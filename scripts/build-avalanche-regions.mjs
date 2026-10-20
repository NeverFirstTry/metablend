// Builds lib/avalanche/regions.json from the EAWS avalanche micro-regions
// (gitlab.com/eaws/eaws-regions, CC0) — the areas every European avalanche
// warning service rates. Only regions in use (no end_date); outlines
// simplified (~200 m) and rounded, each with a bounding box — the same
// { c, b, p } shape as the warning region map. Re-run before each winter:
//   node scripts/build-avalanche-regions.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { simplifyRing, bboxOf } from '../lib/geometry.js'

const API = 'https://gitlab.com/api/v4/projects/eaws%2Feaws-regions/repository/tree?path=public/micro-regions&per_page=100'
const RAW = name => `https://gitlab.com/eaws/eaws-regions/-/raw/master/public/micro-regions/${name}`
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../lib/avalanche/regions.json')
const TOL = Number(process.env.TOL ?? 0.002)
const today = new Date().toISOString().slice(0, 10)

const files = (await fetch(API).then(r => r.json())).map(f => f.name).filter(n => n.endsWith('_micro-regions.geojson.json'))
const regions = []
for (const name of files) {
  const json = await fetch(RAW(name)).then(r => { if (!r.ok) throw new Error(`${r.status} ${name}`); return r.json() })
  for (const f of json.features ?? []) {
    const { id, end_date: end } = f.properties ?? {}
    if (!id || (end && end <= today)) continue
    const polys = f.geometry?.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates : []
    const p = polys.map(rings => rings.map(r => simplifyRing(r, TOL)).filter(Boolean)).filter(rings => rings.length)
    if (!p.length) continue
    regions.push({ c: id, b: bboxOf(p.flat()), p })
  }
}
regions.sort((a, b) => a.c.localeCompare(b.c))
const out = JSON.stringify({ v: 1, source: 'EAWS micro-regions (CC0)', built: today, regions })
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, out)
console.log(`${files.length} files, ${regions.length} regions, ${(out.length / 1048576).toFixed(2)} MB → ${OUT}`)
