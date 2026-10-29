import { test } from 'node:test'
import assert from 'node:assert/strict'
import { osmRow, townRow, townIndex, nearestTown, cleanAltNames, keepSummit, townAltNames, countryLanguages } from './rows.js'

test('osmRow — a summit: kind, height, names in our languages, notability as before', () => {
  const line = { id: 'N26863444', lat: 47.166672, lon: 9.560831, tags: { ele: '2122', name: 'Kuhgrat', natural: 'peak', wikidata: 'Q4244296', wikipedia: 'en:Kuhgrat', 'name:de': 'Kuhgrat', 'name:ja': 'クーグラート', 'summit:cross': 'yes' } }
  assert.deepEqual(osmRow(line), {
    id: 'osm-N26863444', kind: 'peak', name: 'Kuhgrat', names: { ja: 'クーグラート' }, // the same as the name: not kept twice
    ele: 2122, notability: 4, wikidata: 'Q4244296', lat: 47.166672, lon: 9.560831,
  })
})

test('osmRow — huts, volcanoes, zh-Hans as zh, feet and commas in heights; nothing without a name or a kind', () => {
  assert.equal(osmRow({ id: 'W7', lat: 46, lon: 7, tags: { name: 'Hörnlihütte', tourism: 'alpine_hut' } }).kind, 'hut')
  assert.equal(osmRow({ id: 'N1', lat: 1, lon: 1, tags: { name: 'Bivacco', tourism: 'wilderness_hut' } }).kind, 'hut')
  const v = osmRow({ id: 'N2', lat: 35, lon: 138, tags: { name: 'Fuji', natural: 'volcano', ele: '12388 ft', 'name:zh-Hans': '富士山' } })
  assert.deepEqual([v.kind, v.ele, v.names], ['peak', 3776, { zh: '富士山' }])
  assert.equal(osmRow({ id: 'N3', lat: 1, lon: 1, tags: { name: 'x', natural: 'peak', ele: 'about 2000' } }).ele, null)
  assert.equal(osmRow({ id: 'N4', lat: 1, lon: 1, tags: { natural: 'peak' } }), null)
  assert.equal(osmRow({ id: 'N5', lat: 1, lon: 1, tags: { name: 'Shop', shop: 'outdoor' } }), null)
})

// cities5000.txt: geonameid, name, asciiname, alternatenames, lat, lon, class, code, cc, cc2, admin1, …, population (14), …
const HANOI = ['1581130', 'Hanoi', 'Hanoi', 'HAN,Ha Noi,Hanoi,Hanoï,Hà Nội,Хано́й,هانوي,ハノイ,河内,하노이,Thành phố Hà Nội,10000', '21.0245', '105.84117', 'P', 'PPLC', 'VN', '', '44', '', '', '', '8053663', '', '20', 'Asia/Bangkok', '2024-01-01'].join('\t')

test('townRow — a GeoNames town: its other names in scripts our languages use, the region by name, the population', () => {
  const t = townRow(HANOI, { 'VN.44': 'Hanoi' })
  assert.deepEqual(t, {
    id: 1581130, name: 'Hanoi', country: 'VN', region: 'Hanoi', population: 8053663, lat: 21.0245, lon: 105.84117,
    alt: 'Ha Noi | Hanoï | Hà Nội | ハノイ | 河内 | 하노이 | Thành phố Hà Nội',
  })
})

test('cleanAltNames — codes, numbers, other scripts and repeats out; at most 30', () => {
  assert.deepEqual(cleanAltNames(['HAN', 'VIE', 'Wien', 'Vienna', 'Вена', 'wien', '1010', 'Vienne', 'https://x'], 'Vienna'), ['Wien', 'Vienne'])
  assert.equal(cleanAltNames(Array.from({ length: 50 }, (_, i) => `Name ${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`), 'x').length, 30)
})

test('nearestTown — a summit gets the country and region of the nearest town (a grid, not a scan of every town)', () => {
  const towns = [
    { id: 1, name: 'Zermatt', country: 'CH', region: 'Valais', lat: 46.02, lon: 7.75 },
    { id: 2, name: 'Cervinia', country: 'IT', region: "Valle d'Aosta", lat: 45.93, lon: 7.63 },
    { id: 3, name: 'Hanoi', country: 'VN', region: 'Hanoi', lat: 21.02, lon: 105.84 },
  ]
  const idx = townIndex(towns)
  assert.equal(nearestTown(idx, 46.0, 7.73).name, 'Zermatt')
  assert.equal(nearestTown(idx, 45.94, 7.64).name, 'Cervinia')
  assert.equal(nearestTown(idx, 22.30, 103.77).name, 'Hanoi') // ~200 km: still the nearest
  assert.equal(nearestTown(idx, -60, -40), null) // nothing within reach
})

test('keepSummit — every named hut; a named summit with a height, or without one if it has a Wikidata item (notable)', () => {
  assert.equal(keepSummit({ kind: 'hut', ele: null, wikidata: null }), true)
  assert.equal(keepSummit({ kind: 'peak', ele: 812, wikidata: null }), true)
  assert.equal(keepSummit({ kind: 'peak', ele: null, wikidata: 'Q1' }), true)
  assert.equal(keepSummit({ kind: 'peak', ele: null, wikidata: null }), false)
})

// alternateNamesV2.txt: id, geonameid, isolanguage, name, isPreferredName, isShortName, isColloquial, isHistoric, from, to
const alt = (lang, name, flags = {}) => ({ lang, name, preferred: !!flags.preferred, colloquial: !!flags.colloquial, historic: !!flags.historic })

test('townAltNames — a town\'s names in our 13 languages and its country\'s own, preferred first; no slang, old names, codes or links', () => {
  const vienna = [
    alt('link', 'https://en.wikipedia.org/wiki/Vienna'), alt('ru', 'Вена'), alt('nl', 'Wenen'), alt('de', 'Wien', { preferred: true }),
    alt('fr', 'Vienne'), alt('en', 'Vienna'), alt('de', 'Wean', { colloquial: true }), alt('la', 'Vindobona', { historic: true }),
    alt('ja', 'ウィーン'), alt('zh', '维也纳'), alt('ko', '빈'), alt('iata', 'VIE'), alt('', 'Vienna Austria'),
  ]
  assert.deepEqual(townAltNames(vienna, { name: 'Vienna', countryLangs: ['de'] }), ['Wien', 'Wenen', 'Vienne', 'ウィーン', '维也纳', '빈', 'Vienna Austria'])
  const hanoi = [alt('vi', 'Hà Nội', { preferred: true }), alt('vi', 'Thành phố Hà Nội'), alt('th', 'ฮานอย'), alt('en', 'Hanoi'), alt('', 'Ha Noi')]
  assert.deepEqual(townAltNames(hanoi, { name: 'Hanoi', countryLangs: ['vi'] }), ['Hà Nội', 'Thành phố Hà Nội', 'Ha Noi'])
})

test('countryLanguages — a country\'s first two languages from GeoNames\' countryInfo, without regional variants', () => {
  const info = '#ISO\tISO3\n' + ['AT', 'AUT', '040', 'AU', 'Austria', 'Vienna', '83858', '8847037', 'EU', '.at', 'EUR', 'Euro', '43', '####', '^(\d{4})$', 'de-AT,hr,hu,sl', '2782113', 'CH,DE', ''].join('\t') + '\n' +
    ['VN', 'VNM', '704', 'VM', 'Vietnam', 'Hanoi', '329560', '95540395', 'AS', '.vn', 'VND', 'Dong', '84', '######', '^(\d{6})$', 'vi,en,fr,zh,km', '1562822', 'CN,LA,KH', ''].join('\t')
  assert.deepEqual(countryLanguages(info), { AT: ['de', 'hr'], VN: ['vi', 'en'] })
})
