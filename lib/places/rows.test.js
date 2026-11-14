import { test } from 'node:test'
import assert from 'node:assert/strict'
import { osmRow, townRow, townIndex, nearestTown, summitPlace, cleanAltNames, keepSummit, townAltNames, townNames, isPlace, EVERY_PLACE_COUNTRIES, countryLanguages } from './rows.js'

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
  // Chinese is simplified: zh-Hans first, else name:zh in simplified characters
  const both = osmRow({ id: 'N6', lat: 47, lon: 12.7, tags: { name: 'Großglockner', natural: 'peak', 'name:zh': '大格洛克納山', 'name:zh-Hans': '大格洛克纳山' } })
  assert.deepEqual(both.names, { zh: '大格洛克纳山' })
  assert.deepEqual(osmRow({ id: 'N7', lat: 47, lon: 12.7, tags: { name: 'Großglockner', natural: 'peak', 'name:zh': '大格洛克納山' } }).names, { zh: '大格洛克纳山' })
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
  // with a country only its towns count
  assert.equal(nearestTown(idx, 45.94, 7.64, 4, 'CH').name, 'Zermatt')
  assert.equal(nearestTown(idx, 45.94, 7.64, 4, 'AT'), null)
})

test('summitPlace — the country the summit lies in and the region of that country\'s nearest town, not the village across the ridge; nothing in a disputed area', () => {
  // made-up positions: the summit is 5 km from an Italian village and 22 km from the nearest Austrian one
  const grid = townIndex([
    { id: 1, name: 'South village', country: 'IT', region: 'Trentino-Alto Adige', lat: 46.95, lon: 11.0 },
    { id: 2, name: 'North village', country: 'AT', region: 'Tyrol', lat: 47.2, lon: 11.0 },
  ])
  const summit = { id: 'osm-N7', lat: 47.0, lon: 11.0 }
  const inside = country => (lon, lat) => { assert.deepEqual([lon, lat], [11.0, 47.0], 'asked with longitude first'); return { country, disputed: false, inArea: true } }
  assert.deepEqual(summitPlace(grid, summit, inside('AT')), { country: 'AT', region: 'Tyrol', inArea: true, disputed: false })
  // in no outline (the open sea, a gap between two outlines): by the nearest town, as before
  assert.deepEqual(summitPlace(grid, summit, () => ({ country: null, disputed: false, inArea: false })), { country: 'IT', region: 'Trentino-Alto Adige', inArea: false, disputed: false })
  // a country none of whose towns is within reach: the country stands, the region is not guessed from another's
  assert.deepEqual(summitPlace(grid, summit, inside('LI')), { country: 'LI', region: null, inArea: true, disputed: false })
  // an area the boundary file marks as disputed: no country, and no region from the village next door either
  assert.deepEqual(summitPlace(grid, summit, () => ({ country: null, disputed: true, inArea: true })), { country: null, region: null, inArea: true, disputed: true })
  assert.deepEqual(summitPlace(townIndex([]), { id: 'osm-N8', lat: -75, lon: 0 }, () => ({ country: null, disputed: false, inArea: false })), { country: null, region: null, inArea: false, disputed: false })
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

test('townNames — a town\'s name in each of our languages where it differs from its main name, the preferred one; Chinese in simplified characters', () => {
  const vienna = [
    alt('de', 'Wien', { preferred: true }), alt('de', 'Wean', { colloquial: true }), alt('nl', 'Wenen'), alt('en', 'Vienna'), alt('fr', 'Vienne'),
    alt('zh', '維也納'), alt('ja', 'ウィーン'), alt('la', 'Vindobona', { historic: true }), alt('ru', 'Вена'),
  ]
  assert.deepEqual(townNames(vienna, 'Vienna'), { de: 'Wien', fr: 'Vienne', nl: 'Wenen', ja: 'ウィーン', zh: '维也纳' })
  assert.equal(townNames([alt('en', 'Lienz'), alt('ru', 'Лиенц')], 'Lienz'), null, 'nothing that differs in our languages')
  // Köln's main name is not English: its English entry is what its history is filed under
  assert.deepEqual(townNames([alt('en', 'Cologne', { preferred: true }), alt('en', 'Koeln'), alt('nl', 'Keulen')], 'Köln'), { en: 'Cologne', nl: 'Keulen' })
})

test('townNames for a region — its short name before the formal preferred one ("Wien", not "Bundesland Wien"); a town keeps the preferred name', () => {
  const vienna = [{ ...alt('de', 'Bundesland Wien', { preferred: true }) }, { ...alt('de', 'Wien'), short: true }, { ...alt('en', 'State of Vienna', { preferred: true }) }, { ...alt('en', 'Vienna'), short: true }, alt('cs', 'Vídeň', { preferred: true })]
  assert.deepEqual(townNames(vienna, 'Vienna', { shortFirst: true }), { de: 'Wien', cs: 'Vídeň' }, 'the short English name is the main name: no entry')
  assert.deepEqual(townNames(vienna, 'Vienna'), { en: 'State of Vienna', de: 'Bundesland Wien', cs: 'Vídeň' })
  assert.deepEqual(townNames([alt('de', 'Tirol', { preferred: true }), alt('it', 'Tirolo')], 'Tyrol', { shortFirst: true }), { de: 'Tirol', it: 'Tirolo' })
})

test('isPlace — every populated place of a country\'s own file, but none that is no more; EVERY_PLACE_COUNTRIES names Austria', () => {
  const line = (cls, code) => ['2775179', 'Iselsberg', 'Iselsberg', '', '46.83806', '12.84944', cls, code, 'AT', '', '07', '707', '70716', '', '449', '', '1118', 'Europe/Vienna', '2018-07-28'].join('\t')
  assert.deepEqual(['PPL', 'PPLA3', 'PPLX', 'PPLL'].map(code => isPlace(line('P', code))), [true, true, true, true])
  assert.deepEqual(['PPLH', 'PPLQ', 'PPLW', 'PPLCH'].map(code => isPlace(line('P', code))), [false, false, false, false], 'historical, abandoned, destroyed')
  assert.equal(isPlace(line('T', 'MT')), false, 'a mountain is not a place to live')
  assert.equal(townRow(line('P', 'PPL'), { 'AT.07': 'Tyrol' }).region, 'Tyrol', 'the same columns as cities5000.txt')
  assert.deepEqual(EVERY_PLACE_COUNTRIES, ['AT'])
})
