// Step 2 of the summits dataset: GeoNames towns (cities with 5 000+ people,
// CC BY 4.0) and the rows for our tables from every region's OpenStreetMap
// lines (step 1, osm.mjs) — data/places/towns.ndjson and summits.ndjson, plus
// what was kept and dropped. Only with every region there (a broken extract
// run must not become a world without Europe), and the old files stay until
// the new ones are complete.
//   node scripts/places/build.mjs
import { spawnSync } from 'node:child_process'
import { createReadStream, createWriteStream, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { finished } from 'node:stream/promises'
import { createInterface } from 'node:readline'
import { join } from 'node:path'
import { osmRow, townRow, townIndex, nearestTown, keepSummit, townAltNames, countryLanguages } from '../../lib/places/rows.js'
import { missingRegions } from '../../lib/places/plan.js'

const DIR = join('data', 'places')
const missing = missingRegions(existsSync(join(DIR, 'osm')) ? readdirSync(join(DIR, 'osm')) : [])
if (missing.length) {
  console.error(`Not built: no OpenStreetMap lines yet for ${missing.join(', ')} — run scripts/places/osm.mjs (it picks up where it stopped).`)
  process.exit(1)
}
// written beside the old file, which it replaces only once complete
const output = name => {
  const stream = createWriteStream(join(DIR, `${name}.part`))
  stream.done = async () => { stream.end(); await finished(stream); renameSync(join(DIR, `${name}.part`), join(DIR, name)) }
  return stream
}
const get = (url, file) => {
  if (existsSync(file)) return
  const r = spawnSync('curl', ['-sfL', '--retry', '3', '-o', file, url], { stdio: 'inherit' })
  if (r.status !== 0) throw new Error(`download failed: ${url}`)
}

// 1. towns
get('https://download.geonames.org/export/dump/cities5000.zip', join(DIR, 'cities5000.zip'))
get('https://download.geonames.org/export/dump/admin1CodesASCII.txt', join(DIR, 'admin1CodesASCII.txt'))
// every name with its language (205 MB), and each country's languages
get('https://download.geonames.org/export/dump/alternateNamesV2.zip', join(DIR, 'alternateNamesV2.zip'))
get('https://download.geonames.org/export/dump/countryInfo.txt', join(DIR, 'countryInfo.txt'))
// Python is needed for step 1 anyway; its zipfile unpacks on every system (Git Bash's tar can't)
const unzip = (zip, want) => {
  if (existsSync(join(DIR, want))) return
  const r = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-m', 'zipfile', '-e', join(DIR, zip), DIR], { stdio: 'inherit' })
  if (r.status !== 0 || !existsSync(join(DIR, want))) throw new Error(`could not unpack ${zip}`)
}
unzip('cities5000.zip', 'cities5000.txt')
unzip('alternateNamesV2.zip', 'alternateNamesV2.txt')
const admin1 = Object.fromEntries(readFileSync(join(DIR, 'admin1CodesASCII.txt'), 'utf8').split('\n').filter(Boolean).map(l => l.split('\t')).map(([k, name]) => [k, name]))
const towns = readFileSync(join(DIR, 'cities5000.txt'), 'utf8').split('\n').filter(Boolean).map(l => townRow(l, admin1)).filter(Boolean)
// their other names from the list with languages, not cities5000's unlabelled
// one (Vienna has hundreds there, and "Wien" wasn't among the first 30)
const langs = countryLanguages(readFileSync(join(DIR, 'countryInfo.txt'), 'utf8'))
const named = new Map(towns.map(t => [String(t.id), []]))
for await (const line of createInterface({ input: createReadStream(join(DIR, 'alternateNamesV2.txt')) })) {
  const c = line.split('\t')
  const list = named.get(c[1])
  if (list && c[3]) list.push({ lang: c[2] ?? '', name: c[3], preferred: c[4] === '1', colloquial: c[6] === '1', historic: c[7] === '1' })
}
for (const t of towns) {
  const alt = townAltNames(named.get(String(t.id)), { name: t.name, countryLangs: langs[t.country] ?? [] })
  t.alt = alt.length ? alt.join(' | ') : null
}
const tw = output('towns.ndjson')
for (const t of towns) tw.write(JSON.stringify(t) + '\n')
await tw.done()
console.log(`towns: ${towns.length} (with other names: ${towns.filter(t => t.alt).length})`)

// 2. summits and huts, each OSM object once (regions overlap at their edges)
const grid = townIndex(towns)
const seen = new Set()
const stats = { lines: 0, peaks: 0, huts: 0, peaksNoEle: 0, dropped: 0, withNames: 0, bytes: 0 }
const out = output('summits.ndjson')
for (const file of readdirSync(join(DIR, 'osm')).filter(f => f.endsWith('.ndjson')).sort()) {
  for await (const line of createInterface({ input: createReadStream(join(DIR, 'osm', file)) })) {
    if (!line) continue
    stats.lines++
    const row = osmRow(JSON.parse(line))
    if (!row || seen.has(row.id)) continue
    seen.add(row.id)
    if (!keepSummit(row)) { stats.dropped++; continue }
    const town = nearestTown(grid, row.lat, row.lon)
    const json = JSON.stringify({ ...row, country: town?.country ?? null, region: town?.region ?? null })
    stats.bytes += json.length + 1
    if (row.kind === 'hut') stats.huts++
    else { stats.peaks++; if (row.ele == null) stats.peaksNoEle++ }
    if (row.names) stats.withNames++
    out.write(json + '\n')
  }
}
await out.done()
console.log(`summits: ${stats.peaks} peaks (${stats.peaksNoEle} without a height, kept for their Wikidata item), ${stats.huts} huts, ${stats.withNames} with names in our languages; dropped ${stats.dropped} named peaks with neither a height nor Wikidata; from ${stats.lines} OSM lines; ${(stats.bytes / 1048576).toFixed(0)} MB of rows`)
// for the refresh issue (scripts/places/report.mjs)
writeFileSync(join(DIR, 'build-summary.json'), JSON.stringify({ towns: towns.length, townsWithOtherNames: towns.filter(t => t.alt).length, ...stats }, null, 1))
