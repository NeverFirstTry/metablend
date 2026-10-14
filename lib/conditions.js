// Consensus condition → icon (pure — unit tested). Sources report English
// condition strings; night only swaps the clear-sky icon: `dark` from the
// city's sun times when known, else a rough guess from its longitude.
import { isNightAt } from './localtime.js'

export function conditionIcon(condition, lon, dark = null) {
  const c = (condition ?? '').toLowerCase()
  if (/thunder|storm/.test(c)) return '⛈'
  if (/snow|sleet|ice|freez/.test(c)) return '🌨'
  if (/drizzle/.test(c)) return '🌦'
  if (/rain|shower/.test(c)) return '🌧'
  if (/fog|mist|haze/.test(c)) return '🌫'
  if (/overcast/.test(c)) return '☁️'
  if (/partly|broken|scattered|few/.test(c)) return '⛅'
  if (/cloud/.test(c)) return '☁️'
  if (/clear|sunny|fair/.test(c)) return (dark ?? isNightAt(lon)) ? '🌙' : '☀️'
  return '🌤'
}

// A source's condition as a kind of weather; the first three are wet (the
// same words the forecast's "n sources report rain" counts).
const KINDS = [
  ['thunder', /thunder|storm/], ['snow', /snow|sleet|hail|ice pellets/], ['rain', /drizzle|rain|shower/],
  ['fog', /fog|mist|haze/], ['partly', /partly|partial|broken|scattered|few/], ['cloudy', /overcast|cloud/], ['clear', /clear|sunny|fair/],
]
const WET = new Set(['thunder', 'snow', 'rain'])
const kindOf = condition => KINDS.find(([, re]) => re.test((condition ?? '').toLowerCase()))?.[0] ?? null

// The weather now, as most healthy sources say it — one source's shower
// mustn't headline a dry majority. Wet or dry by majority, then the most
// common kind within, in its most common wording; ties go to Open-Meteo.
// The synthetic MetaBlend Local entry doesn't vote. Nothing recognisable:
// Open-Meteo's wording, else the first healthy source's.
export function heroCondition(data) {
  const live = (data?.sources ?? []).filter(s => !s.down && !s.synthetic && s.condition)
  const om = live.find(s => s.apiId === 'open-meteo')
  const votes = live.map(s => ({ s, kind: kindOf(s.condition) })).filter(v => v.kind)
  if (!votes.length) return om?.condition ?? live[0]?.condition ?? null
  const omKind = om ? kindOf(om.condition) : null
  // the most common of the keys; a tie goes to Open-Meteo's, then to the first seen
  const top = (keys, omKey) => {
    const n = new Map()
    for (const k of keys) n.set(k, (n.get(k) ?? 0) + 1)
    const max = Math.max(...n.values())
    const tied = [...n.keys()].filter(k => n.get(k) === max)
    return tied.includes(omKey) ? omKey : tied[0]
  }
  const wet = top(votes.map(v => WET.has(v.kind)), omKind ? WET.has(omKind) : undefined)
  const side = votes.filter(v => WET.has(v.kind) === wet)
  const kind = top(side.map(v => v.kind), omKind)
  const words = side.filter(v => v.kind === kind).map(v => v.s.condition)
  const word = top(words.map(w => w.toLowerCase()), omKind === kind ? om.condition.toLowerCase() : undefined)
  return om?.condition.toLowerCase() === word ? om.condition : words.find(w => w.toLowerCase() === word)
}
