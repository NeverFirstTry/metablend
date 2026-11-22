// A summit page built from the last good forecast during an outage said so only through an older "As of"
// time (UX review M2, owner: before launch). It now says it in the start page's words for the same case.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { default: SummitPage } = await import('../app/mountains/[peak]/SummitPage.jsx')
const LANGS = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko']

const MON = '2026-11-16', TUE = '2026-11-17'
const day = date => ({ date, icon: '☀️', tempMin: -8, tempMax: -3, windMax: 40, rainPct: 10, freezingMin: 1800, freezingMax: 2400, storm: null })
const copy = { days: [day(MON), day(TUE)], windows: { today: null, tomorrow: null }, todayLocal: MON, tomorrowLocal: TUE, stormUnknown: false, sources: ['ECMWF IFS'], madeAt: `${MON}T19:00`, utcOffsetSec: 3600 }
const peak = { id: 'testhorn', name: 'Testhorn', elev: 3000, lat: 47.07, lon: 12.69, region: 'tauern', country: 'Austria', grade: null }
const page = kept => render(h(SummitPage, { peak, avaRows: 0, nearby: [], fullList: [], ...copy, kept }))

test('a page built from a kept answer says so; a normal page does not', async () => {
  const en = (await import('./i18n/en.js')).default
  const kept = page(`${MON}T17:30:00Z`)
  assert.ok(kept.includes(en.keptBanner), 'the line is there')
  assert.match(kept, /role="status"/)
  assert.ok(!page(false).includes(en.keptBanner))
})

test('the line opens with the start page\'s own words for the last known forecast, in every language', async () => {
  for (const l of LANGS) {
    const p = (await import(`./i18n/${l}.js`)).default
    const first = p.offlineBanner.split(/[.。]/)[0]
    assert.ok(p.keptBanner.startsWith(first), `${l}: ${p.keptBanner}`)
    assert.ok(!p.keptBanner.includes('offline'), `${l}: the reader is not offline, the source is down`)
  }
})
