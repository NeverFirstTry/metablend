// A thin blend is not kept for the full 15 minutes: when a source that was asked failed, answered nothing,
// or Open-Meteo's shared model request came back empty, the copy lives 2 minutes in memory and on the CDN
// (Lienz showed 10 of 19 sources for a quarter of an hour, 2026-11-09). Sources that do not apply to the
// place (no key, outside their area) answer undefined and do not make a blend thin. The lookup itself is
// tested on a miss: the first version read the lifetime of a copy that was not there and every forecast
// request failed with 500 for two minutes on 2026-11-09.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { blendTtl, freshCopy, FULL_TTL, SHORT_TTL } from './forecast-cache.js'

const ok = id => ({ id, value: { apiId: id, temp: 5 }, ms: 90, down: false })
const notApplicable = id => ({ id, value: undefined, ms: 1, down: false }) // no key, or outside the source's area
const failedQuietly = id => ({ id, value: null, ms: 400, down: false }) // the fetcher saw a 429 or 503 and returned null
const threw = id => ({ id, value: null, ms: 8000, down: true }) // timed out or threw
const models = ok('open-meteo-models')

test('blendTtl — every asked source answered: the full 15 minutes', () => {
  assert.equal(blendTtl([ok('open-meteo'), ok('owm'), notApplicable('nws'), notApplicable('pirateweather')], models), FULL_TTL)
  assert.equal(FULL_TTL, 15 * 60 * 1000)
})

test('blendTtl — a source that failed, quietly or loudly, or an empty model request: 2 minutes', () => {
  assert.equal(blendTtl([ok('open-meteo'), threw('geosphere')], models), SHORT_TTL)
  assert.equal(blendTtl([ok('open-meteo'), failedQuietly('weatherapi')], models), SHORT_TTL)
  assert.equal(blendTtl([ok('open-meteo'), ok('owm')], { id: 'open-meteo-models', value: null, ms: 300, down: false }), SHORT_TTL)
  assert.equal(blendTtl([ok('open-meteo')], { id: 'open-meteo-models', value: null, ms: 9000, down: true }), SHORT_TTL)
  assert.equal(SHORT_TTL, 2 * 60 * 1000)
})

test('freshCopy — nothing cached is a miss; a copy serves within its own lifetime and not after', () => {
  const now = 1_762_700_000_000
  assert.equal(freshCopy(undefined, now), null)
  const full = { ts: now - 3 * 60 * 1000, payload: { city: 'Vienna' }, ttl: FULL_TTL }
  const thin = { ts: now - 3 * 60 * 1000, payload: { city: 'Lienz' }, ttl: SHORT_TTL }
  assert.equal(freshCopy(full, now), full)
  assert.equal(freshCopy(thin, now), null) // three minutes old: the thin copy is gone, the full one serves
  assert.equal(freshCopy({ ...full, ts: now - FULL_TTL }, now), null)
})

test('the forecast route keeps each copy for its own time, in memory and on the CDN', () => {
  // source-match-ok: tripwire for the 2026-11-09 outage; the route's behaviour is tested by calling GET in forecast-route.test.js
  const src = readFileSync(new URL('../app/api/forecast/route.js', import.meta.url), 'utf8')
  assert.match(src, /const cached = freshCopy\(CACHE\.get\(key\)\)\r?\n  if \(cached\) /)
  assert.match(src, /const ttl = blendTtl\(timed, models\)/)
  assert.match(src, /CACHE\.set\(key, \{ ts: Date\.now\(\), payload, ttl \}\)/)
  assert.match(src, /cdnHeaders\(ttl \/ 1000\)/)
  assert.match(src, /partial: ttl < FULL_TTL/)
  assert.doesNotMatch(src, /cached\.ttl\)/) // never read through a copy that may not be there
})
