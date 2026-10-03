// The nowcast in words: the forecast card's sentence, the widget's short
// line and the "Rain soon" notification body.
import { t } from './i18n.js'
import { fill } from './outlook/text.js'

export const NOWCAST_KEYS = ['ncTitle', 'ncDry', 'ncStart', 'ncStartFor', 'ncStop', 'ncAll', 'ncLight', 'ncModerate', 'ncHeavy',
  'ncShortStart', 'ncShortStop', 'ncRough', 'ncMinutes', 'ncAgreeHint', 'pushNowcastBody', 'pushNowcastBodyOpen']
const LEVEL = { light: 'ncLight', moderate: 'ncModerate', heavy: 'ncHeavy' }
const hh = iso => iso.slice(11, 16)
const tr = (lang, key, vars) => fill(t(lang, key), vars)
const level = (lang, i) => t(lang, LEVEL[i] ?? 'ncLight')
const minutes = (lang, n) => tr(lang, 'ncMinutes', { n })

export function nowcastSentence(lang, s) {
  if (!s) return null
  if (s.kind === 'dry') return t(lang, 'ncDry')
  if (s.kind === 'stop') return tr(lang, 'ncStop', { until: hh(s.until) })
  if (s.kind === 'all') return tr(lang, 'ncAll', { intensity: level(lang, s.intensity) })
  return s.duration
    ? tr(lang, 'ncStartFor', { at: hh(s.at), duration: minutes(lang, s.duration), intensity: level(lang, s.intensity) })
    : tr(lang, 'ncStart', { at: hh(s.at), intensity: level(lang, s.intensity) })
}

export function nowcastShort(lang, s) {
  if (s?.kind === 'start') return tr(lang, 'ncShortStart', { at: hh(s.at) })
  if (s?.kind === 'stop') return tr(lang, 'ncShortStop', { until: hh(s.until) })
  return null
}

export function nowcastPushBody(lang, r) {
  return r.duration
    ? tr(lang, 'pushNowcastBody', { minutes: r.minutes, intensity: level(lang, r.intensity), duration: minutes(lang, r.duration) })
    : tr(lang, 'pushNowcastBodyOpen', { minutes: r.minutes, intensity: level(lang, r.intensity) })
}
