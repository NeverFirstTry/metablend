// Warning outlines (pure — unit tested): some MeteoAlarm countries draw each
// warning's area as CAP polygons ("lat,lon lat,lon …") instead of naming
// regions. Rings are [[lon, lat], …], simplified to ~500 m and rounded to 4
// decimals so a country's warnings stay small in the database.
const TOL = 0.005

function segDist([x, y], [x1, y1], [x2, y2]) {
  const dx = x2 - x1, dy = y2 - y1
  if (!dx && !dy) return Math.hypot(x - x1, y - y1)
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}
// Douglas–Peucker
function simplify(pts, tol) {
  if (pts.length < 3) return pts
  let max = 0, at = 0
  for (let i = 1; i < pts.length - 1; i++) { const d = segDist(pts[i], pts[0], pts.at(-1)); if (d > max) { max = d; at = i } }
  if (max <= tol) return [pts[0], pts.at(-1)]
  return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)]
}
const round = v => Math.round(v * 1e4) / 1e4

export function parseCapPolygon(text) {
  const pts = String(text ?? '').trim().split(/\s+/).filter(Boolean).map(pair => pair.split(',').map(Number))
  if (pts.length < 4 || pts.some(p => p.length !== 2 || !p.every(Number.isFinite))) return null
  const ring = pts.map(([lat, lon]) => [lon, lat])
  // keep at least a triangle: tiny outlines fall back to a finer tolerance
  for (const tol of [TOL, TOL / 5, 0]) {
    const s = tol ? simplify(ring, tol) : ring
    if (s.length >= 4) return s.map(([x, y]) => [round(x), round(y)])
  }
  return null
}

// ray casting
function inRing(ring, x, y) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
export const inAnyRing = (rings, lon, lat) => (rings ?? []).some(r => inRing(r, lon, lat))

// [minLon, minLat, maxLon, maxLat] around all rings; null for none
export function bboxOf(rings) {
  const pts = (rings ?? []).flat()
  if (!pts.length) return null
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}
