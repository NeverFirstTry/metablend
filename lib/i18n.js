import en from './i18n/en.js'
import de from './i18n/de.js'
import fr from './i18n/fr.js'
import es from './i18n/es.js'
import it from './i18n/it.js'

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
]

// one module per language (lib/i18n/<code>.js); parity.test.js keeps them in step
const T = { en, de, fr, es, it }

// A text with a count in it: the singular "<key>One" for exactly one (when
// the language has it), else the plural; {n} and any other {vars} filled in.
export function tn(lang, key, n, vars = {}) {
  const k = n === 1 && (T[lang]?.[key + 'One'] ?? T.en[key + 'One']) ? key + 'One' : key
  const all = { ...vars, n }
  return String(T[lang]?.[k] ?? T.en[k] ?? k).replace(/\{(\w+)\}/g, (m, v) => (all[v] ?? m))
}

export function t(lang, key) {
  return T[lang]?.[key] ?? T.en[key] ?? key
}

export function getWeatherOptions(lang, isNight) {
  const opts = []
  // Sunny is daytime-only; Clear is always offered (and the only sun option at night)
  if (!isNight) opts.push({ value: 'sunny', label: t(lang, 'sunny') })
  opts.push(
    { value: 'clear',        label: t(lang, 'clear') },
    { value: 'partlyCloudy', label: t(lang, 'partlyCloudy') },
    { value: 'cloudy',       label: t(lang, 'cloudy') },
    { value: 'overcast',     label: t(lang, 'overcast') },
    { value: 'rain',         label: t(lang, 'rain') },
    { value: 'thunder',      label: t(lang, 'thunder') },
    { value: 'snow',         label: t(lang, 'snow') },
  )
  return opts
}

// Map a raw/English condition string (from the weather APIs) to a canonical
// key, then translate it. Order matters: more specific needles come first.
const CONDITION_NEEDLES = [
  ['thunder', 'cThunder'], ['storm', 'cThunder'],
  ['drizzle', 'cDrizzle'],
  ['freezing', 'cFreezing'],
  ['sleet', 'cSleet'], ['ice pellet', 'cSleet'],
  ['snow', 'cSnow'],
  ['shower', 'cShowers'],
  ['rain', 'cRain'],
  ['fog', 'cFog'], ['mist', 'cFog'], ['haze', 'cFog'],
  ['overcast', 'cOvercast'],
  ['partly', 'cPartlyCloudy'],
  ['cloud', 'cCloudy'],
  ['clear', 'cClear'], ['fair', 'cClear'], ['sun', 'cClear'],
]
export function translateCondition(lang, raw) {
  if (!raw) return ''
  const s = String(raw).toLowerCase()
  for (const [needle, key] of CONDITION_NEEDLES) {
    if (s.includes(needle)) return t(lang, key)
  }
  return raw // unrecognised provider text — show it untouched
}

// UV index level (WHO bands)
export function uvText(lang, v) {
  if (v == null) return '–'
  if (v < 3) return t(lang, 'uvLow')
  if (v < 6) return t(lang, 'uvModerate')
  if (v < 8) return t(lang, 'uvHigh')
  return t(lang, 'uvVeryHigh')
}

// Air-quality category (6-step, mapped from the European AQI value we fetch)
export function aqiText(lang, v) {
  if (v == null) return '–'
  if (v <= 20) return t(lang, 'aqiGood')
  if (v <= 40) return t(lang, 'aqiModerate')
  if (v <= 60) return t(lang, 'aqiUnhealthySensitive')
  if (v <= 80) return t(lang, 'aqiUnhealthy')
  if (v <= 100) return t(lang, 'aqiVeryUnhealthy')
  return t(lang, 'aqiHazardous')
}

// Pollen level
export function pollenText(lang, v) {
  if (v == null) return '–'
  if (v < 20) return t(lang, 'pollenLow')
  if (v < 50) return t(lang, 'pollenModerate')
  return t(lang, 'pollenHigh')
}

// Derive 2-letter language code from navigator.language (e.g. 'de-AT' → 'de')
// Takes navigator.language ('de-AT') or a whole Accept-Language header
// ('de,en-US;q=0.7') — the first language tag decides.
export function detectLang(navigatorLang) {
  const code = (navigatorLang ?? '').split(/[-_,;]/)[0].trim().toLowerCase()
  return LANGUAGES.find(l => l.code === code)?.code ?? 'en'
}

// The UI language: the one picked by hand (cookie), else the phone's. Push
// registration needs this too — falling back to 'en' re-registered every
// non-English phone in English, which also moved its home city lookup.
// What the language pickers show: the language picked by hand, or "system"
// — follow the phone (and English when we don't speak its language).
export const LANG_SYSTEM = 'system'
export function langChoice(saved) {
  return LANGUAGES.some(l => l.code === saved) ? saved : LANG_SYSTEM
}

export function preferredLang(chosen, navigatorLang) {
  return LANGUAGES.some(l => l.code === chosen) ? chosen : detectLang(navigatorLang)
}
