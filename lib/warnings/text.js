// What the app and its notifications say about an official warning (pure —
// unit tested). The official texts are the issuer's own; we only label the
// level and type, and say when, in the issuer's own clock.
import { t } from '../i18n.js'
import { dayWord } from '../outlook/text.js'
import { WARNING_TYPES } from './parse.js'

const LEVEL = { 2: 'warnYellow', 3: 'warnOrange', 4: 'warnRed' }
const HINT = { 2: 'warnYellowHint', 3: 'warnOrangeHint', 4: 'warnRedHint' }
export const WARNING_KEYS = [
  'warnTitle', 'warnMore', 'warnSource', 'warnAdvice', 'warnShow', ...Object.values(LEVEL), ...Object.values(HINT),
  ...WARNING_TYPES.map(type => `warnType_${type}`),
]

export const levelWord = (lang, level) => t(lang, LEVEL[level] ?? 'warnYellow')
export const levelHint = (lang, level) => t(lang, HINT[level] ?? 'warnYellowHint')
export const levelIcons = level => '⚠'.repeat(Math.max(1, Math.min(3, level - 1)))
export const typeWord = (lang, type) => t(lang, WARNING_TYPES.includes(type) ? `warnType_${type}` : 'warnType_other')

const EMPTY = { event: '', headline: '', description: '', instruction: '' }
export function warningText(w, lang) {
  const tx = w?.texts ?? {}
  return { ...EMPTY, ...(tx[lang] ?? tx.en ?? Object.values(tx)[0] ?? {}) }
}

// "today 15:00–21:00", "today 22:00 – tomorrow 06:00", "Saturday 06:00–14:00"
export function warningSpan(lang, w, todayLocal) {
  const [d1, t1] = [w.onset.slice(0, 10), w.onset.slice(11, 16)]
  const [d2, t2] = [w.expires.slice(0, 10), w.expires.slice(11, 16)]
  const day = d => dayWord(lang, d, todayLocal)
  return d1 === d2 ? `${day(d1)} ${t1}–${t2}` : `${day(d1)} ${t1} – ${day(d2)} ${t2}`
}

export const sortWarnings = list => [...(list ?? [])].sort((a, b) => b.level - a.level || Date.parse(a.onset) - Date.parse(b.onset))

// the strip: the most serious orange / red warning that is on, or starts within 24 h
export function stripWarning(list, now = Date.now()) {
  return sortWarnings(list).find(w => w.level >= 3 && Date.parse(w.expires) > now && Date.parse(w.onset) - now <= 24 * 3600e3) ?? null
}

// a planned hike's day: the most serious orange / red warning touching that local date
export function warningOnDay(list, date) {
  return sortWarnings(list).find(w => w.level >= 3 && w.onset.slice(0, 10) <= date && w.expires.slice(0, 10) >= date) ?? null
}
