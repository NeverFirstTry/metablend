// Walking time (pure — unit tested): DIN 33466, the hiking-time rule of the
// Alpine clubs — 4 km/h on the flat, 300 m/h up, 500 m/h down; the larger
// of the horizontal and vertical times plus half the smaller.
import { haversineM, cumulative, climb } from './geometry.js'

export const PACE = { slow: 1.25, normal: 1, fast: 0.8 }

export function legMinutes(distM, upM, downM) {
  const h = (distM / 4000) * 60, v = (upM / 300) * 60 + (downM / 500) * 60
  return Math.max(h, v) + Math.min(h, v) / 2
}

// minutes from the start at every point
export function etas(points, pace = 'normal') {
  const f = PACE[pace] ?? 1
  const out = [0]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const dz = (b.ele ?? a.ele ?? 0) - (a.ele ?? b.ele ?? 0)
    out.push(out[i - 1] + legMinutes(haversineM(a, b), Math.max(0, dz), Math.max(0, -dz)) * f)
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
