// The /api/route-weather body (pure — unit tested).
import { PACE } from './timing.js'
import { toMin } from './verdict.js'
import { addDays } from '../localtime.js'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const bad = error => ({ ok: false, error })
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi

export function parseRouteBody(b, todayUtc) {
  if (!b || typeof b !== 'object') return bad('Invalid body')
  if (!Array.isArray(b.points) || b.points.length < 2 || b.points.length > 500) return bad('A route needs 2–500 points')
  const points = []
  for (const p of b.points) {
    if (!Array.isArray(p) || !num(p[0], -90, 90) || !num(p[1], -180, 180)) return bad('Invalid point')
    points.push({ lat: p[0], lon: p[1], ele: num(p[2], -500, 9000) ? p[2] : null })
  }
  if (typeof b.date !== 'string' || !DATE.test(b.date) || b.date < addDays(todayUtc, -1) || b.date > addDays(todayUtc, 7)) return bad('The day must be within the forecast')
  const pace = b.pace ?? 'normal'
  if (typeof pace !== 'string' || !Object.hasOwn(PACE, pace)) return bad('Invalid pace')
  const start = b.start ?? null
  if (start !== null && (toMin(start) == null || toMin(start) >= 24 * 60)) return bad('Invalid start time')
  return { ok: true, value: { points, date: b.date, pace, start, roundTrip: b.roundTrip === true } }
}
