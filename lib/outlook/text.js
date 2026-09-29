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

// The day as an adverb: "tomorrow", but "on Monday" / "am Montag" / "el lunes".
export function dayPhrase(lang, date, todayLocal) {
  const word = dayWord(lang, date, todayLocal)
  if (date === todayLocal || date === addDays(todayLocal, 1)) return word
  return fill(t(lang, 'onWeekday'), { day: word })
}

// Today / tomorrow only ever mention a temperature change of a degree or more.
function vsTodayText(tr, d, fmtSpan) {
  if (d == null) return null
  if (Math.abs(d) < 1) return tr('hlLikeToday')
  return tr(d > 0 ? 'hlWarmerThanToday' : 'hlCoolerThanToday', { n: fmtSpan(Math.abs(d)) })
}

export function headlineText(lang, which, h, {
  todayLocal, fmtTemp = tempFormatter('C'), fmtSpan = spanFormatter('C'),
} = {}) {
  if (!h) return null
  const tr = (key, vars = {}) => fill(t(lang, key), vars)
  const join = (...parts) => parts.filter(Boolean).join(' · ') || null
  const agree = h.total ? tr('hlSourcesAgree', { agree: h.agree, total: h.total }) : null
  const high = h.peak ? tr('hlHighAt', { temp: fmtTemp(h.peak.temp), at: hour(h.peak.at) }) : null
  const window = () => tr('hlRainWindow', { from: hour(h.from), to: hour(h.to), day: dayWord(lang, h.from.slice(0, 10), todayLocal) })

  if (which === 'today') {
    if (h.code === 'rain_now') {
      const title = h.until ? tr('hlRainNow', { until: hour(h.until) }) : tr(h.night ? 'hlRainAllNight' : 'hlRainRestOfDay')
      return { title, sub: join(agree, high) }
    }
    if (h.code === 'rain_window') return { title: window(), sub: join(agree, high) }
    const key = h.code === 'dry' ? (h.night ? 'hlDryTonight' : 'hlDryToday') : 'hlNoRainDataToday'
    return { title: tr(key), sub: high }
  }
  if (which === 'tomorrow') {
    const vs = vsTodayText(tr, h.vsToday, fmtSpan)
    if (h.code === 'rain_all_day') return { title: tr('hlRainAllDayTomorrow'), sub: join(agree, high, vs) }
    if (h.code === 'rain_window') return { title: window(), sub: join(agree, high, vs) }
    return { title: tr(h.code === 'dry' ? 'hlDryTomorrow' : 'hlNoRainDataTomorrow'), sub: join(high, vs) }
  }
  if (which === 'd7') {
    const s = h.splits?.[0]
    const split = s ? tr('hlSplit', { spread: fmtSpan(s.spread), when: dayPhrase(lang, s.date, todayLocal) }) : null
    if (h.code === 'best_day') {
      return { title: tr('hlBestDay', { day: dayWord(lang, h.date, todayLocal) }), sub: join(tr('hlBestDaySub', { temp: fmtTemp(h.tempMax), rain: h.rainPct ?? '–' }), split) }
    }
    return { title: tr('hlNoGoodDay'), sub: split }
  }
  return null
}

export function headlineTone(which, h) {
  if (!h) return 'neutral'
  if (which === 'd7') return h.code === 'best_day' ? 'ok' : 'rain'
  if (h.code === 'dry') return 'ok'
  return h.code.startsWith('rain') ? 'rain' : 'neutral'
}
