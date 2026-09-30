// Share links and the embeddable widget (pure — unit tested). Shared links go
// to /city/<name>: a page with a live preview card of that city's weather that
// forwards to the forecast; widgets are /widget/<name> in an iframe.

import { t, LANGUAGES } from './i18n.js'
import { fill } from './outlook/text.js'

export const SITE = 'https://metablend.app'
const LANG_CODES = LANGUAGES.map(l => l.code)
export const EMBED_SIZES = { compact: [300, 200], wide: [480, 180] }
export const WIDGET_THEMES = ['auto', 'dark', 'light']

export const pickLang = l => (LANG_CODES.includes(l) ? l : 'en')
export const pickUnit = u => (u === 'F' ? 'F' : 'C')
export const pickTheme = th => (WIDGET_THEMES.includes(th) ? th : 'auto')

const query = pairs => {
  const q = new URLSearchParams(pairs.filter(([, v]) => v != null && v !== '')).toString()
  return q ? `?${q}` : ''
}

// The link a share carries; lang / unit shape the preview card, not the page
// (the friend who opens it gets their own language and unit).
export function cityShareUrl({ city, lang, unit }, origin = SITE) {
  return `${origin}/city/${encodeURIComponent(city)}${query([['lang', pickLang(lang)], ['unit', unit === 'F' ? 'F' : null]])}`
}

// '{city} · 18° · Clear' + sources line — separators, so no language has to
// bend a weather word into the middle of a sentence
export function shareText(lang, { city, temp, condition, sources, agree }) {
  const head = [city, temp, condition].filter(Boolean).join(' · ')
  return `${head}\n${fill(t(lang, 'shareText'), { n: sources, agree })}`
}

export function widgetPath({ city, lang, unit, theme }) {
  return `/widget/${encodeURIComponent(city)}${query([['lang', pickLang(lang)], ['unit', unit === 'F' ? 'F' : null], ['theme', pickTheme(theme) === 'auto' ? null : theme]])}`
}

const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

export function embedCode({ city, lang, unit, theme, size = 'compact' }, origin = SITE) {
  const [w, h] = EMBED_SIZES[size] ?? EMBED_SIZES.compact
  const src = origin + widgetPath({ city, lang, unit, theme })
  return `<iframe src="${attr(src)}" width="${w}" height="${h}" style="border:0;border-radius:16px" loading="lazy" title="${attr(`MetaBlend · ${city}`)}"></iframe>`
}
