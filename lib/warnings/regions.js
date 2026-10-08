// Which MeteoAlarm warning regions (EMMA_IDs) contain a point (pure — unit
// tested). `data` is lib/warnings/regions.json (scripts/build-warning-regions.mjs):
// { v, regions: [{ c, b, p }] } — c the EMMA_ID, b its [minLon, minLat,
// maxLon, maxLat], p its polygons, each a list of rings [[lon, lat], …]
// (the outer ring first, then holes). Server-only: the file is ~2 MB.
import { FEEDS } from './feeds.js'

export function regionsAt(data, lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return []
  const out = []
  for (const r of data.regions) {
    const [x0, y0, x1, y1] = r.b
    if (lon < x0 || lon > x1 || lat < y0 || lat > y1) continue
    if (r.p.some(rings => inPolygon(rings, lon, lat))) out.push(r.c)
  }
  return out
}

// ray casting: does a horizontal ray from the point cross the ring an odd number of times?
function inRing(ring, x, y) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

// The regions to look up warnings for, in the countries we fetch (FEEDS)
// only. With the place's country (ISO code) known: that country's only — the
// outlines are coarse along borders and coasts (Kehl falls in Bas-Rhin,
// Konstanz in the lake, Cádiz in a sea zone) — and when none of them is
// land, the nearest land region within 10 km joins.
const COVERED = new Set(FEEDS.map(f => f[1]))
const NEAR_KM = 10
const isSea = c => /^[A-Z]{2}8\d\d$/.test(c) // EMMA_ID 801–899: coastal waters

export function regionsFor(data, lat, lon, cc) {
  if (!cc) return regionsAt(data, lat, lon).filter(c => COVERED.has(c.slice(0, 2)))
  const code = String(cc).toUpperCase()
  if (!COVERED.has(code) || !Number.isFinite(lat) || !Number.isFinite(lon)) return []
  const own = regionsAt(data, lat, lon).filter(c => c.startsWith(code))
  if (own.some(c => !isSea(c))) return own
  const near = nearestRegion(data, lat, lon, NEAR_KM, c => c.startsWith(code) && !isSea(c))
  return near ? [...own, near] : own
}

// the region whose outline passes closest, within maxKm (flat km — fine at this range)
function nearestRegion(data, lat, lon, maxKm, keep) {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180), ky = 111.32
  const padX = maxKm / kx, padY = maxKm / ky
  let best = maxKm, code = null
  for (const r of data.regions) {
    const [x0, y0, x1, y1] = r.b
    if (lon < x0 - padX || lon > x1 + padX || lat < y0 - padY || lat > y1 + padY || !keep(r.c)) continue
    for (const rings of r.p) for (const ring of rings) for (let i = 1; i < ring.length; i++) {
      const d = segDist((ring[i - 1][0] - lon) * kx, (ring[i - 1][1] - lat) * ky, (ring[i][0] - lon) * kx, (ring[i][1] - lat) * ky)
      if (d < best) { best = d; code = r.c }
    }
  }
  return code
}

// distance from the origin to the segment a–b
function segDist(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0
  return Math.hypot(ax + t * dx, ay + t * dy)
}

const inPolygon = (rings, x, y) => inRing(rings[0], x, y) && !rings.slice(1).some(hole => inRing(hole, x, y))
