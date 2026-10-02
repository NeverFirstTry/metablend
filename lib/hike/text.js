// Summit headlines (pure — unit tested): a summit window as one sentence in
// the viewer's language, for the hiking views and, later, push alerts.
import { t } from '../i18n.js'
import { fill, dayWord } from '../outlook/text.js'

const hour = iso => iso.slice(11, 16)
export const REASON = { storms: 'reasonStorms', rain: 'reasonRain', wind: 'reasonWind', cold: 'reasonCold' }

// w: a summitWindow() result (null = no daylight left); date: the day it
// covers. stormUnknown: no model reported storm energy — the window ignored
// storms, so the headline has to say so.
export function windowText(lang, w, { date, todayLocal, stormUnknown = false }) {
  const tr = (key, vars = {}) => fill(t(lang, key), vars)
  if (!w) return { title: tr('swNoDaylight'), sub: null }
  const day = dayWord(lang, date, todayLocal)
  const then = w.next ? tr('swThen', { reason: t(lang, REASON[w.next.reason]), at: hour(w.next.at) }) : null
  const sub = [then, stormUnknown ? t(lang, 'hikeNoStorm') : null].filter(Boolean).join(' · ') || null
  if (w.window) return { title: tr('swTitle', { day, from: hour(w.window.from), to: hour(w.window.to) }), sub }
  return { title: tr('swNone', { day }), sub }
}

// A window with unknown storm risk is never shown green.
export const windowTone = (w, { stormUnknown = false } = {}) => (!w ? 'neutral' : !w.window ? 'rain' : stormUnknown ? 'warn' : 'ok')
