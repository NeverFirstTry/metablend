// Step 1 of the summits dataset (README, "Summits, huts and towns"): every
// Geofabrik region → its named summits, volcanoes and huts as
// data/places/osm/<region>.ndjson. Each extract is streamed through pyosmium
// (osm_extract.py), never stored — so it runs on a free CI runner's 14 GB
// disk (Europe alone is 31 GB): once for the summits and huts, and once more,
// up to the end of its nodes, for the corners of huts mapped as buildings.
// A region done is skipped, so a broken run picks up where it stopped; how
// each went is in data/places/osm-summary.json. Needs Python with pyosmium
// (pip install osmium) and curl.
//   node scripts/places/osm.mjs [region …] [--dir=data/places/osm]
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { REGIONS, streamComplete } from '../../lib/places/plan.js'

const args = process.argv.slice(2)
const DIR = args.find(a => a.startsWith('--dir='))?.slice(6) ?? join('data', 'places', 'osm')
const regions = args.filter(a => !a.startsWith('--'))
mkdirSync(DIR, { recursive: true })
const SUMMARY = join(dirname(DIR), 'osm-summary.json')
const summary = existsSync(SUMMARY) ? JSON.parse(readFileSync(SUMMARY, 'utf8')) : {}
const python = process.platform === 'win32' ? 'python' : 'python3'

// curl's download piped into one pass of osm_extract.py; the pass's result,
// the bytes streamed and the file's Last-Modified
function pass(url, mode, files) {
  return new Promise((resolve, reject) => {
    const headers = `${files[0]}.headers`
    const curl = spawn('curl', ['-sfL', '--retry', '3', '-D', headers, url], { stdio: ['ignore', 'pipe', 'inherit'] })
    const py = spawn(python, ['scripts/places/osm_extract.py', mode, '-', ...files], { stdio: ['pipe', 'pipe', 'inherit'] })
    let bytes = 0, out = '', curlCode, pyCode
    curl.stdout.on('data', chunk => { bytes += chunk.length })
    curl.stdout.pipe(py.stdin)
    py.stdin.on('error', () => {}) // pass 2 stops reading before the end
    py.stdout.on('data', chunk => { out += chunk })
    const done = () => {
      if (curlCode === undefined || pyCode === undefined) return
      const modified = existsSync(headers) ? readFileSync(headers, 'utf8').match(/^last-modified:\s*(.+?)\s*$/im)?.[1] ?? null : null
      rmSync(headers, { force: true })
      if (pyCode !== 0) return reject(new Error(`osm_extract ${mode} failed (${pyCode})`))
      const result = JSON.parse(out.trim().split('\n').pop())
      if (!streamComplete(mode, curlCode, result)) return reject(new Error(`download broke off (curl ${curlCode})`))
      resolve({ result, bytes, modified })
    }
    curl.on('close', code => { curlCode = code; done() })
    py.on('close', code => {
      pyCode = code
      if (mode === 'way-nodes' && curlCode === undefined) curl.kill() // pass 2 is through: stop the download
      done()
    })
  })
}

async function region(name) {
  const url = `https://download.geofabrik.de/${name}-latest.osm.pbf`
  const out = join(DIR, `${name}.ndjson`), part = `${out}.part`, ways = join(DIR, `${name}.ways.json`)
  const t0 = Date.now()
  const one = await pass(url, 'named', [part, ways])
  const two = one.result.ways ? await pass(url, 'way-nodes', [ways, part]) : null
  renameSync(part, out)
  rmSync(ways, { force: true })
  return {
    fileMb: Math.round(one.bytes / 1e6), secondPassMb: Math.round((two?.bytes ?? 0) / 1e6), seconds: Math.round((Date.now() - t0) / 1000),
    points: one.result.nodes, ways: two?.result.ways ?? 0, missingNodes: two?.result.missing_nodes ?? 0,
    // Geofabrik publishes a new file daily: if it did between the passes, a few hut corners may come from the newer one
    changedBetweenPasses: !!two && one.modified !== two.modified,
  }
}

for (const name of regions.length ? regions : REGIONS) {
  if (existsSync(join(DIR, `${name}.ndjson`))) { console.log(`${name}: done before`); continue }
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await region(name)
      summary[name] = r
      writeFileSync(SUMMARY, JSON.stringify(summary, null, 1))
      console.log(`${name}: ${r.fileMb} MB file + ${r.secondPassMb} MB again for the hut corners, in ${r.seconds} s → ${r.points} points, ${r.ways} huts mapped as ways${r.missingNodes ? ` (${r.missingNodes} corner nodes missing)` : ''}${r.changedBetweenPasses ? ' — file changed between the passes' : ''}`)
      break
    } catch (e) {
      console.error(`${name}: ${e.message}${attempt < 3 ? ' — trying again' : ''}`)
      if (attempt === 3) process.exit(1)
      await new Promise(r => setTimeout(r, 30000 * attempt))
    }
  }
}
