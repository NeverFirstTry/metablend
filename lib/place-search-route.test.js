// GET /api/places/search, the suggestions of the two search boxes: our own towns, each with its name and its
// region in the reader's language (owner, 2026-11-13: "Tirol" for German, "Tyrol" for English), nothing asked
// outside. The route is called for real with every outside call faked (lib/test-route-fakes.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import './test-jsx-hooks.js'
import { json, seen, answerWith, reset } from './test-route-fakes.js'

const { GET } = await import('../app/api/places/search/route.js')
const { regionIn } = await import('./places/regions.js') // after the hooks: it reads a JSON file
const ask = (query, ip = '203.0.113.40') => GET(new Request(`https://metablend.app/api/places/search${query}`, { headers: { 'x-forwarded-for': ip } }))
const INNSBRUCK = { id: 2775220, name: 'Innsbruck', names: null, country: 'AT', region: 'Tyrol', population: 132493, lat: 47.2627, lon: 11.3945, exact: false, prefix: true }
const VIENNA = { id: 2761369, name: 'Vienna', names: { de: 'Wien', zh: '维也纳' }, country: 'AT', region: 'Vienna', population: 1691468, lat: 48.2085, lon: 16.3721, exact: false, prefix: false }

test('suggestions: the town and its region in the reader\'s language, English where there is none; kept a day; nothing asked outside', async () => {
  reset()
  answerWith(({ url }) => (url.includes('/rest/v1/rpc/towns_search') ? json([INNSBRUCK, VIENNA]) : undefined))
  const de = await ask('?q=inn&lang=de')
  assert.equal(de.status, 200)
  assert.deepEqual((await de.json()).results, [
    { id: 2775220, name: 'Innsbruck', admin1: 'Tirol', country: 'Austria', country_code: 'AT', latitude: 47.2627, longitude: 11.3945 },
    { id: 2761369, name: 'Wien', admin1: 'Wien', country: 'Austria', country_code: 'AT', latitude: 48.2085, longitude: 16.3721 },
  ])
  assert.match(de.headers.get('cache-control'), /public, s-maxage=86400\b/)
  const en = (await (await ask('?q=inn&lang=en')).json()).results
  assert.deepEqual(en.map(r => [r.name, r.admin1]), [['Innsbruck', 'Tyrol'], ['Vienna', 'Vienna']])
  const zh = (await (await ask('?q=inn&lang=zh')).json()).results
  assert.deepEqual(zh.map(r => [r.name, r.admin1]), [['Innsbruck', 'Tyrol'], ['维也纳', 'Vienna']], 'no marked Chinese name for these regions in the list: English')
  assert.deepEqual(JSON.parse(seen.find(c => c.url.includes('/rpc/towns_search')).body), { q: 'inn', lim: 20 }, 'twenty are asked, five shown')
  assert.ok(seen.every(c => c.url.includes('proj.supabase.co')), 'only our own database is asked')
})

// A town matches by any of its names in any language, and the database puts an exact name first. The five
// shown are picked for the reader: the towns whose name as this reader sees it is, or begins with, the text.
test('suggestions: five of the twenty, for this reader: the name the reader sees first, then towns found by another of their names; the database\'s order within each', async () => {
  reset()
  const town = (id, name, extra = {}) => ({ id, name, names: null, country: 'AT', region: 'Tyrol', population: 1000, lat: 47, lon: 11, exact: false, prefix: true, ...extra })
  const found = [
    town(1, 'Paris 06 Luxembourg', { country: 'FR', region: 'Île-de-France', exact: true }), // once filed as "VIe": exact for the database
    town(2, 'Vienna', { names: { de: 'Wien' } }), town(3, 'Vientiane', { country: 'LA' }), town(4, 'Velikiye Luki', { country: 'RU' }),
    town(5, 'Viersen', { country: 'DE' }), town(6, 'Vienna', { country: 'US', region: 'Virginia' }), town(7, 'Vienenburg', { country: 'DE' }), town(8, 'Vieste', { country: 'IT' }),
  ]
  answerWith(({ url }) => (url.includes('/rest/v1/rpc/towns_search') ? json(found) : undefined))
  const names = async (q, lang) => (await (await ask(`?q=${q}&lang=${lang}`, '203.0.113.42')).json()).results.map(r => `${r.name} ${r.country_code}`)
  assert.deepEqual(await names('vie', 'en'), ['Vienna AT', 'Vientiane LA', 'Viersen DE', 'Vienna US', 'Vienenburg DE'], 'the Paris district and the Russian town matched by other names: after the five')
  assert.deepEqual(await names('vie', 'de'), ['Vientiane LA', 'Viersen DE', 'Vienna US', 'Vienenburg DE', 'Vieste IT'], 'a German reader sees "Wien", which does not begin with "vie"')
  assert.deepEqual((await names('wien', 'de'))[0], 'Wien AT', 'the name as the reader sees it, exactly')
  assert.deepEqual((await names('vienna', 'en')).slice(0, 2), ['Vienna AT', 'Vienna US'], 'two of one name: the database\'s order, the bigger first')
})

test('suggestions: one letter is no search (400); a list that does not answer is 502, never kept', async () => {
  reset()
  assert.equal((await ask('?q=w')).status, 400)
  assert.equal(seen.length, 0, 'the database is not asked for one letter')
  answerWith(({ url }) => (url.includes('/rest/v1/rpc/towns_search') ? json({ message: 'upstream timeout' }, 503) : undefined))
  const down = await ask('?q=wien&lang=de', '203.0.113.41')
  assert.equal(down.status, 502)
  assert.equal(down.headers.get('cache-control'), 'no-store')
})

// lib/places/region-names.json is written by scripts/places/build.mjs from GeoNames: a few names every reader
// of the Alps knows are pinned, so a rebuild that loses or mangles them shows here.
test('regionIn: the regions of the Alps in German; English where GeoNames marks no name in the language; one name kept by hand; an unknown region, or none, as it came', () => {
  assert.deepEqual(['Tyrol', 'Carinthia', 'Styria', 'Vienna', 'Salzburg', 'Upper Austria'].map(r => regionIn('AT', r, 'de')), ['Tirol', 'Kärnten', 'Steiermark', 'Wien', 'Salzburg', 'Oberösterreich'])
  assert.deepEqual([regionIn('DE', 'Bavaria', 'de'), regionIn('CH', 'Valais', 'de'), regionIn('CH', 'Grisons', 'de'), regionIn('IT', 'Trentino-Alto Adige', 'de')], ['Bayern', 'Wallis', 'Graubünden', 'Trentino-Südtirol'])
  assert.deepEqual([regionIn('AT', 'Tyrol', 'it'), regionIn('AT', 'Tyrol', 'en'), regionIn('AT', 'Tyrol', 'ja'), regionIn('AT', 'Vienna', 'cs')], ['Tyrol', 'Tyrol', 'Tyrol', 'Vídeň'], 'unmarked names (Tirolo) are left out')
  // GeoNames' unmarked Dutch name for this region was South Tyrol's: English now; the German one is kept by hand
  assert.deepEqual([regionIn('IT', 'Trentino-Alto Adige', 'nl'), regionIn('IT', 'Trentino-Alto Adige', 'pl')], ['Trentino-Alto Adige', 'Trentino-Alto Adige'])
  assert.equal(regionIn('AT', 'No Such Region', 'de'), 'No Such Region')
  assert.equal(regionIn('AT', null, 'de'), null)
})
