// A city search no longer needs Open-Meteo: our own towns answer first (GeoNames places of 5,000 and
// more, by any of their names, the most populous first, the nearest when the search came from
// somewhere), then Open-Meteo's cached answer from the last 30 days, and only then Open-Meteo itself,
// whose answer is cached and whose ask is logged (scope geocode.upstream). The English name a place is
// filed under still comes from Open-Meteo's id lookup, cached the same way (our towns' main name is not
// always English: Köln, not Cologne). The quota card of 2026-11-09: every city search used to cost one
// or two Open-Meteo requests.
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
const { geocodeCity, learnName, townResult, shownName } = await import('./geocode.js')

const vienna = { id: 2761369, name: 'Vienna', alt: 'Wien | Vienne | Viena', country: 'AT', region: 'Vienna', population: 1691468, lat: 48.20849, lon: 16.37208 }
const viennaVa = { id: 4791259, name: 'Vienna', alt: null, country: 'US', region: 'Virginia', population: 16489, lat: 38.9012, lon: -77.2653 }

// a fake database: towns answered by town_lookup, cached answers by geocode_cache, every write kept
function fakeDb({ towns = [], cached = {} } = {}) {
  const writes = []
  const table = name => ({
    select: () => ({ eq: (_c, key) => ({ limit: async () => ({ data: key in cached ? [{ results: cached[key], fetched_at: new Date().toISOString() }] : [], error: null }) }) }),
    upsert: row => { writes.push([name, row]); return Promise.resolve({ error: null }) },
  })
  return { writes, rpc: async fn => ({ data: fn === 'town_lookup' ? towns : null, error: null }), from: table }
}
const quiet = { log: () => {} }
const noFetch = async () => { throw new Error('upstream must not be asked') }
// the fake answers Open-Meteo; the database (the request counter's bump, lib/open-meteo.js) gets an empty answer
const withFetch = async (fake, run) => {
  const real = globalThis.fetch
  globalThis.fetch = async (url, init) => String(url).includes('proj.supabase.co') ? new Response('[]', { headers: { 'content-type': 'application/json' } }) : fake(url, init)
  try { return await run() } finally { globalThis.fetch = real }
}

test('townResult / shownName — a town as the geocoder would answer it, in the spelling the visitor typed', () => {
  const r = townResult(vienna)
  assert.equal(r.country, 'Austria')
  assert.equal(r.country_code, 'AT')
  assert.equal(r.admin1, 'Vienna')
  assert.equal(shownName(r, 'wien'), 'Wien')
  assert.equal(shownName(r, 'VIENNA'), 'Vienna')
  assert.equal(shownName(r, 'Vienne'), 'Vienne')
  assert.equal(shownName(r, 'wiener neustadt'), 'Vienna') // not one of its names: the main name
})

test('geocodeCity — a known town answers from our own data, without any Open-Meteo request', () => withFetch(noFetch, async () => {
  const db = fakeDb({ towns: [vienna, viennaVa], cached: { 'get:2761369': { name: 'Vienna', admin1: 'Vienna' }, 'get:4791259': { name: 'Vienna', admin1: 'Virginia' } } })
  const geo = await geocodeCity('Wien', 'de', null, { db, ...quiet })
  assert.deepEqual(geo, { id: 2761369, lat: 48.20849, lon: 16.37208, name: 'Wien', country: 'Austria', cc: 'AT', admin1: 'Vienna', alt: false, town: true })
  assert.equal(await learnName(geo, 'de', { db, ...quiet }), 'Vienna') // the English name, from the cache
  // searched from Washington: the Virginia town, marked as found by position
  const near = await geocodeCity('Vienna', 'en', { lat: 38.9, lon: -77.0 }, { db, ...quiet })
  assert.equal(near.id, 4791259)
  assert.equal(near.alt, true)
  assert.equal(await learnName(near, 'en', { db, ...quiet }), 'Vienna, Virginia')
  assert.deepEqual(db.writes, [])
}))

test('geocodeCity — a name our towns lack comes from the cached Open-Meteo answer, without a request', () => withFetch(noFetch, async () => {
  const results = [{ id: 2772807, name: 'Lienz', latitude: 46.8294, longitude: 12.7698, country: 'Austria', country_code: 'AT', admin1: 'Tyrol', population: 11800 }]
  const db = fakeDb({ cached: { 'en|lienz': results } })
  const geo = await geocodeCity('Lienz', 'en', null, { db, ...quiet })
  assert.equal(geo.name, 'Lienz')
  assert.equal(geo.town, undefined)
  assert.equal(await learnName(geo, 'en', { db, ...quiet }), 'Lienz') // Open-Meteo's English answer is itself
  assert.deepEqual(db.writes, [])
}))

test('geocodeCity — nothing of ours: Open-Meteo is asked once, its answer cached, the ask logged', async () => {
  let asked = 0
  const db = fakeDb(), logged = []
  const log = (scope, _err, meta) => logged.push([scope, meta])
  await withFetch(async url => { asked++; assert.match(String(url), /geocoding-api\.open-meteo\.com\/v1\/search\?name=Ainet&count=10&language=de$/); return new Response(JSON.stringify({ results: [{ id: 2782113, name: 'Ainet', latitude: 46.866, longitude: 12.692, country: 'Österreich', country_code: 'AT', admin1: 'Tirol' }] })) }, async () => {
    const geo = await geocodeCity('Ainet', 'de', null, { db, log })
    assert.equal(geo.name, 'Ainet')
    assert.equal(asked, 1)
    assert.deepEqual(db.writes.map(([t, r]) => [t, r.key, r.results.length]), [['geocode_cache', 'de|ainet', 1]])
    assert.deepEqual(logged, [['geocode.upstream', { query: 'Ainet', lang: 'de', wide: false }]])
  })
  // Open-Meteo knows nothing either: the empty answer is cached too, so a typo costs one request a month
  await withFetch(async () => new Response('{}'), async () => {
    assert.equal(await geocodeCity('Xyzzy', 'en', null, { db, log }), null)
    assert.deepEqual(db.writes[1][1].results, [])
  })
  // Open-Meteo failed: nothing to cache, the caller gets null
  await withFetch(async () => new Response('', { status: 500 }), async () => {
    assert.equal(await geocodeCity('Nowhere', 'en', null, { db, log }), null)
    assert.equal(db.writes.length, 2)
  })
})

test('geocodeCity — the language goes into the geocoder URL as one encoded value', async () => {
  let asked = null
  await withFetch(async url => { asked = String(url); return new Response(JSON.stringify({ results: [] })) }, () => geocodeCity('Wien', 'de&count=1000&x=', null, { db: fakeDb(), ...quiet }))
  const u = new URL(asked)
  assert.equal(u.searchParams.get('language'), 'de&count=1000&x=')
  assert.equal(u.searchParams.get('count'), '10')
})

test('geocodeCity — with where the search came from, it asks for more matches (a small town of a big name is far down the list)', async () => {
  let asked = null
  const db = fakeDb()
  const geo = await withFetch(async url => { asked = String(url); return new Response(JSON.stringify({ results: [{ id: 1, name: 'Vienna', latitude: 48.21, longitude: 16.37 }, { id: 2, name: 'Vienna', latitude: 38.9, longitude: -77.27, country_code: 'US' }] })) }, () => geocodeCity('Vienna', 'en', { lat: 38.9, lon: -77.3 }, { db, ...quiet }))
  assert.equal(new URL(asked).searchParams.get('count'), '100')
  assert.equal(geo.id, 2)
  assert.equal(geo.alt, true) // not the place the name alone gives
  assert.equal(db.writes[0][1].key, 'en|w|vienna') // cached apart from the short list
})

test('learnName — what a place is filed under: its English name; a town picked by position over a bigger one of that name gets its region too', async () => {
  const vie = { id: 2761369, name: 'Vienna', admin1: 'Vienna', cc: 'AT', alt: false }
  const virginia = { id: 4791259, name: 'Vienna', admin1: 'Virginia', cc: 'US', alt: true }
  const db = fakeDb()
  assert.equal(await learnName(vie, 'en', { db, ...quiet }), 'Vienna')
  assert.equal(await learnName(virginia, 'en', { db, ...quiet }), 'Vienna, Virginia')
  assert.equal(await learnName({ ...virginia, admin1: null }, 'en', { db, ...quiet }), 'Vienna, US')
  const asked = [], logged = []
  const log = (scope, _err, meta) => logged.push([scope, meta])
  // another language: the English name and region by id, so every language files it the same way; cached
  await withFetch(async url => { asked.push(String(url)); return new Response(JSON.stringify({ id: 4791259, name: 'Vienna', admin1: 'Virginia' })) }, async () => {
    assert.equal(await learnName({ ...virginia, name: 'ウィーン', admin1: 'バージニア州' }, 'ja', { db, log }), 'Vienna, Virginia')
    assert.match(asked[0], /\/v1\/get\?id=4791259&language=en/)
    assert.deepEqual(db.writes.map(([t, r]) => [t, r.key, r.results]), [['geocode_cache', 'get:4791259', { name: 'Vienna', admin1: 'Virginia' }]])
    assert.deepEqual(logged, [['geocode.upstream', { id: 4791259 }]])
  })
  const kept = fakeDb({ cached: { 'get:4791259': { name: 'Vienna', admin1: 'Virginia' } } })
  await withFetch(noFetch, async () => assert.equal(await learnName({ ...virginia, name: 'ウィーン' }, 'ja', { db: kept, ...quiet }), 'Vienna, Virginia'))
  await withFetch(async () => new Response('', { status: 500 }), async () => {
    assert.equal(await learnName({ ...vie, name: 'Wien' }, 'de', { db, ...quiet }), null) // lookup failed: the caller decides
    assert.equal(db.writes.length, 1, 'a failed lookup is not cached')
  })
})
