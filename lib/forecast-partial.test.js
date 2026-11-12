// A source that comes back empty without failing must make the blend thin (partial: true, a 2-minute copy),
// or a thin blend is kept 15 minutes, the bug fixed on 2026-11-09: Vienna showed 10 of 18 sources for a
// quarter of an hour with one failed source reported, the rest missing from Open-Meteo's shared model
// answer. The route is called for real with every outside call faked (lib/test-route-fakes.js); Perth, so
// no regional source applies and the US-only model is rightly absent.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import './test-jsx-hooks.js'
import { json, seen, answerWith } from './test-route-fakes.js'

const omMore = JSON.parse(fs.readFileSync(new URL('./__fixtures__/om-more-lienz.json', import.meta.url), 'utf8'))
const omNow = fs.readFileSync(new URL('./__fixtures__/om-now-lienz.json', import.meta.url), 'utf8') // ECMWF, GFS, ICON and Météo-France in their one request
const metno = fs.readFileSync(new URL('./__fixtures__/metno-lienz.json', import.meta.url), 'utf8')
// the same answer with one global model's values gone
const withoutJma = { ...omMore, hourly: Object.fromEntries(Object.entries(omMore.hourly).map(([k, v]) => [k, k.endsWith('_jma_seamless') ? v.map(() => null) : v])) }
let models = () => json(omMore)
answerWith(({ url }) => {
  if (url.includes('/rest/v1/rpc/town_lookup')) return json([{ id: 2063523, name: 'Perth', alt: null, names: null, country: 'AU', region: 'Western Australia', population: 2141834, lat: -31.95, lon: 115.86 }]) // our towns name the place
  if (url.includes('api.open-meteo.com/v1/forecast') && url.includes('current=temperature_2m')) return json({ current: { temperature_2m: 21.4, apparent_temperature: 20.1, precipitation_probability: 5, windspeed_10m: 12, weathercode: 1 } })
  if (url.includes('api.open-meteo.com/v1/forecast') && url.includes('hourly=')) return models()
  if (url.includes('api.open-meteo.com/v1/forecast') && url.includes('minutely_15=')) return new Response(omNow, { headers: { 'content-type': 'application/json' } })
  if (url.includes('api.met.no')) return new Response(metno, { headers: { 'content-type': 'application/json' } })
})
const { GET } = await import('../app/api/forecast/route.js')
const ask = city => GET(new Request(`https://metablend.app/api/forecast?city=${city}&lang=en`, { headers: { 'x-forwarded-for': '203.0.113.7' } }))
const partialLogs = async () => { await new Promise(r => setTimeout(r, 0)); return seen.filter(c => c.url.includes('/rest/v1/error_log') && c.body?.includes('forecast.partial')).map(c => JSON.parse(c.body)) }

test('every asked source answered: a full blend, 15 minutes, nothing logged', async () => {
  const res = await ask('perth')
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(await partialLogs(), [], 'no thin blend')
  assert.equal(body.partial, false)
  assert.match(res.headers.get('cache-control'), /s-maxage=900\b/)
  assert.ok(body.sources.some(s => s.apiId === 'jma'))
  assert.ok(!body.sources.some(s => s.apiId === 'nbm'), 'the US-only model is not expected here')
})

test('a global model missing from the shared answer, nothing failed: a thin blend, 2 minutes, the model named', async () => {
  models = () => json(withoutJma)
  const res = await ask('perth-b')
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.partial, true)
  assert.match(res.headers.get('cache-control'), /s-maxage=120\b/)
  assert.ok(!body.sources.some(s => s.apiId === 'jma'))
  assert.deepEqual((await partialLogs()).at(-1).meta.failed, ['jma'])
})

test('the shared model request refused: a thin blend naming the request', async () => {
  models = () => new Response('{"error":true,"reason":"Too many concurrent requests"}', { status: 429 })
  const res = await ask('perth-c')
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.partial, true)
  assert.match(res.headers.get('cache-control'), /s-maxage=120\b/)
  assert.deepEqual((await partialLogs()).at(-1).meta.failed, ['open-meteo-models'])
})
