// "Regen ab 08:00" stood in a summit's Week rows at -12 and -9 degrees on the Schneeberg, 2076 m, freezing level
// 380 to 760 m (owner, 2026-11-26, seen in the reel: "Precipitation on a summit below freezing must read as snow,
// and mixed near 0°"). The window logic knew one word for precipitation, and the hour's icon came from a model's
// weather code, which is for the model's grid height, the valley's. Now the temperature at the height decides:
// below freezing snow, from freezing to 2 degrees above it rain and snow mixed, warmer rain. In the summit window's
// reason (peak view, Week rows, summit pages, the widgets' line, the alerts), the hour's icon, and on a route's
// stages, its "why not" line and its alert.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { precipKind } from './hike/physics.js'
import { summitWindow } from './hike/window.js'
import { windowText, reasonKey } from './hike/text.js'
import { rowText } from './hike/week.js'
import { blendSummitHourly, summitDays } from './hike/blend.js'
import { stageFlag } from './route/flag.js'
import { suggestStart } from './route/verdict.js'
import { REASON_KEY } from './route/reasons.js'
import { pushText } from './push/text.js'
import { LANGUAGES } from './i18n.js'

const SUN = { sunrise: '07:20', sunset: '16:10' }
const DAY = '2026-11-26'
const H = (hh, o = {}) => ({ t: `${DAY}T${hh}:00`, storm: 'low', rainPct: 10, windKmh: 20, feels: -5, temp: -5, ...o })
// a day whose precipitation starts at 08:00 and stays, at the given summit temperature
const wetFrom8 = temp => summitWindow(['07', '08', '09', '10', '11', '12'].map(hh => H(hh, hh >= '08' ? { rainPct: 70, temp } : { temp })), SUN)

test('precipKind: the temperature at the height decides what falls', () => {
  assert.equal(precipKind(-12), 'snow')
  assert.equal(precipKind(-0.1), 'snow', 'below freezing it is snow')
  assert.equal(precipKind(0), 'mixed', 'at freezing it is mixed')
  assert.equal(precipKind(1.9), 'mixed')
  assert.equal(precipKind(2), 'rain')
  assert.equal(precipKind(8), 'rain')
  assert.equal(precipKind(null), 'rain', 'no temperature: the word stays as it was')
})

test('the summit window: precipitation keeps its reason and says what falls', () => {
  // the Schneeberg case: -12 degrees at 08:00
  assert.deepEqual(wetFrom8(-12).next, { reason: 'rain', at: `${DAY}T08:00`, precip: 'snow' })
  assert.deepEqual(wetFrom8(1).next, { reason: 'rain', at: `${DAY}T08:00`, precip: 'mixed' })
  // rain is said as before, with no new field: an answer made before this change reads the same
  assert.deepEqual(wetFrom8(6).next, { reason: 'rain', at: `${DAY}T08:00` })
  // another reason never carries it
  const windy = summitWindow(['07', '08', '09'].map(hh => H(hh, hh >= '08' ? { windKmh: 60 } : {})), SUN)
  assert.deepEqual(windy.next, { reason: 'wind', at: `${DAY}T08:00` })
})

test('the words: a Week row, the peak view and the route keys', () => {
  const row = temp => ({ date: DAY, exact: true, stormUnknown: false, w: { window: null, next: wetFrom8(temp).next } })
  assert.equal(rowText('de', row(-12)), 'Schnee ab 08:00')
  assert.equal(rowText('en', row(-12)), 'snow from 08:00')
  assert.equal(rowText('de', row(1)), 'Schneeregen ab 08:00')
  assert.equal(rowText('en', row(1)), 'rain and snow from 08:00')
  assert.equal(rowText('de', row(6)), 'Regen ab 08:00')
  assert.equal(windowText('de', wetFrom8(-12), { date: DAY, todayLocal: DAY }).sub, 'Schnee ab 08:00')
  assert.equal(windowText('en', { window: null, next: { reason: 'rain', at: `${DAY}T08:00` } }, { date: DAY, todayLocal: DAY }).sub, 'rain from 08:00', 'an older answer without the field')
  assert.equal(reasonKey('rain', 'snow'), 'reasonSnow')
  assert.equal(reasonKey('rain', 'mixed'), 'reasonMixed')
  assert.equal(reasonKey('rain'), 'reasonRain')
  assert.equal(reasonKey('wind', 'snow'), 'reasonWind', 'only precipitation has a kind')
  assert.equal(reasonKey('late', undefined, REASON_KEY), 'routeReasonLate')
  assert.equal(reasonKey('made-up'), undefined)
})

test('the four new texts in all 13 languages, none of them the rain word', async () => {
  for (const { code } of LANGUAGES) {
    const pack = (await import(`./i18n/${code}.js`)).default
    for (const key of ['reasonSnow', 'reasonMixed', 'routeSnowPossible', 'routeMixedPossible']) assert.ok(pack[key], `${code}: ${key}`)
    assert.notEqual(pack.reasonSnow, pack.reasonRain, code)
    assert.notEqual(pack.reasonMixed, pack.reasonRain, code)
    assert.notEqual(pack.reasonMixed, pack.reasonSnow, code)
    for (const key of ['routeSnowPossible', 'routeMixedPossible']) assert.ok(pack[key].includes('{pct}'), `${code}: ${key} keeps its number`)
  }
})

test('the hour\'s icon: a model\'s rain at a summit below freezing is drawn as snow', () => {
  const EMPTY = { temp: null, feels: null, pop: null, precip: null, code: null, cape: null, fl: null, lpi: null, cloud: null, wind10: null, w850: null, w700: null, w600: null }
  const at = (temp, code) => blendSummitHourly([{ id: 'icon', hourly: [{ t: `${DAY}T12:00`, ...EMPTY, temp, code, pop: 70, w700: 20 }] }], { h48: { icon: 1 } }, { nowLocal: `${DAY}T12:00`, elev: 2076 })
  assert.equal(at(-12, 61)[0].icon, '🌨', 'rain code, -12 degrees')
  assert.equal(at(-12, 80)[0].icon, '🌨', 'showers too')
  assert.equal(at(-12, 61)[0].code, 61, 'the model\'s code is kept as it came')
  assert.equal(at(6, 61)[0].icon, '🌧', 'above freezing the rain icon stays')
  assert.equal(at(1, 61)[0].icon, '🌧', 'mixed has no picture of its own: the rain icon stays')
  assert.equal(at(-12, 95)[0].icon, '⛈', 'a thunderstorm stays a thunderstorm')
  assert.equal(at(-12, 3)[0].icon, '⛅', 'a dry hour keeps its icon')
  // the day's icon is its noon hour's
  assert.equal(summitDays(at(-12, 61))[0].icon, '🌨')
})

test('a route: the stage, the "why not" stage and the alert say what falls there', () => {
  assert.deepEqual(stageFlag('de', { blocker: 'rain', rain: 60, temp: -9, icon: '🌧' }), { text: 'Schnee möglich, 60%', icon: '🌨' })
  assert.deepEqual(stageFlag('en', { blocker: 'rain', rain: 60, temp: 1, icon: '🌧' }), { text: 'rain and snow possible, 60%', icon: '🌧' })
  assert.deepEqual(stageFlag('de', { blocker: 'rain', rain: 60, temp: 7, icon: '🌦' }), { text: 'Regen möglich, 60%', icon: '🌧' })
  assert.deepEqual(stageFlag('de', { blocker: 'rain', rain: null, temp: -9, icon: '🌧' }), { text: 'Schnee', icon: '🌨' })
  // no start all day because of precipitation at -9 degrees on the one stage
  const hours = ['07', '08', '09', '10', '11', '12', '13', '14', '15', '16'].map(hh => H(hh, { rainPct: 70, temp: -9 }))
  const s = suggestStart({ hoursByStage: [hours], offsets: [0, 60], date: DAY, sun: SUN })
  assert.equal(s.none, true)
  assert.equal(s.reason, 'rain')
  assert.equal(s.firstBad.precip, 'snow')
  const warm = suggestStart({ hoursByStage: [hours.map(h => ({ ...h, temp: 7 }))], offsets: [0, 60], date: DAY, sun: SUN })
  assert.equal('precip' in warm.firstBad, false)
  const push = lang => pushText(lang, 'C', { kind: 'hike_route_evening', vars: { peak: 'Fadensteig', date: '2026-11-27', todayLocal: DAY, suggestion: s } }).body
  assert.match(push('de'), /: Schnee$/)
  assert.match(push('en'), /: snow$/)
  assert.match(pushText('de', 'C', { kind: 'hike_route_evening', vars: { peak: 'Fadensteig', date: '2026-11-27', todayLocal: DAY, suggestion: warm } }).body, /: Regen$/)
})
