// The summit window (pure — unit tested): the longest run of daylight hours
// that are dry, without storm risk, not too windy and not brutally cold —
// plus what ends it, or with no window, what rules the day out.
import { inDaylight } from '../outlook/headlines.js'
import { addHours } from '../localtime.js'

export const LIMITS = { rainPct: 30, windKmh: 40, feels: -20 }

// Why an hour isn't summit weather, most serious first; null when it is.
// Unknown storm risk (no model reported CAPE) doesn't block on its own.
export function blocker(h) {
  if (h.storm === 'moderate' || h.storm === 'high') return 'storms'
  if (h.rainPct != null && h.rainPct >= LIMITS.rainPct) return 'rain'
  if (h.windKmh != null && h.windKmh >= LIMITS.windKmh) return 'wind'
  if (h.feels != null && h.feels <= LIMITS.feels) return 'cold'
  return null
}

// hours: one day's blended hours (daylight is one run per day).
export function summitWindow(hours, sun) {
  const day = (hours ?? []).filter(h => inDaylight(h.t.slice(11, 16), sun))
  if (!day.length) return null
  let best = null, start = -1
  for (let i = 0; i <= day.length; i++) {
    const ok = i < day.length && !blocker(day[i])
    if (ok && start < 0) start = i
    if (!ok && start >= 0) {
      if (!best || i - start > best.end - best.start) best = { start, end: i }
      start = -1
    }
  }
  const stop = (best ? day.slice(best.end) : day).find(h => blocker(h))
  return {
    window: best ? { from: day[best.start].t, to: addHours(day[best.end - 1].t, 1), hours: best.end - best.start } : null,
    next: stop ? { reason: blocker(stop), at: stop.t } : null,
  }
}
