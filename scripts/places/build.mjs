// Step 2 of the summits dataset: GeoNames towns (places with 5 000+ people everywhere, with 500+ in
// the five countries the place search knows closely, and every populated place of Austria; CC BY 4.0),
// the regions' names in our languages (lib/places/region-names.json, a file of the repo: commit it when
// it changes), and the rows for our tables from every region's OpenStreetMap
// lines (step 1, osm.mjs) — data/places/towns.ndjson and summits.ndjson, plus
// what was kept and dropped. Only with every region there (a broken extract
// run must not become a world without Europe), and the old files stay until
// the new ones are complete.
// A summit's country is the one its position lies in: we follow OpenStreetMap's country boundaries (step
// 1b, boundaries.py, hands over the outlines; lib/places/areas.js looks a position up in them and has the
// rule for disputed areas). Its region is the one of the nearest town of that country.
//   node scripts/places/build.mjs            towns and summits
//   node scripts/places/build.mjs --towns    the towns alone (needs no OpenStreetMap lines)
//   node scripts/places/build.mjs --refile   the summits of data/places/summits.ndjson (a run's data) filed again:
//                                            country and region anew, without downloading OpenStreetMap again
import { spawnSync } from 'node:child_process'
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { finished } from 'node:stream/promises'
import { createInterface } from 'node:readline'
import { join } from 'node:path'
import { osmRow, townRow, townIndex, summitPlace, keepSummit, keepLean, LEAN, townAltNames, townNames, countryLanguages, SMALL_TOWN_COUNTRIES, EVERY_PLACE_COUNTRIES, isPlace } from '../../lib/places/rows.js'
import { missingRegions, areasProblem, outlinesAgeDays } from '../../lib/places/plan.js'
import { countryLookup } from '../../lib/places/areas.js'

const DIR = join('data', 'places')
const TOWNS_ONLY = process.argv.includes('--towns')
const REFILE = process.argv.includes('--refile')
const missing = TOWNS_ONLY || REFILE ? [] : missingRegions(existsSync(join(DIR, 'osm')) ? readdirSync(join(DIR, 'osm')) : [])
if (missing.length) {
  console.error(`Not built: no OpenStreetMap lines yet for ${missing.join(', ')} — run scripts/places/osm.mjs (it picks up where it stopped).`)
  process.exit(1)
}
const read = name => (existsSync(join(DIR, name)) ? JSON.parse(readFileSync(join(DIR, name), 'utf8')) : null)
const areas = TOWNS_ONLY ? null : read('boundaries-summary.json')
if (!TOWNS_ONLY && areasProblem(areas)) {
  console.error(`Not built: ${areasProblem(areas)}.`)
  process.exit(1)
}
if (REFILE && !existsSync(join(DIR, 'summits.ndjson'))) {
  console.error('Not built: --refile needs data/places/summits.ndjson, the summits of a refresh run (gh run download <run> -n places-data).')
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
if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
get('https://download.geonames.org/export/dump/cities5000.zip', join(DIR, 'cities5000.zip'))
// places from 500 people: only those of the five countries are taken (lib/places/rows.js)
get('https://download.geonames.org/export/dump/cities500.zip', join(DIR, 'cities500.zip'))
// every populated place of a few countries: the country's own file
for (const cc of EVERY_PLACE_COUNTRIES) get(`https://download.geonames.org/export/dump/${cc}.zip`, join(DIR, `${cc}.zip`))
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
unzip('cities500.zip', 'cities500.txt')
unzip('alternateNamesV2.zip', 'alternateNamesV2.txt')
for (const cc of EVERY_PLACE_COUNTRIES) unzip(`${cc}.zip`, `${cc}.txt`)
// a region: its code (AT.07), its English name as the towns carry it, and its GeoNames id for its other names
const regions = readFileSync(join(DIR, 'admin1CodesASCII.txt'), 'utf8').split('\n').filter(Boolean).map(l => l.split('\t')).map(([code, name, , id]) => ({ code, name, id }))
const admin1 = Object.fromEntries(regions.map(r => [r.code, r.name]))
const rowsOf = (file, keep = () => true) => readFileSync(join(DIR, file), 'utf8').split('\n').filter(l => l && keep(l)).map(l => townRow(l, admin1)).filter(Boolean)
const big = rowsOf('cities5000.txt'), have = new Set(big.map(t => t.id))
const add = rows => rows.filter(t => !have.has(t.id) && have.add(t.id)) // each place once, from the first file that has it
const small = add(rowsOf('cities500.txt').filter(t => SMALL_TOWN_COUNTRIES.includes(t.country)))
const every = add(EVERY_PLACE_COUNTRIES.flatMap(cc => rowsOf(`${cc}.txt`, isPlace)))
const towns = [...big, ...small, ...every]
// their other names from the list with languages, not cities5000's unlabelled
// one (Vienna has hundreds there, and "Wien" wasn't among the first 30)
const langs = countryLanguages(readFileSync(join(DIR, 'countryInfo.txt'), 'utf8'))
const named = new Map(towns.map(t => [String(t.id), []]))
const regionNamed = new Map(regions.map(r => [r.id, []]))
for await (const line of createInterface({ input: createReadStream(join(DIR, 'alternateNamesV2.txt')) })) {
  const c = line.split('\t')
  const list = named.get(c[1]) ?? regionNamed.get(c[1])
  if (list && c[3]) list.push({ lang: c[2] ?? '', name: c[3], preferred: c[4] === '1', short: c[5] === '1', colloquial: c[6] === '1', historic: c[7] === '1' })
}
for (const t of towns) {
  t.names = townNames(named.get(String(t.id)), t.name)
  // a name the search box shows must find the town again: those first, before the list is cut at 30
  const alt = townAltNames(named.get(String(t.id)), { name: t.name, countryLangs: langs[t.country] ?? [], first: Object.values(t.names ?? {}) })
  t.alt = alt.length ? alt.join(' | ') : null
}
const tw = output('towns.ndjson')
for (const t of towns) tw.write(JSON.stringify(t) + '\n')
await tw.done()
// The regions' names in our languages, where they differ from the English one the towns carry ("AT|Tyrol":
// de Tirol): what a suggestion shows a reader (lib/places/regions.js). Only names GeoNames marks as preferred or
// short (owner, 2026-11-13): an unmarked one can be the name of a part of the region (Trentino-Alto Adige in
// Dutch was its entry for South Tyrol). One region a line, sorted.
const regionNames = regions.map(r => [`${r.code.split('.')[0]}|${r.name}`, townNames((regionNamed.get(r.id) ?? []).filter(e => e.preferred || e.short), r.name, { shortFirst: true })]).filter(([, names]) => names).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
writeFileSync(join('lib', 'places', 'region-names.json'), `{\n${regionNames.map(([key, names]) => `${JSON.stringify(key)}: ${JSON.stringify(names)}`).join(',\n')}\n}\n`)
console.log(`regions: ${regions.length}, ${regionNames.length} with a name in another of our languages`)
console.log(`towns: ${towns.length} (${small.length} of them places under 5 000 people in ${SMALL_TOWN_COUNTRIES.join(', ')}, ${every.length} more the remaining places of ${EVERY_PLACE_COUNTRIES.join(', ')}; with other names: ${towns.filter(t => t.alt).length}; with a name in another of our languages: ${towns.filter(t => t.names).length})`)
if (TOWNS_ONLY) process.exit(0)

// 2. summits and huts, each OSM object once (regions overlap at their edges)
const grid = townIndex(towns)
const outlines = []
for await (const line of createInterface({ input: createReadStream(join(DIR, 'boundaries.ndjson')) })) if (line) { const a = JSON.parse(line); outlines.push({ ...a, geometry: typeof a.geometry === 'string' ? JSON.parse(a.geometry) : a.geometry }) }
const where = countryLookup(outlines)
outlines.length = 0
const seen = new Set()
const stats = { lines: 0, peaks: 0, huts: 0, peaksNoEle: 0, dropped: 0, droppedLean: 0, withNames: 0, bytes: 0, inArea: 0, noArea: 0, disputed: 0, outlines: areas.release, outlinesAge: outlinesAgeDays(areas.release) }
const out = output('summits.ndjson')
// --refile: the rows a run built, read from the file this build replaces once it is complete
const sources = REFILE ? [join(DIR, 'summits.ndjson')] : readdirSync(join(DIR, 'osm')).filter(f => f.endsWith('.ndjson')).sort().map(f => join(DIR, 'osm', f))
for (const file of sources) {
  for await (const line of createInterface({ input: createReadStream(file) })) {
    if (!line) continue
    stats.lines++
    const row = REFILE ? JSON.parse(line) : osmRow(JSON.parse(line))
    if (!row || seen.has(row.id)) continue
    seen.add(row.id)
    if (!keepSummit(row)) { stats.dropped++; continue }
    const { country, region, inArea, disputed } = summitPlace(grid, row, where)
    // the emergency rule (off unless LEAN, lib/places/rows.js) needs the country, so it comes after it
    if (LEAN && !keepLean({ ...row, country })) { stats.droppedLean++; continue }
    const json = JSON.stringify({ ...row, country, region })
    stats.bytes += json.length + 1
    if (disputed) stats.disputed++
    else if (inArea) stats.inArea++
    else stats.noArea++
    if (row.kind === 'hut') stats.huts++
    else { stats.peaks++; if (row.ele == null) stats.peaksNoEle++ }
    if (row.names) stats.withNames++
    out.write(json + '\n')
  }
}
await out.done()
console.log(`summits: ${stats.peaks} peaks (${stats.peaksNoEle} without a height, kept for their Wikidata item), ${stats.huts} huts, ${stats.withNames} with names in our languages; dropped ${stats.dropped} named peaks with neither a height nor Wikidata${LEAN ? ` and ${stats.droppedLean} unmarked peaks outside the seven countries (the lean rule)` : ''}; from ${stats.lines} ${REFILE ? 'rows filed again' : 'OSM lines'}; ${(stats.bytes / 1048576).toFixed(0)} MB of rows`)
console.log(`country: ${stats.inArea} from the outline the summit lies in (OpenStreetMap's boundaries, release ${stats.outlines}), ${stats.disputed} in a disputed area (no country, no region), ${stats.noArea} from the nearest town (in no outline)`)
// for the refresh issue (scripts/places/report.mjs)
writeFileSync(join(DIR, 'build-summary.json'), JSON.stringify({ towns: towns.length, townsWithOtherNames: towns.filter(t => t.alt).length, ...stats }, null, 1))
