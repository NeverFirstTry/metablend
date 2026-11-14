// Every Open-Meteo source of a forecast gone at once (Vienna, 2026-11-13, 12:37 UTC: a 503 "The service is
// overloaded" on all four requests, a blend of 5 sources went out for 2 minutes). Since then each request is
// asked once more after a 503 (lib/weather.js tfetch), and when they all still fail the place's last full
// blend goes out, at most 2 hours old and marked with its time, instead of a thin one (lib/last-answer.js,
// kind forecast). The route is called for real with every outside call faked (lib/test-route-fakes.js); the
// table and its function are a small in-memory stand-in that applies the age filter the route asks for.
// One place (Perth: no regional source applies) through one afternoon, the clock moved between the tests.
import './test-jsx-hooks.js'
import { test, mock, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { json, seen, answerWith } from './test-route-fakes.js'

const read = name => fs.readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8')
const omMore = read('om-more-lienz.json'), omNow = read('om-now-lienz.json'), metno = read('metno-lienz.json')
const body = text => new Response(text, { headers: { 'content-type': 'application/json' } })
const overloaded = () => new Response('{"error":true,"reason":"The service is overloaded"}', { status: 503, headers: { 'content-type': 'application/json' } })
const TOWN = { id: 2063523, name: 'Perth', alt: '', lat: -31.95, lon: 115.86, country: 'AU', region: 'Western Australia', population: 2000000 }
const OPEN_METEO = /^(open-meteo|ecmwf|gfs|icon|meteofrance|chmi|gem|jma|cma|aifs|meteoswiss|italiameteo|knmi|dmi|nbm)$/

// Open-Meteo: 'up', 'down' (503 to everything), 'once' (503 to each request the first time it is asked),
// 'models-down' (only the shared request of the national models fails); and the kept answers
const w = { openMeteo: 'up', kept: new Map(), keeps: [], refused: new Set() }
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
  if (url.includes('/rest/v1/rpc/town_lookup')) return json([TOWN]) // our own table knows the place
  if (url.includes('api.met.no')) return body(metno)
  if (!url.includes('open-meteo.com')) return
  if (w.openMeteo === 'down') return overloaded()
  if (w.openMeteo === 'once' && !w.refused.has(url)) { w.refused.add(url); return overloaded() }
  if (url.includes('api.open-meteo.com/v1/forecast') && url.includes('current=temperature_2m')) return json({ current: { temperature_2m: 21.4, apparent_temperature: 20.1, precipitation_probability: 5, windspeed_10m: 12, weathercode: 1 } })
  if (url.includes('api.open-meteo.com/v1/forecast') && url.includes('hourly=')) return w.openMeteo === 'models-down' ? overloaded() : body(omMore)
  if (url.includes('api.open-meteo.com/v1/forecast') && url.includes('minutely_15=')) return body(omNow)
})
const { GET } = await import('../app/api/forecast/route.js')
const { MAX_ROWS, KEEP_MS } = await import('./last-answer.js')

const T0 = Date.parse('2026-11-13T12:00:00Z')
mock.timers.enable({ apis: ['Date'], now: T0 })
after(() => mock.timers.reset())
const minutesLater = min => { mock.timers.setTime(T0 + min * 60_000); seen.length = 0 }
let ip = 40
const ask = (lang = 'en') => GET(new Request(`https://metablend.app/api/forecast?city=perth&lang=${lang}`, { headers: { 'x-forwarded-for': `203.0.113.${++ip}` } }))
const unpack = row => JSON.parse(gunzipSync(Buffer.from(row.body ?? row.p_body, 'base64')).toString())
const logged = async scope => { await new Promise(r => setTimeout(r, 0)); return seen.filter(c => c.url.includes('/rest/v1/error_log') && c.body?.includes(`"${scope}"`)).map(c => JSON.parse(c.body)) }
// how often each of the forecast's three Open-Meteo requests was sent
const asked = () => ['current=temperature_2m', 'hourly=', 'minutely_15='].map(part => seen.filter(c => c.url.includes('api.open-meteo.com/v1/forecast') && c.url.includes(part)).length)
const wrote = table => seen.filter(c => c.url.includes(`/rest/v1/${table}`) && c.method === 'POST').length
let full = null // the full blend of 12:00

test('a full blend is kept for the place, without the fields that belong to the request', async () => {
  const res = await ask()
  assert.equal(res.status, 200)
  full = await res.json()
  assert.equal(full.partial, false)
  assert.equal(full.kept, undefined, 'a fresh blend is not marked')
  assert.match(res.headers.get('cache-control'), /s-maxage=900\b/)
  assert.deepEqual(asked(), [1, 1, 1])
  assert.equal(w.keeps.length, 1)
  assert.deepEqual([w.keeps[0].p_kind, w.keeps[0].p_place, w.keeps[0].p_max], ['forecast', '-31.950,115.860', MAX_ROWS])
  const stored = unpack(w.keeps[0])
  for (const k of ['city', 'cityShown', 'learnCity', 'country', 'cc', 'lat', 'lon', 'region']) assert.ok(!(k in stored), `${k} is the request's own and is not kept`)
  assert.deepEqual(stored.sources, full.sources)
  assert.deepEqual(stored.consensus, full.consensus)
  assert.equal(stored.generatedAt, full.generatedAt)
  assert.ok(w.keeps[0].p_body.length < 4000, `kept in ${w.keeps[0].p_body.length} characters`)
  assert.deepEqual(await logged('forecast.lost'), [])
})

test('every Open-Meteo request refused twice: the last full blend goes out with its own time, for 2 minutes, and nothing of the thin build is stored', async () => {
  minutesLater(20)
  w.openMeteo = 'down'
  const res = await ask('de')
  assert.equal(res.status, 200)
  const got = await res.json()
  assert.deepEqual(asked(), [2, 2, 2], 'each request asked once more after its 503, not more')
  assert.equal(got.kept, new Date(T0).toISOString(), 'marked with the time it was made')
  assert.equal(got.generatedAt, full.generatedAt, 'the age line counts from the blend\'s own time')
  assert.equal(got.partial, false)
  assert.deepEqual(got.sources, full.sources)
  assert.deepEqual(got.consensus, full.consensus)
  assert.deepEqual([got.city, got.cc, got.lat, got.lon], ['Perth', 'AU', -31.95, 115.86], 'the place is this request\'s own')
  assert.match(res.headers.get('cache-control'), /s-maxage=120\b/, 'kept only 2 minutes, so a recovered service shows at once')
  const lost = await logged('forecast.lost')
  assert.equal(lost.length, 1)
  assert.match(lost[0].message, /last full blend served/)
  assert.equal(lost[0].meta.kept, new Date(T0).toISOString())
  assert.equal((await logged('forecast.partial')).length, 1, 'the thin-blend log still says what failed')
  assert.equal(wrote('forecasts'), 0, 'no readings stored for a blend nobody saw')
  assert.equal(wrote('consensus_history'), 0)
  assert.equal(wrote('rpc/bump_api_stats'), 1, 'the failed sources still count in the uptime figures')
  assert.equal(w.keeps.length, 1, 'a kept blend is not kept again')

  // asked again within the 2 minutes: the same answer from the route's own copy, nothing sent outside
  seen.length = 0
  const again = await (await ask('de')).json()
  assert.equal(again.cached, true)
  assert.equal(again.kept, got.kept)
  assert.deepEqual(asked(), [0, 0, 0])
})

test('the kept blend is older than 2 hours: it is not served, the thin blend goes out as before', async () => {
  minutesLater(KEEP_MS.forecast / 60_000 + 5)
  const res = await ask('de')
  assert.equal(res.status, 200)
  const got = await res.json()
  assert.equal(got.kept, undefined)
  assert.equal(got.partial, true)
  const live = got.sources.filter(s => !s.down && s.apiId !== 'metablend')
  assert.ok(live.length >= 1 && live.every(s => !OPEN_METEO.test(s.apiId)), `only the other sources: ${live.map(s => s.apiId)}`)
  assert.match(res.headers.get('cache-control'), /s-maxage=120\b/)
  const lost = await logged('forecast.lost')
  assert.equal(lost.length, 1, 'counted all the same: the health check reads this scope')
  assert.match(lost[0].message, /no full one kept/)
  assert.equal(lost[0].meta.kept, null)
  assert.equal(wrote('forecasts'), 1, 'a thin blend that went out is stored as before')
})

test('each request refused once and answered the second time: a full blend, nothing lost, and it is kept anew', async () => {
  minutesLater(KEEP_MS.forecast / 60_000 + 10)
  w.openMeteo = 'once'
  const res = await ask()
  const got = await res.json()
  assert.deepEqual(asked(), [2, 2, 2])
  assert.equal(got.partial, false)
  assert.equal(got.kept, undefined)
  assert.ok(got.sources.some(s => s.apiId === 'ecmwf') && got.sources.some(s => s.apiId === 'jma'))
  assert.match(res.headers.get('cache-control'), /s-maxage=900\b/)
  assert.deepEqual(await logged('forecast.lost'), [])
  assert.deepEqual(await logged('forecast.partial'), [])
  assert.equal(w.keeps.length, 2)
})

test('only part of Open-Meteo gone: a thin blend as before, the kept one is for the case that all of it failed', async () => {
  minutesLater(KEEP_MS.forecast / 60_000 + 30)
  w.openMeteo = 'models-down'
  const got = await (await ask()).json()
  assert.equal(got.partial, true)
  assert.equal(got.kept, undefined)
  assert.ok(got.sources.some(s => s.apiId === 'ecmwf'), 'the four global models answered')
  assert.deepEqual(await logged('forecast.lost'), [])
  assert.deepEqual((await logged('forecast.partial'))[0].meta.failed, ['open-meteo-models'])
})

test('the page counts the age from the blend, and a kept blend does not flash "updated just now"', () => {
  // source-match-ok: HomePage is one client component with the whole app's state, no test renders it
  const src = fs.readFileSync(new URL('../app/HomePage.jsx', import.meta.url), 'utf8')
  assert.match(src, /const generatedAt = data\?\.generatedAt \?\? outlook\?\.generatedAt\r?\n/)
  assert.match(src, /if \(silent && !json\.kept\) \{/)
})
