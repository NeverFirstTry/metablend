// Is the route walkable, and from when? (pure — unit tested) Every stage is
// judged on the blended hour it is reached in, by the summit engine's own
// rules (window.js blocker: storms, rain, wind, cold). The walk starts no
// earlier than first light and must be done by sunset.
import { blocker } from '../hike/window.js'

export const toMin = hm => (typeof hm === 'string' && /^\d\d:\d\d$/.test(hm) ? Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3)) : null)
export function hhmm(m) {
  const r = Math.round(m)
  return `${String(Math.floor(r / 60) % 24).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`
}

// the blended hour a minute of the day falls in ('YYYY-MM-DDTHH:00'; past
// midnight it is the next day's hour)
export function hourAt(hours, date, minute) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCMinutes(Math.floor(minute / 60) * 60)
  const t = `${d.toISOString().slice(0, 13)}:00`
  return hours?.find(h => h.t === t) ?? null
}

export function stagesAt({ hoursByStage, offsets, date, start }) {
  return offsets.map((off, i) => {
    const minute = start + off, hour = hourAt(hoursByStage[i], date, minute)
    return { i, minute, eta: hhmm(minute), hour, blocker: hour ? blocker(hour) : 'nodata' }
  })
}

export function suggestStart({ hoursByStage, offsets, date, sun, notBefore = 0, step = 15 }) {
  const rise = toMin(sun?.sunrise) ?? 6 * 60, set = toMin(sun?.sunset) ?? 19 * 60
  const total = offsets.at(-1) ?? 0
  const first = Math.ceil(Math.max(rise, notBefore) / step) * step
  if (first + total > set) return { none: true, reason: 'daylight', firstBad: null }
  let earliest = null, latest = null, firstBad = null
  for (let s = first; s + total <= set; s += step) {
    const bad = stagesAt({ hoursByStage, offsets, date, start: s }).find(x => x.blocker)
    if (!bad) { earliest ??= s; latest = s } else if (earliest != null) break
    else firstBad ??= bad
  }
  if (earliest == null) return { none: true, reason: firstBad?.blocker ?? 'daylight', firstBad: firstBad ? { i: firstBad.i, eta: firstBad.eta } : null }
  return { start: hhmm(earliest), latest: hhmm(latest), startMinute: earliest }
}
