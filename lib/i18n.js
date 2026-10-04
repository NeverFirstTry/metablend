import en from './i18n/en.js'
import { createRegistry } from './i18n-registry.js'

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' },
  { code: 'cs', label: 'Čeština' },
  { code: 'sl', label: 'Slovenščina' },
  { code: 'pt', label: 'Português (Brasil)' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文（简体）' },
  { code: 'ko', label: '한국어' },
]

// One module per language (lib/i18n/<code>.js); parity.test.js keeps them in
// step. English is built in (pages prerender in English, and it's the
// fallback); each other language is its own small file the browser fetches
// only for a visitor who reads it. The server and tests load them all.
const R = createRegistry({ en }, {
  de: () => import('./i18n/de.js'),
  fr: () => import('./i18n/fr.js'),
  es: () => import('./i18n/es.js'),
  it: () => import('./i18n/it.js'),
  nl: () => import('./i18n/nl.js'),
  pl: () => import('./i18n/pl.js'),
  cs: () => import('./i18n/cs.js'),
  sl: () => import('./i18n/sl.js'),
  pt: () => import('./i18n/pt.js'),
  ja: () => import('./i18n/ja.js'),
  zh: () => import('./i18n/zh.js'),
  ko: () => import('./i18n/ko.js'),
})
if (typeof window === 'undefined') await R.loadAll()

// Switch to a language only once this resolves (true = its texts are here,
// false = unknown or offline: stay in English). LocaleReady waits for
// languageSettled() before revealing the page.
export const loadLanguage = code => R.load(code)
export const languageSettled = () => R.settled()
// a whole language pack — for a server-rendered page to inline (LangPack)
export const packFor = code => R.pack(code)

const PLURAL_FORM = { one: 'One', two: 'Two', few: 'Few', many: 'Many' }
const pluralRules = {}

// The text for a count: the language's plural category (Intl.PluralRules —
// Polish 2 → few, 5 → many; Slovenian 2 → two) picks key + One/Two/Few/Many
// when the language has that form, else the base key ("other").
export function pluralKey(lang, key, n, has) {
  const rules = (pluralRules[lang] ??= new Intl.PluralRules(lang))
  const form = PLURAL_FORM[rules.select(n)]
  return form && has(key + form) ? key + form : key
}

// A text with a count in it; {n} and any other {vars} filled in.
export function tn(lang, key, n, vars = {}) {
  const pack = R.pack(lang) ?? en
  const k = pluralKey(R.has(lang) ? lang : 'en', key, n, f => f in pack)
  const all = { ...vars, n }
  return String(pack[k] ?? en[k] ?? en[key] ?? k).replace(/\{(\w+)\}/g, (m, v) => (all[v] ?? m))
}

export function t(lang, key) {
  return R.pack(lang)?.[key] ?? en[key] ?? key
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
  const tag = (navigatorLang ?? '').split(/[,;]/)[0].trim().toLowerCase().replace(/_/g, '-')
  const code = tag.split('-')[0]
  // Simplified Chinese only: Taiwan, Hong Kong, Macau and Hant read Traditional
  if (code === 'zh' && /-(tw|hk|mo|hant)\b/.test(tag)) return 'en'
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

// In the browser, start fetching the visitor's language as soon as this module
// runs — in parallel with hydration, not after it (useLang and the home page
// then find it loaded or on its way). Last, so everything above exists.
if (typeof window !== 'undefined') {
  try {
    const saved = document.cookie.match(/(?:^|; *)metablend_lang=([a-z]+)/)?.[1]
    R.load(preferredLang(saved, navigator.language))
  } catch { /* no cookie access: the pages load it when they switch */ }
}
