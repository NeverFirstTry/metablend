// The summit window (pure — unit tested): the longest run of daylight hours
// that are dry, without storm risk, not too windy and not brutally cold, and
// that leaves daylight for the way down — plus what ends it, or with no
// window, what rules the day out.
import { inDaylight } from '../outlook/headlines.js'
import { addHours } from '../localtime.js'

// Every threshold of the summit window, in one place to tune. The wind text in
// the language files says "over 40 km/h": change it there too with windKmh.
export const LIMITS = {
  rainPct: 30, // rain probability that blocks an hour
  windKmh: 40, // summit wind that blocks an hour
  feels: -20, // feels-like or wind chill at or below this blocks an hour
  minHours: 1, // a shorter window isn't shown
  reserveH: 3, // daylight kept for the descent from a summit with no route
  reserveAlpineH: 4, // … on alpine grades and high peaks
  alpineGrades: ['L', 'WS', 'ZS', 'T5', 'T6'],
  alpineFromM: 3000,
}

// Environment Canada / US NWS wind chill, for 10 °C and below with wind over
// 4.8 km/h; otherwise the air temperature.
export const windChill = (t, v) => (t == null || v == null || t > 10 || v <= 4.8 ? t : 13.12 + 0.6215 * t - 11.37 * v ** 0.16 + 0.3965 * t * v ** 0.16)

// Daylight kept for the descent from a summit with no route chosen (a route
// is timed by the route planner instead): LIMITS.reserveAlpineH on alpine
// grades and high peaks, LIMITS.reserveH otherwise.
export const descentReserve = peak => (LIMITS.alpineGrades.includes(peak?.grade) || peak?.elev >= LIMITS.alpineFromM ? LIMITS.reserveAlpineH : LIMITS.reserveH)

// Why an hour isn't summit weather, most serious first; null when it is.
// Unknown storm risk (no model reported CAPE) doesn't block on its own.
// Cold: the models' own feels-like uses their 10 m wind, so the summit wind's
// chill is checked as well.
export function blocker(h) {
  if (h.storm === 'moderate' || h.storm === 'high') return 'storms'
  if (h.rainPct != null && h.rainPct >= LIMITS.rainPct) return 'rain'
  if (h.windKmh != null && h.windKmh >= LIMITS.windKmh) return 'wind'
  if (h.feels != null && h.feels <= LIMITS.feels) return 'cold'
  const chill = windChill(h.temp, h.windKmh)
  if (chill != null && chill <= LIMITS.feels) return 'cold'
  // no rain or wind value: the hour can't be judged, so it isn't favourable (fail closed)
  if (h.rainPct == null || h.windKmh == null) return 'nodata'
  return null
}

const minutesOf = hhmm => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

// hours: one day's blended hours (daylight is one run per day). reserveH: the
// hours before sunset the window must close by; from then on an hour is 'dark'.
export function summitWindow(hours, sun, { reserveH = 0 } = {}) {
  const day = (hours ?? []).filter(h => inDaylight(h.t.slice(11, 16), sun))
  if (!day.length) return null
  const date = day[0].t.slice(0, 10)
  const close = sun?.sunset ? hhmm(Math.max(0, minutesOf(sun.sunset) - reserveH * 60)) : null
  const why = h => (reserveH && close && h.t.slice(11, 16) >= close ? 'dark' : blocker(h))
  let best = null, start = -1
  for (let i = 0; i <= day.length; i++) {
    const ok = i < day.length && !why(day[i])
    if (ok && start < 0) start = i
    if (!ok && start >= 0) {
      if (!best || i - start > best.end - best.start) best = { start, end: i }
      start = -1
    }
  }
  const stop = (best ? day.slice(best.end) : day).find(h => why(h))
  const reason = stop ? why(stop) : null
  // the last daylight hour can run past the close — the window ends with it
  const endOf = t => {
    const end = addHours(t, 1), by = close ? `${date}T${close}` : null
    return by && by < end ? by : end
  }
  const window = best ? { from: day[best.start].t, to: endOf(day[best.end - 1].t), hours: best.end - best.start } : null
  // under an hour: only the close can cut a run that short, so the close is the reason
  if (window && (Date.parse(`${window.to}:00Z`) - Date.parse(`${window.from}:00Z`)) / 3600e3 < LIMITS.minHours) {
    return { window: null, next: { reason: 'dark', at: `${date}T${close}` } }
  }
  return {
    window,
    next: stop ? { reason, at: reason === 'dark' ? `${date}T${close}` : stop.t } : null,
  }
}
