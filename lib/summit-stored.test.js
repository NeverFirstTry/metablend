// The summit pages are asked mostly by crawlers, and each render cost a full summit forecast (17
// Open-Meteo calls, about 1,200 a day on 2026-11-10 at a 7 % cache hit rate). They now render from a
// stored copy: /api/hike?…&models=core asks the three core models only (5.1 calls), is kept six hours
// and is counted apart (summit-page); a visitor's browser fetches the live forecast. Route called for
// real with every outside call faked (lib/test-route-fakes.js).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seen, reset, answerWith } from './test-route-fakes.js'

const { GET: hike } = await import('../app/api/hike/route.js')
const { hikeApiPath } = await import('./hike/params.js')
const { summitProps, storedPath, STORED_SECONDS } = await import('./hike/summit-props.js')
const { loadSummit } = await import('./hike/summit-fetch.js')
const { CORE_MODELS, OM_MODELS } = await import('./outlook/models.js')

const PEAK = { name: 'Grossglockner', lat: 47.074, lon: 12.694, elev: 3798 }
// Open-Meteo answers one hour for whatever models were asked: enough for the route to build an answer
const upstream = ({ url }) => {
  if (!url.includes('api.open-meteo.com/v1/forecast')) return
  const models = new URL(url).searchParams.get('models').split(',')
  const hourly = { time: ['2026-11-12T12:00'] }
  for (const m of models) for (const v of new URL(url).searchParams.get('hourly').split(',')) hourly[`${v}_${m}`] = [v === 'weather_code' ? 1 : 2]
  return new Response(JSON.stringify({ utc_offset_seconds: 3600, hourly, daily: { time: ['2026-11-12'], sunrise: ['2026-11-12T07:05'], sunset: ['2026-11-12T16:40'] } }), { headers: { 'content-type': 'application/json' } })
}
const asked = () => seen.filter(c => c.url.includes('api.open-meteo.com/v1/forecast')).map(c => new URL(c.url).searchParams.get('models').split(','))
const bumps = async () => { await new Promise(r => setTimeout(r, 20)); return seen.filter(c => c.url.includes('/rpc/bump_open_meteo_calls')).map(c => JSON.parse(c.body)) }
const get = (path, ip) => hike(new Request(`https://metablend.app${path}`, { headers: { 'x-forwarded-for': ip } }))

test('the stored copy asks the three core models only, is kept six hours and is counted as summit-page at 5.1 calls', async () => {
  reset(); answerWith(upstream)
  const res = await get(storedPath(hikeApiPath(PEAK)), '203.0.113.41')
  assert.equal(res.status, 200)
  assert.deepEqual(asked(), [CORE_MODELS])
  assert.equal(STORED_SECONDS, 21600)
  assert.match(res.headers.get('cache-control') ?? '', /s-maxage=21600\b/)
  const b = await bumps()
  assert.deepEqual(b.map(x => [x.p_kind, x.p_calls]), [['summit-page', 5.1]])
  assert.ok(!seen.some(c => c.url.includes('/rest/v1/error_log') && c.body?.includes('fell back')), 'three models by design is no fallback to log')
})

test('the live forecast is unchanged: every model, an hour, counted as summit at 17 calls', async () => {
  reset(); answerWith(upstream)
  const res = await get(hikeApiPath(PEAK), '203.0.113.42')
  assert.equal(res.status, 200)
  assert.deepEqual(asked(), [OM_MODELS.map(m => m.model)])
  assert.match(res.headers.get('cache-control') ?? '', /s-maxage=3600\b/)
  assert.deepEqual((await bumps()).map(x => [x.p_kind, x.p_calls]), [['summit', 17]])
})

test('summitProps: the page takes the same parts from the stored copy and from the live forecast', () => {
  const d = { nowLocal: '2026-11-12T09:00', notes: ['no_storm_data'], sources: [{ id: 'ecmwf', name: 'ECMWF IFS' }], windows: { today: { from: 9 }, tomorrow: null, later: 1 },
    days: [{ date: '2026-11-12', icon: 'x', tempMin: -8, tempMax: -3, windMax: 40, rainPct: 10, freezingMin: 1800, freezingMax: 2400, storm: 0, extra: 'not shown' }, { date: '2026-11-13' }] }
  const p = summitProps(d)
  assert.deepEqual(Object.keys(p), ['days', 'windows', 'todayLocal', 'tomorrowLocal', 'stormUnknown', 'sources'])
  assert.deepEqual(p.days[0], { date: '2026-11-12', icon: 'x', tempMin: -8, tempMax: -3, windMax: 40, rainPct: 10, freezingMin: 1800, freezingMax: 2400, storm: 0 })
  assert.deepEqual([p.windows, p.todayLocal, p.tomorrowLocal, p.stormUnknown, p.sources], [{ today: { from: 9 }, tomorrow: null }, '2026-11-12', '2026-11-13', true, ['ECMWF IFS']])
})

test('loadSummit keeps the stored copy for the time it is told (default 30 minutes)', async () => {
  const opts = []
  const getOk = async (u, o) => { opts.push(o); return new Response(JSON.stringify({ days: [1] })) }
  await loadSummit('http://self.test/api/hike?x=1', getOk, STORED_SECONDS)
  await loadSummit('http://self.test/api/hike?x=1', getOk)
  assert.deepEqual(opts, [{ next: { revalidate: 21600 } }, { next: { revalidate: 1800 } }])
})
