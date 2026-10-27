// The marked routes up a peak, from the official OpenStreetMap API (network
// through the injected getJson / getElevations — unit tested with recorded
// responses). Not Overpass: it timed out where this API answered in < 1 s.
import { routesNear, stitch } from './osm.js'
import { simplify, haversineM, withReturn } from './geometry.js'
import { fillHeights, hasHeights, walkStats } from './heights.js'

const OSM = 'https://api.openstreetmap.org/api/0.6'
const BOX = { lat: 0.006, lon: 0.009 }
const r5 = v => Math.round(v * 1e5) / 1e5

const asStored = points => points.map(p => [r5(p.lat), r5(p.lon), p.ele == null ? null : Math.round(p.ele)])
// up and back down the same way
const statsFor = (points, roundTrip) => walkStats(points, 'normal', { roundTrip })

export async function findRoutes(peak, { getJson, getElevations, max = 8, wait }) {
  const bbox = [peak.lon - BOX.lon, peak.lat - BOX.lat, peak.lon + BOX.lon, peak.lat + BOX.lat].map(v => v.toFixed(5)).join(',')
  const map = await getJson(`${OSM}/map.json?bbox=${bbox}`, { ms: 12000 })
  if (!map) return null
  const routes = []
  for (const near of routesNear(map, peak).slice(0, max)) {
    const full = await getJson(`${OSM}/relation/${near.id}/full.json`, { ms: 10000 })
    const s = full && stitch(full)
    if (!s || s.points.length < 2) continue
    // heights from the terrain model (OSM routes have none of their own)
    let points = (await fillHeights(simplify(s.points, 300), getElevations, { wait })).points
    // the end nearer the summit goes last; up to the point nearest the summit,
    // then on to the summit itself (routes usually stop at the last hut)
    if (haversineM(points[0], peak) < haversineM(points.at(-1), peak)) points = points.slice().reverse()
    let closest = 0
    points.forEach((p, i) => { if (haversineM(p, peak) < haversineM(points[closest], peak)) closest = i })
    points = points.slice(0, closest + 1)
    if (haversineM(points.at(-1), peak) > 100) points.push({ lat: peak.lat, lon: peak.lon, ele: peak.elev })
    const roundTrip = true
    routes.push({
      id: s.id, ref: s.ref, name: s.name, from: s.from, to: s.to, difficulty: s.difficulty, roundTrip,
      // 'terrain': from the terrain model, shown as approximate; null: no heights, so no times
      heights: hasHeights(points) ? 'terrain' : null,
      ...statsFor(points, roundTrip),
      points: asStored(points),
    })
  }
  return routes
}

// Cached routes that lost their heights (until 2026-10-27 one failed height
// request emptied a whole route, and the cache kept it for a week, timed as
// if flat): fill them again and time them again. Complete ones stay as they
// are; still nothing to be had → no ascent and no time instead of the wrong
// ones. changed: whether the cache should be rewritten.
export async function healRoutes(routes, getElevations, { wait } = {}) {
  let changed = false
  const out = []
  for (const r of routes) {
    const points = r.points.map(([lat, lon, ele]) => ({ lat, lon, ele }))
    if (hasHeights(points)) {
      if (r.heights) out.push(r)
      else { out.push({ ...r, heights: 'terrain' }); changed = true }
      continue
    }
    const filled = (await fillHeights(points, getElevations, { wait })).points
    const next = { ...r, heights: hasHeights(filled) ? 'terrain' : null, ...statsFor(filled, r.roundTrip !== false), points: asStored(filled) }
    // only a real change is written (still nothing to be had, already stored without times: no write)
    const moved = next.heights !== r.heights || next.minutes !== r.minutes || next.ascentM !== r.ascentM || JSON.stringify(next.points) !== JSON.stringify(r.points)
    if (moved) changed = true
    out.push(moved ? next : r)
  }
  return { routes: out, changed }
}

// What can be served right away while healRoutes runs after the response:
// routes without heights lose their (flat-land) ascent and time, old ones
// with full heights get their marker — no network. missing: how many still
// need heights.
export function withoutGuesses(routes) {
  let missing = 0
  const out = routes.map(r => {
    if (hasHeights(r.points.map(([lat, lon, ele]) => ({ lat, lon, ele })))) return r.heights ? r : { ...r, heights: 'terrain' }
    missing++
    return { ...r, heights: null, ascentM: null, descentM: null, minutes: null }
  })
  return { routes: out, missing }
}
