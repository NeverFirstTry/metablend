// Headline answers for the three tabs (pure — unit tested): language-neutral
// codes + numbers; lib/outlook/text.js turns them into sentences.

import { addDays, addHours } from '../localtime.js'

const WET = 50
const NIGHT_FROM = 18 // from this local hour on, "today" means tonight
const isWet = h => h.rainPct != null && h.rainPct >= WET
const comfortMiss = t => (t < 15 ? 15 - t : t > 25 ? t - 25 : 0)
const r1 = v => Math.round(v * 10) / 10

const warmest = hs => {
  const p = hs.reduce((a, b) => (b.temp > a.temp ? b : a))
  return { temp: p.temp, at: p.t }
}

// The first wet run in a window of hours: where it starts and ends, and how
// many of the sources calling rain at all agree on it.
function firstRain(hs) {
  const start = hs.findIndex(isWet)
  if (start === -1) return { code: hs.some(x => x.rainPct != null) ? 'dry' : 'no_rain_data' }
  let end = start
  while (end + 1 < hs.length && isWet(hs[end + 1])) end++
  const run = hs.slice(start, end + 1)
  return {
    code: 'rain', start, toEnd: end === hs.length - 1,
    from: hs[start].t, to: addHours(hs[end].t, 1),
    agree: Math.max(...run.map(x => x.rainVotes ?? 0)),
    total: Math.max(...run.map(x => x.rainCallers ?? 0)),
  }
}

// The hours the Today tab covers: from now to midnight, or, from 18:00 on,
// through the night to 06:00 so the evening still gets a useful answer.
export function todayHours(hourly, todayLocal) {
  const h = hourly ?? []
  if (!h.length) return { hours: [], night: false }
  const night = Number(h[0].t.slice(11, 13)) >= NIGHT_FROM
  const end = `${addDays(todayLocal, 1)}T${night ? '07' : '00'}:00`
  return { hours: h.filter(x => x.t < end), night }
}

export function headlineToday(hourly, { todayLocal }) {
  const { hours: hs, night } = todayHours(hourly, todayLocal)
  if (!hs.length) return null
  const peak = night ? null : warmest(hs)
  const r = firstRain(hs)
  if (r.code !== 'rain') return { code: r.code, night, peak }
  const { agree, total } = r
  if (r.start === 0) return { code: 'rain_now', until: r.toEnd ? null : r.to, agree, total, night, peak }
  return { code: 'rain_window', from: r.from, to: r.to, agree, total, night, peak }
}

// Tomorrow as a whole day: its rain, its high, and how it compares with
// today's high and with a normal year. Rain before 06:00 is tonight's —
// the Today tab covers the night — so the rain answer starts at 06:00.
export function headlineTomorrow(hourly, days, normals, { todayLocal }) {
  const date = addDays(todayLocal, 1)
  const hs = (hourly ?? []).filter(h => h.t.startsWith(date))
  if (!hs.length) return null
  const today = days?.find(d => d.date === todayLocal)
  const tmr = days?.find(d => d.date === date)
  const normal = normals?.find(n => n.date === date)
  const extra = {
    peak: warmest(hs),
    vsToday: today?.tempMax != null && tmr?.tempMax != null ? r1(tmr.tempMax - today.tempMax) : null,
    vsNormal: normal?.max != null && tmr?.tempMax != null ? r1(tmr.tempMax - normal.max) : null,
  }
  const byDay = hs.filter(h => h.t.slice(11, 13) >= '06')
  const r = firstRain(byDay.length ? byDay : hs)
  if (r.code !== 'rain') return { code: r.code, ...extra }
  const { agree, total } = r
  if (r.start === 0 && r.toEnd) return { code: 'rain_all_day', agree, total, ...extra }
  return { code: 'rain_window', from: r.from, to: r.to, agree, total, ...extra }
}

const minutes = hm => (typeof hm === 'string' && /^\d\d:\d\d$/.test(hm) ? Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3)) : null)

// Daylight for an hour starting at 'HH:MM': after sunrise with at least
// 30 min of light left; 07–21 when the sun times are unknown.
export function inDaylight(hhmm, sun) {
  const m = minutes(hhmm), rise = minutes(sun?.sunrise), set = minutes(sun?.sunset)
  if (m == null) return false
  return rise != null && set != null ? m >= rise && m + 30 <= set : m >= 7 * 60 && m <= 21 * 60
}

// The nicest daylight hour among the given hours: rain hurts most, then
// distance from a pleasant 21 °C (doubly so outside 15–25 °C), then wind —
// but only real wind: a breeze under 15 km/h costs nothing. Daylight keeps a
// calm evening after dark from winning.
export function bestTimeOutside(hours, sun = null) {
  const pool = (hours ?? []).filter(h => inDaylight(h.t.slice(11, 16), sun))
  if (!pool.length) return null
  const score = h => (h.rainPct ?? 0) + Math.abs(h.temp - 21) + comfortMiss(h.temp) * 2 + Math.max(0, (h.windKmh ?? 0) - 15) * 0.5
  const best = pool.reduce((a, b) => (score(b) < score(a) ? b : a))
  if (best.rainPct != null && best.rainPct >= 60) return null // a "best" hour that's wet anyway is no answer
  return { t: best.t, temp: best.temp, rainPct: best.rainPct, windKmh: best.windKmh, icon: best.icon }
}

export function headline7(days) {
  const week = (days ?? []).slice(0, 7)
  if (!week.length) return null
  const splits = week.filter(d => d.spread != null && d.spread > 4).map(d => ({ date: d.date, spread: d.spread }))
  const score = d => (d.rainPct ?? 50) + (d.windKmh ?? 0) * 0.5 + comfortMiss(d.tempMax) * 2
  const best = week.reduce((a, b) => (score(b) < score(a) ? b : a))
  if (best.rainPct != null && best.rainPct >= 60) return { code: 'no_good_day', splits }
  return { code: 'best_day', date: best.date, tempMax: best.tempMax, rainPct: best.rainPct, splits }
}
