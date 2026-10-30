// Step 3 of the summits dataset: data/places/summits.ndjson and towns.ndjson
// (build.mjs) into the database — the dev project from .env.local, or
// production after you confirm (scripts/lib/production.mjs). Every row of a
// load carries its start time; only once all of it is in are rows of older
// loads dropped, so a broken load never leaves gaps.
//   node scripts/places/load.mjs                 the dev database
//   node scripts/places/load.mjs --production    production (asks first)
import { createReadStream, readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { confirmProduction, parseEnv } from '../lib/production.mjs'
import { isProductionUrl } from '../../lib/db-target.js'

if (process.argv.includes('--production')) {
  await confirmProduction('replace the summits, huts and towns tables with data/places/summits.ndjson and towns.ndjson')
} else {
  Object.assign(process.env, parseEnv(readFileSync('.env.local', 'utf8')))
  if (isProductionUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) { console.error('.env.local points at production — use --production for that.'); process.exit(1) }
}
const { supabase } = await import(pathToFileURL(join(process.cwd(), 'lib/supabase.js')).href)

const started = new Date().toISOString()
const point = r => `SRID=4326;POINT(${r.lon} ${r.lat})`
const SHAPE = {
  summits: r => ({ id: r.id, kind: r.kind, name: r.name, names: r.names, ele: r.ele, notability: r.notability, wikidata: r.wikidata, country: r.country, region: r.region, geog: point(r), loaded_at: started }),
  towns: r => ({ id: r.id, name: r.name, alt: r.alt, country: r.country, region: r.region, population: r.population, geog: point(r), loaded_at: started }),
}

async function put(table, rows) {
  for (let attempt = 1; ; attempt++) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' })
    if (!error) return
    if (attempt === 3) throw new Error(`${table}: ${error.code} ${error.message}`)
    await new Promise(r => setTimeout(r, 2000 * attempt))
  }
}

for (const table of ['towns', 'summits']) {
  const t0 = Date.now()
  let batch = [], n = 0
  for await (const line of createInterface({ input: createReadStream(join('data', 'places', `${table}.ndjson`)) })) {
    if (!line) continue
    batch.push(SHAPE[table](JSON.parse(line)))
    if (batch.length === 2000) { await put(table, batch); n += batch.length; batch = []; if (n % 100000 === 0) console.log(`  ${table}: ${n}…`) }
  }
  if (batch.length) { await put(table, batch); n += batch.length }
  console.log(`${table}: ${n} rows in ${Math.round((Date.now() - t0) / 1000)} s`)
}
// older loads' rows out, 20 000 at a time (each call within the API's time limit)
const dropped = { summits: 0, towns: 0 }
for (;;) {
  const { data, error } = await supabase.rpc('places_prune', { before: started, max_rows: 20000 })
  if (error) { console.log('older rows: could not drop —', error.message); break }
  const s = Number(data[0].summits), t = Number(data[0].towns)
  dropped.summits += s
  dropped.towns += t
  if (!s && !t) break
}
console.log('older rows dropped:', JSON.stringify(dropped))
const analyzed = await supabase.rpc('places_analyze')
console.log('planner statistics:', analyzed.error ? analyzed.error.message : 'fresh')
const size = await supabase.rpc('places_size')
for (const s of size.data ?? []) console.log(`  ${s.relation}: ${s.row_count ?? ''} ${s.total_mb} MB`)
