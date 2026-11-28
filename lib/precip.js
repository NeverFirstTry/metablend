// What a precipitation chance is called beside a temperature (owner, 2026-11-27: "so nowhere says "Regen" below
// freezing"). The thresholds are the summit's (hike/physics.js precipKind): below 0 snow, 0 to under 2 mixed,
// warmer rain, by the whole degrees the screen shows (owner, 2026-11-28). A summit day gets its kind from its
// hours (hike/blend.js summitDays); everything else asks here.
import { t } from './i18n.js'
import { precipKind, precipKindOfDay } from './hike/physics.js'

// no temperature, no kind: precipKind alone reads a missing temperature as rain
export const kindAt = temp => (typeof temp === 'number' ? precipKind(temp) : undefined)

// a day that has only its minimum and maximum (a city's days): the kind at the middle of the two as shown
export const dayKind = d => (typeof d?.tempMin === 'number' && typeof d?.tempMax === 'number' ? precipKindOfDay(d.tempMin, d.tempMax) : undefined)

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

// What falls in one hour of a city's forecast (owner, 2026-11-27: "by the sources' weather codes or the
// temperature"). The temperature sets the frame (below 0 snow, 0 to under 2 mixed, warmer rain), and the hour's
// code, the heaviest source's, says two things the temperature cannot: freezing rain and freezing drizzle are
// rain, which is what falls; and a snow code makes it snow where the temperature alone would say mixed. From 2
// degrees on the temperature decides: the code is one source's, for its own grid height, which on a coast or in
// a valley lies above the place (Bergen, 27 November 2026: code 73 at 3.5 degrees). A snow code and no
// temperature: snow. Neither: undefined.
const SNOW_CODE = new Set([71, 73, 75, 77, 85, 86]), FREEZING_RAIN = new Set([56, 57, 66, 67])
export function hourKind(h) {
  if (FREEZING_RAIN.has(h?.code)) return 'rain'
  const byTemp = kindAt(h?.temp)
  return SNOW_CODE.has(h?.code) && byTemp !== 'rain' ? 'snow' : byTemp
}

// What falls over several hours (a headline's wet hours, the two-hour card): the kind that carries most of their
// chance, as a summit day (hike/blend.js summitDays); rain when two tie; undefined when no hour has a kind
export function hoursKind(hours) {
  const share = {}
  for (const h of hours ?? []) {
    const kind = hourKind(h)
    if (kind) share[kind] = (share[kind] ?? 0) + (typeof h.rainPct === 'number' ? h.rainPct : 0) + 1
  }
  let top
  for (const kind of ['rain', 'mixed', 'snow']) if (share[kind] > (share[top] ?? 0)) top = kind
  return top
}

// The words by which a source's condition counts as precipitation right now (lib/consensus.js counts "raining
// now" with them, snow included)
export const PRECIP_WORDS = /rain|drizzle|shower|sleet|snow|hail|thunder|storm/i

// What the sources that report precipitation right now report, for "6 of 14 sources report snow now" beside the
// current temperature. Owner, 2026-11-28: "Quote the sources: the line says what most reporting sources report, at
// any temperature, since it says "sources report". The temperature rule only applies where no source names a
// kind." So each source counts by its own word (first match; freezing rain is rain, which is what falls), and the
// kind most of them name names the line. Showers, hail and thunder name no kind. Where none is named, or as many
// name one kind as another, the temperature rule decides (kindAt); undefined when that tells nothing either. The
// sources' stored reports of November 2026 say "snow", "light snow", "snow, overcast", "rain", "drizzle".
const SAID = [[/freezing (rain|drizzle)/i, 'rain'], [/sleet|rain and snow|snow and rain|wintry/i, 'mixed'], [/snow/i, 'snow'], [/rain|drizzle/i, 'rain']]
export function reportedKind(sources, temp) {
  const share = {}
  for (const s of sources ?? []) {
    const said = s?.condition ?? ''
    if (!PRECIP_WORDS.test(said)) continue
    const kind = SAID.find(([words]) => words.test(said))?.[1]
    if (kind) share[kind] = (share[kind] ?? 0) + 1
  }
  const most = Math.max(0, ...Object.values(share))
  const named = Object.keys(share).filter(kind => share[kind] === most)
  return named.length === 1 ? named[0] : kindAt(temp)
}

// An event's sentence with the word for what falls in its {what}: "{what} likely {from}-{to} {day}" reads "Snow
// likely …". The packs keep the words in small letters, so the word gets its capital where the sentence starts
// with it. An event of unknown kind gets the neutral word, never "rain".
export function eventText(lang, key, precip, vars = {}) {
  const text = t(lang, key), word = t(lang, WORD[precip] ?? 'reasonPrecip')
  const what = text.startsWith('{what}') ? word.charAt(0).toLocaleUpperCase(lang) + word.slice(1) : word
  return text.replace(/\{(\w+)\}/g, (m, k) => (k === 'what' ? what : vars[k] ?? m))
}

// the short label of one chance (the compare cards): "Rain prob." where it is rain, otherwise the column's word
export const shortChanceLabelKey = kind => (kind === 'rain' ? 'rainLabel' : 'colPrecip')
