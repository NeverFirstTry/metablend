// Chinese on this site is simplified Chinese (a traditional-Chinese browser reads English, lib/i18n.js), but
// place names often arrive in traditional script: Open-Meteo's geocoder (GeoNames) and OpenStreetMap give
// Vienna as 維也納. toHans writes them in simplified characters, one character at a time, with OpenCC's table
// (lib/zh-hans-table.js); everything that is not a traditional character stays as it is.
import PAIRS from './zh-hans-table.js'

let MAP = null
const HAN = /[㐀-鿿豈-﫿\u{20000}-\u{3134f}]/u

export function toHans(s) {
  if (typeof s !== 'string' || !HAN.test(s)) return s
  if (!MAP) {
    const c = [...PAIRS]
    MAP = new Map()
    for (let i = 0; i < c.length; i += 2) MAP.set(c[i], c[i + 1])
  }
  return [...s].map(ch => MAP.get(ch) ?? ch).join('')
}

// a place name as a reader in this language sees it: simplified characters in Chinese, unchanged otherwise
export const placeIn = (lang, name) => (lang === 'zh' ? toHans(name) : name)
