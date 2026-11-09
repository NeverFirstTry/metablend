// A thin blend is not kept for the full 15 minutes: when a source that was asked failed, answered nothing,
// or Open-Meteo's shared model request came back empty, the copy lives 2 minutes in memory and on the CDN
// (Lienz showed 10 of 19 sources for a quarter of an hour, 2026-11-09). Sources that do not apply to the
// place (no key, outside their area) answer undefined and do not make a blend thin.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { blendTtl, FULL_TTL, SHORT_TTL } from './forecast-cache.js'

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

test('the forecast route keeps each copy for its own time, in memory and on the CDN', () => {
  const src = readFileSync(new URL('../app/api/forecast/route.js', import.meta.url), 'utf8')
  assert.match(src, /const ttl = blendTtl\(timed, models\)/)
  assert.match(src, /if \(age < cached\.ttl\)/)
  assert.match(src, /cdnHeaders\(Math\.max\(1, Math\.round\(\(cached\.ttl - age\) \/ 1000\)\)\)/)
  assert.match(src, /CACHE\.set\(key, \{ ts: Date\.now\(\), payload, ttl \}\)/)
  assert.match(src, /cdnHeaders\(ttl \/ 1000\)/)
  assert.match(src, /partial: ttl < FULL_TTL/)
})
