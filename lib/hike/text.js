// Summit headlines (pure — unit tested): a summit window as one sentence in
// the viewer's language, for the hiking views and, later, push alerts.
import { t } from '../i18n.js'
import { fill, dayWord } from '../outlook/text.js'

const hour = iso => iso.slice(11, 16)
const REASON = { storms: 'reasonStorms', rain: 'reasonRain', wind: 'reasonWind', cold: 'reasonCold' }

// w: a summitWindow() result (null = no daylight left); date: the day it covers.
export function windowText(lang, w, { date, todayLocal }) {
  const tr = (key, vars = {}) => fill(t(lang, key), vars)
  if (!w) return { title: tr('swNoDaylight'), sub: null }
  const day = dayWord(lang, date, todayLocal)
  const then = w.next ? tr('swThen', { reason: t(lang, REASON[w.next.reason]), at: hour(w.next.at) }) : null
  if (w.window) return { title: tr('swTitle', { day, from: hour(w.window.from), to: hour(w.window.to) }), sub: then }
  return { title: tr('swNone', { day }), sub: then }
}

export const windowTone = w => (!w ? 'neutral' : w.window ? 'ok' : 'rain')
