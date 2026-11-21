// The peak's Week tab verdict (pure, unit tested; UX review 2026-11-20, P1): the best day and, for every
// day the forecast covers to its evening, its favourable window or why it has none. Built on /api/hike
// windows.days (lib/hike/build.js): [{ date, w, stormUnknown, n }], w as windows.today is.
import { t } from '../i18n.js'
import { fill, dayWord } from '../outlook/text.js'

import { REASON, windowTone } from './text.js'

// How many days from today get a window to the hour; later ones say it as a tendency and are the best day
// only when no nearer day has a window. One switch: the owner decides the number (Fable proposed 3, today,
// tomorrow and the day after; until 2026-11-20 only today and tomorrow had a verdict at all).
export const EXACT_DAYS = 3

const hour = iso => iso.slice(11, 16)
const daysFrom = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)

export function weekVerdict(days, todayLocal, exactDays = EXACT_DAYS) {
  const rows = new Map()
  for (const d of Array.isArray(days) ? days : []) rows.set(d.date, { ...d, exact: daysFrom(todayLocal, d.date) < exactDays })
  // near before far, a known storm risk before an unknown one, then the longest window, then the earliest
  const rank = r => [r.exact ? 0 : 1, r.stormUnknown ? 1 : 0, -(r.w.window.hours ?? 0), r.date]
  const best = [...rows.values()].filter(r => r.w?.window).sort((a, b) => {
    const x = rank(a), y = rank(b)
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1
    return 0
  })[0] ?? null
  return { best, rows }
}

export function headlineText(lang, { best }, todayLocal) {
  if (!best) return { title: t(lang, 'wkNone'), sub: null, tone: 'rain' }
  const vars = { day: dayWord(lang, best.date, todayLocal), from: hour(best.w.window.from), to: hour(best.w.window.to) }
  return {
    title: fill(t(lang, best.exact ? 'wkBest' : 'wkBestTendency'), vars),
    sub: best.stormUnknown ? t(lang, 'hikeNoStorm') : null,
    tone: windowTone(best.w, { stormUnknown: best.stormUnknown }),
  }
}

// one row's line: its window (to the hour for near days, a tendency for far ones), the reason it has none,
// or "no daylight left" for today after dark
export function rowText(lang, r) {
  if (!r) return null
  if (!r.w) return t(lang, 'swNoDaylight')
  const storm = r.stormUnknown ? ` · ${t(lang, 'hikeNoStorm')}` : ''
  if (r.w.window) return fill(t(lang, r.exact ? 'wkRowWindow' : 'wkRowTendency'), { from: hour(r.w.window.from), to: hour(r.w.window.to) }) + storm
  if (r.w.next) return fill(t(lang, 'swThen'), { reason: t(lang, REASON[r.w.next.reason]), at: hour(r.w.next.at) })
  return t(lang, 'wkRowNone')
}

