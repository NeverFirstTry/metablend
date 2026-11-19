// Route lists without the OpenStreetMap API (scripts/routes/local.mjs): the pure parts. A peak's routes
// are read from a Geofabrik extract on disk, and the site's own finder (find.js) and height store
// (height-store.js) do the rest, so what comes out is what the live lookup would have stored.

const rings = g => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)
function inRing(ring, lon, lat) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const holds = (g, lon, lat) => rings(g).some(([outer, ...holes]) => inRing(outer, lon, lat) && !holes.some(h => inRing(h, lon, lat)))
// in square degrees: only to tell a region from its country
const area = g => rings(g).reduce((sum, [outer]) => sum + Math.abs(outer.reduce((s, [x, y], i) => { const [x2, y2] = outer[(i + 1) % outer.length]; return s + x * y2 - x2 * y }, 0)) / 2, 0)

// Which extract a peak is read from (features: Geofabrik's index-v1.json): the Alps extract when the peak
// lies in it (it crosses the borders, so a route from the other side of a border summit is whole), else
// the smallest extract that holds the peak. null: none does.
// shortcut: outside the Alps a route that crosses the extract's edge is cut there; scripts/routes/local.mjs
// counts those and leaves them to the live lookup. Upgrade: read the neighbouring extract as well.
export function extractFor(features, { lat, lon }) {
  const inside = features.filter(f => f.geometry && f.properties?.urls?.pbf && holds(f.geometry, lon, lat))
  if (!inside.length) return null
  const pick = inside.find(f => f.properties.id === 'alps') ?? inside.reduce((a, b) => (area(b.geometry) < area(a.geometry) ? b : a))
  return { id: pick.properties.id, url: pick.properties.urls.pbf }
}

// the route cache's key for a peak (app/api/routes/route.js)
export const peakKey = p => `${p.lat.toFixed(3)},${p.lon.toFixed(3)},${Math.round(p.elev)}`

// findRoutes' getJson, answered from what scripts/routes/osm_routes.py wrote for the peak:
// { map: the box around the summit, full: { <relation id>: the route with its ways and nodes } }.
// Anything else is refused: this path asks no service.
export const fileJson = file => async url => {
  if (/\/map\.json\?bbox=/.test(url)) return file.map
  const route = url.match(/\/relation\/(\d+)\/full\.json$/)
  if (route) return file.full[route[1]] ?? null
  throw new Error(`not answered from the file: ${url}`)
}

// routeHeights' database, in memory: nothing is known before, and every row it would store is kept in rows
export function memoryStore() {
  const rows = []
  const none = { eq: () => none, maybeSingle: async () => ({ data: null }) }
  return { rows, db: { from: () => ({ select: () => none, upsert: async row => { rows.push(row) } }) } }
}
