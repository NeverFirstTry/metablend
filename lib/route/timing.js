// Walking time (pure — unit tested): DIN 33466, the hiking-time rule of the
// Alpine clubs — 4 km/h on the flat, 300 m/h up, 500 m/h down; the larger
// of the horizontal and vertical times plus half the smaller.
import { cumulative, climb } from './geometry.js'

export const PACE = { slow: 1.25, normal: 1, fast: 0.8 }

export function legMinutes(distM, upM, downM) {
  const h = (distM / 4000) * 60, v = (upM / 300) * 60 + (downM / 500) * 60
  return Math.max(h, v) + Math.min(h, v) / 2
}

// minutes from the start at every point. Heights count like climb(): once
// they've moved `step` m from the last counted level. Each stretch from level
// to level is timed whole (the rule is meant for stretches, not 20 m legs) and
// its minutes spread over its points by distance — so what's left of the
// terrain model's noise isn't walked as up and down.
export function etas(points, pace = 'normal', step = 5) {
  const f = PACE[pace] ?? 1
  const dist = cumulative(points)
  const out = points.map(() => 0)
  let from = 0, level = points.find(p => typeof p.ele === 'number')?.ele ?? 0
  for (let i = 1; i < points.length; i++) {
    const e = points[i].ele
    if (!(typeof e === 'number' && Math.abs(e - level) >= step) && i < points.length - 1) continue
    const to = typeof e === 'number' ? e : level, d = dist[i] - dist[from], dz = to - level
    const m = legMinutes(d, Math.max(0, dz), Math.max(0, -dz)) * f
    for (let k = from + 1; k <= i; k++) out[k] = out[from] + (d ? (m * (dist[k] - dist[from])) / d : m)
    from = i
    level = to
  }
  return out
}

export function routeStats(points, pace = 'normal') {
  const dist = cumulative(points)
  return {
    distanceKm: Math.round(dist.at(-1) / 100) / 10,
    ...climb(points),
    minutes: Math.round(etas(points, pace).at(-1)),
  }
}

// More walking than one day out (DIN time, breaks not counted): a multi-day
// route. A single start window or stage times for it would treat ~47 h on
// Kilimanjaro as one continuous walk — so it gets neither.
export const DAY_MAX_MIN = 14 * 60
export const isMultiDay = minutes => typeof minutes === 'number' && minutes > DAY_MAX_MIN

// 10 to 14 h: a long day — some walk it in one go, many with a night in a hut.
// Still timed as one walk (start window, stages), and labelled as such.
export const LONG_DAY_MIN = 10 * 60
export const isLongDay = minutes => typeof minutes === 'number' && minutes > LONG_DAY_MIN && minutes <= DAY_MAX_MIN
