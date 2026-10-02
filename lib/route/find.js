// The marked routes up a peak, from the official OpenStreetMap API (network
// through the injected getJson / getElevations — unit tested with recorded
// responses). Not Overpass: it timed out where this API answered in < 1 s.
import { routesNear, stitch } from './osm.js'
import { simplify, haversineM, withReturn } from './geometry.js'
import { routeStats } from './timing.js'

const OSM = 'https://api.openstreetmap.org/api/0.6'
const BOX = { lat: 0.006, lon: 0.009 }
const r5 = v => Math.round(v * 1e5) / 1e5

async function elevationsFor(points, getElevations) {
  const out = []
  for (let i = 0; i < points.length; i += 100) {
    const e = await getElevations(points.slice(i, i + 100))
    if (!e) return null
    out.push(...e)
  }
  return out
}

export async function findRoutes(peak, { getJson, getElevations, max = 8 }) {
  const bbox = [peak.lon - BOX.lon, peak.lat - BOX.lat, peak.lon + BOX.lon, peak.lat + BOX.lat].map(v => v.toFixed(5)).join(',')
  const map = await getJson(`${OSM}/map.json?bbox=${bbox}`, { ms: 12000 })
  if (!map) return null
  const routes = []
  for (const near of routesNear(map, peak).slice(0, max)) {
    const full = await getJson(`${OSM}/relation/${near.id}/full.json`, { ms: 10000 })
    const s = full && stitch(full)
    if (!s || s.points.length < 2) continue
    let points = simplify(s.points, 300)
    const eles = await elevationsFor(points, getElevations)
    if (eles) points = points.map((p, i) => ({ ...p, ele: eles[i] }))
    // the end nearer the summit goes last; up to the point nearest the summit,
    // then on to the summit itself (routes usually stop at the last hut)
    if (haversineM(points[0], peak) < haversineM(points.at(-1), peak)) points = points.slice().reverse()
    let closest = 0
    points.forEach((p, i) => { if (haversineM(p, peak) < haversineM(points[closest], peak)) closest = i })
    points = points.slice(0, closest + 1)
    if (haversineM(points.at(-1), peak) > 100) points.push({ lat: peak.lat, lon: peak.lon, ele: peak.elev })
    // up and back down the same way
    const roundTrip = true
    const stats = routeStats(withReturn(points), 'normal')
    routes.push({
      id: s.id, ref: s.ref, name: s.name, from: s.from, to: s.to, difficulty: s.difficulty, roundTrip, ...stats,
      points: points.map(p => [r5(p.lat), r5(p.lon), p.ele == null ? null : Math.round(p.ele)]),
    })
  }
  return routes
}
