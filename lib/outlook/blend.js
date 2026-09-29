// Outlook blending (pure — unit tested): many sources' hourly and daily
// series → one consensus per hour and per day, with an honest spread band and
// a rain chance that stays null when no source said anything about rain.

import { weatherIcon, decodeWeatherCode } from '../weather.js'

const r1 = v => Math.round(v * 10) / 10

// Which learned-weight bucket a lead time belongs to: 'h48' covers the Today
// and Tomorrow tabs, 'd7' the rest of the week.
export const horizonForLeadHours = h => (h < 48 ? 'h48' : 'd7')
export const horizonForLeadDays = d => (d <= 1 ? 'h48' : 'd7')

// Linear-interpolated percentile of an ascending array.
export function percentile(sorted, p) {
  if (!sorted.length) return null
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

// [low, high] of the contributing values: min–max for a handful of sources,
// p10–p90 once there are enough that one outlier shouldn't define the band.
export function band(values) {
  const s = values.filter(v => typeof v === 'number').sort((a, b) => a - b)
  if (!s.length) return [null, null]
  if (s.length >= 6) return [r1(percentile(s, 0.1)), r1(percentile(s, 0.9))]
  return [s[0], s[s.length - 1]]
}

// One source's rain call as a probability 0..1: its real probability when it
// publishes one, otherwise a yes/no vote from the amount, null when silent.
export function rainProb(pop, precip, wetMm) {
  if (typeof pop === 'number') return Math.round(pop) / 100
  if (typeof precip === 'number') return precip >= wetMm ? 1 : 0
  return null
}

// Sources without a learned weight yet stand on equal footing with the
// average of those that have one.
function weightFn(weights) {
  const vals = Object.values(weights ?? {}).filter(v => typeof v === 'number')
  const fallback = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 1
  return id => (typeof weights?.[id] === 'number' ? weights[id] : fallback)
}

function combine(pts, w, wetMm) {
  let ws = pts.map(p => Math.max(0, w(p.id)))
  if (!ws.some(v => v > 0)) ws = pts.map(() => 1)
  const mean = key => {
    let s = 0, sw = 0
    pts.forEach((p, i) => { if (typeof p[key] === 'number') { s += p[key] * ws[i]; sw += ws[i] } })
    return sw ? s / sw : null
  }
  let rain = 0, rainW = 0, votes = 0, callers = 0, top = null, topW = -1
  pts.forEach((p, i) => {
    const pr = rainProb(p.pop, p.precip, wetMm)
    if (pr != null) { rain += pr * ws[i]; rainW += ws[i]; callers++; if (pr >= 0.5) votes++ }
    if (typeof p.code === 'number' && ws[i] > topW) { topW = ws[i]; top = p }
  })
  return { mean, rainPct: rainW ? Math.round((rain / rainW) * 100) : null, votes, callers, topCode: top?.code ?? null }
}

function group(series, pick, from) {
  const by = new Map()
  for (const s of series) for (const p of pick(s) ?? []) {
    const k = p.t ?? p.date
    if (k < from) continue
    let e = by.get(k)
    if (!e) by.set(k, (e = []))
    e.push({ id: s.id, ...p })
  }
  return by
}

// nowLocal: the city-local hour to start from, 'YYYY-MM-DDTHH:MM'.
export function blendHourly(series, weightsByHorizon, { nowLocal, hours = 168 }) {
  const by = group(series, s => s.hourly, nowLocal)
  const t0 = Date.parse(`${nowLocal}:00Z`)
  return [...by.keys()].sort().slice(0, hours).map(t => {
    const pts = by.get(t)
    const lead = (Date.parse(`${t}:00Z`) - t0) / 3600e3
    const c = combine(pts, weightFn(weightsByHorizon?.[horizonForLeadHours(lead)]), 0.1)
    const [lo, hi] = band(pts.map(p => p.temp))
    const wind = c.mean('wind')
    return {
      t, temp: r1(c.mean('temp')), lo, hi,
      rainPct: c.rainPct, rainVotes: c.votes, rainCallers: c.callers,
      windKmh: wind == null ? null : Math.round(wind),
      icon: c.topCode == null ? null : weatherIcon(c.topCode),
      n: pts.length,
    }
  })
}

// todayLocal: the city-local date, 'YYYY-MM-DD'. Day lead 0 is today.
export function blendDaily(series, weightsByHorizon, { todayLocal, days = 7 }) {
  const by = group(series, s => s.daily, todayLocal)
  const d0 = Date.parse(`${todayLocal}T00:00:00Z`)
  return [...by.keys()].sort().slice(0, days).map(date => {
    const pts = by.get(date)
    const lead = Math.round((Date.parse(`${date}T00:00:00Z`) - d0) / 864e5)
    const c = combine(pts, weightFn(weightsByHorizon?.[horizonForLeadDays(Math.max(1, lead))]), 1)
    const maxes = pts.map(p => p.max)
    const [maxLo, maxHi] = band(maxes)
    const [minLo, minHi] = band(pts.map(p => p.min))
    const spread = pts.length >= 2 ? r1(Math.max(...maxes) - Math.min(...maxes)) : null
    const wind = c.mean('wind')
    return {
      date, lead,
      tempMax: r1(c.mean('max')), tempMin: r1(c.mean('min')),
      maxLo, maxHi, minLo, minHi,
      rainPct: c.rainPct,
      windKmh: wind == null ? null : Math.round(wind),
      icon: c.topCode == null ? null : weatherIcon(c.topCode),
      condition: c.topCode == null ? null : decodeWeatherCode(c.topCode),
      spread, agree: spread == null ? null : spread <= 2 ? 3 : spread <= 4 ? 2 : 1,
      n: pts.length,
    }
  })
}
