// The hourly calibration where no airport is within 60 km (owner, 2026-11-14): the town's own official
// station is the truth when one stands within 3 km (Lienz, Sillian, Großkirchheim); farther away it is
// not (Ainet's nearest is Lienz's, 9.9 km down the valley), and an airport stays the truth where there is
// one. And only when the forecast point lies within 100 m of the station's height (owner, 2026-11-15):
// Sillianberg is a hamlet 312 m above Sillian's station, Dölsach's point 202 m above Lienz's. The route is called for real with every outside call faked (lib/test-route-fakes.js); the station
// list is the real one (lib/shadow-stations.json).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { json, seen, answerWith, reset, jobRequest } from './test-route-fakes.js'

const LIENZ = { city: 'Lienz', lat: 46.8289, lon: 12.769 }   // station LIENZ (11204) 2.9 km away
const AINET = { city: 'Ainet', lat: 46.866, lon: 12.6897 }   // the same station, 9.9 km away
const SILLIAN = { city: 'Sillian', lat: 46.7528, lon: 12.4211 } // station SILLIAN (11201, 1081 m) 0.7 km away; the stored point lies on the slope at 1261 m
const rows = (place, now) => [
  { ...place, api_id: 'open-meteo', temp: 4, wind_kmh: 6, region: 'europe', created_at: new Date(now - 10 * 60_000).toISOString() },
  { ...place, api_id: 'weatherapi', temp: -1, wind_kmh: 9, region: 'europe', created_at: new Date(now - 5 * 60_000).toISOString() },
]
const WEIGHTS = [
  { id: 'open-meteo', region: 'europe', name: 'Open-Meteo', score: 50, reports: 10, weight: 0.5, delta_history: [] },
  { id: 'weatherapi', region: 'europe', name: 'WeatherAPI', score: 50, reports: 10, weight: 0.5, delta_history: [] },
]
const stationAnswer = (temp, id = '11204') => json({ features: [{ properties: { station: id, parameters: { TL: { data: [null, temp] } } } }] })
// one run of the job: the places asked in the last hour, the airports' reports, GeoSphere's answer, and the
// heights Open-Meteo's height model gives for the forecast points it is asked about (Lienz: 683 m, its station 661 m)
async function run({ places, metar = [], station = stationAnswer(3), heights = [683] }) {
  const { GET } = await import('../app/api/station-calibrate/route.js')
  const now = Date.now()
  reset()
  answerWith(({ url, method }) => {
    if (method === 'GET' && url.includes('/rest/v1/forecasts?')) return json(places.flatMap(p => rows(p, now)))
    if (method === 'GET' && url.includes('/rest/v1/api_weights?')) return json(WEIGHTS)
    if (url.includes('aviationweather.gov/api/data/metar')) return json(metar.map(m => ({ ...m, reportTime: new Date(now - 20 * 60_000).toISOString() })))
    if (url.includes('dataset.api.hub.geosphere.at')) return station
    if (url.includes('api.open-meteo.com/v1/elevation')) return heights === 'down' ? new Response('down', { status: 503 }) : json({ elevation: heights })
  })
  const res = await GET(jobRequest('/api/station-calibrate'))
  const sent = table => seen.filter(c => c.method === 'POST' && c.url.includes(`/rest/v1/${table}`)).flatMap(c => [JSON.parse(c.body)].flat())
  return { status: res.status, body: await res.json(), sent, stationCalls: seen.filter(c => c.url.includes('dataset.api.hub.geosphere.at')).length, heightCalls: seen.filter(c => c.url.includes('/v1/elevation')).map(c => c.url.split('?')[1]) }
}

test('no airport within 60 km and the town\'s station within 3 km: the place is scored against its station', async () => {
  const { status, body, sent, stationCalls, heightCalls } = await run({ places: [LIENZ] })
  assert.equal(status, 200)
  assert.equal(body.calibrated, 1)
  assert.deepEqual(body.results, [{ city: 'Lienz', truth: 'station', actualTemp: 3, actualWind: null, stations: 0, apis: [{ id: 'open-meteo', deltas: [2] }, { id: 'weatherapi', deltas: [0] }] }],
    'one degree off scores +2, four degrees 0; a station gives no wind to score')
  // the per-place correction behind MetaBlend Local: one sample, a fifth of (reading minus what was shown);
  // no blend was stored in the hour, so the middle of the sources stands in (1.5): 0.2 x (3 - 1.5)
  const [bias, ...more] = sent('city_bias')
  assert.ok(bias && !more.length, 'one correction written')
  assert.equal(bias.city, 'Lienz')
  assert.equal(bias.samples + bias.samples_night, 1, 'one sample, in the bucket of the hour the test runs in')
  assert.equal(bias.temp_bias + bias.temp_bias_night, 0.3)
  assert.equal(sent('api_weights').length, 2, 'both sources\' weights saved')
  // the shadow run keeps its row, from the same answer: GeoSphere is asked once a run
  assert.deepEqual(sent('station_errors').filter(r => r.city === 'Lienz').map(r => [r.truth, r.truth_km, r.actual, r.errors]), [['station', 2.9, 3, { 'open-meteo': 1, weatherapi: -4 }]])
  assert.equal(stationCalls, 1)
  assert.deepEqual(heightCalls, ['latitude=46.8289&longitude=12.769'], 'the height of the point is asked once, for this place only')
})

test('the forecast point more than 100 m from the height of the station: not the truth for the place, however near the station stands', async () => {
  // Sillian: the station stands in the village, 0.7 km away, but the stored point lies 180 m above it
  const sillian = await run({ places: [SILLIAN], station: stationAnswer(-4.7, '11201'), heights: [1261] })
  assert.equal(sillian.body.calibrated, 0)
  assert.match(sillian.body.results[0].skipped, /^no fresh METAR within 60km/)
  assert.equal(sillian.sent('city_bias').length, 0)
  assert.deepEqual(sillian.sent('station_errors').filter(r => r.city === 'Sillian').map(r => [r.truth, r.truth_km]), [['station', 0.7]], 'the shadow run records it as before')
  // the limit itself: 100 m counts, 101 m does not (Lienz's station stands at 661 m)
  assert.equal((await run({ places: [LIENZ], heights: [761] })).body.calibrated, 1)
  assert.equal((await run({ places: [LIENZ], heights: [762] })).body.calibrated, 0)
  assert.equal((await run({ places: [LIENZ], heights: [560] })).body.calibrated, 0, 'below the station as well')
  // no height, no check: the place is skipped, the run goes on
  const blind = await run({ places: [LIENZ], heights: 'down' })
  assert.equal(blind.status, 200)
  assert.equal(blind.body.calibrated, 0)
})

test('a station farther than 3 km is not the place\'s truth: skipped as before, and the shadow run still records it', async () => {
  const { body, sent, heightCalls } = await run({ places: [AINET] })
  assert.equal(body.calibrated, 0)
  assert.deepEqual(heightCalls, [], 'no height is asked for a place that has no station near enough')
  assert.equal(body.results.length, 1)
  assert.equal(body.results[0].city, 'Ainet')
  assert.match(body.results[0].skipped, /^no fresh METAR within 60km/)
  assert.equal(sent('city_bias').length, 0, 'no correction learned from a station 9.9 km down the valley')
  assert.equal(sent('api_weights').length, 0)
  assert.deepEqual(sent('station_errors').filter(r => r.city === 'Ainet').map(r => [r.truth, r.truth_km]), [['station', 9.9]], 'the shadow run compares within 10 km, as before')
})

test('an airport within 60 km stays the truth, whatever the town\'s station reads', async () => {
  const { body, sent } = await run({ places: [LIENZ], metar: [{ lat: 46.8, lon: 12.8, temp: 5, wspd: 4 }] })
  assert.equal(body.calibrated, 1)
  assert.deepEqual([body.results[0].truth, body.results[0].actualTemp, body.results[0].stations], ['metar', 5, 1])
  assert.equal(sent('city_bias')[0].temp_bias + sent('city_bias')[0].temp_bias_night, 0.7, '0.2 x (5 - 1.5): learned against the airport')
})

test('GeoSphere does not answer: the station places are skipped, the airports are scored as always', async () => {
  const { status, body } = await run({ places: [LIENZ, { city: 'Vienna', lat: 48.2085, lon: 16.3721 }], metar: [{ lat: 48.11, lon: 16.57, temp: 6, wspd: 5 }], station: new Response('down', { status: 503 }) })
  assert.equal(status, 200)
  assert.equal(body.calibrated, 1)
  assert.match(body.results.find(r => r.city === 'Lienz').skipped, /^no fresh METAR within 60km/)
  assert.equal(body.results.find(r => r.city === 'Vienna').truth, 'metar')
})
