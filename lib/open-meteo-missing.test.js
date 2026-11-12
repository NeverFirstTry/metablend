// Every Open-Meteo host answering nothing useful (503 on all of them): what each feature does then.
// The forecast and the outlook go on with the other sources; the nowcast, the route weather and the
// planner have no other source and say "unavailable" with a clean answer nothing caches, instead of
// failing. (The summit forecast's unavailable answer: lib/hike-unavailable.test.js.) A place must come
// from our own towns table then, since the outside geocoder is Open-Meteo's too. Routes called for
// real with every outside call faked (lib/test-route-fakes.js).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { json, seen, reset, answerWith } from './test-route-fakes.js'

const metno = fs.readFileSync(new URL('./__fixtures__/metno-lienz.json', import.meta.url), 'utf8')
const TOWN = { id: 2063523, name: 'Perth', alt: '', lat: -31.95, lon: 115.86, country: 'AU', region: 'Western Australia', population: 2000000 }
let metNorway = true
const down = ({ url }) => {
  if (url.includes('open-meteo.com')) return new Response('{"error":true,"reason":"The service is overloaded"}', { status: 503, headers: { 'content-type': 'application/json' } })
  if (url.includes('/rest/v1/rpc/town_lookup')) return json([TOWN]) // our own table knows the place
  if (url.includes('api.met.no')) return metNorway ? new Response(metno, { headers: { 'content-type': 'application/json' } }) : new Response('down', { status: 503 })
}
const { GET: forecast } = await import('../app/api/forecast/route.js')
const { GET: outlook } = await import('../app/api/outlook/route.js')
const { GET: nowcast } = await import('../app/api/nowcast/route.js')
const { GET: planner } = await import('../app/api/planner/route.js')
const { POST: routeWeather } = await import('../app/api/route-weather/route.js')
const from = ip => ({ headers: { 'x-forwarded-for': ip } })
const askedOpenMeteo = () => assert.ok(seen.some(c => c.url.includes('open-meteo.com')), 'Open-Meteo was asked and gave nothing')
const OPEN_METEO_IDS = /^(open-meteo|ecmwf|gfs|icon|meteofrance|chmi|gem|jma|cma|aifs|meteoswiss|italiameteo|knmi|dmi|nbm)$/

test('forecast: without Open-Meteo the blend is built from the other sources, marked thin and kept 2 minutes', async () => {
  reset(); answerWith(down); metNorway = true
  const res = await forecast(new Request('https://metablend.app/api/forecast?city=perth&lang=en', from('203.0.113.21')))
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.partial, true)
  assert.match(res.headers.get('cache-control'), /s-maxage=120\b/)
  const live = body.sources.filter(s => !s.down && s.apiId !== 'metablend')
  assert.ok(live.length >= 1, 'at least one other source answered')
  assert.ok(live.every(s => !OPEN_METEO_IDS.test(s.apiId)), `no Open-Meteo source in the blend: ${live.map(s => s.apiId)}`)
  assert.equal(typeof body.consensus.temp, 'number')
  askedOpenMeteo()
})

test('forecast: with every source gone the answer is a clean error nothing caches', async () => {
  reset(); answerWith(down); metNorway = false
  const res = await forecast(new Request('https://metablend.app/api/forecast?city=perth-b&lang=en', from('203.0.113.22')))
  assert.equal(res.status, 500)
  assert.match((await res.json()).error, /No API data available/)
  assert.equal(res.headers.get('cache-control'), 'no-store')
})

test('outlook: without Open-Meteo the hours and days come from MET Norway', async () => {
  reset(); answerWith(down); metNorway = true
  const res = await outlook(new Request('https://metablend.app/api/outlook?city=perth&lang=en', from('203.0.113.23')))
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(body.hourly.length > 0 && body.days.length > 0, 'hours and days from the fallback')
  assert.ok(seen.some(c => c.url.includes('api.met.no')), 'MET Norway was asked')
  askedOpenMeteo()
})

test('outlook: with MET Norway gone as well it says unavailable, uncached', async () => {
  reset(); answerWith(down); metNorway = false
  const res = await outlook(new Request('https://metablend.app/api/outlook?city=perth-b&lang=en', from('203.0.113.24')))
  assert.equal(res.status, 502)
  assert.match((await res.json()).error, /unavailable/i)
  assert.equal(res.headers.get('cache-control'), 'no-store')
})

test('nowcast, route weather and planner have no other source: each says unavailable, uncached, and does not throw', async () => {
  reset(); answerWith(down)
  const rain = await nowcast(new Request('https://metablend.app/api/nowcast?lat=-31.95&lon=115.86', from('203.0.113.25')))
  assert.equal(rain.status, 502)
  assert.match((await rain.json()).error, /unavailable/i)
  assert.equal(rain.headers.get('cache-control'), 'no-store')

  const points = Array.from({ length: 8 }, (_, i) => [47.07 + i * 0.004, 12.69 + i * 0.004, 2400 + i * 150])
  const route = await routeWeather(new Request('https://metablend.app/api/route-weather', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.26' }, body: JSON.stringify({ points, date: new Date().toISOString().slice(0, 10) }) }))
  assert.equal(route.status, 502, JSON.stringify(await route.clone().json()))
  assert.match((await route.json()).error, /unavailable/i)
  assert.equal(route.headers.get('cache-control'), 'no-store')

  const climate = await planner(new Request('https://metablend.app/api/planner?city=perth', from('203.0.113.27')))
  assert.equal(climate.status, 502)
  assert.match((await climate.json()).error, /unavailable/i)
  assert.equal(climate.headers.get('cache-control'), 'no-store')
  askedOpenMeteo()
})
