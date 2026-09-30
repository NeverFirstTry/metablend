// Blends the per-model summit series into one consensus per hour and per day
// (pure — unit tested). Weights are the region's learned outlook weights:
// summits have no observations of their own to learn from, so they borrow
// the valley's trust.
import { band, rainProb, weightFn, horizonForLeadHours } from '../outlook/blend.js'
import { weatherIcon } from '../weather.js'
import { summitWind, freezingLevel, stormRisk } from './physics.js'

const r1 = v => Math.round(v * 10) / 10
const RISK_RANK = { low: 0, moderate: 1, high: 2 }

// The most serious storm risk in a list ('low' < 'moderate' < 'high');
// unknown (null) entries are skipped; null when nothing is known.
export function worstStorm(list) {
  return (list ?? []).filter(Boolean).reduce((a, b) => (a == null || RISK_RANK[b] > RISK_RANK[a] ? b : a), null)
}

function weighted(pts, ws, key) {
  let s = 0, sw = 0
  pts.forEach((p, i) => { if (typeof p[key] === 'number') { s += p[key] * ws[i]; sw += ws[i] } })
  return sw ? s / sw : null
}

// nowLocal: the peak-local hour to start from, 'YYYY-MM-DDTHH:MM'.
export function blendSummitHourly(series, weightsByHorizon, { nowLocal, elev, hours = 168 }) {
  const by = new Map()
  for (const s of series) for (const p of s.hourly) {
    if (p.t < nowLocal) continue
    let e = by.get(p.t)
    if (!e) by.set(p.t, (e = []))
    e.push({ id: s.id, ...p, wind: summitWind(elev, p), fzl: freezingLevel(p, elev), rp: rainProb(p.pop, p.precip, 0.1) })
  }
  const t0 = Date.parse(`${nowLocal}:00Z`)
  return [...by.keys()].sort().slice(0, hours).map(t => {
    const pts = by.get(t)
    const w = weightFn(weightsByHorizon?.[horizonForLeadHours((Date.parse(`${t}:00Z`) - t0) / 3600e3)])
    let ws = pts.map(p => Math.max(0, w(p.id)))
    if (!ws.some(v => v > 0)) ws = pts.map(() => 1)
    const rain = weighted(pts, ws, 'rp')
    const rainPct = rain == null ? null : Math.round(rain * 100)
    const cape = weighted(pts, ws, 'cape')
    const lpis = pts.map(p => p.lpi).filter(v => typeof v === 'number')
    const lpi = lpis.length ? Math.max(...lpis) : null
    const [lo, hi] = band(pts.map(p => p.temp))
    const [fzlLo, fzlHi] = band(pts.map(p => p.fzl))
    let top = null, topW = -1
    pts.forEach((p, i) => { if (typeof p.code === 'number' && ws[i] > topW) { topW = ws[i]; top = p } })
    const feels = weighted(pts, ws, 'feels'), wind = weighted(pts, ws, 'wind'), fzl = weighted(pts, ws, 'fzl')
    return {
      t, temp: r1(weighted(pts, ws, 'temp')), lo, hi,
      feels: feels == null ? null : r1(feels),
      rainPct,
      windKmh: wind == null ? null : Math.round(wind),
      freezingLevel: fzl == null ? null : Math.round(fzl / 10) * 10, fzlLo, fzlHi,
      cape: cape == null ? null : Math.round(cape),
      storm: stormRisk({ cape, pop: rainPct, lpi }),
      icon: top ? weatherIcon(top.code) : null,
      n: pts.length,
    }
  })
}

// One row per summit day from the blended hours. Today starts now and is
// flagged partial, as is a cut-off last day.
export function summitDays(hourly, days = 7) {
  const byDate = new Map()
  for (const h of hourly ?? []) {
    const d = h.t.slice(0, 10)
    if (!byDate.has(d)) byDate.set(d, [])
    byDate.get(d).push(h)
  }
  return [...byDate.entries()].slice(0, days).map(([date, hs]) => {
    const nums = k => hs.map(h => h[k]).filter(v => typeof v === 'number')
    const temps = nums('temp'), fz = nums('freezingLevel'), winds = nums('windKmh'), rain = nums('rainPct'), feels = nums('feels')
    const noon = hs.find(h => h.t.slice(11, 13) === '12') ?? hs[Math.floor(hs.length / 2)]
    return {
      date, partial: hs.length < 24,
      tempMax: Math.max(...temps), tempMin: Math.min(...temps),
      feelsMin: feels.length ? Math.min(...feels) : null,
      windMax: winds.length ? Math.max(...winds) : null,
      rainPct: rain.length ? Math.max(...rain) : null,
      freezingMin: fz.length ? Math.min(...fz) : null,
      freezingMax: fz.length ? Math.max(...fz) : null,
      storm: worstStorm(hs.map(h => h.storm)),
      icon: noon?.icon ?? null,
    }
  })
}
