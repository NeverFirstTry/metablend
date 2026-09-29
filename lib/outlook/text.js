// Headline codes → sentences, plus the unit formatters the outlook views
// share (pure — used by the page and by the server-rendered city pages).

import { t } from '../i18n.js'
import { addDays, formatCalendarDate } from '../localtime.js'

export const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m))

export const tempFormatter = unit => c => (c == null ? '–' : `${Math.round(unit === 'F' ? c * 9 / 5 + 32 : c)}°`)
// differences scale with the unit but never get the +32 offset
export const deltaFormatter = unit => d => {
  if (d == null) return '–'
  const v = unit === 'F' ? d * 9 / 5 : d
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(1)}°`
}
export const spanFormatter = unit => d => (d == null ? '–' : `${Math.round(unit === 'F' ? d * 9 / 5 : d)}°`)

const hour = iso => iso.slice(11, 16)

export function dayWord(lang, date, todayLocal) {
  if (date === todayLocal) return t(lang, 'todayWord')
  if (date === addDays(todayLocal, 1)) return t(lang, 'tomorrowWord')
  return formatCalendarDate(date, lang, { weekday: 'long' })
}

export function headlineText(lang, which, h, {
  todayLocal, fmtTemp = tempFormatter('C'), fmtDelta = deltaFormatter('C'), fmtSpan = spanFormatter('C'),
} = {}) {
  if (!h) return null
  const tr = (key, vars = {}) => fill(t(lang, key), vars)
  const join = (...parts) => parts.filter(Boolean).join(' · ') || null
  const peak = h.peak ? tr('hlPeak', { day: dayWord(lang, h.peak.at.slice(0, 10), todayLocal), temp: fmtTemp(h.peak.temp), at: hour(h.peak.at) }) : null

  if (which === 'h48') {
    const agree = h.total ? tr('hlSourcesAgree', { agree: h.agree, total: h.total }) : null
    if (h.code === 'rain_now') return { title: h.until ? tr('hlRainNow', { until: hour(h.until) }) : tr('hlRainNow48'), sub: join(agree, peak) }
    if (h.code === 'rain_window') {
      return { title: tr('hlRainWindow', { from: hour(h.from), to: hour(h.to), day: dayWord(lang, h.from.slice(0, 10), todayLocal) }), sub: join(agree, peak) }
    }
    return { title: tr(h.code === 'dry' ? 'hlDry' : 'hlNoRainData'), sub: peak }
  }
  if (which === 'd7') {
    const s = h.splits?.[0]
    const split = s ? tr('hlSplit', { spread: fmtSpan(s.spread), day: dayWord(lang, s.date, todayLocal) }) : null
    if (h.code === 'best_day') {
      return { title: tr('hlBestDay', { day: dayWord(lang, h.date, todayLocal) }), sub: join(tr('hlBestDaySub', { temp: fmtTemp(h.tempMax), rain: h.rainPct ?? '–' }), split) }
    }
    return { title: tr('hlNoGoodDay'), sub: split }
  }
  if (which === 'd14') {
    const key = h.shift === 'cooling' ? 'hlCooling' : h.shift === 'warming' ? 'hlWarming'
      : h.dir === 'warmer' ? 'hlWarmer' : h.dir === 'cooler' ? 'hlCooler' : 'hlNormal'
    return { title: tr(key), sub: h.week1 != null ? tr('hlTrendSub', { w1: fmtDelta(h.week1) }) : null }
  }
  return null
}

export function headlineTone(which, h) {
  if (!h) return 'neutral'
  if (which === 'h48') return h.code === 'rain_now' || h.code === 'rain_window' ? 'rain' : h.code === 'dry' ? 'ok' : 'neutral'
  if (which === 'd7') return h.code === 'best_day' ? 'ok' : 'rain'
  if (h.shift === 'cooling' || (!h.shift && h.dir === 'cooler')) return 'rain'
  if (h.shift === 'warming' || (!h.shift && h.dir === 'warmer')) return 'warn'
  return 'neutral'
}
