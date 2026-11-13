// The summit pages are asked mostly by crawlers, and each build cost a full summit forecast (about 750
// requests and 12,200 Open-Meteo calls on 2026-11-11). They are built from a stored copy:
// /api/hike?…&models=core asks the three core models only (5.1 calls) and is counted apart (summit-page).
// The page fetches nothing on its own; its button asks the live forecast at the shared address and names
// itself in a header, so those requests are counted apart too (summit-live). Route called for real with
// every outside call faked (lib/test-route-fakes.js).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seen, reset, answerWith } from './test-route-fakes.js'

const { GET: hike } = await import('../app/api/hike/route.js')
const { hikeApiPath } = await import('./hike/params.js')
const { summitProps, storedPath, madeAtText, LIVE_HEADER } = await import('./hike/summit-props.js')
const { CORE_MODELS, OM_MODELS, modelCovers } = await import('./outlook/models.js')

const PEAK = { name: 'Grossglockner', lat: 47.074, lon: 12.694, elev: 3798 }
// every model that covers the peak: all but MET Nordic (lib/model-coverage.test.js)
const COVERING = OM_MODELS.map(m => m.model).filter(m => modelCovers(m, PEAK.lat, PEAK.lon))
// Open-Meteo answers one hour for whatever models were asked: enough for the route to build an answer.
// The hour is tomorrow's noon whatever day the test runs: with a fixed date the route found no hour still
// to come from that afternoon on and answered "unavailable" (2026-11-12).
const DAY = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
const upstream = ({ url }) => {
  if (!url.includes('api.open-meteo.com/v1/forecast')) return
  const models = new URL(url).searchParams.get('models').split(',')
  const hourly = { time: [`${DAY}T12:00`] }
  for (const m of models) for (const v of new URL(url).searchParams.get('hourly').split(',')) hourly[`${v}_${m}`] = [v === 'weather_code' ? 1 : 2]
  return new Response(JSON.stringify({ utc_offset_seconds: 3600, hourly, daily: { time: [DAY], sunrise: [`${DAY}T07:05`], sunset: [`${DAY}T16:40`] } }), { headers: { 'content-type': 'application/json' } })
}
const asked = () => seen.filter(c => c.url.includes('api.open-meteo.com/v1/forecast')).map(c => new URL(c.url).searchParams.get('models').split(','))
const bumps = async () => { await new Promise(r => setTimeout(r, 20)); return seen.filter(c => c.url.includes('/rpc/bump_open_meteo_calls')).map(c => JSON.parse(c.body)).map(x => [x.p_kind, x.p_calls]) }
const get = (path, ip, headers = {}) => hike(new Request(`https://metablend.app${path}`, { headers: { 'x-forwarded-for': ip, ...headers } }))

test('the stored copy asks the three core models only and is counted as summit-page at 5.1 calls', async () => {
  reset(); answerWith(upstream)
  const res = await get(storedPath(hikeApiPath(PEAK)), '203.0.113.41')
  assert.equal(res.status, 200)
  assert.deepEqual(asked(), [CORE_MODELS])
  // kept an hour like every summit forecast: the page built from it is what stays six hours
  assert.match(res.headers.get('cache-control') ?? '', /s-maxage=3600\b/)
  assert.deepEqual(await bumps(), [['summit-page', 5.1]])
  assert.ok(!seen.some(c => c.url.includes('/rest/v1/error_log') && c.body?.includes('fell back')), 'three models by design is no fallback to log')
})

test('the live forecast is unchanged: every model that covers the peak, an hour, counted as summit', async () => {
  reset(); answerWith(upstream)
  const res = await get(hikeApiPath(PEAK), '203.0.113.42')
  assert.equal(res.status, 200)
  assert.equal(COVERING.length, 9)
  assert.deepEqual(asked(), [COVERING])
  assert.match(res.headers.get('cache-control') ?? '', /s-maxage=3600\b/)
  assert.deepEqual(await bumps(), [['summit', 15.3]])
})

test('the page’s live button asks the same address and is counted on its own as summit-live', async () => {
  reset(); answerWith(upstream)
  const res = await get(hikeApiPath(PEAK), '203.0.113.43', { [LIVE_HEADER]: '1' })
  assert.equal(res.status, 200)
  assert.deepEqual(asked(), [COVERING])
  assert.match(res.headers.get('cache-control') ?? '', /s-maxage=3600\b/)
  assert.equal(res.headers.get('vary'), null, 'the header must not split the CDN copy it shares with the app')
  assert.deepEqual(await bumps(), [['summit-live', 15.3]])
})

test('summitProps: the page takes the same parts from the stored copy and from the live forecast, with the minute the server fetched it', () => {
  const d = { nowLocal: '2026-11-12T09:00', generatedAt: '2026-11-12T08:52:31.000Z', utcOffsetSec: 3600, notes: ['no_storm_data'], sources: [{ id: 'ecmwf', name: 'ECMWF IFS' }], windows: { today: { from: 9 }, tomorrow: null, later: 1 },
    days: [{ date: '2026-11-12', icon: 'x', tempMin: -8, tempMax: -3, windMax: 40, rainPct: 10, freezingMin: 1800, freezingMax: 2400, storm: 0, extra: 'not shown' }, { date: '2026-11-13' }] }
  const p = summitProps(d)
  assert.deepEqual(Object.keys(p), ['days', 'windows', 'todayLocal', 'tomorrowLocal', 'stormUnknown', 'sources', 'kept', 'madeAt'])
  assert.deepEqual(p.days[0], { date: '2026-11-12', icon: 'x', tempMin: -8, tempMax: -3, windMax: 40, rainPct: 10, freezingMin: 1800, freezingMax: 2400, storm: 0 })
  assert.deepEqual([p.windows, p.todayLocal, p.tomorrowLocal, p.stormUnknown, p.sources, p.madeAt], [{ today: { from: 9 }, tomorrow: null }, '2026-11-12', '2026-11-13', true, ['ECMWF IFS'], '2026-11-12T09:52'])
  // a peak's last good answer from before an outage is marked (lib/last-answer.js); a live one is not
  assert.deepEqual([p.kept, summitProps({ ...d, kept: '2026-11-12T08:52:31.000Z' }).kept], [false, true])
  // an answer without the fetch time falls back to the forecast's hour
  assert.equal(summitProps({ nowLocal: '2026-11-12T09:00' }).madeAt, '2026-11-12T09:00')
})

test('madeAtText: day, month and the time as it stands in the forecast, whatever the time zone here', () => {
  assert.equal(madeAtText('2026-11-12T14:00', 'de'), '12. Nov., 14:00')
  assert.equal(madeAtText('2026-11-12T00:05', 'en'), 'Nov 12, 00:05')
  assert.equal(madeAtText(undefined, 'en'), '')
})
