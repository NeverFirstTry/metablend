// How many uncached forecasts of one address are written to the database in a day (lib/write-cap.js).
// Every forecast our server has to build writes about 20 rows (each source's reading, for the scoring)
// and one more for the feed. The database is on a plan of 500 MB, and until 2026-11-20 one address asking
// for a new town 40 times a minute could fill what was left in a few hours. Beyond its count an address
// still gets every forecast; only the rows are not written. The route is called for real with every
// outside call faked (lib/test-route-fakes.js).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seen, reset, answerWith, json } from './test-route-fakes.js'

const { GET: forecast } = await import('../app/api/forecast/route.js')
const { mayStore, STORED_PER_DAY, OWN_PER_DAY } = await import('./write-cap.js')

test('an address may have 100 forecasts stored in a day; the next one is not, and another address has its own count', () => {
  assert.equal(STORED_PER_DAY, 100)
  for (let n = 1; n <= STORED_PER_DAY; n++) assert.equal(mayStore('203.0.113.91'), true, `forecast ${n}`)
  assert.equal(mayStore('203.0.113.91'), false)
  assert.equal(mayStore('203.0.113.92'), true)
})

test('the site\'s own readers (widget feed, share card, alert run) share one larger count', () => {
  assert.ok(OWN_PER_DAY > STORED_PER_DAY)
  for (let n = 1; n <= OWN_PER_DAY; n++) assert.equal(mayStore('own'), true)
  assert.equal(mayStore('own'), false)
})

// one town the database knows, and one weather source that answers (MET Norway): enough for a forecast
const LIENZ = { id: 2772807, name: 'Lienz', alt: null, names: null, country: 'AT', region: 'Tyrol', population: 11800, lat: 46.8294, lon: 12.7698 }
const met = { properties: { timeseries: [{ data: { instant: { details: { air_temperature: 5, wind_speed: 2 } }, next_1_hours: { summary: { symbol_code: 'cloudy' }, details: { precipitation_amount: 0 } } } }] } }
const world = call => {
  if (call.url.includes('/rest/v1/rpc/town_lookup')) return json([LIENZ])
  if (call.url.includes('api.met.no')) return json(met)
}
const ask = (city, ip) => forecast(new Request(`https://metablend.app/api/forecast?city=${city}&lang=en`, { headers: { 'x-forwarded-for': ip } }))
const written = table => seen.filter(c => c.method === 'POST' && c.url.includes(`/rest/v1/${table}`)).length

test('the forecast route: within its count an address\'s forecast is written, beyond it the forecast is answered and nothing is written', async () => {
  reset(); answerWith(world)
  const first = await ask('cap-one', '203.0.113.93')
  assert.equal(first.status, 200)
  assert.deepEqual([written('forecasts'), written('consensus_history')], [1, 1], 'one insert of the readings, one row for the feed')

  for (let n = 1; n < STORED_PER_DAY; n++) mayStore('203.0.113.93') // the rest of its day
  reset(); answerWith(world)
  const over = await ask('cap-two', '203.0.113.93')
  assert.equal(over.status, 200)
  assert.equal(typeof (await over.json()).consensus.temp, 'number', 'the visitor gets the forecast all the same')
  assert.deepEqual([written('forecasts'), written('consensus_history')], [0, 0])
})
