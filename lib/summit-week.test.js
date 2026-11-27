// The summit page's week on a phone (UX review M1, owner: before launch): each day was a block repeating five
// labels, so the week took four screens. A phone now gets the app's Week rows with one legend (rain chance
// added, which the page shows); a wider screen keeps the table.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { tempFormatter } = await import('./outlook/text.js')
const { default: SummitDays } = await import('../app/components/hike/SummitDays.jsx')
const { default: SummitPage } = await import('../app/mountains/[peak]/SummitPage.jsx')
const en = (await import('./i18n/en.js')).default

const MON = '2026-11-16', TUE = '2026-11-17'
const day = (date, rainPct) => ({ date, icon: '☀️', tempMin: -8, tempMax: -3, windMax: 40, rainPct, freezingMin: 1800, freezingMax: 2400, storm: 'low' })
const fmt = { fmtTemp: tempFormatter('C') }

test('SummitDays shows the precipitation chance when asked, each day with what falls; the app keeps its rows as they were', () => {
  const withRain = render(h(SummitDays, { days: [day(MON, 30), day(TUE, null)], todayLocal: null, lang: 'en', fmt, rain: true }))
  // this day has a chance and no kind, like an answer kept from before the days carried one: the chance alone
  assert.match(withRain, />30%</)
  // since 2026-11-26 the day itself says what falls ("30% rain", "90% snow"; lib/precip-column.test.js), so the
  // legend has no entry for it: "Chance of rain" stood there under days of snow
  assert.ok(!withRain.includes(en.rainChanceLabel), 'the legend no longer calls it rain')
  const app = render(h(SummitDays, { days: [day(MON, 30)], todayLocal: null, lang: 'en', fmt }))
  assert.doesNotMatch(app, /30%/)
})

test('the summit page: the rows for a phone, the table from sm up, and no card inside a card', () => {
  const copy = { days: [day(MON, 30), day(TUE, 10)], windows: { today: null, tomorrow: null }, todayLocal: MON, tomorrowLocal: TUE, stormUnknown: false, sources: ['ECMWF IFS'], kept: false, madeAt: `${MON}T19:00`, utcOffsetSec: 3600 }
  const peak = { id: 'testhorn', name: 'Testhorn', elev: 3000, lat: 47.07, lon: 12.69, region: 'tauern', country: 'Austria', grade: null }
  const html = render(h(SummitPage, { peak, avaRows: 0, nearby: [], fullList: [], ...copy }))
  const week = html.slice(html.indexOf(`aria-label="${en.mtn7Day}"`))
  assert.match(week, /<div class="sm:hidden">/, 'the rows, for a phone')
  assert.match(week, /<table[^>]*class="[^"]*hidden sm:table/, 'the table, from sm up')
  // the section is a card only where the table stands; on a phone the rows bring their own card
  assert.match(html, new RegExp(`<section data-keep="true" aria-label="${en.mtn7Day}" class="mb-6 sm:bg-\\[var\\(--glass\\)\\] sm:shadow-\\[var\\(--lift\\)\\] sm:border sm:border-\\[var\\(--hairline\\)\\] sm:rounded-2xl sm:p-8"`))
})
