// The /api/route-weather and /api/route-heights bodies (pure — unit tested).
import { PACE } from './timing.js'
import { toMin } from './verdict.js'
import { addDays } from '../localtime.js'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const bad = error => ({ ok: false, error })
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi

function parsePoints(list) {
  if (!Array.isArray(list) || list.length < 2 || list.length > 500) return 'A route needs 2–500 points'
  const points = []
  for (const p of list) {
    if (!Array.isArray(p) || !num(p[0], -90, 90) || !num(p[1], -180, 180)) return 'Invalid point'
    points.push({ lat: p[0], lon: p[1], ele: num(p[2], -500, 9000) ? p[2] : null })
  }
  return points
}

// The /api/route-heights body: a saved route's points.
export function parseHeightsBody(b) {
  const points = parsePoints(b?.points)
  return typeof points === 'string' ? bad(points) : { ok: true, value: { points } }
}

export function parseRouteBody(b, todayUtc) {
  if (!b || typeof b !== 'object') return bad('Invalid body')
  const points = parsePoints(b.points)
  if (typeof points === 'string') return bad(points)
  if (typeof b.date !== 'string' || !DATE.test(b.date) || b.date < addDays(todayUtc, -1) || b.date > addDays(todayUtc, 7)) return bad('The day must be within the forecast')
  const pace = b.pace ?? 'normal'
  if (typeof pace !== 'string' || !Object.hasOwn(PACE, pace)) return bad('Invalid pace')
  const start = b.start ?? null
  if (start !== null && (toMin(start) == null || toMin(start) >= 24 * 60)) return bad('Invalid start time')
  return { ok: true, value: { points, date: b.date, pace, start, roundTrip: b.roundTrip === true } }
}
