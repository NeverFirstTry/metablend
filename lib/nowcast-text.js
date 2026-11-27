// The nowcast in words: the forecast card's sentence, the widget's short
// line and the "Rain soon" notification body.
import { t } from './i18n.js'
import { fill } from './outlook/text.js'
import { eventText } from './precip.js'

export const NOWCAST_KEYS = ['ncTitle', 'ncDry', 'ncStart', 'ncStartFor', 'ncStop', 'ncAll', 'ncLight', 'ncModerate', 'ncHeavy',
  'ncShortStart', 'ncShortStop', 'ncRough', 'ncMinutes', 'ncAgreeHint', 'pushNowcastBody', 'pushNowcastBodyOpen',
  'ncPrecipStart', 'ncPrecipStartFor', 'ncPrecipStop', 'ncPrecipAll', 'ncPrecipShortStart', 'ncPrecipShortStop']
const LEVEL = { light: 'ncLight', moderate: 'ncModerate', heavy: 'ncHeavy' }
const hh = iso => iso.slice(11, 16)
const tr = (lang, key, vars) => fill(t(lang, key), vars)
const level = (lang, i) => t(lang, LEVEL[i] ?? 'ncLight')
const minutes = (lang, n) => tr(lang, 'ncMinutes', { n })

// What falls (`kind`, lib/nowcast.js nowcastKind): rain keeps the sentences it had; snow and mixed take the noun
// sentences with their word; without a kind (the nowcast cannot tell snow from rain, and no forecast hour was at
// hand) the neutral word, "Niederschlag". The neutral sentence leaves the intensity out: its adjective is made
// for a noun of one gender and number, and the neutral nouns differ.
function say(lang, kind, rainKey, anyKey, vars) {
  if (kind === 'rain') return tr(lang, rainKey, vars)
  const text = eventText(lang, anyKey, kind, { ...vars, ...(kind ? {} : { intensity: '' }) })
  return kind ? text : text.replace(/\s*·\s*$/, '')
}

export function nowcastSentence(lang, s, kind) {
  if (!s) return null
  if (s.kind === 'dry') return t(lang, 'ncDry')
  if (s.kind === 'stop') return say(lang, kind, 'ncStop', 'ncPrecipStop', { until: hh(s.until) })
  if (s.kind === 'all') return say(lang, kind, 'ncAll', 'ncPrecipAll', { intensity: level(lang, s.intensity) })
  return s.duration
    ? say(lang, kind, 'ncStartFor', 'ncPrecipStartFor', { at: hh(s.at), duration: minutes(lang, s.duration), intensity: level(lang, s.intensity) })
    : say(lang, kind, 'ncStart', 'ncPrecipStart', { at: hh(s.at), intensity: level(lang, s.intensity) })
}

export function nowcastShort(lang, s, kind) {
  if (s?.kind === 'start') return say(lang, kind, 'ncShortStart', 'ncPrecipShortStart', { at: hh(s.at) })
  if (s?.kind === 'stop') return say(lang, kind, 'ncShortStop', 'ncPrecipShortStop', { until: hh(s.until) })
  return null
}

export function nowcastPushBody(lang, r) {
  return r.duration
    ? tr(lang, 'pushNowcastBody', { minutes: r.minutes, intensity: level(lang, r.intensity), duration: minutes(lang, r.duration) })
    : tr(lang, 'pushNowcastBodyOpen', { minutes: r.minutes, intensity: level(lang, r.intensity) })
}
