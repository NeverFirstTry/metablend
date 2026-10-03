// What VoiceOver / TalkBack read for things the eye takes in at a glance:
// a chart's range, an hour card, a summit hour. Uses the page's own
// formatters so units and decimals match what is on screen.
import { t } from './i18n.js'
import { fill } from './outlook/text.js'

export const A11Y_KEYS = ['a11yChart', 'a11yRain', 'a11yWind', 'a11yFreezing', 'a11yStorm', 'a11ySpark']
const hh = iso => iso.slice(11, 16)
const tr = (lang, key, vars) => fill(t(lang, key), vars)

export function chartSummary(lang, hours, fmtTemp) {
  const valid = (hours ?? []).filter(h => typeof h.temp === 'number')
  if (!valid.length) return ''
  const lo = valid.reduce((a, b) => (b.temp < a.temp ? b : a)), hi = valid.reduce((a, b) => (b.temp > a.temp ? b : a))
  const rain = Math.max(0, ...valid.map(h => h.rainPct ?? 0))
  return tr(lang, 'a11yChart', { min: fmtTemp(lo.temp), minAt: hh(lo.t), max: fmtTemp(hi.temp), maxAt: hh(hi.t), rain })
}

export function hourLabel(lang, h, fmtTemp) {
  return [hh(h.t), fmtTemp(h.temp), h.rainPct != null ? tr(lang, 'a11yRain', { pct: h.rainPct }) : null].filter(Boolean).join(', ')
}

export function summitHourLabel(lang, h, fmtTemp) {
  return [
    hourLabel(lang, h, fmtTemp),
    h.windKmh != null ? tr(lang, 'a11yWind', { kmh: h.windKmh }) : null,
    h.freezingLevel != null ? tr(lang, 'a11yFreezing', { m: h.freezingLevel }) : null,
    h.storm ? tr(lang, 'a11yStorm', { level: t(lang, `storm${h.storm[0].toUpperCase()}${h.storm.slice(1)}`) }) : null,
  ].filter(Boolean).join(', ')
}

// The leaderboard's recent-scoring sparkline (last 24 reports, as drawn).
export function sparkLabel(lang, data) {
  const recent = (data ?? []).slice(-24)
  return tr(lang, 'a11ySpark', { n: recent.length, close: recent.filter(d => d > 0).length, off: recent.filter(d => d < 0).length })
}
