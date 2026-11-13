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
function fakeDb({ lookup = [], search = [], near = [], summits = [], row = null, broken = false } = {}) {
  const asked = []
  return {
    asked,
    rpc: async (fn, args) => {
      asked.push([fn, args])
      if (broken) throw new Error('no database')
      if (fn === 'places_search' && summits === 'down') return { data: null, error: { message: 'timeout' } }
      return { data: fn === 'town_lookup' ? lookup : fn === 'towns_search' ? search : fn === 'town_near' ? near : fn === 'places_search' ? summits : null, error: null }
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

test('geocodeCity: the start of a name finds the town the search ranks first; a misspelling or an unknown name find nothing; a list that does not answer is an error, not "not found"', async () => {
  await sealed(async () => {
    const start = fakeDb({ search: [{ ...INNSBRUCK, exact: false, prefix: true }, { ...VIENNA, exact: false, prefix: true }] })
    const geo = await geocodeCity('Innsbr', 'de', null, { db: start })
    assert.deepEqual([geo.name, geo.cc], ['Innsbruck', 'AT'])
    assert.deepEqual(start.asked.map(a => a[0]), ['town_lookup', 'places_search', 'towns_search'], 'a town of that name, a summit of that name, then a town that begins so')
    // the search function also offers look-alikes: they are not taken for the place
    assert.equal(await geocodeCity('Insbruck', 'de', null, { db: fakeDb({ search: [{ ...INNSBRUCK, exact: false, prefix: false }] }) }), null)
    assert.equal(await geocodeCity('Nowhere at all', 'en', null, { db: fakeDb() }), null)
    // a towns list that does not answer is no "not found": the visitor would be told to check the spelling
    await assert.rejects(geocodeCity('Vienna', 'en', null, { db: fakeDb({ broken: true }) }), /no database/)
    const refused = { rpc: async () => ({ data: null, error: { message: 'upstream timeout' } }) }
    await assert.rejects(geocodeCity('Vienna', 'en', null, { db: refused }), /the towns list did not answer \(town_lookup: upstream timeout\)/)
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
    // typed in another language than the one it is filed under: the spelling found is the visitor's, the
    // filing name is the town's (the first version filed "Wien" under "Wien": found on the dev database, 2026-11-12)
    for (const typed of ['Wien', 'ウィーン', '維也納']) {
      const geo = await geocodeCity(typed, 'de', null, { db: fakeDb({ lookup: [VIENNA] }) })
      assert.equal(geo.name, typed)
      assert.equal(await learnName(geo), 'Vienna', `${typed} is filed under Vienna`)
      assert.deepEqual(await placeNames(geo, 'en'), { learn: 'Vienna', shown: 'Vienna' }, `${typed}: an English reader sees the English name`)
      assert.deepEqual(await placeNames(geo, 'fr'), { learn: 'Vienna', shown: 'Vienna' }, `${typed}: no French name in the list, so the main name`)
      assert.deepEqual(await placeNames(geo, 'ja'), { learn: 'Vienna', shown: 'ウィーン' }, typed)
    }
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

// A name no town carries can be a summit's (owner, 2026-11-13: "Kreuzspitze" and other peaks were "not found").
const peak = (id, name, ele, extra = {}) => ({ id, kind: 'peak', name, names: null, ele, notability: 0, country: 'AT', region: 'Tyrol', lat: 47, lon: 11, km: null, ...extra })
const KREUZ_HIGH = peak('osm-N1', 'Kreuzspitze', 3455, { lat: 46.83, lon: 10.86 })
const KREUZ_KNOWN = peak('osm-N2', 'Kreuzspitze', 3155, { notability: 2, lat: 47.05, lon: 12.31 })
const GLOCKNER = peak('osm-N3', 'Großglockner', 3798, { notability: 4, names: { en: 'Grossglockner', it: 'Monte Glockner' }, region: 'Carinthia', lat: 47.0745, lon: 12.6939 })

test('geocodeCity: a name no town carries finds the summit of exactly that name; the order is exact town, exact summit, then a town that begins so', async () => {
  await sealed(async () => {
    const db = fakeDb({ summits: [KREUZ_HIGH, KREUZ_KNOWN, peak('osm-N9', 'Kreuzspitzl', 2000), { ...peak('osm-W4', 'Kreuzspitze', 2500), kind: 'hut' }] })
    const geo = await geocodeCity('kreuzspitze', 'de', null, { db })
    assert.deepEqual(db.asked.map(a => a[0]), ['town_lookup', 'places_search'], 'the towns first; no search for a town that begins so once a summit is found')
    assert.deepEqual([geo.id, geo.name, geo.lat, geo.lon, geo.cc, geo.country, geo.summit, geo.town, geo.elev], ['osm-N2', 'Kreuzspitze', 47.05, 12.31, null, null, true, false, 3155], 'of several: the best known, not the highest; no hut, no look-alike')
    // no country on a summit: the table files Wildspitze, Großvenediger and Zuckerhütl under Italy, and a wrong
    // country hides the right one's official warnings (without one they are found by position)
    assert.equal(await learnName(geo), 'Kreuzspitze 3155 m, Tyrol', 'filed with its height and region: dozens of peaks share the name')
    assert.deepEqual(await placeNames(geo, 'de'), { learn: 'Kreuzspitze 3155 m, Tyrol', shown: 'Kreuzspitze' })
    // equally known: the highest
    assert.equal((await geocodeCity('Kreuzspitze', 'de', null, { db: fakeDb({ summits: [KREUZ_KNOWN, { ...KREUZ_HIGH, notability: 2 }] }) })).id, 'osm-N1')
    // with where the search comes from: the nearest
    const nearby = await geocodeCity('Kreuzspitze', 'de', { lat: 46.8, lon: 10.9 }, { db: fakeDb({ summits: [{ ...KREUZ_KNOWN, km: 110 }, { ...KREUZ_HIGH, km: 5 }] }) })
    assert.equal(nearby.id, 'osm-N1')
    // a town of that name always wins; the summits are not even asked
    const town = fakeDb({ lookup: [INNSBRUCK], summits: [peak('osm-N7', 'Innsbruck', 2000)] })
    assert.equal((await geocodeCity('Innsbruck', 'de', null, { db: town })).town, true)
    assert.deepEqual(town.asked.map(a => a[0]), ['town_lookup'])
    // a whole summit name beats a town that merely begins with it
    const rax = await geocodeCity('Rax', 'de', null, { db: fakeDb({ summits: [peak('osm-N8', 'Rax', 2007)], search: [{ ...INNSBRUCK, name: 'Raxendorf', exact: false, prefix: true }] }) })
    assert.equal(rax.summit, true)
  })
})

test('geocodeCity: a summit is found by its name in another language and without ß; only look-alikes, or summits that do not answer: on to the towns, then null', async () => {
  await sealed(async () => {
    for (const typed of ['Grossglockner', 'großglockner', 'Monte Glockner']) {
      const geo = await geocodeCity(typed, 'en', null, { db: fakeDb({ summits: [GLOCKNER] }) })
      assert.equal(geo?.id, 'osm-N3', typed)
      assert.equal(await learnName(geo), 'Grossglockner 3798 m, Carinthia', typed)
      assert.deepEqual([(await placeNames(geo, 'it')).shown, (await placeNames(geo, 'de')).shown], ['Monte Glockner', 'Großglockner'], typed)
    }
    const only = fakeDb({ summits: [peak('osm-N9', 'Glocknerwand', 3721)], search: [{ ...INNSBRUCK, exact: false, prefix: true }] })
    assert.equal((await geocodeCity('Glockner', 'de', null, { db: only })).name, 'Innsbruck', 'no summit of exactly that name: the town search decides')
    assert.equal(await geocodeCity('Glockner', 'de', null, { db: fakeDb({ summits: [peak('osm-N9', 'Glocknerwand', 3721)] }) }), null)
    assert.equal(await geocodeCity('Kreuzspitze', 'de', null, { db: fakeDb({ summits: 'down' }) }), null, 'the summits are an extra: their failing is "not found", not an error')
  })
})
