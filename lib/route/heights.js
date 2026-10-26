// A route's height profile: how much of it is known, filling the gaps from
// the terrain model (Open-Meteo's elevation API, 100 points per request), and
// the numbers that depend on it. Walking time by DIN 33466 counts the climb:
// a route without heights would be timed as if it were flat (Lemosho, 84 km
// to Kilimanjaro: "21 h", the pure horizontal time) — wrong in the unsafe
// direction, so then there is no time at all rather than a wrong one.
import { routeStats } from './timing.js'
import { cumulative } from './geometry.js'

export const HEIGHTS_MIN = 0.9 // share of points with a height before ascent and times count

export const coverage = points => (points.length ? points.filter(p => typeof p.ele === 'number').length / points.length : 0)
export const hasHeights = points => points.length >= 2 && coverage(points) >= HEIGHTS_MIN

const pause = ms => new Promise(r => setTimeout(r, ms))

// Fills the points without a height. A request that fails gets one more try
// after a pause (Open-Meteo refuses bursts from Vercel's shared addresses, and
// one failed request used to empty the whole route); failing twice leaves its
// points empty — never zero.
export async function fillHeights(points, getElevations, { wait = () => pause(2500) } = {}) {
  const out = points.map(p => ({ ...p }))
  const missing = out.flatMap((p, i) => (typeof p.ele === 'number' ? [] : [i]))
  let filled = 0
  for (let k = 0; k < missing.length; k += 100) {
    const chunk = missing.slice(k, k + 100)
    let e = await getElevations(chunk.map(i => out[i]))
    if (!Array.isArray(e)) { await wait(); e = await getElevations(chunk.map(i => out[i])) }
    if (Array.isArray(e)) chunk.forEach((i, j) => { if (typeof e[j] === 'number') { out[i].ele = e[j]; filled++ } })
  }
  return { points: out, filled }
}

// The few points still without a height, from their neighbours by distance
// along the way (ends: the nearest height). Without this a gap was walked as
// flat — a refused last block on a 90%-covered route cost about an hour.
// Nothing known at all: nothing made up.
export function interpolateHeights(points) {
  const known = points.flatMap((p, i) => (typeof p.ele === 'number' ? [i] : []))
  if (!known.length) return points.map(p => ({ ...p }))
  const dist = cumulative(points)
  return points.map((p, i) => {
    if (typeof p.ele === 'number') return { ...p }
    const after = known.find(k => k > i), before = [...known].reverse().find(k => k < i)
    if (before == null) return { ...p, ele: points[after].ele }
    if (after == null) return { ...p, ele: points[before].ele }
    const f = (dist[i] - dist[before]) / ((dist[after] - dist[before]) || 1)
    return { ...p, ele: points[before].ele + f * (points[after].ele - points[before].ele) }
  })
}

// distance always; ascent, descent and walking time only with heights
export function walkStats(points, pace = 'normal') {
  if (!hasHeights(points)) return { ...routeStats(points, pace), ascentM: null, descentM: null, minutes: null }
  return routeStats(interpolateHeights(points), pace)
}
