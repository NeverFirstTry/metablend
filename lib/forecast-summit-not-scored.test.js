// A summit opened from the search box is not kept for scoring and gets no MetaBlend Local line. Nothing we
// have can check a summit: on 2026-11-14 the hourly check compared the Wildspitze (3768 m, about -11°) with
// an airport 55 km away and 3,000 m lower, scored every source as 13° off and began to learn a "correction"
// of +13° for the summit (production: city_bias 'Wildspitze 3768 m, Tyrol', one sample). A town is kept as
// before. The forecast route is called for real with every outside call faked (lib/test-route-fakes.js).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { json, seen, answerWith, reset } from './test-route-fakes.js'

const { GET } = await import('../app/api/forecast/route.js')
const WILDSPITZE = { id: 'osm-N26863664', kind: 'peak', name: 'Wildspitze', names: {}, ele: 3768, notability: 4, country: 'AT', region: 'Tyrol', lat: 46.8853, lon: 10.8672, km: null }
const LIENZ = { id: 2772807, name: 'Lienz', alt: null, names: null, country: 'AT', region: 'Tyrol', population: 11800, lat: 46.8294, lon: 12.7698 }

// one forecast request; every place has a learned correction on file (five samples by day and by night)
async function forecast(city, ip, { towns = [], peaks = [], temp }) {
  reset()
  answerWith(({ url, method }) => {
    if (url.includes('/rest/v1/rpc/town_lookup')) return json(towns)
    if (url.includes('/rest/v1/rpc/towns_search')) return json([])
    if (url.includes('/rest/v1/rpc/places_search')) return json(peaks)
    if (method === 'GET' && url.includes('/rest/v1/city_bias?')) return json([{ city: 'on file', temp_bias: 6.5, samples: 5, temp_bias_night: 6.5, samples_night: 5 }])
    if (url.includes('api.open-meteo.com/v1/forecast') && url.includes('current=')) return json({ current: { temperature_2m: temp, apparent_temperature: temp - 4, precipitation_probability: 10, windspeed_10m: 20, weathercode: 1 } })
  })
  const res = await GET(new Request(`https://metablend.app/api/forecast?city=${encodeURIComponent(city)}&lang=en`, { headers: { 'x-forwarded-for': ip } }))
  const body = await res.json()
  const stored = seen.filter(c => c.method === 'POST' && c.url.includes('/rest/v1/forecasts')).flatMap(c => [JSON.parse(c.body)].flat())
  return { status: res.status, body, stored, history: seen.filter(c => c.method === 'POST' && c.url.includes('/rest/v1/consensus_history')).length }
}

test('a summit: its forecast is answered, but not kept for scoring, and it gets no MetaBlend Local line', async () => {
  const { status, body, stored, history } = await forecast('Wildspitze', '203.0.113.61', { peaks: [WILDSPITZE], temp: -11.2 })
  assert.equal(status, 200)
  assert.equal(body.consensus.temp, -11.2)
  assert.deepEqual(body.sources.filter(s => s.apiId === 'metablend'), [], 'no line made from a correction nothing could have measured')
  assert.deepEqual(stored, [], 'no rows for the hourly, daily and nightly checks to compare with a valley')
  assert.equal(history, 1, 'the blend itself is still noted, as for every place')
})

test('a town: kept for scoring as before, with its MetaBlend Local line', async () => {
  const { status, body, stored } = await forecast('Lienz', '203.0.113.62', { towns: [LIENZ], temp: 4.2 })
  assert.equal(status, 200)
  assert.deepEqual(body.sources.filter(s => s.apiId === 'metablend').map(s => s.temp), [10.7], 'the blend and the correction on file')
  assert.deepEqual(stored.map(r => [r.city, r.api_id]).sort(), [['Lienz', 'metablend'], ['Lienz', 'open-meteo']])
})
