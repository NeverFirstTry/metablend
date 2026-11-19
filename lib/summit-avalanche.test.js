// The avalanche danger on a summit page is read fresh when the page opens, never taken from the stored
// page (owner, 2026-11-18): a bulletin that changed after the page was stored must show its new level, and
// when the avalanche source is slow or down the page still loads, with a clear note instead of an old level.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { default: SummitPage, AvalancheSection } = await import('../app/mountains/[peak]/SummitPage.jsx')
const { readAvalanche } = await import('./avalanche/read.js')
const { ratingsRead } = await import('./avalanche/fetch.js')
const { avalancheAnswer } = await import('./avalanche/avalanche.js')
const { default: regionData } = await import('./avalanche/regions.json', { with: { type: 'json' } })
const en = (await import('./i18n/en.js')).default

const MON = '2026-11-16', TUE = '2026-11-17'
const day = date => ({ date, icon: '☀️', tempMin: -8, tempMax: -3, windMax: 40, rainPct: 10, freezingMin: 1800, freezingMax: 2400, storm: null })
const copy = { days: [day(MON), day(TUE)], windows: null, todayLocal: MON, tomorrowLocal: TUE, stormUnknown: false, sources: ['ECMWF IFS'], kept: false, madeAt: `${MON}T19:00`, utcOffsetSec: 3600 }
const peak = { id: 'piz-bernina', name: 'Piz Bernina', elev: 4049, lat: 46.38, lon: 9.91, region: 'eastern_alps', country: 'CH', grade: 'ZS' }
const LEVEL = /<span class="sr-only">(\d)(<!-- -->)?: <\/span>/
const section = props => render(h(AvalancheSection, { lang: 'en', reserve: 2, levels: [], ...props }))

test('the stored page shows no level of its own, even when the server hands it one (the bulletin may have changed since)', () => {
  // until 2026-11-18 the server rendered the level it read when the page was stored ("3 Considerable")
  const html = render(h(SummitPage, { peak, ava: { today: 3, tomorrow: 3 }, avaRows: 2, nearby: [], fullList: [], ...copy }))
  assert.ok(!LEVEL.test(html), 'no level in the stored page')
  assert.ok(!html.includes('Considerable'))
})

test('while the danger is read: the heading, the rows\' room kept, no level and no note yet', () => {
  const html = section({ read: undefined })
  assert.ok(html.includes('Avalanche danger'))
  assert.ok(!LEVEL.test(html))
  assert.ok(!html.includes(en.avaUnavailable))
  assert.match(html, /min-height:56px/) // two rows of 24 px with 8 px between them, so nothing below moves
})

test('the fresh levels, once read', () => {
  const html = section({ read: { today: 2, tomorrow: 2 }, levels: [['Today', 2], ['Tomorrow', 2]] })
  assert.equal(html.match(new RegExp(LEVEL.source, 'g')).length, 2)
  assert.ok(html.includes('Moderate'))
  assert.ok(!html.includes(en.avaUnavailable))
})

test('the source is down or too slow: a clear note, never a level', () => {
  for (const read of [null, { region: null, today: null, tomorrow: null, unavailable: true }]) {
    const html = section({ read })
    assert.ok(html.includes(en.avaUnavailable), 'the note says the danger could not be read')
    assert.ok(!LEVEL.test(html), 'no level at all')
    assert.ok(html.includes('https://avalanches.org/'), 'the official bulletins stay one tap away')
  }
})

test('no section where the area had no rating when the page was stored and none is read now', () => {
  assert.equal(section({ reserve: 0, read: undefined }), '')
  assert.equal(section({ reserve: 0, read: null }), '')
  assert.equal(section({ reserve: 2, read: { region: null, today: null, tomorrow: null } }), '')
})

test('readAvalanche: the answer; null on an error, a refusal or when the source takes too long', async () => {
  const answer = { region: 'CH-7112', today: 2, tomorrow: 2 }
  const ok = async () => ({ ok: true, json: async () => answer })
  assert.deepEqual(await readAvalanche('/api/avalanche', { get: ok, ms: 50 }), answer)
  assert.equal(await readAvalanche('/api/avalanche', { get: async () => ({ ok: false, status: 503 }), ms: 50 }), null)
  assert.equal(await readAvalanche('/api/avalanche', { get: async () => { throw new TypeError('offline') }, ms: 50 }), null)
  const started = Date.now()
  assert.equal(await readAvalanche('/api/avalanche', { get: () => new Promise(() => {}), ms: 50 }), null)
  assert.ok(Date.now() - started < 1000, 'gives up after its time, the page does not wait')
})

test('ratingsRead: the day\'s ratings, and whether the store failed to answer', async () => {
  const file = { maxDangerRatings: { 'CH-7112': 3, 'CH-7112:high': 4 } }
  assert.deepEqual(await ratingsRead('2026-11-17', async () => file), { ratings: { 'CH-7112': 3 }, failed: false })
  assert.deepEqual(await ratingsRead('2026-11-17', async () => null), { ratings: {}, failed: true }) // timeout, refusal or bad JSON
})

test('the avalanche answer says when today\'s bulletin could not be read, and is then kept only a minute', () => {
  const dates = { today: '2026-11-17', tomorrow: '2026-11-18' }
  const fine = avalancheAnswer(regionData, { ratings: { 'CH-7112': 3 }, failed: false }, { ratings: {}, failed: true }, 46.38, 9.91, dates)
  assert.deepEqual(fine.body, { region: 'CH-7112', today: 3, tomorrow: null, dates }) // tomorrow's not out yet: no note
  assert.equal(fine.maxAge, 1800)
  const down = avalancheAnswer(regionData, { ratings: {}, failed: true }, { ratings: {}, failed: true }, 46.38, 9.91, dates)
  assert.equal(down.body.unavailable, true)
  assert.equal(down.body.today, null)
  assert.equal(down.maxAge, 60)
})
