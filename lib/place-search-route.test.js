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
  // Vienna stands for a town found by the beginning of another of its names (a mere look-alike is no longer offered)
  answerWith(({ url }) => (url.includes('/rest/v1/rpc/towns_search') ? json([INNSBRUCK, { ...VIENNA, prefix: true }]) : undefined))
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

// Found on dev with the whole list loaded, 2026-11-13: a big city typed under its name in another language
// than the reader's was missing or buried. "Wien" for an English reader offered Wiener Neustadt and four
// villages, "Munich" in German five hamlets called Münich..., "Vienna" in German two American towns before
// Wien, and "Inn" three hamlets of that name (89, 22 and 20 people) before Innsbruck. A town counts as called
// so by its main name and by its name in each of our languages; among the towns called so or beginning so
// the biggest comes first, an exact name counting like thirty times the size. The Paris district above is
// filed under "VIe" only among the list's loose spellings, so it stays behind.
test('suggestions: a city typed under its name in another language comes first; among the names that fit, the biggest, an exact name counting for more', async () => {
  reset()
  const town = (id, name, population, extra = {}) => ({ id, name, names: null, country: 'AT', region: 'Lower Austria', population, lat: 47, lon: 11, exact: false, prefix: true, ...extra })
  const vienna = town(1, 'Vienna', 1691468, { names: { de: 'Wien', zh: '维也纳' }, region: 'Vienna', exact: true })
  let found = []
  answerWith(({ url }) => (url.includes('/rest/v1/rpc/towns_search') ? json(found) : undefined))
  const names = async (q, lang) => (await (await ask(`?q=${q}&lang=${lang}`, '203.0.113.43')).json()).results.map(r => `${r.name} ${r.country_code}`)

  found = [vienna, town(2, 'Wiener Neustadt', 43000), town(3, 'Wiener Neudorf', 9000), town(4, 'Wienhausen', 4000, { country: 'DE' }), town(5, 'Wienersdorf', 2000), town(6, 'Wienrode', 900, { country: 'DE' }), town(7, 'Wienerherberg', 700)]
  assert.deepEqual(await names('wien', 'en'), ['Vienna AT', 'Wiener Neustadt AT', 'Wiener Neudorf AT', 'Wienhausen DE', 'Wienersdorf AT'])
  assert.equal((await names('wien', 'zh'))[0], '维也纳 AT')
  assert.equal((await names('wien', 'de'))[0], 'Wien AT')

  // the database puts every exact name first, the biggest of them leading
  found = [vienna, town(8, 'Vienna', 16000, { country: 'US', region: 'Virginia', exact: true }), town(9, 'Vienna', 10000, { country: 'US', region: 'West Virginia', exact: true }), town(10, 'Vienne', 30000, { country: 'FR' })]
  assert.deepEqual(await names('vienna', 'de'), ['Wien AT', 'Vienna US', 'Vienna US', 'Vienne FR'], 'Wien before the two American towns a German reader sees as "Vienna"')

  // a small town under its other name, with nothing bigger seen under the text: first as well
  found = [town(11, 'Bressanone', 22000, { names: { de: 'Brixen' }, country: 'IT', exact: true }), town(12, 'Brixen im Thale', 2600)]
  assert.deepEqual(await names('brixen', 'en'), ['Bressanone IT', 'Brixen im Thale AT'])
  assert.deepEqual(await names('brixen', 'de'), ['Brixen IT', 'Brixen im Thale AT'])

  // a place that has the text only among the list's loose spellings: behind the towns the reader sees under it
  found = [town(13, 'Paris 06 Luxembourg', 41000, { names: { de: 'St. Sulpice' }, country: 'FR', exact: true }), vienna, town(14, 'Vientiane', 196000, { country: 'LA' }), town(15, 'Viersen', 75000, { country: 'DE' })]
  assert.deepEqual(await names('vie', 'en'), ['Vienna AT', 'Vientiane LA', 'Viersen DE', 'Paris 06 Luxembourg FR'])

  // hamlets called exactly so do not push a city aside; a town of some size called exactly so does
  found = [town(16, 'Inn', 89, { exact: true }), town(17, 'Inn', 22, { exact: true }), town(18, 'Inn', 20, { exact: true }), town(19, 'Innsbruck', 132493, { region: 'Tyrol' }), town(20, 'Innisfil', 36566, { country: 'CA' })]
  assert.deepEqual(await names('inn', 'de'), ['Innsbruck AT', 'Innisfil CA', 'Inn AT', 'Inn AT', 'Inn AT'])
  found = [town(21, 'Wil', 23955, { names: { de: 'Wil SG' }, country: 'CH', exact: true }), town(22, 'Willemstad', 125000, { country: 'CW' }), town(23, 'Wilmington', 115451, { country: 'US' }), town(24, 'Wilhelmshaven', 76089, { country: 'DE' })]
  assert.deepEqual(await names('wil', 'de'), ['Wil SG CH', 'Willemstad CW', 'Wilmington US', 'Wilhelmshaven DE'], 'its main name is exactly the text, though a German reader sees "Wil SG"')
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

// What the dev database really answers (lib/__fixtures__/towns-search-dev.json, recorded 2026-11-13 with all
// 111,331 towns loaded: towns_search asked once per text with lim 20, as the route asks it). Tests on made-up rows
// passed twice while the real list failed: "Wie" did not offer Wien, "Wien" in English did not offer Vienna,
// "Inn" offered three hamlets before Innsbruck. Each line below was looked at on dev before it was pinned.
test('suggestions from the real list: the first one is the place a reader means', async () => {
  const { readFileSync } = await import('node:fs')
  const real = JSON.parse(readFileSync(new URL('./__fixtures__/towns-search-dev.json', import.meta.url), 'utf8')).answers
  reset()
  answerWith(({ url, body }) => (url.includes('/rest/v1/rpc/towns_search') ? json(real[JSON.parse(body).q] ?? []) : undefined))
  const names = async (q, lang) => (await (await ask(`?q=${encodeURIComponent(q)}&lang=${lang}`, '203.0.113.44')).json()).results.map(r => `${r.name} ${r.country_code}`)
  const FIRST = [
    ['Wie', 'de', 'Wien AT'], ['Vie', 'en', 'Vienna AT'], ['维也纳', 'zh', '维也纳 AT'],
    // a city typed under its name in another language than the reader's
    ['Wien', 'en', 'Vienna AT'], ['Wien', 'zh', '维也纳 AT'], ['Vienna', 'de', 'Wien AT'], ['Munich', 'de', 'München DE'], ['München', 'en', 'Munich DE'],
    ['Köln', 'en', 'Cologne DE'], ['Roma', 'de', 'Rom IT'],
    // hamlets called exactly so do not come before the city, a town of some size called exactly so does
    ['Inn', 'de', 'Innsbruck AT'], ['Salz', 'de', 'Salzburg AT'], ['Wil', 'de', 'Wil SG CH'], ['Lienz', 'de', 'Lienz AT'], ['Paris', 'en', 'Paris FR'],
  ]
  for (const [q, lang, first] of FIRST) assert.equal((await names(q, lang))[0], first, `${q} (${lang})`)
  assert.deepEqual((await names('Wie', 'de')).slice(0, 3), ['Wien AT', 'Wiesbaden DE', 'Wiener Neustadt AT'])
  assert.ok((await names('Kirchberg', 'de')).includes('Kirchberg in Tirol AT'))
  assert.ok(!(await names('Vie', 'en')).some(n => n.startsWith('Paris')), 'the Paris district filed under "VIe" is not among the five')
})

// Summits in the forecast's box (owner, 2026-11-13: "Großglockner" showed nothing until Enter, so people think
// we do not have it): asked with summits=1, from the summit search the hiking page uses. First when no town
// fits the text, below the towns that fit otherwise; never one whose name a town carries, because for that
// name the forecast opens the town; with its height, region and country (the country the summit lies in,
// since the summits were filed anew on 2026-11-14).
test('suggestions with summits: first when no town fits, below the towns that fit, none for a short text on its way to a town, none a town is named like', async () => {
  reset()
  const town = (id, name, population, extra = {}) => ({ id, name, names: null, country: 'AT', region: 'Tyrol', population, lat: 47, lon: 12, exact: false, prefix: false, ...extra })
  const peak = (id, name, ele, notability, extra = {}) => ({ id, kind: 'peak', name, names: null, ele, notability, country: 'AT', region: 'Tyrol', lat: 47.07, lon: 12.69, km: null, ...extra })
  let towns = [], peaks = [], taken = []
  answerWith(({ url, body }) => {
    if (url.includes('/rest/v1/rpc/towns_search')) return json(towns)
    if (url.includes('/rest/v1/rpc/places_search')) return peaks === 'down' ? new Response('{"message":"timeout"}', { status: 500 }) : json(peaks)
    if (url.includes('/rest/v1/rpc/town_lookup')) return json(taken.includes(JSON.parse(body).q) ? [{ id: 1 }] : [])
  })
  const rows = async (q, lang = 'de', extra = '&summits=1') => (await (await ask(`?q=${encodeURIComponent(q)}&lang=${lang}${extra}`, '203.0.113.45')).json()).results
  const said = list => list.map(r => (r.summit ? `${r.name} ${r.elev} m` : r.name))

  // no town is called so or begins so: the summits first, three at most, the best known leading, then the look-alike towns
  towns = [town(1, 'Heiligenblut am Großglockner', 1000), town(2, 'Kals am Großglockner', 1200), town(3, 'Bruck an der Großglocknerstraße', 4500)]
  peaks = [peak('osm-N1', 'Glöckner', 703, 3, { country: 'DE' }), peak('osm-N2', 'Glocknerhorn', 3680, 3), peak('osm-N3', 'Großglockner', 3798, 4), peak('osm-N4', 'Glocknerwand', 3721, 1), { ...peak('osm-W5', 'Glocknerhaus', 2132, 2), kind: 'hut' }]
  assert.deepEqual(said(await rows('Glockner')), ['Großglockner 3798 m', 'Glöckner 703 m', 'Glocknerhorn 3680 m', 'Heiligenblut am Großglockner', 'Kals am Großglockner'])
  const first = (await rows('Großglock'))[0]
  assert.deepEqual(first, { id: 'osm-N3', name: 'Großglockner', admin1: 'Tirol', country: '', country_code: 'AT', latitude: 47.07, longitude: 12.69, elev: 3798, summit: true }, 'its height, its region in the reader\'s language and its country, as the table files it')
  const english = await rows('Grossglock', 'en')
  assert.deepEqual(said(english).slice(0, 1), ['Großglockner 3798 m'], 'without ß as well')
  assert.equal(english[0].admin1, 'Tyrol')
  assert.equal(seen.filter(c => c.url.includes('/rpc/places_search')).length, 3)
  assert.deepEqual(JSON.parse(seen.find(c => c.url.includes('/rpc/places_search')).body), { q: 'Glockner', near_lat: null, near_lon: null, lim: 30 })

  // letter for letter the text comes first, whatever is better known; a name that only holds a short text is not offered
  peaks = [peak('osm-N6', 'Wilder Freiger', 3418, 4), peak('osm-N7', 'Hochzeiger', 2560, 3), peak('osm-N8', 'Eiger', 3970, 3, { country: 'CH' }), peak('osm-N9', 'Chlyne Eiger', 3467, 1, { country: 'CH' })]
  towns = []
  assert.deepEqual(said(await rows('Eiger', 'en')), ['Eiger 3970 m', 'Chlyne Eiger 3467 m'])

  // towns fit the text: they come first, two summits below them, then nothing pushed out but the fifth town
  towns = [town(10, 'Mattersburg', 7000, { prefix: true }), town(11, 'Mattersberg', 300, { prefix: true }), town(12, 'Mattersdorf', 200, { prefix: true }), town(13, 'Matterbach', 100, { prefix: true }), town(14, 'Matterau', 50, { prefix: true })]
  peaks = [peak('osm-N20', 'Matterhorn', 4478, 3, { country: 'CH' }), peak('osm-N21', 'Matterhorn', 3250, 3, { country: 'US' }), peak('osm-N22', 'Matterhorn Peak', 3747, 1, { country: 'US' })]
  assert.deepEqual(said(await rows('Matter')), ['Mattersburg', 'Mattersberg', 'Mattersdorf', 'Matterhorn 4478 m', 'Matterhorn 3250 m'])
  // a short text with towns that fit is on its way to a town: no summit, unless it is called exactly so
  towns = [town(20, 'Innsbruck', 132493, { prefix: true })]
  peaks = [peak('osm-N30', 'Innere Quellspitze', 3514, 3), peak('osm-N31', 'Inn', 2000, 1)]
  assert.deepEqual(said(await rows('Inn')), ['Innsbruck', 'Inn 2000 m'])
  peaks = [peak('osm-N30', 'Innere Quellspitze', 3514, 3)]
  assert.deepEqual(said(await rows('Inn')), ['Innsbruck'])

  // a summit whose name a town carries is left out: picking it would open the town
  towns = [town(30, 'Schneeberg', 14000, { country: 'DE', exact: true, prefix: true })]
  peaks = [peak('osm-N40', 'Schneeberg', 2076, 3), peak('osm-N41', 'Glatzer Schneeberg', 1423, 3, { country: 'PL' })]
  taken = ['Schneeberg']
  assert.deepEqual(said(await rows('Schneeberg')), ['Schneeberg', 'Glatzer Schneeberg 1423 m'])
  taken = []

  // a peak without a height is not offered; a hut never
  towns = []
  peaks = [peak('osm-N50', 'Ortler', null, 4), peak('osm-N52', 'Ortler Vorgipfel', 3845, 0, { country: 'IT' })]
  assert.deepEqual(said(await rows('Ortler')), ['Ortler Vorgipfel 3845 m'])
  // a summit in a disputed area has no country and no region: offered with its name and height, nothing else
  peaks = [peak('osm-N53', 'Mitzpe Shelegim', 2224, 3, { country: null, region: null })]
  const golan = (await rows('Mitzpe Shelegim', 'en'))[0]
  assert.deepEqual([golan.name, golan.elev, golan.admin1, golan.country, golan.country_code, golan.summit], ['Mitzpe Shelegim', 2224, null, '', null, true])

  // the summits are an extra: their search down, or not asked for (the notification settings' box), leaves the towns
  towns = [town(20, 'Innsbruck', 132493, { prefix: true })]
  peaks = 'down'
  assert.deepEqual(said(await rows('Innsbruck')), ['Innsbruck'])
  peaks = [peak('osm-N60', 'Innsbrucker Hütte Spitze', 2500, 3)]
  const before = seen.filter(c => c.url.includes('/rpc/places_search')).length
  assert.deepEqual(said(await rows('Innsbruck', 'de', '')), ['Innsbruck'])
  assert.equal(seen.filter(c => c.url.includes('/rpc/places_search')).length, before, 'without summits=1 the summit search is not asked')
})

test('suggestions with summits from the real list: Großglockner for "Großglock" and for "Glockner", the Eiger for "Eiger", no summit for "Wie" or "Inn"', async () => {
  const { readFileSync } = await import('node:fs')
  const real = JSON.parse(readFileSync(new URL('./__fixtures__/towns-search-dev.json', import.meta.url), 'utf8'))
  reset()
  answerWith(({ url, body }) => {
    const sent = JSON.parse(body ?? '{}')
    if (url.includes('/rest/v1/rpc/towns_search')) return json(real.answers[sent.q] ?? [])
    if (url.includes('/rest/v1/rpc/places_search')) return json(real.summits[sent.q] ?? [])
    if (url.includes('/rest/v1/rpc/town_lookup')) { assert.ok(sent.q in real.townOf, `${sent.q}: not recorded`); return json(real.townOf[sent.q] ? [{ id: 1 }] : []) }
  })
  const said = async (q, lang) => (await (await ask(`?q=${encodeURIComponent(q)}&lang=${lang}&summits=1`, '203.0.113.46')).json()).results.map(r => (r.summit ? `${r.name} ${r.elev} m` : `${r.name} ${r.country_code}`))
  assert.equal((await said('Großglock', 'de'))[0], 'Großglockner 3798 m')
  assert.deepEqual((await said('Glockner', 'de')).slice(0, 3), ['Großglockner 3798 m', 'Glöckner 703 m', 'Glocknerhorn 3680 m'])
  assert.equal((await said('Eiger', 'en'))[0], 'Eiger 3970 m')
  assert.deepEqual((await said('Matter', 'de')).slice(0, 5), ['Mattersburg AT', 'Mattersberg AT', 'Mattersdorf AT', 'Matterhorn 4478 m', 'Matterhorn 3250 m'])
  // towns of that name exist: every summit called Schneeberg is left out, the towns stay
  const schneeberg = await said('Schneeberg', 'de')
  assert.equal(schneeberg[0], 'Schneeberg DE')
  assert.ok(!schneeberg.some(r => /^Schneeberg \d+ m$/.test(r)), schneeberg.join(' ; '))
  for (const [q, lang] of [['Wie', 'de'], ['Inn', 'de']]) assert.ok(!(await said(q, lang)).some(r => / m$/.test(r)), `${q}: towns only`)
  assert.equal((await said('Wie', 'de'))[0], 'Wien AT')
})

// Production, 2026-11-14: a German or English reader who typed "Mont Blanc" was offered hills of that exact
// name in Quebec and Texas and not the Mont Blanc. The table holds it as "Mont Blanc / Monte Bianco" with no
// German or English name, and a name that is letter for letter the text comes first. "Sněžka" typed by a
// German reader offered only Malá Sněžka: the summit is "Śnieżka / Sněžka", shown as Schneekoppe in German.
test('suggestions with summits: a summit whose name carries two ("A / B") is called by each of them, and by the parts of its main name when the reader sees another name', async () => {
  reset()
  const peak = (id, name, ele, notability, extra = {}) => ({ id, kind: 'peak', name, names: null, ele, notability, country: 'FR', region: 'Auvergne-Rhône-Alpes', lat: 45.83, lon: 6.87, km: null, ...extra })
  let peaks = []
  answerWith(({ url }) => {
    if (url.includes('/rest/v1/rpc/towns_search')) return json([])
    if (url.includes('/rest/v1/rpc/places_search')) return json(peaks)
    if (url.includes('/rest/v1/rpc/town_lookup')) return json([])
  })
  const said = async (q, lang) => (await (await ask(`?q=${encodeURIComponent(q)}&lang=${lang}&summits=1`, '203.0.113.47')).json()).results.map(r => `${r.name} ${r.elev} m`)
  peaks = [peak('osm-N1', 'Mont Blanc / Monte Bianco', 4807, 3, { names: { fr: 'Mont Blanc' } }), peak('osm-N2', 'Mont Blanc du Tacul', 4248, 3),
    peak('osm-N3', 'Mont Blanc', 1063, 0, { country: 'CA' }), peak('osm-N4', 'Mont Blanc', 540, 0, { country: 'CA' }), peak('osm-N5', 'Mont Blanc', 401, 0, { country: 'US' }),
    peak('osm-N8', 'Monte Bianco', 1168, 3, { country: 'IT' })]
  for (const lang of ['de', 'en']) assert.deepEqual((await said('Mont Blanc', lang)).slice(0, 2), ['Mont Blanc / Monte Bianco 4807 m', 'Mont Blanc 1063 m'], `${lang}: the best known of those called so, then the next`)
  assert.equal((await said('Mont Blanc', 'fr'))[0], 'Mont Blanc 4807 m', 'unchanged where the language has a name of its own')
  assert.equal((await said('Monte Bianco', 'de'))[0], 'Mont Blanc / Monte Bianco 4807 m', 'the second part too: before the hill in Lazio that is called just so')
  assert.equal((await said('mont blanc', 'de'))[0], 'Mont Blanc / Monte Bianco 4807 m', 'in small letters')
  // the reader sees another name: the parts of the main name still find the summit, shown under the reader's name
  peaks = [peak('osm-N6', 'Śnieżka / Sněžka', 1603, 3, { names: { de: 'Schneekoppe' }, country: 'CZ' }), peak('osm-N7', 'Malá Sněžka', 498, 0, { country: 'CZ' })]
  assert.deepEqual(await said('Sněžka', 'de'), ['Schneekoppe 1603 m', 'Malá Sněžka 498 m'])
  assert.deepEqual(await said('Snezka', 'de'), ['Schneekoppe 1603 m', 'Malá Sněžka 498 m'], 'without the marks')
  assert.equal((await said('Śnieżka', 'en'))[0], 'Śnieżka / Sněžka 1603 m')
  assert.equal((await said('Schneekoppe', 'de'))[0], 'Schneekoppe 1603 m', 'and by the name shown, as before')
  // a part is a name, not every word of it: a text that fits no part as a name stays out as before
  peaks = [peak('osm-N9', 'Piz Bernina / Pizzo Bernina', 4048, 3, { country: 'CH' })]
  assert.deepEqual(await said('Pizzo', 'de'), ['Piz Bernina / Pizzo Bernina 4048 m'], 'a part begins so')
  assert.deepEqual(await said('ernina', 'de'), ['Piz Bernina / Pizzo Bernina 4048 m'], 'six letters held by the name, as before')
  assert.deepEqual(await said('rnina', 'de'), [], 'five letters inside a word: not offered, as before')
})

test('suggestions with summits from the real list: the Mont Blanc for "Mont Blanc" in German and English, the Schneekoppe for "Sněžka" in German', async () => {
  const { readFileSync } = await import('node:fs')
  const real = JSON.parse(readFileSync(new URL('./__fixtures__/towns-search-dev.json', import.meta.url), 'utf8'))
  reset()
  answerWith(({ url, body }) => {
    const sent = JSON.parse(body ?? '{}')
    if (url.includes('/rest/v1/rpc/towns_search')) return json(real.answers[sent.q] ?? [])
    if (url.includes('/rest/v1/rpc/places_search')) return json(real.summits[sent.q] ?? [])
    if (url.includes('/rest/v1/rpc/town_lookup')) { assert.ok(sent.q in real.townOf, `${sent.q}: not recorded`); return json(real.townOf[sent.q] ? [{ id: 1 }] : []) }
  })
  const summits = async (q, lang) => (await (await ask(`?q=${encodeURIComponent(q)}&lang=${lang}&summits=1`, '203.0.113.48')).json()).results.filter(r => r.summit).map(r => `${r.name} ${r.elev} m ${r.country_code}`)
  for (const lang of ['de', 'en']) assert.equal((await summits('Mont Blanc', lang))[0], 'Mont Blanc / Monte Bianco 4807 m FR', lang)
  assert.equal((await summits('Mont Blanc', 'fr'))[0], 'Mont Blanc 4807 m FR')
  assert.equal((await summits('Monte Bianco', 'de'))[0], 'Mont Blanc / Monte Bianco 4807 m FR')
  assert.equal((await summits('Sněžka', 'de'))[0], 'Schneekoppe 1603 m CZ')
  assert.equal((await summits('Schneekoppe', 'de'))[0], 'Schneekoppe 1603 m CZ')
})

// Production, 2026-11-14: "Inns" offered Innsbruck, then Kreith, Augsburg, Vinzons and Innisfil. Only
// Innsbruck begins so; the other four are the database's look-alikes, found by spellings and inner words a
// reader never sees. A look-alike is offered only when a name the reader can see explains it (lib/places/alike.js).
test('suggestions: a town that only looks alike to the database is offered when the reader can follow it, and not otherwise', async () => {
  reset()
  const town = (id, name, extra = {}) => ({ id, name, names: null, country: 'DE', region: 'Bavaria', population: 1000, lat: 48, lon: 11, exact: false, prefix: false, ...extra })
  const lists = {
    inns: [INNSBRUCK, town(1, 'Kreith', { country: 'AT' }), town(2, 'Augsburg', { population: 301105 }), town(3, 'Vinzons', { country: 'PH' }), town(4, 'Innisfil', { country: 'CA' }), town(5, 'Ried im Innkreis', { country: 'AT' })],
    // a slip of the finger: no town begins so, the database sends look-alikes only
    insbr: [town(6, 'Insberg'), { ...INNSBRUCK, prefix: false }, town(2, 'Augsburg')],
    // a later word begins with the text
    inn: [{ ...INNSBRUCK }, town(7, 'Wasserburg am Inn'), town(8, 'Kyar Inn West', { country: 'MM' }), town(9, 'Mühldorf')],
    // found by a name in a language that is none of ours, exactly or by its beginning: stays, as before
    becs: [{ ...VIENNA, exact: true }], bec: [{ ...VIENNA, prefix: true }, town(10, 'Bechhofen', { prefix: true })],
    // one of our languages' names is close: a German reader types "Mailnad" for Mailand
    mailnad: [town(11, 'Milan', { names: { de: 'Mailand', it: 'Milano' }, country: 'IT' }), town(12, 'Mainaschaff')],
  }
  answerWith(({ url, body }) => (url.includes('/rest/v1/rpc/towns_search') ? json(lists[JSON.parse(body).q.toLowerCase()] ?? []) : undefined))
  const names = async (q, lang = 'de') => (await (await ask(`?q=${q}&lang=${lang}`, '203.0.113.47')).json()).results.map(r => r.name)
  assert.deepEqual(await names('Inns'), ['Innsbruck'], 'one town fits; four letters are too few to call anything a slip')
  assert.deepEqual(await names('Insbr'), ['Insberg', 'Innsbruck'], 'one letter off the beginning of each, in the database\'s order; Augsburg is not')
  assert.deepEqual(await names('Inn'), ['Innsbruck', 'Wasserburg am Inn', 'Kyar Inn West'], 'towns with a word that begins so come after the one that begins so')
  assert.deepEqual(await names('becs'), ['Wien'])
  assert.deepEqual(await names('bec'), ['Bechhofen', 'Wien'], 'Bechhofen begins so; Wien found by the beginning of another name stays behind it')
  assert.deepEqual(await names('Mailnad'), ['Mailand'])
})
