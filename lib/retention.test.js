import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// the routes below are called for real with every outside call faked (lib/test-route-fakes.js)
const { seen, reset, answerWith, json, jobRequest } = await import('./test-route-fakes.js')
const { supabase } = await import('./supabase.js')
const { purgeShortLived, SHORT_LIVED } = await import('./retention.js')

// WeatherAPI's terms cap caching of current conditions at 60 minutes: its
// rows live only until the hourly station calibration has scored them.
test('purgeShortLived — deletes the short-lived sources\' forecast rows from before the run, nothing else', async () => {
  reset()
  await purgeShortLived(supabase, '2026-11-08T10:00:00.000Z')
  assert.deepEqual(SHORT_LIVED, ['weatherapi'])
  assert.deepEqual(seen.map(({ url, method }) => ({ url, method })), [{ url: 'https://proj.supabase.co/rest/v1/forecasts?api_id=in.(weatherapi)&created_at=lt.2026-11-08T10:00:00.000Z', method: 'DELETE' }])
})

// the purge's DELETE calls, with the time each compares against
const purges = () => seen
  .map((c, i) => ({ ...c, i }))
  .filter(c => c.method === 'DELETE' && c.url.includes('/rest/v1/forecasts?api_id=in.(weatherapi)&created_at=lt.'))
  .map(c => ({ i: c.i, before: Date.parse(c.url.match(/created_at=lt\.([^&]+)/)[1]) }))

// should an hourly run be missed, the daily cleanup purges anything older than the 60-minute cap
test('the daily cleanup purges them too, an hour old or more', async () => {
  const { GET } = await import('../app/api/cleanup/route.js')
  reset()
  const start = Date.now()
  const res = await GET(jobRequest('/api/cleanup'))
  const end = Date.now()
  assert.equal(res.status, 200)
  const [purge, ...more] = purges()
  assert.ok(purge && !more.length, 'one purge')
  const HOUR = 60 * 60 * 1000
  assert.ok(purge.before >= start - HOUR && purge.before <= end - HOUR, 'rows from before an hour ago')
})

test('the hourly station calibration purges them on its quiet exit (no forecasts in the last hour)', async () => {
  const { GET } = await import('../app/api/station-calibrate/route.js')
  reset()
  const start = Date.now()
  const res = await GET(jobRequest('/api/station-calibrate'))
  const end = Date.now()
  assert.equal(res.status, 200)
  assert.match((await res.json()).skipped, /no forecasts/)
  const [purge, ...more] = purges()
  assert.ok(purge && !more.length, 'one purge')
  assert.ok(purge.before >= start && purge.before <= end, 'rows from before the run started')
})

test('the hourly station calibration purges them after scoring, on its full exit', async () => {
  const { GET } = await import('../app/api/station-calibrate/route.js')
  const now = Date.now()
  reset()
  answerWith(({ url, method }) => {
    if (method === 'GET' && url.includes('/rest/v1/forecasts?')) return json([
      { city: 'Lienz', lat: 46.83, lon: 12.77, api_id: 'open-meteo', temp: 4, wind_kmh: 6, region: 'europe', created_at: new Date(now - 10 * 60_000).toISOString() },
      { city: 'Lienz', lat: 46.83, lon: 12.77, api_id: 'weatherapi', temp: 6, wind_kmh: 9, region: 'europe', created_at: new Date(now - 5 * 60_000).toISOString() },
    ])
    if (method === 'GET' && url.includes('/rest/v1/api_weights?')) return json([
      { id: 'open-meteo', region: 'europe', name: 'Open-Meteo', score: 50, reports: 10, weight: 0.5, delta_history: [] },
      { id: 'weatherapi', region: 'europe', name: 'WeatherAPI', score: 50, reports: 10, weight: 0.5, delta_history: [] },
    ])
    if (url.includes('aviationweather.gov/api/data/metar')) return json([{ lat: 46.8, lon: 12.8, temp: 5, wspd: 4, reportTime: new Date(now - 20 * 60_000).toISOString() }])
  })
  const start = Date.now()
  const res = await GET(jobRequest('/api/station-calibrate'))
  const end = Date.now()
  assert.equal(res.status, 200)
  assert.equal((await res.json()).calibrated, 1, 'Lienz was scored')
  const weightsSaved = seen.findLastIndex(c => c.method === 'POST' && c.url.includes('/rest/v1/api_weights'))
  assert.ok(weightsSaved >= 0, 'the new weights were saved')
  const [purge, ...more] = purges()
  assert.ok(purge && !more.length, 'one purge')
  assert.ok(purge.i > weightsSaved, 'the purge comes after the weights are saved')
  assert.ok(purge.before >= start && purge.before <= end, 'rows from before the run started: the ones just scored')
})
