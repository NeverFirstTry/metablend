// The summit page's 7-day forecast headed its precipitation chance "Regen" / "Rain" at any temperature, beside rows
// that say "Schnee ab 09:00" since 2026-11-26 (owner, 2026-11-26: "the precipitation-chance column header follows
// the same rule as the rows: "Schnee" below 0°, "Schneeregen" from 0° to under 2°, "Regen" above, per row or per day
// as the layout allows. Check it fits at 320 px in all 13 languages."). One header cannot say three things, so the
// column is headed by the neutral word and every day says what falls on it: by the summit's temperature in the
// hours that carry most of that day's chance.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { summitDays } from './hike/blend.js'
import { summitProps } from './hike/summit-props.js'
import { precipWord } from './hike/text.js'
import { LANGUAGES } from './i18n.js'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { tempFormatter } = await import('./outlook/text.js')
const { default: SummitDays } = await import('../app/components/hike/SummitDays.jsx')
const { default: SummitPage } = await import('../app/mountains/[peak]/SummitPage.jsx')
const de = (await import('./i18n/de.js')).default
const en = (await import('./i18n/en.js')).default

const hour = (date, hh, temp, rainPct) => ({ t: `${date}T${hh}:00`, temp, rainPct, windKmh: 20, freezingLevel: 800, storm: 'low', icon: '⛅' })

test('a day says what most of its chance falls as', () => {
  const days = summitDays([
    // Monday: most of the chance falls below freezing: snow, though the morning is milder
    hour('2026-11-30', '08', 1, 20), hour('2026-11-30', '14', -6, 90), hour('2026-11-30', '20', -8, 40),
    // Tuesday: most of it at +1: mixed
    hour('2026-12-01', '08', -3, 10), hour('2026-12-01', '14', 1, 70),
    // Wednesday: most of it at +5: rain, said as before with no field
    hour('2026-12-02', '08', -1, 10), hour('2026-12-02', '14', 5, 60),
    // Thursday, as on Ben Nevis on 1 December 2026: the chance peaks in a mild hour past midnight, then it snows
    // from morning on. The day's icon (noon) shows snow; the word beside the chance must not say rain
    hour('2026-12-03', '00', 2, 96), hour('2026-12-03', '06', -1, 70), hour('2026-12-03', '12', -0.4, 78),
    // Friday: no chance given at all: no word of its own
    hour('2026-12-04', '08', -9, null),
    // Saturday: a dry day far below freezing still says what would fall
    hour('2026-12-05', '08', -9, 0), hour('2026-12-05', '14', -7, 0),
  ])
  assert.deepEqual(days.map(d => d.precip ?? 'rain'), ['snow', 'mixed', 'rain', 'snow', 'rain', 'snow'])
  assert.equal('precip' in days[2], false, 'rain carries no field: an older answer reads the same')
  assert.equal('precip' in days[4], false)
  assert.deepEqual(days.map(d => d.rainPct), [90, 70, 60, 96, null, 0])
})

test('the summit page is given the day\'s kind', () => {
  const p = summitProps({ nowLocal: '2026-11-30T10:00', days: [{ date: '2026-11-30', icon: '🌨', tempMin: -6, tempMax: -3, windMax: 30, rainPct: 90, freezingMin: 500, freezingMax: 900, storm: 'low', precip: 'snow', feelsMin: -14 }] })
  assert.equal(p.days[0].precip, 'snow')
  assert.equal('feelsMin' in p.days[0], false, 'still only what the page shows')
})

test('precipWord: the rows\' own words, in every language', async () => {
  assert.equal(precipWord('de', 'snow'), 'Schnee')
  assert.equal(precipWord('de', 'mixed'), 'Schneeregen')
  assert.equal(precipWord('de', undefined), 'Regen')
  assert.equal(precipWord('en', 'snow'), 'snow')
  for (const { code } of LANGUAGES) {
    const pack = (await import(`./i18n/${code}.js`)).default
    assert.equal(precipWord(code, 'snow'), pack.reasonSnow, code)
    assert.equal(precipWord(code, 'mixed'), pack.reasonMixed, code)
    assert.equal(precipWord(code, 'rain'), pack.reasonRain, code)
    assert.ok(pack.colPrecip, `${code}: the neutral column word`)
  }
  // the column's own word, not precipLabel: that one heads an amount in mm, and in Japanese and Korean it says so
  // ("降水量", "강수량": precipitation amount), which is wrong over "100% 雪"
  assert.equal((await import('./i18n/ja.js')).default.colPrecip, '降水')
  assert.equal((await import('./i18n/ko.js')).default.colPrecip, '강수')
  assert.equal(de.colPrecip, 'Niederschlag')
})

const fmt = { fmtTemp: tempFormatter('C') }
const day = (date, o) => ({ date, icon: '🌨', tempMin: -6, tempMax: -3, windMax: 30, rainPct: 90, freezingMin: 500, freezingMax: 900, storm: 'low', ...o })
const DAYS = [day('2026-11-30', { precip: 'snow', rainPct: 100 }), day('2026-12-01', { precip: 'mixed', rainPct: 98 }), day('2026-12-02', { rainPct: 56 }), day('2026-12-03', { rainPct: null })]

test('the phone rows: each day says its chance and what falls; the legend no longer calls it rain', () => {
  const html = render(h(SummitDays, { days: DAYS, todayLocal: null, lang: 'de', fmt, rain: true }))
  assert.match(html, />100% Schnee</)
  assert.match(html, />98% Schneeregen</)
  assert.match(html, />56% Regen</)
  assert.ok(!html.includes(de.rainChanceLabel), 'no "Regenwahrscheinlichkeit" under days of snow')
  // the words may wrap under the number: nothing forbids a line break inside the label
  const label = html.match(/<span class="([^"]*)">100% Schnee</)?.[1] ?? ''
  assert.doesNotMatch(label, /whitespace-nowrap|truncate/)
  // a day without a chance says nothing; the app's Week rows (no rain chance) are as they were
  assert.equal((html.match(/% (Schnee|Schneeregen|Regen)</g) ?? []).length, 3)
  assert.doesNotMatch(render(h(SummitDays, { days: DAYS, todayLocal: null, lang: 'de', fmt })), /% Schnee/)
})

test('the table from sm up: a neutral heading, and each row says what falls', () => {
  const copy = { days: DAYS, windows: { today: null, tomorrow: null }, todayLocal: '2026-11-30', tomorrowLocal: '2026-12-01', stormUnknown: false, sources: ['ECMWF IFS'], kept: false, madeAt: '2026-11-30T19:00', utcOffsetSec: 3600 }
  const peak = { id: 'testhorn', name: 'Testhorn', elev: 3000, lat: 47.07, lon: 12.69, region: 'tauern', country: 'Austria', grade: null }
  const html = render(h(SummitPage, { peak, avaRows: 0, nearby: [], fullList: [], ...copy }))
  const table = html.slice(html.indexOf('<table'), html.indexOf('</table>'))
  const heads = [...table.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map(m => m[1])
  assert.ok(heads.includes(en.colPrecip), 'the column is headed "Precipitation"')
  // a static render is always English, where both words read "Precipitation": the key itself is checked in the source
  const source = readFileSync(new URL('../app/mountains/[peak]/SummitPage.jsx', import.meta.url), 'utf8')
  assert.match(source, /t\(lang, 'colPrecip'\)/)
  assert.doesNotMatch(source, /precipLabel/, 'not the word that heads an amount in mm')
  assert.ok(!heads.includes(en.colRain), 'not "Rain"')
  assert.match(table, />100% snow</)
  assert.match(table, />98% rain and snow</)
  assert.match(table, />56% rain</)
})
