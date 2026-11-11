// Fills place_climate (lib/climate-store.js) ahead of the move to an Open-Meteo plan without the
// archive host: afterwards a place without a table can only borrow a neighbour's. One 10-year request
// per place, about 104 Open-Meteo calls each.
//
//   node scripts/climate-prefill.mjs --set=A                       what would be asked (dev database, .env.local)
//   node scripts/climate-prefill.mjs --set=A --run                 fill the dev database
//   node scripts/climate-prefill.mjs --set=A --production --run    fill production (asks for the project ref first)
//   node scripts/climate-prefill.mjs --set=B --production --run --max=500 --pace=1500
//
// Sets: A = the sitemap's cities and the places asked lately (outlook snapshots, forecasts);
//       B = A and every town from --min-pop people (default 100000).
// Rate-limited: --pace milliseconds between requests (default 3000), --max places per run (default 80,
// about 8,350 calls). Resumable: a place whose table is kept and current is skipped, so the next run
// goes on where this one stopped; three failures in a row end the run (Open-Meteo is refusing).
// Counted: every request goes through loadClimate, so it lands in open_meteo_calls (kind climate) of
// the database being filled. Without --run nothing is asked and nothing is written.
import { existsSync, readFileSync } from 'node:fs'
import { confirmProduction, parseEnv } from './lib/production.mjs'

const arg = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
const has = name => process.argv.includes(`--${name}`)
const SET = String(arg('set', '')).toUpperCase()
if (!['A', 'B'].includes(SET)) { console.error('Say which places: --set=A (cities and places asked lately) or --set=B (A and the larger towns).'); process.exit(1) }
const MAX = Math.max(1, Number(arg('max', 80))), PACE = Math.max(500, Number(arg('pace', 3000))), MIN_POP = Math.max(1000, Number(arg('min-pop', 100000)))
const RUN = has('run'), PRODUCTION = has('production')
const CALLS = 104.37 // one request, by Open-Meteo's calculator (lib/climate-store.test.js)

if (PRODUCTION && process.env.CI) { console.error('The production fill runs on the owner\'s PC, never in CI.'); process.exit(1) }
if (PRODUCTION && RUN) await confirmProduction(`ask Open-Meteo for up to ${MAX} places' climate (about ${Math.round(MAX * CALLS)} calls) and write them into place_climate`)
else if (PRODUCTION) (await import('./lib/production.mjs')).loadProduction()
else if (existsSync('.env.local')) Object.assign(process.env, parseEnv(readFileSync('.env.local', 'utf8')))
else { console.error('No .env.local here: run from the project folder, or pass --production.'); process.exit(1) }

// only now: lib/supabase.js reads the database's address when it loads
const { supabase: db } = await import('../lib/supabase.js')
const { loadClimate, climateKey } = await import('../lib/climate-store.js')
const { TABLE_VERSION } = await import('../lib/outlook/climate.js')
const { geocodeCity } = await import('../lib/geocode.js')
const { CITIES } = await import('../lib/cities.js')

// every row of a select, a thousand at a time (the API's page size)
async function all(table, columns, filter = q => q) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(db.from(table).select(columns)).range(from, from + 999)
    if (error) { console.log(`  ${table}: ${error.message} (left out)`); break }
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows
}

const places = new Map() // key → { lat, lon, from }
const add = (lat, lon, from) => { if (Number.isFinite(lat) && Number.isFinite(lon)) { const key = climateKey(lat, lon); if (!places.has(key)) places.set(key, { lat, lon, from }) } }

for (const c of CITIES) {
  const geo = await geocodeCity(c.name, 'en', null, { log: () => {} }).catch(() => null)
  if (geo) add(geo.lat, geo.lon, `city ${c.name}`); else console.log(`  ${c.name}: not found (left out)`)
}
const cities = places.size
for (const r of await all('outlook_snapshots', 'lat, lon')) add(r.lat, r.lon, 'asked lately')
for (const r of await all('forecasts', 'lat, lon')) add(r.lat, r.lon, 'asked lately')
const asked = places.size - cities
if (SET === 'B') for (const r of await all('towns', 'lat, lon, population', q => q.gte('population', MIN_POP).order('population', { ascending: false }))) add(r.lat, r.lon, 'town')
const towns = places.size - cities - asked

const yearAgo = Date.now() - 365 * 86_400_000
const kept = new Set((await all('place_climate', 'key, fetched_at, v:data->v')).filter(r => r.v === TABLE_VERSION && Date.parse(r.fetched_at) > yearAgo).map(r => r.key))
const todo = [...places].filter(([key]) => !kept.has(key))
const now = todo.slice(0, MAX)
console.log(`Set ${SET}, ${PRODUCTION ? 'PRODUCTION' : 'dev'} database: ${places.size} places (${cities} sitemap cities, ${asked} asked lately${SET === 'B' ? `, ${towns} towns from ${MIN_POP} people` : ''}).`)
console.log(`${places.size - todo.length} have a current table, ${todo.length} are missing: about ${Math.round(todo.length * CALLS)} Open-Meteo calls and ${(todo.length * 2.4 / 1024).toFixed(1)} MB in all.`)
console.log(`This run: ${now.length} places, about ${Math.round(now.length * CALLS)} calls, ${Math.round(now.length * PACE / 60000)} minutes at ${PACE} ms apart; ${Math.ceil(todo.length / MAX)} runs of ${MAX} to finish.`)
if (!RUN) { console.log('No climate request sent, nothing written (add --run).'); process.exit(0) }

let done = 0, failed = 0, streak = 0
for (const [key, p] of now) {
  const table = await loadClimate(p.lat, p.lon).catch(() => null)
  // loadClimate may hand back a neighbour's table when the archive gave nothing: only the place's own, just kept, counts
  const own = table?.v === TABLE_VERSION && (await db.from('place_climate').select('key').eq('key', key).limit(1)).data?.length === 1
  if (own) { done++; streak = 0 } else { failed++; streak++; console.log(`  ${key} (${p.from}): nothing kept`) }
  if (streak >= 3) { console.log('Three in a row gave nothing: stopping. Run again later; what is kept stays.'); break }
  if ((done + failed) % 20 === 0) console.log(`  ${done + failed} of ${now.length} asked, ${done} kept`)
  await new Promise(r => setTimeout(r, PACE))
}
console.log(`Done: ${done} kept, ${failed} without an answer, about ${Math.round((done + failed) * CALLS)} calls counted under "climate". ${todo.length - done} places are still missing.`)
