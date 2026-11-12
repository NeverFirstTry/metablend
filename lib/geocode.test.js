// lib/geocode.js: a place name becomes one of our own towns, and nothing outside is asked for it
// (2026-11-12: Open-Meteo's geocoder is gone from the whole site). A fake database answers the three
// town functions; any outside request fails the test.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
const { geocodeCity, placeNear, learnName, placeNames, shownIn, shownName, townResult, nameIn } = await import('./geocode.js')

const VIENNA = { id: 2761369, name: 'Vienna', alt: 'Wien | Viena | 維也納 | 维也纳 | ウィーン', names: { de: 'Wien', zh: '维也纳', ja: 'ウィーン' }, country: 'AT', region: 'Vienna', population: 1691468, lat: 48.2085, lon: 16.3721 }
const VIENNA_VA = { id: 4791259, name: 'Vienna', alt: '维也纳', names: null, country: 'US', region: 'Virginia', population: 16489, lat: 38.9012, lon: -77.2653 }
const KOELN = { id: 2886242, name: 'Köln', alt: 'Cologne | Keulen', names: { en: 'Cologne', nl: 'Keulen' }, country: 'DE', region: 'North Rhine-Westphalia', population: 1024621, lat: 50.9333, lon: 6.95 }
const INNSBRUCK = { id: 2775220, name: 'Innsbruck', alt: null, names: null, country: 'AT', region: 'Tyrol', population: 132493, lat: 47.2627, lon: 11.3945 }

// the database: what each town function answers, and what was asked of it
function fakeDb({ lookup = [], search = [], near = [], row = null, broken = false } = {}) {
  const asked = []
  return {
    asked,
    rpc: async (fn, args) => {
      asked.push([fn, args])
      if (broken) throw new Error('no database')
      return { data: fn === 'town_lookup' ? lookup : fn === 'towns_search' ? search : fn === 'town_near' ? near : null, error: null }
    },
    from: table => ({ select: () => ({ eq: (col, id) => ({ limit: async () => { asked.push([table, id]); return { data: row ? [row] : [] } } }) }) }),
  }
}
// nothing may leave: an outside request is a failure
async function sealed(fn) {
  const real = globalThis.fetch
  globalThis.fetch = async url => { throw new Error(`asked outside: ${url}`) }
  try { return await fn() } finally { globalThis.fetch = real }
}

test('geocodeCity: a town by its exact name, the most populous first, in the spelling the visitor used', async () => {
  await sealed(async () => {
    const db = fakeDb({ lookup: [VIENNA, VIENNA_VA] })
    const geo = await geocodeCity('wien', 'de', null, { db })
    assert.deepEqual(db.asked, [['town_lookup', { q: 'wien', lim: 20 }]], 'one lookup, no search needed')
    assert.deepEqual({ id: geo.id, name: geo.name, lat: geo.lat, lon: geo.lon, country: geo.country, cc: geo.cc, admin1: geo.admin1, alt: geo.alt, town: geo.town },
      { id: 2761369, name: 'Wien', lat: 48.2085, lon: 16.3721, country: 'Austria', cc: 'AT', admin1: 'Vienna', alt: false, town: true })
    assert.equal(geo.names.ja, 'ウィーン', 'its names in our languages come along')
  })
})

test('geocodeCity: Chinese in either script finds Vienna in Austria, not the one in Virginia', async () => {
  await sealed(async () => {
    for (const typed of ['维也纳', '維也納']) {
      const geo = await geocodeCity(typed, 'zh', null, { db: fakeDb({ lookup: [VIENNA, VIENNA_VA] }) })
      assert.deepEqual([geo.cc, geo.name], ['AT', typed], typed)
    }
  })
})

test('geocodeCity: with where the search came from, the town of that name nearby wins and is marked', async () => {
  await sealed(async () => {
    const geo = await geocodeCity('Vienna', 'en', { lat: 38.9, lon: -77.3 }, { db: fakeDb({ lookup: [VIENNA, VIENNA_VA] }) })
    assert.deepEqual([geo.cc, geo.admin1, geo.alt], ['US', 'Virginia', true])
    assert.equal(await learnName(geo), 'Vienna, Virginia', 'filed apart from the big one')
    assert.equal(await learnName(await geocodeCity('Vienna', 'en', null, { db: fakeDb({ lookup: [VIENNA, VIENNA_VA] }) })), 'Vienna')
  })
})

test('geocodeCity: the start of a name finds the town the search ranks first; a misspelling, an unknown name or no database find nothing', async () => {
  await sealed(async () => {
    const start = fakeDb({ search: [{ ...INNSBRUCK, exact: false, prefix: true }, { ...VIENNA, exact: false, prefix: true }] })
    const geo = await geocodeCity('Innsbr', 'de', null, { db: start })
    assert.deepEqual([geo.name, geo.cc], ['Innsbruck', 'AT'])
    assert.deepEqual(start.asked.map(a => a[0]), ['town_lookup', 'towns_search'])
    // the search function also offers look-alikes: they are not taken for the place
    assert.equal(await geocodeCity('Insbruck', 'de', null, { db: fakeDb({ search: [{ ...INNSBRUCK, exact: false, prefix: false }] }) }), null)
    assert.equal(await geocodeCity('Nowhere at all', 'en', null, { db: fakeDb() }), null)
    assert.equal(await geocodeCity('Vienna', 'en', null, { db: fakeDb({ broken: true }) }), null)
  })
})

test('learnName and placeNames: filed under the English name, shown in the reader\'s language', async () => {
  await sealed(async () => {
    const koeln = await geocodeCity('Köln', 'de', null, { db: fakeDb({ lookup: [KOELN] }) })
    assert.equal(await learnName(koeln), 'Cologne', 'Köln and Cologne are one city in what we learn')
    assert.deepEqual(await placeNames(koeln, 'de'), { learn: 'Cologne', shown: 'Köln' })
    assert.deepEqual(await placeNames(koeln, 'en'), { learn: 'Cologne', shown: 'Cologne' })
    assert.deepEqual(await placeNames(koeln, 'nl'), { learn: 'Cologne', shown: 'Keulen' })
    const vienna = await geocodeCity('Vienna', 'en', null, { db: fakeDb({ lookup: [VIENNA] }) })
    assert.deepEqual(await placeNames(vienna, 'de'), { learn: 'Vienna', shown: 'Wien' }, '"Vienna" asked in German shows "Wien"')
    assert.deepEqual(await placeNames(vienna, 'en'), { learn: 'Vienna', shown: 'Vienna' })
  })
})

test('townResult, shownName, nameIn: the shapes the search boxes and the picker read', () => {
  const r = townResult(VIENNA)
  assert.deepEqual({ id: r.id, name: r.name, latitude: r.latitude, longitude: r.longitude, country: r.country, country_code: r.country_code, admin1: r.admin1, population: r.population },
    { id: 2761369, name: 'Vienna', latitude: 48.2085, longitude: 16.3721, country: 'Austria', country_code: 'AT', admin1: 'Vienna', population: 1691468 })
  assert.equal(shownName(VIENNA, 'WIEN'), 'Wien')
  assert.equal(shownName(VIENNA, 'vien'), 'Vienna', 'not one of its names: the main name')
  assert.deepEqual([nameIn(VIENNA, 'de'), nameIn(VIENNA, 'fr'), nameIn(INNSBRUCK, 'de')], ['Wien', 'Vienna', 'Innsbruck'])
})

test('placeNear: one of our towns in reach, in the visitor\'s language; Nominatim only without one; null when nothing is there', async () => {
  await sealed(async () => {
    const reverse = async () => { throw new Error('Nominatim must not be asked when a town answers') }
    const near = [{ id: 2761369, name: 'Vienna', country: 'AT', population: 1691468, km: 3 }]
    const db = fakeDb({ near, row: { name: 'Vienna', names: VIENNA.names } })
    assert.deepEqual(await placeNear({ lat: 48.2, lon: 16.4 }, 'de', { db, reverse }), { name: 'Wien' })
    assert.deepEqual(db.asked, [['town_near', { lat: 48.2, lon: 16.4 }], ['towns', 2761369]], 'the town by position, then its names by id: no position goes further')
    assert.deepEqual(await placeNear({ lat: 48.2, lon: 16.4 }, 'fr', { db: fakeDb({ near, row: { name: 'Vienna', names: VIENNA.names } }), reverse }), { name: 'Vienna' })
    // the names not readable: the main name will do
    assert.deepEqual(await placeNear({ lat: 48.2, lon: 16.4 }, 'de', { db: fakeDb({ near }), reverse }), { name: 'Vienna' })
    const asked = []
    const village = async (lat, lon, lang) => { asked.push([lat, lon, lang]); return { name: 'Matrei in Osttirol', address: { town: 'Matrei in Osttirol' } } }
    assert.deepEqual(await placeNear({ lat: 47, lon: 12.5 }, 'de', { db: fakeDb(), reverse: village }), { name: 'Matrei in Osttirol' })
    assert.deepEqual(asked, [[47, 12.5, 'de']])
    assert.equal(await placeNear({ lat: 40, lon: -40 }, 'en', { db: fakeDb(), reverse: async () => null }), null)
  })
})

test('shownIn: Chinese readers see simplified characters, a listed city its own Chinese name; other languages what was found', () => {
  assert.equal(shownIn('de', 'Wien', 'Vienna'), 'Wien')
  assert.equal(shownIn('zh', '維也納', 'Somewhere Else'), '维也纳')
  assert.equal(shownIn('zh', '利恩茨', null), '利恩茨')
})
