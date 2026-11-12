// A route's heights, kept for good. The terrain does not change, yet every week each peak's routes were
// looked up again and every point (up to 300 a route, eight routes a peak) asked from Open-Meteo's
// elevation API, which charges one call per point: a walk through twenty peaks cost 22,705 calls in an hour
// (2026-11-12) and ran into the per-minute limit. Now a route's line is sampled to at most SAMPLE_MAX
// points, their heights are stored under the route's id and the line's fingerprint (route_heights), and
// only a line never seen before is asked, once. Server only.
import { createHash } from 'node:crypto'
import { cumulative } from './geometry.js'
import { fillHeights, interpolateHeights } from './heights.js'

// One request of 100 coordinates per route. On a phone the profile is drawn about 340 px wide, so 100
// points are one every 3 to 4 px; the terrain model has 90 m cells and walking times are counted on a
// profile averaged over 200 m either side (SMOOTH_M), so up to 10 to 20 km one way nothing is lost.
export const SAMPLE_MAX = 100
// One way. A longer line is a long-distance trail, not a way up a summit: at 100 points its samples would
// lie more than 400 m apart and the ascent would be wrong. It gets no heights from the live service
// (no ascent and no time are shown, as for any route without heights); heights already stored are used.
export const LIVE_MAX_KM = 40
// Route points asked from the live service per UTC day, all visitors together (OPEN_METEO_ROUTE_POINTS).
export const DAILY_POINTS = 3000

// at most `max` of the points, evenly along the way, the first and the last always among them
export function sampleIndexes(points, max = SAMPLE_MAX) {
  if (points.length <= max) return points.map((_, i) => i)
  const dist = cumulative(points), total = dist.at(-1) || 1, picked = new Set([0, points.length - 1])
  for (let k = 1, j = 0; k < max - 1; k++) {
    const at = total * k / (max - 1)
    while (j < points.length - 1 && dist[j] < at) j++
    picked.add(j)
  }
  return [...picked].sort((a, b) => a - b)
}

const at5 = p => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`
// the sampled line's fingerprint: a route that changed gets new heights, an unchanged one never asks again
export const lineKey = sampled => createHash('sha1').update(sampled.map(at5).join(';')).digest('hex').slice(0, 20)
export const oneWayKm = points => cumulative(points).at(-1) / 1000

// How many route points may still be asked today: today's count for the kind in the request counter, read
// at most once a minute per instance. Without a database every request is allowed (tests, local runs).
export function dailyBudget(db, { kind = 'route-heights', limit = Number(process.env.OPEN_METEO_ROUTE_POINTS) || DAILY_POINTS, now = () => Date.now() } = {}) {
  let used = 0, readAt = 0
  return async n => {
    if (db && now() - readAt > 60_000) {
      const { data } = await db.from('open_meteo_calls').select('calls').eq('day', new Date(now()).toISOString().slice(0, 10)).eq('kind', kind)
      if (Array.isArray(data)) { used = data.reduce((s, r) => s + Number(r.calls || 0), 0); readAt = now() }
    }
    if (used + n > limit) return false
    used += n
    return true
  }
}

// The route's points with heights: from the store, else from what the route cache already holds for the
// same places (`known`: "lat,lon" → height), else asked live (short lines only, within the day's budget)
// and stored. Points between the samples take their height from the neighbours along the way. A point
// that came with a height (the summit) keeps it. asked: how many points went to the live service.
export async function routeHeights(id, points, { db, getElevations, budget = async () => true, known, wait } = {}) {
  const idx = sampleIndexes(points), sampled = idx.map(i => points[i]), geom = lineKey(sampled)
  const complete = h => Array.isArray(h) && h.length === sampled.length && h.every(v => typeof v === 'number')
  let heights = null, asked = 0
  if (db) {
    const { data } = await db.from('route_heights').select('heights').eq('route_id', id).eq('geom', geom).maybeSingle()
    if (complete(data?.heights)) heights = data.heights
  }
  if (!heights) {
    const had = sampled.map(p => (typeof p.ele === 'number' ? p.ele : known?.get(at5(p))))
    if (complete(had)) heights = had
    else if (oneWayKm(points) <= LIVE_MAX_KM && await budget(sampled.length)) {
      asked = sampled.filter(p => typeof p.ele !== 'number').length
      const got = (await fillHeights(sampled, getElevations, { wait })).points.map(p => p.ele)
      if (complete(got)) heights = got
    }
    if (heights && db) await db.from('route_heights').upsert({ route_id: id, geom, heights: heights.map(Math.round) })
  }
  const out = points.map(p => ({ ...p }))
  if (!heights) return { points: out, asked }
  idx.forEach((i, k) => { if (typeof out[i].ele !== 'number') out[i].ele = heights[k] })
  return { points: interpolateHeights(out), asked }
}
