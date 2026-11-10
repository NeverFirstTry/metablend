// "My location" without a third party seeing the device: /api/place names the place at a position
// rounded to 0.1° (about 10 km) from our own towns, and from OpenStreetMap's Nominatim where no town is
// in reach. The route is called for real with every outside call faked (lib/test-route-fakes.js). What
// must hold: whatever the request carries, nothing finer than 0.1° reaches the database or Nominatim.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import './test-jsx-hooks.js'
import { json, seen, answerWith, reset } from './test-route-fakes.js'

const { GET } = await import('../app/api/place/route.js')
const ask = (query, ip = '203.0.113.20') => GET(new Request(`https://metablend.app/api/place${query}`, { headers: { 'x-forwarded-for': ip } }))
const lienz = { id: 2772505, name: 'Lienz', country: 'AT', population: 11572, km: 4 }
const calls = part => seen.filter(c => c.url.includes(part))

test('a town in reach: named from our towns in the visitor\'s language, the position rounded before anything is asked, a day at the CDN', async () => {
  reset()
  answerWith(({ url }) => {
    if (url.includes('/rpc/town_near')) return json([lienz])
    if (url.includes('geocoding-api.open-meteo.com/v1/get')) return json({ id: 2772505, name: 'Lienz', admin1: 'Tirol' })
  })
  const res = await ask('?near=46.82912,12.76903&lang=de') // a client that did not round: the server does
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { name: 'Lienz' })
  assert.match(res.headers.get('cache-control'), /public, s-maxage=86400\b/)
  assert.deepEqual(JSON.parse(calls('/rpc/town_near')[0].body), { lat: 46.8, lon: 12.8 })
  assert.match(calls('geocoding-api.open-meteo.com/v1/get')[0].url, /[?&]id=2772505&language=de$/) // an id and a language, no position
  assert.equal(calls('nominatim').length, 0, 'Nominatim is not asked when a town answers')
  assert.ok(!seen.some(c => /46\.82|12\.76/.test(c.url + (c.body ?? ''))), 'the finer position appears in no outgoing call')
})

test('no town within reach: Nominatim names the municipality at the rounded position, through its gate', async () => {
  reset()
  answerWith(({ url }) => {
    if (url.includes('/rpc/town_near')) return json([])
    if (url.includes('/rpc/nominatim_slot')) return json(0)
    if (url.includes('nominatim.openstreetmap.org/reverse')) return json({ name: 'Matrei in Osttirol', address: { town: 'Matrei in Osttirol', country_code: 'at' } })
  })
  const res = await ask('?near=47.00213,12.53871&lang=de', '203.0.113.21')
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { name: 'Matrei in Osttirol' })
  const [asked] = calls('nominatim.openstreetmap.org')
  assert.match(asked.url, /\/reverse\?format=jsonv2&zoom=10&addressdetails=1&lat=47&lon=12\.5&accept-language=de$/)
  assert.equal(calls('/rpc/nominatim_slot').length, 1, 'one slot from the gate')
  assert.equal(calls('/rest/v1/nominatim_cache').filter(c => c.method === 'POST').length, 1, 'the answer is kept')
  assert.equal(calls('geocoding-api.open-meteo.com').length, 0)
})

test('no place there (open sea), or nothing answered: 404, never cached', async () => {
  reset()
  answerWith(({ url }) => {
    if (url.includes('/rpc/town_near')) return json([])
    if (url.includes('/rpc/nominatim_slot')) return json(0)
    if (url.includes('nominatim.openstreetmap.org/reverse')) return json({ error: 'Unable to geocode' })
  })
  const sea = await ask('?near=40,-40&lang=en', '203.0.113.22')
  assert.equal(sea.status, 404)
  assert.match(sea.headers.get('cache-control'), /no-store/)
  reset() // the database's function missing and Nominatim down
  const down = await ask('?near=46.8,12.8&lang=en', '203.0.113.23')
  assert.equal(down.status, 404)
})

test('without a usable position: 400, nothing asked', async () => {
  reset()
  for (const q of ['', '?near=', '?near=Lienz', '?near=95,12', '?lat=46.8&lon=12.8']) assert.equal((await ask(q, '203.0.113.24')).status, 400, q)
  assert.equal(seen.length, 0)
})
