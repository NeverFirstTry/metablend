// The forecast route handler, called for real with every outside call faked: the geocoder, Open-Meteo,
// one failing source (MET Norway answers 503) and the database's REST API. A cold instance (empty
// in-memory cache) answers 200 with a blend; the same request again is served from the copy without
// another upstream call. The first version of the per-copy lifetime read a field of the copy on a miss
// and every forecast request failed with 500 (2026-11-09): this test calls the miss path.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
delete process.env.WEBHOOK_URL
for (const k of ['OPENWEATHERMAP_API_KEY', 'WEATHERAPI_KEY', 'VISUAL_CROSSING_KEY', 'PIRATE_WEATHER_KEY']) delete process.env[k]

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const calls = { upstream: 0, partialLogged: 0 }
// what each outside service answers
globalThis.fetch = async (input, init) => {
  const url = String(input)
  if (url.includes('geocoding-api.open-meteo.com/v1/search')) return json({ results: [{ id: 2772400, name: 'Lienz', latitude: 46.8294, longitude: 12.7698, country: 'Austria', country_code: 'AT', admin1: 'Tyrol' }] })
  if (url.includes('geocoding-api.open-meteo.com/v1/get')) return json({ name: 'Lienz', admin1: 'Tyrol' })
  if (url.includes('api.open-meteo.com/v1/forecast') && url.includes('current=')) {
    calls.upstream++
    return json({ current: { temperature_2m: 4.2, apparent_temperature: 2.1, precipitation_probability: 10, windspeed_10m: 7, weathercode: 1 } })
  }
  if (url.includes('api.met.no')) return new Response('busy', { status: 503 }) // a source that fails: the blend is thin
  if (url.includes('proj.supabase.co/rest/v1/error_log') && String(init?.body).includes('forecast.partial')) calls.partialLogged++
  if (url.includes('proj.supabase.co/rest/v1/')) return json([], (init?.method ?? 'GET') === 'GET' ? 200 : 201)
  return new Response('not found', { status: 404 })
}

const { GET } = await import('../app/api/forecast/route.js')
const ask = () => GET(new Request('https://metablend.app/api/forecast?city=lienz&lang=en', { headers: { 'x-forwarded-for': '203.0.113.5' } }))

test('a cold instance answers 200 with a blend; the next request is served from the copy, with no upstream call', async () => {
  const first = await ask()
  assert.equal(first.status, 200)
  const body = await first.json()
  assert.equal(body.city, 'Lienz')
  assert.ok(body.sources.some(s => s.apiId === 'open-meteo'), 'the blend carries the source that answered')
  assert.equal(typeof body.consensus.temp, 'number')
  assert.notEqual(body.cached, true)
  assert.equal(body.partial, true) // MET Norway failed
  assert.match(first.headers.get('cache-control'), /s-maxage=120\b/) // a thin blend: two minutes on the CDN too
  await new Promise(r => setTimeout(r, 0))
  assert.equal(calls.partialLogged, 1, 'the thin blend was logged once (error_log, scope forecast.partial)')
  const upstreamAfterFirst = calls.upstream
  assert.ok(upstreamAfterFirst >= 1)

  const second = await ask()
  assert.equal(second.status, 200)
  const again = await second.json()
  assert.equal(again.cached, true)
  assert.equal(again.city, 'Lienz')
  assert.equal(calls.upstream, upstreamAfterFirst, 'the copy was served, Open-Meteo was not asked again')
  assert.equal(calls.partialLogged, 1, 'a served copy logs nothing')
  assert.match(second.headers.get('cache-control'), /s-maxage=(1[01]\d|120)\b/) // what is left of the two minutes
})
