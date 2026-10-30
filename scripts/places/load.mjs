// Step 3 of the summits dataset: data/places/summits.ndjson and towns.ndjson
// (build.mjs) into the database — the dev project (.env.local, or the
// environment in CI), or production after you confirm (scripts/lib/
// production.mjs; on the PC only, never in CI). Rows go in by batch and only
// new or changed ones are written (summits_upsert), so a reload adds little to
// the database; then the rows the new data no longer has are deleted by id —
// unless that's more than a tenth of a table (a short file must never empty
// production; --allow-shrink if it's right). Only then is the load marked
// finished: from then on the API reads our tables (places_ready). A failed run
// changes nothing that a second run won't finish. What it did goes to
// data/places/load-summary.json (for the refresh issue).
//   node scripts/places/load.mjs                               the dev database
//   node scripts/places/load.mjs --production                  production (asks first)
//   node scripts/places/load.mjs --production --run=<id>       …with the data a refresh run built (gh run download)
import { spawnSync } from 'node:child_process'
import { createReadStream, existsSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { confirmProduction } from '../lib/production.mjs'
import { toDelete, shrinkProblem } from '../../lib/places/plan.js'
import { fail, devDatabase } from './env.mjs'

const production = process.argv.includes('--production')
if (production && process.env.CI) fail('The production load runs on the owner\'s PC, never in CI — its keys aren\'t in GitHub.')
const run = process.argv.find(a => a.startsWith('--run='))?.slice(6)
let DATA = join('data', 'places')
if (run) {
  if (!/^\d+$/.test(run)) fail('--run takes the number of a refresh run (its issue names it).')
  DATA = join('data', 'places', `run-${run}`)
  if (!existsSync(join(DATA, 'summits.ndjson'))) {
    console.log(`Downloading the data of refresh run ${run}…`)
    const r = spawnSync('gh', ['run', 'download', run, '-n', 'places-data', '-D', DATA], { stdio: 'inherit' })
    if (r.status !== 0) fail('Could not download it (gh run download) — is gh logged in, and the run younger than 90 days?')
  }
}

const TABLES = ['towns', 'summits']
const file = table => join(DATA, `${table}.ndjson`)
const lines = async function* (table) {
  for await (const line of createInterface({ input: createReadStream(file(table)) })) if (line) yield JSON.parse(line)
}

const sizes = {}
for (const table of TABLES) {
  sizes[table] = 0
  try { for await (const _ of lines(table)) sizes[table]++ } catch { fail(`No ${file(table)} — run scripts/places/build.mjs first.`) }
  if (!sizes[table]) fail(`${file(table)} is empty — run scripts/places/build.mjs again.`)
}
const what = `load ${sizes.summits} summits and huts and ${sizes.towns} towns from ${DATA} (only new or changed rows are written; rows they lack are deleted)`
if (production) {
  await confirmProduction(what)
} else {
  devDatabase()
  console.log(`This will ${what} — in the dev database.`)
}
const allowShrink = process.argv.includes('--allow-shrink')
const { supabase } = await import(pathToFileURL(join(process.cwd(), 'lib/supabase.js')).href)

async function rpc(fn, args) {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await supabase.rpc(fn, args)
    if (!error) return data
    if (attempt === 3) fail(`${fn}: ${error.code} ${error.message} — stopped; run it again to finish.`)
    await new Promise(r => setTimeout(r, 2000 * attempt))
  }
}

const SHAPE = {
  summits: r => ({ id: r.id, kind: r.kind, name: r.name, names: r.names, ele: r.ele, notability: r.notability, wikidata: r.wikidata, country: r.country, region: r.region, lat: r.lat, lon: r.lon }),
  towns: r => ({ id: r.id, name: r.name, alt: r.alt, country: r.country, region: r.region, population: r.population, lat: r.lat, lon: r.lon }),
}
const t0 = Date.now()
const kept = { summits: new Set(), towns: new Set() }
const written = { summits: 0, towns: 0 }
for (const table of TABLES) {
  const t1 = Date.now()
  let batch = [], n = 0
  const send = async () => { written[table] += await rpc(`${table}_upsert`, { batch }); n += batch.length; batch = [] }
  for await (const row of lines(table)) {
    kept[table].add(row.id)
    batch.push(SHAPE[table](row))
    if (batch.length === 2000) { await send(); if (n % 100000 === 0) console.log(`  ${table}: ${n}…`) }
  }
  if (batch.length) await send()
  console.log(`${table}: ${n} rows sent, ${written[table]} new or changed, in ${Math.round((Date.now() - t1) / 1000)} s`)
}

// the rows the new data no longer has — unless that's too many
const gone = {}
for (const table of TABLES) {
  const current = []
  for (let after = null; ;) {
    const page = await rpc(`${table}_ids`, { after, n: 50000 })
    if (!page.length) break
    for (const id of page) current.push(id)
    after = page.at(-1)
  }
  gone[table] = toDelete(current, kept[table])
  const problem = shrinkProblem({ table, current: current.length, deleting: gone[table].length, allowShrink })
  if (problem) fail(problem)
}
for (let i = 0; i < Math.max(gone.summits.length, gone.towns.length); i += 5000) {
  await rpc('places_delete', { summit_ids: gone.summits.slice(i, i + 5000), town_ids: gone.towns.slice(i, i + 5000) })
}
console.log(`deleted: ${gone.summits.length} summits and huts, ${gone.towns.length} towns the new data no longer has`)

await rpc('places_analyze')
await rpc('places_mark_loaded', { rows_written: written.summits + written.towns, rows_deleted: gone.summits.length + gone.towns.length })
console.log('load finished — the API reads these tables from now on (each server within 10 minutes)')
const size = (await rpc('places_size')) ?? []
for (const s of size) console.log(`  ${s.relation}: ${s.row_count ?? ''} ${s.total_mb} MB`)
writeFileSync(join('data', 'places', 'load-summary.json'), JSON.stringify({
  production, seconds: Math.round((Date.now() - t0) / 1000), sent: sizes, written,
  deleted: { summits: gone.summits.length, towns: gone.towns.length }, size,
}, null, 1))
