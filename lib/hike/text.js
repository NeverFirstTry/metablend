// Summit headlines (pure — unit tested): a summit window as one sentence in
// the viewer's language, for the hiking views and, later, push alerts.
import { t } from '../i18n.js'
import { fill, dayWord } from '../outlook/text.js'
import { addDays } from '../localtime.js'

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

// After sunset no window is possible today: the peak opens on Tomorrow.
export const defaultSummitTab = d => (d && d.windows && d.windows.today === null ? 'tomorrow' : 'today')

// Today after sunset, instead of a mostly empty page: one card pointing to
// tomorrow's window (tapping it opens Tomorrow).
export function noDaylightPointer(lang, d) {
  const todayLocal = d.nowLocal.slice(0, 10)
  const w = d.windows?.tomorrow ?? null
  const stormUnknown = !!d.notes?.includes('no_storm_data')
  return {
    title: t(lang, 'swNoDaylight'),
    sub: w ? windowText(lang, w, { date: addDays(todayLocal, 1), todayLocal, stormUnknown }).title : null,
    // neutral: a green or blue box on "no daylight left" would read as a verdict on tonight
    tone: 'neutral',
  }
}
