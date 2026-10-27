// A route's height profile: how much of it is known, filling the gaps from
// the terrain model (Open-Meteo's elevation API, 100 points per request), and
// the numbers that depend on it. Walking time by DIN 33466 counts the climb:
// a route without heights would be timed as if it were flat (Lemosho, 84 km
// to Kilimanjaro: "21 h", the pure horizontal time) — wrong in the unsafe
// direction, so then there is no time at all rather than a wrong one.
import { routeStats } from './timing.js'
import { cumulative, withReturn } from './geometry.js'

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

// The terrain model gives one height per ~90 m cell: on a steep slope a path
// across it reads the cells above and below in turn, ±40 m from point to
// point, and every jump counted as climbing — Mount Whitney Trail "↑4030 m,
// 27 h" for 1830 m and about 14 h. Ascent and walking time are counted on a
// profile averaged over 200 m either side; the heights shown stay as they are.
// The start and the end — the trailhead and the summit — keep their own
// heights (the window narrows towards them), so a route loses none of its
// climb to the averaging; a round trip is smoothed one way, then mirrored.
export const SMOOTH_M = 200

export function walkingProfile(points) {
  const p = interpolateHeights(points)
  if (!p.some(x => typeof x.ele === 'number')) return p
  const dist = cumulative(p)
  const anchors = [0, dist.at(-1)]
  return p.map((x, i) => {
    const w = Math.min(SMOOTH_M, ...anchors.map(a => Math.abs(dist[i] - a)))
    let sum = 0, n = 0
    for (let j = i; j >= 0 && dist[i] - dist[j] <= w; j--) { sum += p[j].ele; n++ }
    for (let j = i + 1; j < p.length && dist[j] - dist[i] <= w; j++) { sum += p[j].ele; n++ }
    return { ...x, ele: sum / n }
  })
}

// distance always; ascent, descent and walking time only with heights
export function walkStats(points, pace = 'normal', { roundTrip = false } = {}) {
  const both = p => (roundTrip ? withReturn(p) : p)
  if (!hasHeights(points)) return { ...routeStats(both(points), pace), ascentM: null, descentM: null, minutes: null }
  return routeStats(both(walkingProfile(points)), pace)
}
