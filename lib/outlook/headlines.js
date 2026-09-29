// Headline answers for the three tabs (pure — unit tested): language-neutral
// codes + numbers; lib/outlook/text.js turns them into sentences.

import { addDays, addHours } from '../localtime.js'
import { anomalies } from './climate.js'

const WET = 50
const isWet = h => h.rainPct != null && h.rainPct >= WET
const comfortMiss = t => (t < 15 ? 15 - t : t > 25 ? t - 25 : 0)

function tomorrowPeak(hourly, todayLocal) {
  const day = addDays(todayLocal, 1)
  const tmr = hourly.filter(h => h.t.startsWith(day))
  if (!tmr.length) return null
  const p = tmr.reduce((a, b) => (b.temp > a.temp ? b : a))
  return { temp: p.temp, at: p.t }
}

export function headline48(hourly, { todayLocal }) {
  const h = (hourly ?? []).slice(0, 48)
  if (!h.length) return null
  const peak = tomorrowPeak(hourly, todayLocal)
  const start = h.findIndex(isWet)
  if (start === -1) return { code: h.some(x => x.rainPct != null) ? 'dry' : 'no_rain_data', peak }
  let end = start
  while (end + 1 < h.length && isWet(h[end + 1])) end++
  const run = h.slice(start, end + 1)
  const agree = Math.max(...run.map(x => x.rainVotes ?? 0))
  const total = Math.max(...run.map(x => x.rainCallers ?? 0))
  const until = end + 1 < h.length ? addHours(h[end].t, 1) : null
  if (start === 0) return { code: 'rain_now', until, agree, total, peak }
  return { code: 'rain_window', from: h[start].t, to: addHours(h[end].t, 1), agree, total, peak }
}

// The nicest daytime hour (07–21 local) in the next 48 h: rain hurts most,
// then wind, then leaving the 15–25 °C comfort band.
export function bestTimeOutside(hourly, hours = 48) {
  const pool = (hourly ?? []).slice(0, hours).filter(h => {
    const hr = Number(h.t.slice(11, 13))
    return hr >= 7 && hr <= 21
  })
  if (!pool.length) return null
  const score = h => (h.rainPct ?? 0) + (h.windKmh ?? 0) * 0.5 + comfortMiss(h.temp) * 2
  const best = pool.reduce((a, b) => (score(b) < score(a) ? b : a))
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

export function headline14(days, normals) {
  if (!normals?.some(n => n.max != null)) return null
  const { week1, week2 } = anomalies(days, normals)
  const ref = week2 ?? week1
  if (ref == null) return null
  const dir = ref >= 1 ? 'warmer' : ref <= -1 ? 'cooler' : 'normal'
  const change = week1 != null && week2 != null ? week2 - week1 : 0
  return { code: 'trend', week1, week2, dir, shift: change <= -2 ? 'cooling' : change >= 2 ? 'warming' : null }
}
