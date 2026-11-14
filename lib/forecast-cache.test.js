// A thin blend is not kept for the full 15 minutes: when a source that was asked failed, answered nothing,
// or Open-Meteo's shared model request came back empty, the copy lives 2 minutes in memory and on the CDN
// (Lienz showed 10 of 19 sources for a quarter of an hour, 2026-11-09). Sources that do not apply to the
// place (no key, outside their area) answer undefined and do not make a blend thin. The lookup itself is
// tested on a miss: the first version read the lifetime of a copy that was not there and every forecast
// request failed with 500 for two minutes on 2026-11-09.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { blendTtl, freshCopy, FULL_TTL, SHORT_TTL, lostOpenMeteo, OPEN_METEO_IDS } from './forecast-cache.js'

// `failed`: the ids of the sources that were asked and gave nothing, and the global models missing from
// Open-Meteo's shared request (the route builds it; lib/weather.js missingModels)
test('blendTtl — nothing failed or missing: the full 15 minutes', () => {
  assert.equal(blendTtl([]), FULL_TTL)
  assert.equal(FULL_TTL, 15 * 60 * 1000)
})

test('blendTtl — a source that failed, or a model missing from the shared answer: 2 minutes, unless the daily limit is the cause', () => {
  assert.equal(blendTtl(['geosphere']), SHORT_TTL)
  assert.equal(blendTtl(['weatherapi']), SHORT_TTL)
  assert.equal(blendTtl(['open-meteo-models']), SHORT_TTL)
  assert.equal(blendTtl(['jma']), SHORT_TTL) // present in the answer everywhere else, missing here: thin
  assert.equal(blendTtl(['open-meteo-models'], true), FULL_TTL) // Open-Meteo's daily limit: its sources will not come back before midnight
  assert.equal(SHORT_TTL, 2 * 60 * 1000)
})

test('lostOpenMeteo — only when everything the forecast gets from Open-Meteo gave nothing', () => {
  assert.deepEqual(OPEN_METEO_IDS, ['open-meteo', 'ecmwf', 'gfs', 'icon', 'meteofrance', 'open-meteo-models'])
  assert.equal(lostOpenMeteo([...OPEN_METEO_IDS]), true)
  assert.equal(lostOpenMeteo(['met-norway', ...OPEN_METEO_IDS, 'geosphere']), true) // other sources failing as well changes nothing
  assert.equal(lostOpenMeteo(OPEN_METEO_IDS.filter(id => id !== 'icon')), false) // one of them answered: a thin blend, as before
  assert.equal(lostOpenMeteo(['open-meteo', 'ecmwf', 'gfs', 'icon', 'meteofrance', 'jma']), false) // the shared request answered, one model missing from it
  assert.equal(lostOpenMeteo([]), false)
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
  assert.match(src, /const ttl = blendTtl\(failed, limited\)/)
  assert.match(src, /CACHE\.set\(key, \{ ts: Date\.now\(\), payload, ttl \}\)/)
  assert.match(src, /cdnHeaders\(ttl \/ 1000\)/)
  assert.match(src, /partial: failed\.length > 0/)
  assert.doesNotMatch(src, /cached\.ttl\)/) // never read through a copy that may not be there
})
