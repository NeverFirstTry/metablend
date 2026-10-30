// Step 1 of the summits dataset (README, "Summits, huts and towns"): every
// Geofabrik region (~90 GB together, one at a time) → its named summits,
// volcanoes and huts as data/places/osm/<region>.ndjson. Each extract is
// deleted once filtered; a region already done is skipped, so a broken run
// picks up where it stopped. Needs Python with pyosmium (pip install osmium).
//   node scripts/places/osm.mjs [region …]      (default: the whole world)
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { REGIONS } from '../../lib/places/plan.js'

const DIR = join('data', 'places', 'osm')
mkdirSync(DIR, { recursive: true })
const python = process.platform === 'win32' ? 'python' : 'python3'
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`${cmd} ${args[0]} failed (${r.status})`)
  return r.stdout.trim()
}

for (const region of process.argv.slice(2).length ? process.argv.slice(2) : REGIONS) {
  const out = join(DIR, `${region}.ndjson`)
  if (existsSync(out)) { console.log(`${region}: done before`); continue }
  const pbf = join('data', 'places', `${region}.osm.pbf`)
  const t0 = Date.now()
  run('curl', ['-sfL', '--retry', '3', '-o', pbf, `https://download.geofabrik.de/${region}-latest.osm.pbf`])
  const gb = (statSync(pbf).size / 1e9).toFixed(1)
  const t1 = Date.now()
  const counts = run(python, ['scripts/places/osm_extract.py', pbf, `${out}.part`])
  renameSync(`${out}.part`, out)
  rmSync(pbf)
  console.log(`${region}: ${gb} GB in ${Math.round((t1 - t0) / 1000)} s, filtered in ${Math.round((Date.now() - t1) / 1000)} s → ${counts}`)
}
