// Open-Meteo through one gate (2026-11-10). A forecast miss asked eight Open-Meteo requests at once and
// a burst of places many times that; Open-Meteo refused some with 429 "Too many concurrent requests"
// and the blends went thin: Vienna during a store run (its ten-model request, nine sources gone for two
// minutes), sixteen cities in one burst the evening before. The route is called for real with every
// outside call faked (lib/test-route-fakes.js): never more than four Open-Meteo requests in flight, a
// refused one asked once more, the log saying what Open-Meteo answered, and a source that does not
// cover a place no longer counted as failed (Toronto and Vancouver were thin on every request).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import './test-jsx-hooks.js'
import { json, seen, answerWith } from './test-route-fakes.js'

// the shared fake answers however long the caller has waited; fetch gives up once the caller's time
// limit has passed, and the test of that limit needs it to
const faked = globalThis.fetch
globalThis.fetch = async (input, init = {}) => {
  if (init.signal?.aborted) throw init.signal.reason
  const res = await faked(input, init)
  if (init.signal?.aborted) throw init.signal.reason
  return res
}

const omMore = fs.readFileSync(new URL('./__fixtures__/om-more-lienz.json', import.meta.url), 'utf8')
const omNow = fs.readFileSync(new URL('./__fixtures__/om-now-lienz.json', import.meta.url), 'utf8')
const metno = fs.readFileSync(new URL('./__fixtures__/metno-lienz.json', import.meta.url), 'utf8')
const body = text => new Response(text, { headers: { 'content-type': 'application/json' } })
const busy = () => new Response('{"error":true,"reason":"Too many concurrent requests"}', { status: 429 })

// every searched name is its own place; a few sit where a regional source does not reach
const PLACES = { toronto: [43.6532, -79.3832, 'CA'], prague: [50.0755, 14.4378, 'CZ'] }
const placeOf = name => PLACES[name] ?? [-20 - (Number(name.replace(/\D/g, '')) || 0), 115.86, 'AU']
let running = 0, peak = 0, answerMs = 8 // an answer takes a moment: requests overlap as they do live
let modelAnswers = [] // what the ten-model request gets, in order; then the normal answer
answerWith(async ({ url }) => {
  if (url.includes('geocoding-api.open-meteo.com/v1/search')) {
    const name = /name=([^&]+)/.exec(url)[1]
    const [latitude, longitude, cc] = placeOf(name)
    return json({ results: [{ id: 1000 + name.length, name, latitude, longitude, country: cc, country_code: cc, admin1: null }] })
  }
  if (url.includes('api.weather.gov/points') || url.includes('api.brightsky.dev')) return new Response('{"detail":"not covered"}', { status: 404 })
  if (url.includes('api.met.no')) return body(metno)
  if (!url.includes('.open-meteo.com/')) return undefined
  running++; peak = Math.max(peak, running)
  await new Promise(r => setTimeout(r, answerMs))
  running--
  if (url.includes('current=temperature_2m')) return json({ current: { temperature_2m: 21.4, apparent_temperature: 20.1, precipitation_probability: 5, windspeed_10m: 12, weathercode: 1 } })
  if (url.includes('hourly=')) return modelAnswers.shift() ?? body(omMore)
  if (url.includes('minutely_15=')) return body(omNow)
  // the extras and the name lookup answer too, so the log holds only what a test refuses
  if (url.includes('current=uv_index')) return json({ current: { uv_index: 2 } })
  if (url.includes('current=snowfall')) return json({ current: { snowfall: 0, visibility: 10000, cloudcover: 10, soil_temperature_0cm: 5, precipitation: 0 } })
  if (url.includes('air-quality-api')) return json({ current: { european_aqi: 20 } })
  if (url.includes('archive-api')) return json({ daily: { temperature_2m_max: [8], temperature_2m_min: [2] } })
  if (url.includes('/v1/get')) return json({ name: 'Somewhere', admin1: null })
})
const { GET } = await import('../app/api/forecast/route.js')
const ask = (city, ip = '203.0.113.30') => GET(new Request(`https://metablend.app/api/forecast?city=${city}&lang=en`, { headers: { 'x-forwarded-for': ip } })).then(async res => ({ res, body: await res.json() }))
const partialLogs = async () => { await new Promise(r => setTimeout(r, 0)); return seen.filter(c => c.url.includes('/rest/v1/error_log') && c.body?.includes('forecast.partial')).map(c => JSON.parse(c.body)) }
const modelAsks = lat => seen.filter(c => c.url.includes('hourly=') && c.url.includes(`latitude=${lat}&`)).length

test('six places asked at the same moment: never more than four Open-Meteo requests in flight, every blend full', async () => {
  const blends = await Promise.all([1, 2, 3, 4, 5, 6].map(n => ask(`burst${n}`)))
  assert.equal(peak, 4, 'the gate holds the rest back (without it: 30 and more at once)')
  for (const { res, body } of blends) {
    assert.equal(res.status, 200)
    assert.equal(body.partial, false)
    assert.ok(['jma', 'ecmwf', 'open-meteo'].every(id => body.sources.some(s => s.apiId === id)))
  }
  assert.deepEqual(await partialLogs(), [])
})

test('the ten-model request refused once for being one too many: asked again, a full blend, nothing logged', async () => {
  modelAnswers = [busy()]
  const { res, body } = await ask('place10')
  assert.equal(body.partial, false)
  assert.match(res.headers.get('cache-control'), /s-maxage=900\b/)
  assert.ok(body.sources.some(s => s.apiId === 'ukmo'))
  assert.equal(modelAsks(-30), 2)
  assert.deepEqual(await partialLogs(), [])
})

test('refused again on the retry: a thin blend for 2 minutes, and the log says what Open-Meteo answered', async () => {
  modelAnswers = [busy(), busy()]
  const { res, body } = await ask('place11')
  assert.equal(body.partial, true)
  assert.match(res.headers.get('cache-control'), /s-maxage=120\b/)
  assert.equal(modelAsks(-31), 2, 'one retry, not more')
  const { meta } = (await partialLogs()).at(-1)
  assert.deepEqual(meta.failed, ['open-meteo-models'])
  assert.equal(meta.upstream.length, 2)
  for (const u of meta.upstream) {
    assert.deepEqual([u.status, u.reason], [429, 'Too many concurrent requests'])
    assert.match(u.request, /^ukmo_seamless,gem_seamless/)
  }
})

test('a limit per minute is not asked again: thin, with that reason in the log', async () => {
  modelAnswers = [new Response('{"error":true,"reason":"Minutely API request limit exceeded. Please try again in one minute."}', { status: 429 })]
  const { body } = await ask('place12')
  assert.equal(body.partial, true)
  assert.equal(modelAsks(-32), 1)
  const { meta } = (await partialLogs()).at(-1)
  assert.equal(meta.upstream.length, 1)
  assert.match(meta.upstream[0].reason, /^Minutely API request limit exceeded/)
})

test('Toronto (inside NWS\'s box, not on its grid) and Prague (no Bright Sky station in reach): asked, not covered, a full blend', async () => {
  const logsBefore = (await partialLogs()).length
  for (const [city, host] of [['toronto', 'api.weather.gov/points/43.6532,-79.3832'], ['prague', 'api.brightsky.dev/current_weather?lat=50.0755']]) {
    const { res, body } = await ask(city)
    assert.equal(seen.filter(c => c.url.includes(host)).length, 1, `${city}: the regional source was asked`)
    assert.equal(body.partial, false, city)
    assert.match(res.headers.get('cache-control'), /s-maxage=900\b/, city)
    assert.ok(!body.sources.some(s => s.down), city)
  }
  assert.equal((await partialLogs()).length, logsBefore)
})

test('the request count: what getJson asks the forecast host (outlook, nowcast, summits, route weather) is counted like the forecast\'s own requests, and so are the archive\'s 10-year climate request, by its span, and the peak search', async () => {
  const { getJson } = await import('./outlook/http.js')
  const bumps = () => seen.filter(c => c.url.includes('/rpc/bump_open_meteo_calls'))
  const settle = () => new Promise(r => setTimeout(r, 20))
  const before = bumps().length
  await getJson('https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2&hourly=a,b,c,d,e&daily=f,g,h,i,j,k,l,m&models=m1,m2,m3,m4,m5,m6,m7,m8,m9,m10&forecast_days=8')
  await settle()
  assert.equal(bumps().length, before + 1)
  assert.equal(JSON.parse(bumps().at(-1).body).p_calls, 13, 'an outlook miss: 13 variables for 10 models')
  await getJson('https://archive-api.open-meteo.com/v1/archive?latitude=1.00&longitude=2.00&start_date=2016-01-01&end_date=2025-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum')
  await getJson('https://geocoding-api.open-meteo.com/v1/search?name=glockner&count=20&language=en')
  await settle()
  assert.equal(bumps().length, before + 3, 'the climate request and the peak search are counted too')
  assert.deepEqual(bumps().slice(-2).map(b => JSON.parse(b.body).p_calls), [78.28, 1], '3 daily values over 10 years by their calculator; a name search is one call')
})

// Takes about 7 s by design: the forecast's limit is 5 s per request, and the point is that the wait in
// the queue no longer uses it up.
test('twenty places at once with slow answers: the last requests wait more than their 5 seconds for a turn and still get them, every blend full', async () => {
  answerMs = 200
  try {
    const started = Date.now()
    const blends = await Promise.all(Array.from({ length: 20 }, (_, n) => ask(`slow${40 + n}`, '203.0.113.31')))
    assert.ok(Date.now() - started > 5500, `the queue took longer than one time limit (${Date.now() - started} ms)`)
    assert.deepEqual(blends.map(b => b.body.partial), Array(20).fill(false))
    assert.ok(blends.every(b => ['open-meteo', 'ukmo', 'ecmwf'].every(id => b.body.sources.some(s => s.apiId === id))))
    assert.equal(peak, 4)
  } finally { answerMs = 8 }
})
