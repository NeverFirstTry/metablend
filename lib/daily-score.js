// The nightly scoring's comparison (app/api/calibrate/route.js), pure. A stored forecast is the temperature at
// the moment someone looked at a place; it is scored against the measured temperature of that same hour, with
// the thresholds of a same-moment comparison ('instant', as the hourly station check uses). Until 2026-11-21
// it was scored against the mean of the whole day, which marked a right afternoon reading down on every warm
// day (code audit of 2026-11-20, finding 18).
import { deltaFromDiff, median } from './scoring.js'

// The nearest full hour of a stored reading on the place's own clock; tzoffset is the service's, in hours.
// A reading in the last half hour of the day stays in its day.
export function localHour(createdAt, tzoffset) {
  const h = (((Date.parse(createdAt) / 3_600_000 + tzoffset) % 24) + 24) % 24
  return Math.min(23, Math.round(h))
}

// Visual Crossing's answer for one day with its hours: 24 temperatures by local hour (null where it has none),
// its offset from UTC and what the request cost in its records. null when the answer cannot be used.
export function dayHours(answer) {
  const list = answer?.days?.[0]?.hours
  if (!Array.isArray(list) || typeof answer.tzoffset !== 'number') return null
  const hours = Array(24).fill(null)
  for (const h of list) {
    const i = Number(String(h?.datetime ?? '').slice(0, 2))
    if (Number.isInteger(i) && i >= 0 && i < 24 && typeof h.temp === 'number') hours[i] = h.temp
  }
  return { hours, tzoffset: answer.tzoffset, cost: typeof answer.queryCost === 'number' ? answer.queryCost : 24 }
}

// rows: the latest stored reading per source for one place and day [{ api_id, temp, created_at }].
// Returns { api_id: delta }. A source more than 5 degrees from the others' median gets -2 whatever the
// measurement says (the outlier rule, unchanged); a reading whose hour has no measurement is not scored.
export function dailyDeltas(rows, hours, tzoffset) {
  const mid = median(rows.map(f => f.temp))
  const out = {}
  for (const f of rows) {
    const actual = hours[localHour(f.created_at, tzoffset)]
    if (typeof actual !== 'number') continue
    out[f.api_id] = Math.abs(f.temp - mid) > 5 ? -2 : deltaFromDiff(Math.abs(f.temp - actual), 'instant')
  }
  return out
}
