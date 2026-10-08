// Which MeteoAlarm warning regions (EMMA_IDs) contain a point (pure — unit
// tested). `data` is lib/warnings/regions.json (scripts/build-warning-regions.mjs):
// { v, regions: [{ c, b, p }] } — c the EMMA_ID, b its [minLon, minLat,
// maxLon, maxLat], p its polygons, each a list of rings [[lon, lat], …]
// (the outer ring first, then holes). Server-only: the file is ~2 MB.
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

const inPolygon = (rings, x, y) => inRing(rings[0], x, y) && !rings.slice(1).some(hole => inRing(hole, x, y))
