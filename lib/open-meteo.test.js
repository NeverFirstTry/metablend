// Open-Meteo's daily limit (10,000 calls per IP, reset at midnight UTC): once an answer says it is used
// up, no Open-Meteo source comes back until then, so a blend missing them keeps its full 15 minutes
// instead of being refetched every 2 minutes; a concurrency 429 or any other failure still shortens it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isOpenMeteo, noteAnswer, dailyLimited, resetLimit, nextUtcMidnight, openMeteoFetch } from './open-meteo.js'
import { blendTtl, FULL_TTL, SHORT_TTL } from './forecast-cache.js'

const T = Date.parse('2026-11-09T14:30:00Z')
const ok = id => ({ id, value: { apiId: id }, ms: 1, down: false })
const nothing = id => ({ id, value: null, ms: 1, down: false })

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
  const timed = [ok('owm'), nothing('ecmwf'), nothing('icon')], models = nothing('open-meteo-models')
  assert.equal(blendTtl(timed, models, false), SHORT_TTL)
  assert.equal(blendTtl(timed, models, true), FULL_TTL)
  assert.equal(blendTtl([ok('owm'), ok('ecmwf')], ok('open-meteo-models'), true), FULL_TTL)
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
