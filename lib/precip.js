// What a precipitation chance is called beside a temperature (owner, 2026-11-27: "so nowhere says "Regen" below
// freezing"). The thresholds are the summit's (hike/physics.js precipKind): below 0 snow, 0 to under 2 mixed,
// warmer rain. A summit day gets its kind from its hours (hike/blend.js summitDays); everything else asks here.
import { t } from './i18n.js'
import { precipKind } from './hike/physics.js'

// no temperature, no kind: precipKind alone reads a missing temperature as rain
export const kindAt = temp => (typeof temp === 'number' ? precipKind(temp) : undefined)

// a day that has only its minimum and maximum (a city's days): the kind at their mean
export const dayKind = d => (typeof d?.tempMin === 'number' && typeof d?.tempMax === 'number' ? precipKind((d.tempMin + d.tempMax) / 2) : undefined)

// a chance with what falls, where a row has room for the word: "100% snow", "98% rain and snow", "56% rain".
// Without a kind (an answer kept from before the days carried one, a value without its temperature) the chance
// alone, never "rain" (owner, 2026-11-27)
const WORD = { snow: 'reasonSnow', mixed: 'reasonMixed', rain: 'reasonRain' }
export const precipWord = (lang, precip) => (WORD[precip] ? t(lang, WORD[precip]) : '')
export const precipChance = (lang, pct, precip) => [`${pct}%`, precipWord(lang, precip)].filter(Boolean).join(' ')

// the name of a row of chances under its drop (hour cells and narrow columns have no room for a word each), by
// the kinds shown: all rain, all snow, otherwise the neutral word
export function chanceLabelKey(kinds) {
  const seen = new Set(kinds)
  if (seen.size !== 1) return 'precipChanceLabel'
  return seen.has('rain') ? 'rainChanceLabel' : seen.has('snow') ? 'snowChanceLabel' : 'precipChanceLabel'
}

// the short label of one chance (the compare cards): "Rain prob." where it is rain, otherwise the column's word
export const shortChanceLabelKey = kind => (kind === 'rain' ? 'rainLabel' : 'colPrecip')
