// The last good answer per place (lib/last-answer.js) in the three routes that keep one: the outlook,
// the summit forecast and the rain forecast. Order when the models give nothing (owner, 2026-11-12):
// the kept answer with its time, else MET Norway where there is one (the outlook), else the error.
// The routes are called for real with every outside call faked (lib/test-route-fakes.js); the table and
// its function are a small in-memory stand-in that keeps what the routes send and applies the age filter
// the routes ask for. The clock is set into the recorded answers.
import './test-jsx-hooks.js'
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

const { json, answerWith, reset, seen } = await import('./test-route-fakes.js')
const { GET: outlook } = await import('../app/api/outlook/route.js')
const { GET: hike } = await import('../app/api/hike/route.js')
const { GET: nowcast } = await import('../app/api/nowcast/route.js')
const { KEPT_TTL, MAX_ROWS } = await import('./last-answer.js')

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const vienna = read('./outlook/__fixtures__/om-multi-vienna.json'), glockner = read('./hike/__fixtures__/om-summit-glockner.json')
const rain = read('./__fixtures__/nowcast-vienna.json'), metno = read('./outlook/__fixtures__/metno-oslo.json')
const body = text => new Response(text, { headers: { 'content-type': 'application/json' } })
// the moment 20 minutes into hour `i` of a recorded answer (its hours are local time)
const at = (recorded, i) => { const r = JSON.parse(recorded); return Date.parse(`${r.hourly.time[i]}:00Z`) - r.utc_offset_seconds * 1000 + 20 * 60e3 }
const HOUR = 3600_000

// the outside world of one test: are the models up, does MET Norway answer, and the kept answers
function world({ models = true, met = false } = {}) {
  const w = { models, met, kept: new Map(), keeps: [] }
  reset()
  answerWith(({ url, method, body: sent }) => {
    if (url.includes('/rest/v1/rpc/keep_last_answer')) {
      const p = JSON.parse(sent)
      w.keeps.push(p)
      w.kept.set(`${p.p_kind}|${p.p_place}`, { body: p.p_body, made_at: new Date().toISOString() })
      return json(true)
    }
    if (url.includes('/rest/v1/last_answers') && method === 'GET') {
      const part = k => url.match(new RegExp(`${k}=(?:eq|gte)\\.([^&]+)`))?.[1]
      const row = w.kept.get(`${part('kind')}|${part('place')}`)
      return json(row && row.made_at >= part('made_at') ? [row] : [])
    }
    if (url.includes('geocoding-api.open-meteo.com/v1/search')) return json({ results: [{ id: 2761369, name: 'Vienna', latitude: 48.2085, longitude: 16.3721, country: 'Austria', country_code: 'AT', admin1: 'Vienna' }] })
    if (url.includes('api.met.no')) return w.met ? body(metno) : new Response('down', { status: 503 })
    if (url.includes('api.open-meteo.com/v1/forecast')) {
      if (!w.models) return new Response('{"error":true,"reason":"down"}', { status: 500, headers: { 'content-type': 'application/json' } })
      return body(url.includes('minutely_15=precipitation') ? rain : url.includes('elevation=') ? glockner : vienna)
    }
  })
  return w
}
const unpack = row => JSON.parse(gunzipSync(Buffer.from(row.body ?? row.p_body, 'base64')).toString())
let ip = 20
const ask = (GET, path) => GET(new Request(`https://metablend.app${path}`, { headers: { 'x-forwarded-for': `203.0.113.${++ip}` } }))
const askedMet = () => seen.some(c => c.url.includes('api.met.no'))

test('the outlook: a good answer is kept without the place\'s name; when the models give nothing it is served with its time, before MET Norway is even asked', async () => {
  mock.timers.enable({ apis: ['Date'], now: at(vienna, 9) })
  try {
    const w = world()
    const good = await ask(outlook, '/api/outlook?city=kept-town-a&lang=en')
    assert.equal(good.status, 200)
    const first = await good.json()
    assert.equal(first.kept, undefined, 'a fresh answer is not marked')
    assert.equal(w.keeps.length, 1)
    assert.deepEqual([w.keeps[0].p_kind, w.keeps[0].p_place, w.keeps[0].p_max], ['outlook', '48.209,16.372', MAX_ROWS])
    const stored = unpack(w.keeps[0])
    assert.deepEqual([stored.city, stored.country, stored.cc], [null, null, null], 'no name in the shared row')
    assert.equal(stored.generatedAt, first.generatedAt)

    // three hours later the models are down
    w.models = false
    mock.timers.setTime(at(vienna, 12))
    seen.length = 0
    const res = await ask(outlook, '/api/outlook?city=kept-town-a&lang=en')
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('cache-control'), `public, s-maxage=${KEPT_TTL}`, 'kept only briefly, so a recovered server shows soon')
    const kept = await res.json()
    assert.equal(kept.kept, new Date(at(vienna, 9)).toISOString(), 'marked with the time it was made')
    assert.equal(kept.generatedAt, first.generatedAt)
    assert.deepEqual([kept.city, kept.country, kept.cc], ['Vienna', 'Austria', 'AT'], "the place's name is this request's own")
    assert.deepEqual(kept.days, first.days)
    assert.equal(askedMet(), false, 'the kept answer comes before the one-source fallback')
    assert.equal(w.keeps.length, 1, 'a kept answer is not kept again')

    // 25 hours after it was made it is too old: MET Norway is asked, and with nothing from there the error
    mock.timers.setTime(at(vienna, 9) + 25 * HOUR)
    seen.length = 0
    const late = await ask(outlook, '/api/outlook?city=kept-town-a&lang=en')
    assert.equal(late.status, 502)
    assert.equal(late.headers.get('cache-control'), 'no-store')
    assert.equal(askedMet(), true)
  } finally { mock.timers.reset() }
})

test('the outlook without a kept answer: MET Norway answers, and that one-source answer is not kept', async () => {
  mock.timers.enable({ apis: ['Date'], now: Date.parse(JSON.parse(metno).properties.timeseries[1].time) + 10 * 60e3 })
  try {
    const w = world({ models: false, met: true })
    const res = await ask(outlook, '/api/outlook?city=kept-town-b&lang=en')
    assert.equal(res.status, 200)
    const out = await res.json()
    assert.equal(out.kept, undefined)
    assert.ok(out.hourly.length > 0)
    assert.equal(w.keeps.length, 0, 'the fallback must not replace a place\'s last good models answer')
  } finally { mock.timers.reset() }
})

test('the summit forecast: kept without the name a request gave the peak, and served under the asking request\'s own name', async () => {
  mock.timers.enable({ apis: ['Date'], now: at(glockner, 9) })
  try {
    const w = world()
    const spot = 'lat=47.0745&lon=12.6939&elev=3798'
    const good = await (await ask(hike, `/api/hike?${spot}&name=Somebody%27s+own+words`)).json()
    assert.ok(good.hourly.length > 0)
    assert.deepEqual([w.keeps[0].p_kind, w.keeps[0].p_place], ['summit', '47.075,12.694,3798'])
    assert.equal(unpack(w.keeps[0]).peak.name, null, 'one request must not name the peak for others')
    // the summit pages' three-model copy is its own row
    await ask(hike, `/api/hike?${spot}&name=Glockner&models=core`)
    assert.equal(w.keeps[1].p_place, '47.075,12.694,3798,core')

    w.models = false
    mock.timers.setTime(at(glockner, 12))
    const res = await ask(hike, `/api/hike?${spot}&name=Gro%C3%9Fglockner`)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('cache-control'), `public, s-maxage=${KEPT_TTL}`)
    const kept = await res.json()
    assert.equal(kept.kept, new Date(at(glockner, 9)).toISOString())
    assert.equal(kept.unavailable, undefined)
    assert.equal(kept.peak.name, 'Großglockner')
    assert.equal(kept.generatedAt, good.generatedAt)
    assert.deepEqual(kept.days, good.days)

    // another height at the same spot has no kept answer: "unavailable" with 200, as before
    const other = await (await ask(hike, '/api/hike?lat=47.0745&lon=12.6939&elev=3000&name=x')).json()
    assert.equal(other.unavailable, true)
    // and after 24 hours the kept one is too old
    mock.timers.setTime(at(glockner, 9) + 25 * HOUR)
    const late = await ask(hike, `/api/hike?${spot}&name=Gro%C3%9Fglockner`)
    assert.equal((await late.json()).unavailable, true)
    assert.equal(late.headers.get('cache-control'), 'no-store')
  } finally { mock.timers.reset() }
})

test('the rain forecast: kept, served up to an hour old with its time, then the error', async () => {
  const T0 = Date.parse('2026-11-20T10:00:00Z')
  mock.timers.enable({ apis: ['Date'], now: T0 })
  try {
    const w = world()
    const good = await (await ask(nowcast, '/api/nowcast?lat=47.81&lon=13.04')).json()
    assert.deepEqual([w.keeps[0].p_kind, w.keeps[0].p_place], ['rain', '47.81,13.04'])
    w.models = false
    mock.timers.setTime(T0 + 40 * 60e3) // past the route's own ten minutes
    const res = await ask(nowcast, '/api/nowcast?lat=47.81&lon=13.04')
    assert.equal(res.status, 200)
    const kept = await res.json()
    assert.equal(kept.kept, new Date(T0).toISOString())
    assert.deepEqual(kept.steps, good.steps)
    mock.timers.setTime(T0 + 61 * 60e3)
    const late = await ask(nowcast, '/api/nowcast?lat=47.81&lon=13.04')
    assert.equal(late.status, 502)
  } finally { mock.timers.reset() }
})

test('no table yet (the SQL has not run): the routes behave as before', async () => {
  mock.timers.enable({ apis: ['Date'], now: at(glockner, 9) })
  try {
    reset()
    answerWith(({ url }) => {
      if (url.includes('keep_last_answer')) return json({ code: 'PGRST202', message: 'Could not find the function' }, 404)
      if (url.includes('/rest/v1/last_answers')) return json({ code: 'PGRST205', message: 'Could not find the table' }, 404)
      if (url.includes('api.open-meteo.com/v1/forecast') && url.includes('elevation=') && !url.includes('elev-down')) return body(glockner)
    })
    const good = await ask(hike, '/api/hike?lat=47.0745&lon=12.6939&elev=3798&name=Glockner')
    assert.equal(good.status, 200)
    assert.ok((await good.json()).hourly.length > 0)
    answerWith(({ url }) => (url.includes('/rest/v1/last_answers') ? json({ code: 'PGRST205', message: 'Could not find the table' }, 404) : undefined))
    const down = await (await ask(hike, '/api/hike?lat=46.5&lon=11.5&elev=2500&name=Elsewhere')).json()
    assert.equal(down.unavailable, true)
  } finally { mock.timers.reset() }
})
