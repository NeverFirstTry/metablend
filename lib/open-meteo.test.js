// Open-Meteo's daily limit (10,000 calls per IP, reset at midnight UTC): once an answer says it is used
// up, no Open-Meteo source comes back until then, so a blend missing them keeps its full 15 minutes
// instead of being refetched every 2 minutes; a concurrency 429 or any other failure still shortens it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isOpenMeteo, noteAnswer, dailyLimited, resetLimit, nextUtcMidnight, openMeteoFetch } from './open-meteo.js'
import { blendTtl, FULL_TTL, SHORT_TTL } from './forecast-cache.js'

const T = Date.parse('2026-11-09T14:30:00Z')

test('isOpenMeteo — every Open-Meteo host, nothing else', () => {
  for (const u of ['https://api.open-meteo.com/v1/forecast?x', 'https://archive-api.open-meteo.com/v1/archive', 'https://geocoding-api.open-meteo.com/v1/search', 'https://air-quality-api.open-meteo.com/v1/air-quality']) assert.equal(isOpenMeteo(u), true, u)
  assert.equal(isOpenMeteo('https://api.met.no/weatherapi/x'), false)
  assert.equal(isOpenMeteo('not a url'), false)
})

test('noteAnswer — a daily-limit 429 marks the limit until the next midnight UTC; other 429s and other hosts do not', () => {
  resetLimit()
  noteAnswer('https://api.open-meteo.com/v1/forecast', 429, '{"error":true,"reason":"Too many concurrent requests"}', T)
  assert.equal(dailyLimited(T), false)
  noteAnswer('https://api.met.no/x', 429, '{"reason":"Daily API request limit exceeded"}', T)
  assert.equal(dailyLimited(T), false)
  noteAnswer('https://api.open-meteo.com/v1/forecast', 429, '{"error":true,"reason":"Daily API request limit exceeded"}', T)
  assert.equal(dailyLimited(T), true)
  assert.equal(dailyLimited(nextUtcMidnight(T) - 1), true)
  assert.equal(dailyLimited(nextUtcMidnight(T)), false)
  assert.equal(new Date(nextUtcMidnight(T)).toISOString(), '2026-11-10T00:00:00.000Z')
  resetLimit()
})

test('blendTtl — a blend missing Open-Meteo while the daily limit is reached keeps the full 15 minutes', () => {
  const failed = ['ecmwf', 'icon', 'open-meteo-models'] // what gave nothing (the route builds it; lib/forecast-cache.js)
  assert.equal(blendTtl(failed, false), SHORT_TTL)
  assert.equal(blendTtl(failed, true), FULL_TTL)
  assert.equal(blendTtl([], true), FULL_TTL)
})

test('openMeteoFetch — reads the reason of a 429 and still hands the answer to the caller', async () => {
  resetLimit()
  const real = globalThis.fetch
  globalThis.fetch = async () => new Response('{"error":true,"reason":"Daily API request limit exceeded"}', { status: 429 })
  try {
    const res = await openMeteoFetch('https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2')
    assert.equal(res.status, 429)
    assert.match(await res.text(), /Daily API request limit/) // the body is still readable
    assert.equal(dailyLimited(), true)
  } finally { globalThis.fetch = real; resetLimit() }
})

// ── the gate (2026-11-10) ─────────────────────────────────────────────────────────────────────
// Every Open-Meteo request, whichever path it takes (tfetch, getJson, the summit forecast), shares one
// gate: four in flight per instance, the same URL asked once while it is in flight, and what was
// refused is kept for the log.
const { getJson } = await import('./outlook/http.js')
const { fetchSummitRaw } = await import('./hike/sources.js')
const { failuresSince } = await import('./open-meteo.js')

// a fake network whose Open-Meteo answers are released by hand, counting how many run at once
function slowNet(answer = () => new Response('{"hourly":{"time":[]}}')) {
  const pending = [], asked = []
  let running = 0, peak = 0
  const fake = async url => {
    if (!isOpenMeteo(url)) return new Response('[]') // the request counter's database bump
    asked.push(String(url)); running++; peak = Math.max(peak, running)
    await new Promise(r => pending.push(r))
    running--
    return answer(String(url))
  }
  const drain = async all => { for (let done = false; !done;) { while (pending.length) pending.shift()(); done = await Promise.race([all.then(() => true), new Promise(r => setTimeout(() => r(false), 5))]) } }
  return { fake, asked, drain, stats: () => ({ running, peak }) }
}
const tick = () => new Promise(r => setTimeout(r, 5))
const withNet = async (net, run) => { const real = globalThis.fetch; globalThis.fetch = net.fake; try { return await run() } finally { globalThis.fetch = real } }

test('openMeteoFetch — at most four requests in flight, the rest wait their turn, every caller gets its answer', async () => {
  const net = slowNet()
  await withNet(net, async () => {
    const all = Promise.all(Array.from({ length: 10 }, (_, i) => openMeteoFetch(`https://api.open-meteo.com/v1/forecast?latitude=${i}&longitude=1`).then(r => r.json())))
    await tick()
    assert.deepEqual(net.stats(), { running: 4, peak: 4 })
    await net.drain(all)
    assert.equal((await all).length, 10)
    assert.equal(net.asked.length, 10)
    assert.equal(net.stats().peak, 4)
  })
})

test('openMeteoFetch — the same URL asked while it is in flight is one request, and each caller reads its own copy of the answer', async () => {
  const net = slowNet(() => new Response('{"current":{"temperature_2m":5.5}}'))
  await withNet(net, async () => {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=46.8289&longitude=12.76903&current=temperature_2m'
    const both = Promise.all([openMeteoFetch(url).then(r => r.json()), openMeteoFetch(url).then(r => r.json())])
    await tick()
    assert.equal(net.asked.length, 1)
    await net.drain(both)
    assert.deepEqual(await both, [{ current: { temperature_2m: 5.5 } }, { current: { temperature_2m: 5.5 } }])
    const again = openMeteoFetch(url).then(r => r.json())
    await tick()
    assert.equal(net.asked.length, 2, 'afterwards it is asked again')
    await net.drain(again)
  })
})

test('getJson and the summit forecast go through the same gate: six at once, four in flight; another host is not held back', async () => {
  const net = slowNet()
  await withNet(net, async () => {
    const all = Promise.all([
      ...[0, 1, 2].map(i => getJson(`https://api.open-meteo.com/v1/forecast?latitude=${i}&longitude=2&hourly=temperature_2m`)),
      ...[0, 1, 2].map(i => fetchSummitRaw(47 + i, 12, 3000)),
      getJson('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=47&lon=12'),
    ])
    await tick()
    assert.deepEqual(net.stats(), { running: 4, peak: 4 })
    await net.drain(all)
    const answers = await all
    assert.equal(answers.length, 7)
    assert.ok(answers.slice(0, 6).every(a => a?.hourly), 'all six Open-Meteo answers arrive')
    assert.equal(net.stats().peak, 4)
  })
})

test('failuresSince — what Open-Meteo refused or never answered, per spot: status, reason and which request', async () => {
  const since = Date.now()
  const real = globalThis.fetch
  globalThis.fetch = async url => {
    const u = String(url)
    if (!isOpenMeteo(u)) return new Response('[]')
    if (u.includes('models=')) return new Response('{"error":true,"reason":"Too many concurrent requests"}', { status: 429 })
    if (u.includes('latitude=48')) { const e = new Error('The operation was aborted due to timeout'); e.name = 'TimeoutError'; throw e }
    if (u.includes('uv_index')) return new Response('', { status: 502 })
    return new Response('{"current":{}}')
  }
  try {
    const at = 'latitude=47.1&longitude=12.3'
    await openMeteoFetch(`https://api.open-meteo.com/v1/forecast?${at}&hourly=temperature_2m&models=ukmo_seamless,gem_seamless`)
    await openMeteoFetch(`https://api.open-meteo.com/v1/forecast?${at}&current=uv_index`)
    await openMeteoFetch(`https://api.open-meteo.com/v1/forecast?${at}&current=temperature_2m`) // answered: not noted
    await assert.rejects(openMeteoFetch('https://api.open-meteo.com/v1/forecast?latitude=48&longitude=16&current=temperature_2m'), { name: 'TimeoutError' })
    assert.deepEqual(failuresSince(since, at), [
      { status: 429, reason: 'Too many concurrent requests', request: 'ukmo_seamless,gem_seamless' },
      { status: 502, reason: '', request: 'uv_index' },
    ])
    assert.deepEqual(failuresSince(since, 'latitude=48&longitude=16'), [{ status: 0, reason: 'TimeoutError', request: 'temperature_2m' }])
    assert.deepEqual(failuresSince(Date.now() + 1000, at), [], 'nothing from before the moment asked for')
    assert.equal(dailyLimited(), false, 'a refusal for being one too many is not the daily limit')
  } finally { globalThis.fetch = real; resetLimit() }
})
