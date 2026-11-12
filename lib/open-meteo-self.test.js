// The switch to our own Open-Meteo server (lib/open-meteo.js, "our own server"): where a request goes
// with each setting, what our server's failures do, that the access token reaches our server only, and
// that with the public service switched off nothing is ever sent to it.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// the counter writes to the database: an address for its client, as in lib/test-route-fakes.js (the fake below answers it)
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
const { openMeteoFetch, selfUrl, isOpenMeteo, resetSelf, failuresSince } = await import('./open-meteo.js')

const SELF = 'https://weather.example.net'
const FORECAST = 'https://api.open-meteo.com/v1/forecast?latitude=47.07&longitude=12.69&hourly=temperature_2m&models=ecmwf_ifs025,gfs_seamless'
const KEYS = ['OPEN_METEO_SELF', 'OPEN_METEO_PUBLIC', 'OPEN_METEO_SELF_ID', 'OPEN_METEO_SELF_SECRET', 'OPEN_METEO_SELF_TIMEOUT_MS']

// Runs `fn` with the settings and a faked network. answer(url, init) gives each outside request its
// Response (or throws); the counter's database calls are answered here and collected in `counted`.
async function withNet(settings, answer, fn) {
  const before = Object.fromEntries(KEYS.map(k => [k, process.env[k]]))
  for (const k of KEYS) delete process.env[k]
  Object.assign(process.env, settings)
  const realFetch = globalThis.fetch
  const asked = [], counted = []
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input?.url ?? input)
    if (url.includes('/rest/v1/')) {
      if (url.includes('bump_open_meteo_calls')) counted.push(JSON.parse(init.body))
      return new Response('0', { status: 200, headers: { 'content-type': 'application/json' } })
    }
    asked.push({ url, host: new URL(url).host, headers: Object.fromEntries(new Headers(init.headers ?? {})), redirect: init.redirect })
    return answer(url, init)
  }
  resetSelf()
  try {
    await fn({ asked, counted })
    await new Promise(r => setTimeout(r, 5)) // the counter is fire and forget
  } finally {
    globalThis.fetch = realFetch
    for (const k of KEYS) { if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k] }
    resetSelf()
  }
  return { asked, counted }
}
const ok = () => new Response('{"hourly":{}}', { status: 200 })
const fromSelf = url => url.startsWith(SELF)
// a different place per request: the gate shares one in-flight request between callers of the same URL
let n = 0
const spot = () => FORECAST.replace('47.07', (40 + ++n * 0.01).toFixed(2))

test('isOpenMeteo: open-meteo.com and its subdomains, not a host that merely ends in those letters', () => {
  assert.equal(isOpenMeteo('https://open-meteo.com/en/docs'), true)
  assert.equal(isOpenMeteo('https://api.open-meteo.com/v1/forecast'), true)
  assert.equal(isOpenMeteo('https://evil-open-meteo.com/v1/forecast'), false)
  assert.equal(isOpenMeteo('https://open-meteo.com.example.org/v1/forecast'), false)
})

test('selfUrl: same path and question on our server; only https (or localhost), only the hosts our server replaces', () => {
  const env = { OPEN_METEO_SELF: `${SELF}/ignored/path/` }
  assert.equal(selfUrl(FORECAST, env), FORECAST.replace('https://api.open-meteo.com', SELF))
  assert.equal(selfUrl('https://api.open-meteo.com/v1/elevation?latitude=47&longitude=12', env), `${SELF}/v1/elevation?latitude=47&longitude=12`)
  assert.equal(selfUrl('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=47&longitude=12', env), `${SELF}/v1/air-quality?latitude=47&longitude=12`)
  // the place search and the archive are not on our server
  assert.equal(selfUrl('https://geocoding-api.open-meteo.com/v1/search?name=Wien', env), null)
  assert.equal(selfUrl('https://archive-api.open-meteo.com/v1/archive?latitude=47&longitude=12', env), null)
  assert.equal(selfUrl('https://api.met.no/weatherapi/x', env), null)
  assert.equal(selfUrl(FORECAST, {}), null, 'unset')
  assert.equal(selfUrl(FORECAST, { OPEN_METEO_SELF: 'http://weather.example.net' }), null, 'the token must not travel in the clear')
  assert.equal(selfUrl(FORECAST, { OPEN_METEO_SELF: 'http://localhost:8080' }), FORECAST.replace('https://api.open-meteo.com', 'http://localhost:8080'))
  assert.equal(selfUrl(FORECAST, { OPEN_METEO_SELF: 'not an address' }), null)
})

test('unset: the public service is asked as before, counted with its weight', async () => {
  const url = spot()
  const { asked, counted } = await withNet({}, ok, async () => { assert.equal((await openMeteoFetch(url, { kind: 'outlook' })).status, 200) })
  assert.deepEqual(asked.map(a => a.host), ['api.open-meteo.com'])
  assert.equal(counted.length, 1)
  assert.equal(counted[0].p_kind, 'outlook')
  assert.ok(counted[0].p_calls >= 1)
})

test('set: our server answers, with the token, without following a redirect; counted as self:<kind> with weight 0; the public service is not asked', async () => {
  const url = spot()
  const { asked, counted } = await withNet({ OPEN_METEO_SELF: SELF, OPEN_METEO_SELF_ID: 'id-123', OPEN_METEO_SELF_SECRET: 'secret-456' }, ok, async () => {
    assert.equal((await openMeteoFetch(url, { kind: 'summit', headers: { 'User-Agent': 'MetaBlend' } })).status, 200)
  })
  assert.equal(asked.length, 1)
  assert.equal(asked[0].url, url.replace('https://api.open-meteo.com', SELF))
  assert.equal(asked[0].headers['cf-access-client-id'], 'id-123')
  assert.equal(asked[0].headers['cf-access-client-secret'], 'secret-456')
  assert.equal(asked[0].headers['user-agent'], 'MetaBlend', "the caller's own headers stay")
  assert.equal(asked[0].redirect, 'error')
  assert.deepEqual(counted.map(c => [c.p_kind, c.p_calls]), [['self:summit', 0]])
})

test('our server fails (500, no answer, a redirect, 401): the same request goes to the public service, and the token does not go with it', async () => {
  for (const fail of [
    () => new Response('boom', { status: 500 }),
    () => { throw new TypeError('fetch failed') },
    () => { throw new TypeError('redirect mode is set to error') },
    () => new Response('who are you', { status: 401 }),
    () => new Response('{"error":true,"reason":"No data is available for this location"}', { status: 400 }),
    () => new Response('not here', { status: 404 }),
  ]) {
    const url = spot()
    const { asked, counted } = await withNet({ OPEN_METEO_SELF: SELF, OPEN_METEO_SELF_ID: 'id-123', OPEN_METEO_SELF_SECRET: 'secret-456' },
      u => (fromSelf(u) ? fail() : ok()),
      async () => { assert.equal((await openMeteoFetch(url, { kind: 'forecast' })).status, 200) })
    assert.deepEqual(asked.map(a => a.host), ['weather.example.net', 'api.open-meteo.com'])
    assert.equal(asked[1].url, url)
    assert.equal(asked[1].headers['cf-access-client-id'], undefined)
    assert.equal(asked[1].headers['cf-access-client-secret'], undefined)
    assert.notEqual(asked[1].redirect, 'error')
    assert.deepEqual(counted.map(c => c.p_kind).sort(), ['forecast', 'self:forecast'])
  }
})

test('our server is slow: it gets its own short limit while the public service stands behind it, and the caller\'s full time when alone', async () => {
  const slow = (u, init) => (fromSelf(u)
    ? new Promise((resolve, reject) => {
      const t = setTimeout(() => resolve(ok()), 80)
      init.signal?.addEventListener('abort', () => { clearTimeout(t); reject(init.signal.reason) })
    })
    : ok())
  const behind = await withNet({ OPEN_METEO_SELF: SELF, OPEN_METEO_SELF_TIMEOUT_MS: '30' }, slow, async () => {
    assert.equal((await openMeteoFetch(spot(), { kind: 'forecast', timeoutMs: 5000 })).status, 200)
  })
  assert.deepEqual(behind.asked.map(a => a.host), ['weather.example.net', 'api.open-meteo.com'], 'given up after 30 ms, then the public service')
  const alone = await withNet({ OPEN_METEO_SELF: SELF, OPEN_METEO_SELF_TIMEOUT_MS: '30', OPEN_METEO_PUBLIC: 'off' }, slow, async () => {
    assert.equal((await openMeteoFetch(spot(), { kind: 'forecast', timeoutMs: 5000 })).status, 200)
  })
  assert.deepEqual(alone.asked.map(a => a.host), ['weather.example.net'], 'waited the 80 ms')
})

test('three failures in a row: our server is left out for a minute, then asked again; a 404 or 400 does not count', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-20T10:00:00Z') })
  let selfAnswer = () => new Response('boom', { status: 503 })
  await withNet({ OPEN_METEO_SELF: SELF }, u => (fromSelf(u) ? selfAnswer() : ok()), async ({ asked }) => {
    const hosts = async () => { asked.length = 0; await openMeteoFetch(spot(), { kind: 'forecast' }); return asked.map(a => a.host) }
    // answers that are not an outage, any number of them
    selfAnswer = () => new Response('not here', { status: 404 })
    for (let i = 0; i < 4; i++) assert.deepEqual(await hosts(), ['weather.example.net', 'api.open-meteo.com'])
    selfAnswer = () => new Response('boom', { status: 503 })
    for (let i = 0; i < 3; i++) assert.deepEqual(await hosts(), ['weather.example.net', 'api.open-meteo.com'])
    // paused: straight to the public service, our server is not asked
    assert.deepEqual(await hosts(), ['api.open-meteo.com'])
    t.mock.timers.tick(59_000)
    assert.deepEqual(await hosts(), ['api.open-meteo.com'])
    t.mock.timers.tick(2_000)
    selfAnswer = ok
    assert.deepEqual(await hosts(), ['weather.example.net'], 'asked again after the minute')
    // two failures, a good answer, two failures: never three in a row, so no pause
    selfAnswer = () => new Response('boom', { status: 503 })
    await hosts(); await hosts()
    selfAnswer = ok
    await hosts()
    selfAnswer = () => new Response('boom', { status: 503 })
    await hosts()
    assert.deepEqual(await hosts(), ['weather.example.net', 'api.open-meteo.com'])
  })
})

test('the public service switched off: it is never asked, whatever our server does', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-12-15T10:00:00Z') })
  const since = Date.now()
  let selfAnswer = () => new Response('boom', { status: 500 })
  const { asked, counted } = await withNet({ OPEN_METEO_SELF: SELF, OPEN_METEO_PUBLIC: 'off' }, u => (fromSelf(u) ? selfAnswer() : ok()), async () => {
    // our server's own failure comes back as it is
    assert.equal((await openMeteoFetch(spot(), { kind: 'outlook' })).status, 500)
    selfAnswer = () => { throw new TypeError('fetch failed') }
    await assert.rejects(openMeteoFetch(spot(), { kind: 'outlook' }), /fetch failed/)
    await assert.rejects(openMeteoFetch(spot(), { kind: 'outlook' }), /fetch failed/)
    // three in a row: paused, and a request is refused without being sent anywhere
    await assert.rejects(openMeteoFetch(spot(), { kind: 'outlook' }), { name: 'SelfPaused' })
    // what our server does not replace (place search, archive) is refused too
    await assert.rejects(openMeteoFetch('https://geocoding-api.open-meteo.com/v1/search?name=Wien', { kind: 'geocoding' }), { name: 'PublicOff' })
    await assert.rejects(openMeteoFetch('https://archive-api.open-meteo.com/v1/archive?latitude=47&longitude=12', { kind: 'climate' }), { name: 'PublicOff' })
    t.mock.timers.tick(61_000)
    selfAnswer = ok
    assert.equal((await openMeteoFetch(spot(), { kind: 'outlook' })).status, 200)
  })
  assert.ok(asked.length === 4 && asked.every(a => a.host === 'weather.example.net'), 'only our server was asked')
  assert.deepEqual(counted.map(c => [c.p_kind, c.p_calls]), Array(4).fill(['self:outlook', 0]), 'four requests to our server, nothing counted against the public service')
  // a refused request is in the failure notes, so a thin blend's log says why
  assert.ok(failuresSince(since).some(f => f.reason === 'SelfPaused') && failuresSince(since).some(f => f.reason === 'PublicOff'))
})

test('the public service switched off and no server of our own set: nothing is sent at all', async () => {
  const { asked, counted } = await withNet({ OPEN_METEO_PUBLIC: 'off' }, ok, async () => {
    await assert.rejects(openMeteoFetch(spot(), { kind: 'forecast' }), { name: 'PublicOff' })
  })
  assert.equal(asked.length, 0)
  assert.equal(counted.length, 0)
})

test('set, but the place search and the archive still go to the public service while it is allowed, without the token', async () => {
  const { asked } = await withNet({ OPEN_METEO_SELF: SELF, OPEN_METEO_SELF_ID: 'id-123', OPEN_METEO_SELF_SECRET: 'secret-456' }, ok, async () => {
    await openMeteoFetch('https://geocoding-api.open-meteo.com/v1/search?name=Graz', { kind: 'geocoding' })
    await openMeteoFetch('https://archive-api.open-meteo.com/v1/archive?latitude=47.1&longitude=15.4', { kind: 'climate' })
  })
  assert.deepEqual(asked.map(a => a.host), ['geocoding-api.open-meteo.com', 'archive-api.open-meteo.com'])
  assert.ok(asked.every(a => a.headers['cf-access-client-secret'] === undefined))
})
