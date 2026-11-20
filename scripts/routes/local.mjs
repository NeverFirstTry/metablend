// Route lists and route heights for featured peaks, worked out on this machine: no request to the
// OpenStreetMap API and none to Open-Meteo. The routes are read from Geofabrik extracts (one download per
// region, one at a time, deleted after reading unless --keep), the heights from Copernicus GLO-90 tiles
// (scripts/routes/tile_heights.py), and the site's own code makes the rows: findRoutes (lib/route/find.js)
// with its two requests answered from a file, routeHeights (lib/route/height-store.js) with the tiles as
// its terrain model. Writes one file per peak to <work>/out/ and stores nothing in any database.
//   node scripts/routes/local.mjs --work=<dir> --have=<file: the route_cache keys there are, ';' or lines>
//     [--peaks=<id,…>: these peaks whether they have a list or not] [--only=<extract id,…>] [--plan]
//     [--python=<python with osmium and rasterio>] [--reading=between|cell|shifted] [--keep]
// Needs Python with pyosmium and rasterio (pip install osmium==4.3.2 rasterio) and curl.
import { spawn, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parsePeakQuery } from '../../lib/hike/params.js'
import { findRoutes, listedRoutes } from '../../lib/route/find.js'
import { routeHeights, LIVE_MAX_KM } from '../../lib/route/height-store.js'
import { extractFor, fileJson, memoryStore, peakKey } from '../../lib/route/local.js'

const arg = name => process.argv.slice(2).find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const flag = name => process.argv.includes(`--${name}`)
const WORK = arg('work')
if (!WORK) { console.error('--work=<dir> is required'); process.exit(2) }
const PYTHON = arg('python') ?? (process.platform === 'win32' ? 'python' : 'python3')
const AGENT = 'MetaBlend/1.0 (https://metablend.app; info@metablend.app)'
const dirs = { pbf: join(WORK, 'pbf'), osm: join(WORK, 'osm'), out: join(WORK, 'out'), tiles: join(WORK, 'dem90') }
for (const d of Object.values(dirs)) mkdirSync(d, { recursive: true })
const pause = ms => new Promise(r => setTimeout(r, ms))
const curl = (url, to) => spawnSync('curl', ['-sSfL', '--retry', '3', '-A', AGENT, '-o', `${to}.part`, url], { stdio: 'inherit' }).status === 0 && (renameSync(`${to}.part`, to), true)

// the peaks: as the site's routes request names them (three decimals, whole metres)
const featured = JSON.parse(readFileSync(new URL('../../lib/hike/featured.json', import.meta.url), 'utf8')).filter(p => p.kind !== 'hut')
const asked = p => ({ ...parsePeakQuery(new URLSearchParams({ lat: p.lat, lon: p.lon, elev: Math.round(p.elev) })), id: p.id, name: p.name, region: p.region })
const named = arg('peaks')?.split(',')
const have = new Set(arg('have') ? readFileSync(arg('have'), 'utf8').split(/[;\s]+/).filter(Boolean) : [])
const peaks = featured.map(asked).filter(p => (named ? named.includes(p.id) : !have.has(peakKey(p))))

// which extract each is read from
const INDEX = join(WORK, 'geofabrik-index.json')
if (!existsSync(INDEX) && !curl('https://download.geofabrik.de/index-v1.json', INDEX)) { console.error('Geofabrik\'s index could not be read'); process.exit(1) }
const features = JSON.parse(readFileSync(INDEX, 'utf8')).features
const plan = new Map(), nowhere = []
for (const p of peaks) {
  const e = extractFor(features, p)
  if (!e) { nowhere.push(p.id); continue }
  if (!plan.has(e.id)) plan.set(e.id, { ...e, peaks: [] })
  plan.get(e.id).peaks.push(p)
}
const only = arg('only')?.split(',')
const todo = [...plan.values()].filter(e => !only || only.includes(e.id)).sort((a, b) => b.peaks.length - a.peaks.length)
console.log(`${peaks.length} peaks in ${plan.size} extracts${nowhere.length ? `; in no extract: ${nowhere.join(', ')}` : ''}`)
for (const e of todo) console.log(`  ${e.id}: ${e.peaks.length} (${e.peaks.map(p => p.id).join(', ')})`)
if (flag('plan')) process.exit(0)

// the terrain model: one Python process, a line of points in, a line of heights out
const tiles = spawn(PYTHON, ['-I', 'scripts/routes/tile_heights.py', dirs.tiles, arg('reading') ?? 'between'], { stdio: ['pipe', 'pipe', 'inherit'] })
const answers = createInterface({ input: tiles.stdout })[Symbol.asyncIterator]()
const getElevations = async points => {
  tiles.stdin.write(`${JSON.stringify(points.map(p => [p.lat, p.lon]))}\n`)
  const { value, done } = await answers.next()
  return done ? null : JSON.parse(value)
}

const run = (cmd, args) => new Promise(resolve => {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'] })
  let out = ''
  child.stdout.on('data', chunk => { out += chunk })
  child.on('close', code => resolve({ ok: code === 0, out: out.trim() }))
})
const pbfOf = e => join(dirs.pbf, `${e.id.replaceAll('/', '_')}.osm.pbf`)
const unread = e => e.peaks.filter(p => !existsSync(join(dirs.osm, `${p.id}.json`)))
// One download at a time, with a breath between. The next extract is fetched while this one is read: it
// is only asked for once this one's download has ended.
const fetched = new Map()
let downloads = 0
const fetchExtract = e => {
  if (!fetched.has(e.id)) fetched.set(e.id, !unread(e).length || existsSync(pbfOf(e)) ? Promise.resolve(true) : (async () => {
    if (downloads++) await pause(5000)
    console.log(`${e.id}: downloading ${e.url}`)
    const got = (await run('curl', ['-sSfL', '--retry', '3', '-A', AGENT, '-o', `${pbfOf(e)}.part`, e.url])).ok
    if (got) renameSync(`${pbfOf(e)}.part`, pbfOf(e))
    return got
  })())
  return fetched.get(e.id)
}

const tally = { peaks: 0, withRoutes: 0, routes: 0, listed: 0, withHeights: 0, heightRows: 0, cut: 0 }
for (const [i, e] of todo.entries()) {
  // a refusal is not answered with the next file: the run stops here and says so
  if (!await fetchExtract(e)) { console.error(`${e.id}: the download failed. Stopped; what is done stays in ${dirs.out}, the same command goes on from here.`); process.exitCode = 1; break }
  if (todo[i + 1]) void fetchExtract(todo[i + 1])
  const waiting = unread(e)
  if (waiting.length) {
    const list = join(dirs.osm, `${e.id.replaceAll('/', '_')}.summits.json`)
    writeFileSync(list, JSON.stringify(waiting.map(({ id, lat, lon }) => ({ id, lat, lon }))))
    const t0 = Date.now()
    const read = await run(PYTHON, ['-I', 'scripts/routes/osm_routes.py', pbfOf(e), list, dirs.osm])
    rmSync(list)
    if (!read.ok) { console.error(`${e.id}: reading the extract failed, its peaks are left out`); continue }
    console.log(`${e.id}: read in ${Math.round((Date.now() - t0) / 1000)} s ${read.out}`)
  }
  if (!flag('keep')) rmSync(pbfOf(e), { force: true })
  for (const p of e.peaks) {
    const file = JSON.parse(readFileSync(join(dirs.osm, `${p.id}.json`), 'utf8'))
    const store = memoryStore()
    const found = await findRoutes(p, { getJson: fileJson(file), heightsFor: (id, points) => routeHeights(id, points, { db: store.db, getElevations, wait: async () => {} }) })
    // a route the extract holds only in part is not stored: the live lookup reads it whole
    const cut = found.routes.filter(r => file.cut[r.id])
    const routes = found.routes.filter(r => !file.cut[r.id])
    const heights = store.rows.filter(h => routes.some(r => r.id === h.route_id))
    writeFileSync(join(dirs.out, `${p.id}.json`), JSON.stringify({ peak: p, peak_key: peakKey(p), extract: e.id, complete: found.complete && !cut.length, routes, heights, cut: cut.map(r => r.id) }))
    const listed = listedRoutes(routes, LIVE_MAX_KM)
    tally.peaks++; tally.routes += routes.length; tally.listed += listed.length; tally.cut += cut.length; tally.heightRows += heights.length
    tally.withRoutes += routes.length ? 1 : 0; tally.withHeights += routes.filter(r => r.heights).length
    console.log(`  ${p.id}: ${routes.length} routes (${listed.length} listed, ${routes.filter(r => r.heights).length} with heights)${cut.length ? `, ${cut.length} cut at the extract's edge and left out` : ''}`)
  }
}
tiles.stdin.end()
console.log(`${tally.peaks} peaks: ${tally.withRoutes} with a marked route, ${tally.routes} routes (${tally.listed} listed, ${tally.withHeights} with heights), ${tally.heightRows} rows of heights, ${tally.cut} routes left out because the extract cuts them`)
