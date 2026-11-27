// Owner, 2026-11-27, after the summit page's precipitation column: "the same rule for the city pages' table, the
// hour strip and route stage legends, so nowhere says "Regen" below freezing." Every place that names a
// precipitation chance now goes by the temperature it stands beside: below 0 snow, 0 to under 2 mixed, warmer rain
// (lib/hike/physics.js precipKind). A row with room says the word ("60% Schnee"); a legend names its drop by what
// is shown (all rain, all snow, otherwise the neutral word); a value without a temperature gets the neutral word.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { kindAt, dayKind, chanceLabelKey, shortChanceLabelKey } from './precip.js'
import { hourLabel, summitHourLabel, chartSummary, A11Y_KEYS } from './a11y-text.js'
import { headlineText, tempFormatter, deltaFormatter, spanFormatter } from './outlook/text.js'
import { LANGUAGES } from './i18n.js'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { ValueKey } = await import('../app/components/ValueKey.jsx')
const { default: SummitStrip } = await import('../app/components/hike/SummitStrip.jsx')
const { default: HourStrip } = await import('../app/components/outlook/HourStrip.jsx')
const { default: Tab7d } = await import('../app/components/outlook/Tab7d.jsx')
const { default: CityPage } = await import('../app/weather/[city]/CityPage.jsx')
const de = (await import('./i18n/de.js')).default
const en = (await import('./i18n/en.js')).default
const src = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const C = tempFormatter('C')
const fmt = { fmtTemp: C, fmtDelta: deltaFormatter('C'), fmtSpan: spanFormatter('C') }

test('the rule beside any temperature, and for a day that has only its minimum and maximum', () => {
  assert.deepEqual([-0.1, 0, 1.9, 2, 14].map(kindAt), ['snow', 'mixed', 'mixed', 'rain', 'rain'])
  assert.deepEqual([null, undefined, '3'].map(kindAt), [undefined, undefined, undefined], 'no temperature, no kind: never rain by default')
  assert.equal(dayKind({ tempMin: -6, tempMax: -1 }), 'snow')
  assert.equal(dayKind({ tempMin: -3, tempMax: 3 }), 'mixed', 'by the mean of the two')
  assert.equal(dayKind({ tempMin: -1, tempMax: 6 }), 'rain')
  assert.equal(dayKind({ tempMin: null, tempMax: 3 }), undefined)
  assert.equal(dayKind(undefined), undefined)
})

test('a legend names its drop by what is shown', () => {
  assert.equal(chanceLabelKey(['rain', 'rain']), 'rainChanceLabel')
  assert.equal(chanceLabelKey(['snow', 'snow', 'snow']), 'snowChanceLabel')
  assert.equal(chanceLabelKey(['snow', 'rain']), 'precipChanceLabel', 'two kinds: the neutral word')
  assert.equal(chanceLabelKey(['mixed', 'mixed']), 'precipChanceLabel')
  assert.equal(chanceLabelKey(['rain', undefined]), 'precipChanceLabel', 'a value without a temperature')
  assert.equal(chanceLabelKey([]), 'precipChanceLabel', 'nothing shown: nothing claimed')
  // the short label of the compare cards: rain where it is rain, otherwise the column word
  assert.equal(shortChanceLabelKey('rain'), 'rainLabel')
  assert.deepEqual(['snow', 'mixed', undefined].map(shortChanceLabelKey), ['colPrecip', 'colPrecip', 'colPrecip'])
})

test('the new words in 13 languages; the neutral ones never name rain', async () => {
  assert.equal(de.snowChanceLabel, 'Schneewahrscheinlichkeit')
  assert.equal(de.precipChanceLabel, 'Niederschlagswahrscheinlichkeit')
  assert.equal(en.snowChanceLabel, 'Chance of snow')
  assert.equal(en.precipChanceLabel, 'Chance of precipitation')
  assert.ok(A11Y_KEYS.includes('a11yChartPrecip'))
  assert.ok(!A11Y_KEYS.includes('a11yRain'), 'the hour sentence says the chance with its word instead')
  const plain = s => s.replace(/\{[a-z]+\}/g, '').toLowerCase()
  for (const { code } of LANGUAGES) {
    const pack = (await import(`./i18n/${code}.js`)).default
    for (const k of ['snowChanceLabel', 'precipChanceLabel', 'a11yChartPrecip', 'hlBestDaySubKind']) assert.ok(pack[k], `${code}: ${k}`)
    assert.equal('a11yRain' in pack, false, `${code}: a11yRain is gone`)
    // the language's own word for rain must not stand in them
    for (const k of ['snowChanceLabel', 'precipChanceLabel', 'a11yChartPrecip', 'hlBestDaySubKind']) assert.ok(!plain(pack[k]).includes(pack.reasonRain.toLowerCase()), `${code}: ${k} names rain ("${pack[k]}")`)
    assert.equal('colRain' in pack, false, `${code}: the old column heading has no reader left`)
    assert.match(pack.a11yChartPrecip, /\{rain\}/, `${code}: the chart sentence keeps its number`)
    assert.match(pack.hlBestDaySubKind, /\{temp\}.*\{chance\}/, `${code}: the best day's line keeps its two parts`)
  }
})

test('ValueKey: the drop is named as its caller says, and neutrally when the caller says nothing', () => {
  assert.match(render(h(ValueKey, { lang: 'de', kinds: ['wind', 'rain'], rainLabel: 'snowChanceLabel' })), /Schneewahrscheinlichkeit/)
  assert.match(render(h(ValueKey, { lang: 'de', kinds: ['rain'], rainLabel: 'rainChanceLabel' })), /Regenwahrscheinlichkeit/)
  const bare = render(h(ValueKey, { lang: 'de', kinds: ['rain'] }))
  assert.match(bare, /Niederschlagswahrscheinlichkeit/)
  assert.doesNotMatch(bare, /Regen/)
})

const sun = { sunrise: '07:30', sunset: '16:00' }
const hour = (hh, temp, rainPct) => ({ t: `2026-11-27T${hh}:00`, icon: '🌨', temp, windKmh: 20, freezingLevel: 800, rainPct, storm: 'low' })
const COLD = [hour('12', -6, 80), hour('13', -5, 60), hour('14', -7, null)]
const WARM = [hour('12', 6, 80), hour('13', 5, 60)]
const ACROSS = [hour('12', -1, 80), hour('13', 3, 60)]

for (const [name, Strip] of [['the summit hour strip', SummitStrip], ['the city hour strip', HourStrip]]) {
  test(`${name}: the legend and the sentence per hour follow the temperatures shown`, () => {
    const cold = render(h(Strip, { hours: COLD, fmtTemp: C, sun, lang: 'de' }))
    assert.match(cold, /Schneewahrscheinlichkeit/)
    assert.doesNotMatch(cold, /Regen/, 'nothing says rain at -6 degrees')
    assert.match(cold, /80% Schnee/, 'the sentence a screen reader gets')
    const warm = render(h(Strip, { hours: WARM, fmtTemp: C, sun, lang: 'de' }))
    assert.match(warm, /Regenwahrscheinlichkeit/)
    assert.match(warm, /80% Regen/)
    const across = render(h(Strip, { hours: ACROSS, fmtTemp: C, sun, lang: 'de' }))
    assert.match(across, /Niederschlagswahrscheinlichkeit/)
    assert.doesNotMatch(across, /Regenwahrscheinlichkeit|Schneewahrscheinlichkeit/)
    assert.match(across, /80% Schnee/)
    assert.match(across, /60% Regen/)
  })
}

test('the sentences a screen reader gets: an hour, and the chart', () => {
  assert.equal(hourLabel('en', hour('15', 24, 10), C), `15:00, ${C(24)}, 10% rain`)
  assert.equal(hourLabel('en', hour('15', -6, 80), C), `15:00, ${C(-6)}, 80% snow`)
  assert.equal(hourLabel('en', hour('15', 1, 80), C), `15:00, ${C(1)}, 80% rain and snow`)
  assert.equal(hourLabel('en', hour('15', -6, null), C), `15:00, ${C(-6)}`)
  const blind = hourLabel('en', hour('15', null, 40), C)
  assert.ok(blind.includes(`${en.precipChanceLabel} 40%`) && !/rain/i.test(blind), 'no temperature: the neutral word')
  assert.match(summitHourLabel('de', hour('15', -6, 80), C), /80% Schnee/)
  assert.ok(chartSummary('en', WARM, C).endsWith(', rain chance up to 80%'), 'a mild day reads as before')
  assert.ok(chartSummary('en', COLD, C).endsWith(en.a11yChartPrecip.replace('{rain}', '80')))
  assert.doesNotMatch(chartSummary('de', COLD, C), /Regen/)
  assert.doesNotMatch(chartSummary('de', ACROSS, C), /Regen/)
  // an hour without a chance does not decide: the dry hour at +9 leaves the day's chances all below freezing
  assert.doesNotMatch(chartSummary('de', [...COLD, hour('16', 9, 0)], C), /Regen/)
})

const outlook = JSON.parse(readFileSync(new URL('./__fixtures__/outlook-vienna.json', import.meta.url), 'utf8'))
const withDays = (min, max) => ({ ...outlook, days: outlook.days.map(d => ({ ...d, tempMin: min, tempMax: max })) })

test('the city week: the legend by the days shown, and the best day says what falls', () => {
  const week = o => render(h(Tab7d, { outlook: o, unit: 'C', lang: 'de', fmt }))
  const cold = week(withDays(-8, -2))
  assert.match(cold, /Schneewahrscheinlichkeit/)
  assert.doesNotMatch(cold.slice(0, cold.indexOf('aria-expanded')), /Regen/, 'headline and legend: no rain at -8 to -2')
  assert.match(week(withDays(5, 12)), /Regenwahrscheinlichkeit/)
  const one = { ...outlook, days: outlook.days.map((d, i) => ({ ...d, tempMin: i ? 5 : -8, tempMax: i ? 12 : -2 })) }
  assert.match(week(one), /Niederschlagswahrscheinlichkeit/)
  // the best day's line under the headline
  const best = { code: 'best_day', date: '2026-11-09', tempMax: -2, rainPct: 20, splits: [] }
  const words = { todayLocal: '2026-11-08', ...fmt }
  assert.equal(headlineText('de', 'd7', best, { ...words, precip: 'snow' }).sub, `${C(-2)}, 20% Schnee`)
  assert.equal(headlineText('de', 'd7', best, { ...words, precip: 'mixed' }).sub, `${C(-2)}, 20% Schneeregen`)
  assert.equal(headlineText('de', 'd7', best, { ...words, precip: 'rain' }).sub, de.hlBestDaySub.replace('{temp}', C(-2)).replace('{rain}', '20'), 'rain reads as before')
  assert.equal(headlineText('de', 'd7', best, words).sub, `${C(-2)}, 20%`, 'no kind known: the chance alone, never rain')
  assert.match(src('app/components/outlook/Tab7d.jsx'), /precip: dayKind\(/, 'the week tab hands the best day its kind')
})

const city = (temp, days) => h(CityPage, {
  slug: 'kiruna', name: 'Kiruna', country: 'Sweden', condition: 'Snow', sourceCount: 12, topWeights: [], others: [],
  consensus: { temp, feelsLike: temp - 4, rainPct: 70, windKmh: 12, confidencePct: 80 },
  outlook: { nowLocal: '2026-11-27T14:00', cc: 'SE', sources: [], days },
})
const cityDay = (date, tempMin, tempMax, rainPct) => ({ date, icon: '🌨', condition: 'Snow', tempMin, tempMax, rainPct, windKmh: 10 })

test('the city page: the value beside the temperature and every row of the table', () => {
  const cold = render(city(-9, [cityDay('2026-11-27', -12, -6, 60), cityDay('2026-11-28', -2, 4, 98), cityDay('2026-11-29', 3, 9, 30), cityDay('2026-11-30', null, null, 41), cityDay('2026-12-01', -5, -1, null)]))
  assert.match(cold, />Chance of snow</)
  assert.doesNotMatch(cold, />Chance of rain</)
  const table = cold.slice(cold.indexOf('<table'), cold.indexOf('</table>'))
  const heads = [...table.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map(m => m[1].replace(/<[^>]+>/g, ''))
  assert.ok(heads.includes(en.colPrecip), 'the column is headed "Precipitation"')
  assert.ok(!heads.includes('Rain'), 'not "Rain"')
  // on a phone the heading is for screen readers only: one long word ("Niederschlag") made the table 41 px wider
  // than before at 320 px, and every row says its own word there
  assert.match(table, new RegExp(`<span class="sr-only sm:not-sr-only">${en.colPrecip}</span></th>`))
  // the word stands in the row: under the number on a phone (small, as on the summit list), beside it from sm up
  const cells = [...table.matchAll(/<td[^>]*>(\d+%.*?)<\/td>/g)].map(m => m[1].replace(/<!-- -->/g, ''))
  assert.equal(cells[0], '60% <span class="block text-xs sm:inline sm:text-sm">snow</span>')
  assert.deepEqual(cells.map(c => c.replace(/<[^>]+>/g, '').trim()), ['60% snow', '98% rain and snow', '30% rain', '41%'], 'what a crawler reads; a day without its temperatures says the chance alone')
  assert.match(render(city(1, [])), />Chance of precipitation</, 'around freezing: the neutral word')
  assert.match(render(city(8, [])), />Chance of rain</)
})

test('the compare cards and the route stages go by the same rule', () => {
  const home = src('app/HomePage.jsx')
  assert.match(home, /t\(lang, shortChanceLabelKey\(kindAt\(d\.consensus\.temp\)\)\)/)
  assert.doesNotMatch(home, /t\(lang, 'rainLabel'\)/)
  const route = src('app/components/hike/RouteView.jsx')
  assert.match(route, /rainLabel=\{chanceLabelKey\(d\.stages\.filter\(st => st\.rain != null\)\.map\(st => kindAt\(st\.temp\)\)\)\}/)
})
