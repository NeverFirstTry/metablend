// Builds lib/warnings/regions.json from MeteoAlarm's EMMA_ID region outlines
// (as bundled by the open-source NiklasJordan/meteoalarm package; data ©
// MeteoAlarm / EUMETNET, CC BY 4.0-equivalent terms). Re-run about once a
// year:   node scripts/build-warning-regions.mjs
// Outlines are simplified (Douglas–Peucker, ~0.005° ≈ 400 m) and rounded to
// 4 decimals so the file stays ~2 MB; each region gets a bounding box.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = 'https://raw.githubusercontent.com/NiklasJordan/meteoalarm/HEAD/src/meteoalarm/assets/geocodes.json'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../lib/warnings/regions.json')
const TOL = Number(process.env.TOL ?? 0.005)

const round = v => Math.round(v * 1e4) / 1e4
// perpendicular distance from p to the segment a–b (in degrees; fine at this scale)
function dist(p, a, b) {
  const [x, y] = p, [x1, y1] = a, [x2, y2] = b
  const dx = x2 - x1, dy = y2 - y1
  if (!dx && !dy) return Math.hypot(x - x1, y - y1)
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}
function dp(pts, tol) {
  if (pts.length < 3) return pts
  let max = 0, at = 0
  for (let i = 1; i < pts.length - 1; i++) { const d = dist(pts[i], pts[0], pts.at(-1)); if (d > max) { max = d; at = i } }
  if (max <= tol) return [pts[0], pts.at(-1)]
  return [...dp(pts.slice(0, at + 1), tol).slice(0, -1), ...dp(pts.slice(at), tol)]
}
// a closed ring keeps ≥ 4 points (3 corners + closing point); tiny islands fall back to a finer tolerance
function simplifyRing(ring) {
  for (const tol of [TOL, TOL / 5, 0]) {
    const s = tol ? dp(ring, tol) : ring
    if (s.length >= 4) return s.map(([x, y]) => [round(x), round(y)])
  }
  return null
}

const json = await fetch(SRC).then(r => { if (!r.ok) throw new Error(`${r.status} ${SRC}`); return r.json() })
const regions = []
for (const f of json.features) {
  const code = f.properties?.code
  if (!code || f.properties?.type !== 'EMMA_ID') continue
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : []
  const p = polys.map(rings => rings.map(simplifyRing).filter(Boolean)).filter(rings => rings.length)
  if (!p.length) continue
  const xs = p.flat(2).map(c => c[0]), ys = p.flat(2).map(c => c[1])
  regions.push({ c: code, b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], p })
}
regions.sort((a, b) => a.c.localeCompare(b.c))
const out = JSON.stringify({ v: 1, source: 'MeteoAlarm EMMA_ID geocodes (CC BY 4.0)', built: new Date().toISOString().slice(0, 10), regions })
writeFileSync(OUT, out)
console.log(`${regions.length} regions, ${(out.length / 1048576).toFixed(2)} MB → ${OUT}`)
