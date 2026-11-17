// The paid plan's key (lib/open-meteo.js, "the paid plan"): with OPEN_METEO_KEY set a request to the
// public service leaves for the customer host with the key; without it nothing changes. The key is added
// where the request leaves and nowhere else: what is counted and what is noted about a failure keep the
// address without it, and our own server never gets it.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// the counter writes to the database: an address for its client, as in lib/test-route-fakes.js (the fake below answers it)
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
const { openMeteoFetch, paidUrl, callWeight, resetSelf, failuresSince } = await import('./open-meteo.js')

const KEY = 'k-123 secret/+' // with characters an address has to escape
const ESCAPED = 'k-123%20secret%2F%2B'
const SELF = 'https://weather.example.net'
const QUESTION = 'latitude=47.07&longitude=12.69&hourly=temperature_2m,precipitation&models=ecmwf_ifs025,gfs_seamless'
const FORECAST = `https://api.open-meteo.com/v1/forecast?${QUESTION}`
const SETTINGS = ['OPEN_METEO_KEY', 'OPEN_METEO_SELF', 'OPEN_METEO_PUBLIC', 'OPEN_METEO_SELF_ID', 'OPEN_METEO_SELF_SECRET', 'OPEN_METEO_SELF_TIMEOUT_MS', 'OPEN_METEO_SHADOW']

// Runs `fn` with the settings and a faked network, as lib/open-meteo-self.test.js does: answer(url) gives
// each outside request its Response; the counter's database calls are answered here and collected.
async function withNet(settings, answer, fn) {
  const before = Object.fromEntries(SETTINGS.map(k => [k, process.env[k]]))
  for (const k of SETTINGS) delete process.env[k]
  Object.assign(process.env, settings)
  const realFetch = globalThis.fetch
  const asked = [], counted = []
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input?.url ?? input)
    if (url.includes('/rest/v1/')) {
      if (url.includes('bump_open_meteo_calls')) counted.push(JSON.parse(init.body))
      return new Response('0', { status: 200, headers: { 'content-type': 'application/json' } })
    }
    asked.push({ url, host: new URL(url).host })
    return answer(url, init)
  }
  resetSelf()
  try {
    await fn({ asked, counted })
    await new Promise(r => setTimeout(r, 5)) // the counter is fire and forget
  } finally {
    globalThis.fetch = realFetch
    for (const k of SETTINGS) { if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k] }
    resetSelf()
  }
  return { asked, counted }
}
const ok = () => new Response('{"hourly":{}}', { status: 200 })
// a different place per request: the gate shares one in-flight request between callers of the same URL
let n = 0
const spot = () => FORECAST.replace('47.07', (50 + ++n * 0.01).toFixed(2))

test('paidUrl: without a key the address is the one asked', () => {
  assert.equal(paidUrl(FORECAST, {}), FORECAST)
  assert.equal(paidUrl(FORECAST, { OPEN_METEO_KEY: '' }), FORECAST)
})

test('paidUrl: with a key, the customer host and the key; the question itself stays byte for byte', () => {
  assert.equal(paidUrl(FORECAST, { OPEN_METEO_KEY: KEY }), `https://customer-api.open-meteo.com/v1/forecast?${QUESTION}&apikey=${ESCAPED}`)
})

test('paidUrl: air quality and the archive have customer hosts too; an address without a question gets one', () => {
  const env = { OPEN_METEO_KEY: 'abc' }
  assert.equal(paidUrl('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=47&longitude=12', env), 'https://customer-air-quality-api.open-meteo.com/v1/air-quality?latitude=47&longitude=12&apikey=abc')
  assert.equal(paidUrl('https://archive-api.open-meteo.com/v1/archive?latitude=47&longitude=12', env), 'https://customer-archive-api.open-meteo.com/v1/archive?latitude=47&longitude=12&apikey=abc')
  assert.equal(paidUrl('https://api.open-meteo.com/v1/forecast', env), 'https://customer-api.open-meteo.com/v1/forecast?apikey=abc')
})

test('paidUrl: the key goes to Open-Meteo\'s API hosts only, and never twice', () => {
  const env = { OPEN_METEO_KEY: 'abc' }
  for (const other of [`${SELF}/v1/forecast?${QUESTION}`, `https://evil-open-meteo.com/v1/forecast?${QUESTION}`, 'https://open-meteo.com/en/docs', 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=47&lon=12']) {
    assert.equal(paidUrl(other, env), other)
  }
  const once = paidUrl(FORECAST, env)
  assert.equal(paidUrl(once, env), once)
})

test('with the key set, a request leaves for the customer host with the key and is counted as before', async () => {
  const url = spot()
  const { asked, counted } = await withNet({ OPEN_METEO_KEY: KEY }, ok, async () => {
    const res = await openMeteoFetch(url, { kind: 'forecast' })
    assert.equal(res.status, 200)
  })
  assert.deepEqual(asked.map(a => a.url), [`${url.replace('https://api.', 'https://customer-api.')}&apikey=${ESCAPED}`])
  assert.deepEqual(counted.map(c => [c.p_kind, c.p_calls]), [['forecast', callWeight(url)]])
})

test('without the key nothing changes: the public host, no key', async () => {
  const url = spot()
  const { asked } = await withNet({}, ok, () => openMeteoFetch(url, { kind: 'forecast' }))
  assert.deepEqual(asked.map(a => a.url), [url])
})

test('a refusal is noted with its reason and without the key', async () => {
  const url = spot(), since = Date.now()
  await withNet({ OPEN_METEO_KEY: KEY }, () => new Response('{"reason":"Too many concurrent requests","error":true}', { status: 429 }), async () => {
    const res = await openMeteoFetch(url, { kind: 'forecast' })
    assert.equal(res.status, 429)
  })
  const noted = JSON.stringify(failuresSince(since, url.split('?')[1].split('&hourly')[0]))
  assert.match(noted, /Too many concurrent requests/)
  assert.ok(!noted.includes('secret') && !noted.includes('apikey'), noted)
})

test('our own server never gets the key; the public service standing behind it does', async () => {
  const url = spot()
  const { asked } = await withNet({ OPEN_METEO_KEY: KEY, OPEN_METEO_SELF: SELF }, u => (u.startsWith(SELF) ? new Response('down', { status: 503 }) : ok()), async () => {
    const res = await openMeteoFetch(url, { kind: 'forecast' })
    assert.equal(res.status, 200)
  })
  assert.deepEqual(asked.map(a => a.host), ['weather.example.net', 'customer-api.open-meteo.com'])
  assert.equal(asked[0].url, url.replace('https://api.open-meteo.com', SELF))
  assert.ok(asked[1].url.endsWith(`&apikey=${ESCAPED}`))
})
