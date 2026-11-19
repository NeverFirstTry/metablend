// Route lists worked out without the OpenStreetMap API (scripts/routes/local.mjs): which Geofabrik extract
// a peak is read from, and that the site's own route finder gives its usual answer when its two requests
// are answered from a file and its heights from the terrain tiles.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractFor, fileJson, loadPlan, memoryStore, peakKey } from './local.js'
import { findRoutes } from './find.js'
import { routeHeights, lineKey, sampleIndexes } from './height-store.js'

const square = (lat1, lon1, lat2, lon2) => ({ type: 'MultiPolygon', coordinates: [[[[lon1, lat1], [lon2, lat1], [lon2, lat2], [lon1, lat2], [lon1, lat1]]]] })
const extract = (id, parent, geometry) => ({ type: 'Feature', properties: { id, parent, urls: { pbf: `https://download.example/${id}-latest.osm.pbf` } }, geometry })
const INDEX = [
  extract('europe', undefined, square(35, -10, 70, 40)),
  extract('alps', 'europe', square(45, 5, 48, 16)),
  extract('austria', 'europe', square(46.4, 9.5, 49, 17.2)),
  extract('italy', 'europe', square(36, 6.6, 47.1, 18.5)),
  extract('nord-est', 'italy', square(44, 10, 47.1, 14)),
  extract('spain', 'europe', square(36, -9.3, 43.8, 3.3)),
]

test('a peak is read from the Alps extract when it lies in it, so a route that crosses a border is whole', () => {
  assert.equal(extractFor(INDEX, { lat: 47.07, lon: 12.69 }).id, 'alps') // inside Austria too
  assert.equal(extractFor(INDEX, { lat: 46.5, lon: 11.8 }).id, 'alps') // Italy, north-east
})

test('elsewhere the smallest extract that holds the peak: the region before its country, the country before the continent', () => {
  assert.equal(extractFor(INDEX, { lat: 44.5, lon: 11.0 }).id, 'nord-est')
  assert.equal(extractFor(INDEX, { lat: 42.6, lon: 0.6 }).id, 'spain')
  assert.equal(extractFor(INDEX, { lat: 60, lon: 20 }).id, 'europe')
  assert.equal(extractFor(INDEX, { lat: -3.07, lon: 37.35 }), null) // no extract holds it
  assert.equal(extractFor(INDEX, { lat: 44.5, lon: 11.0 }).url, 'https://download.example/nord-est-latest.osm.pbf')
})

test('the key of a peak is the route cache\'s own', () => {
  assert.equal(peakKey({ lat: 47.0745, lon: 12.6941, elev: 3798 }), '47.075,12.694,3798')
})

// a summit with one marked route of two ways, as scripts/routes/osm_routes.py writes it
const node = (id, lat, lon) => ({ type: 'node', id, lat, lon })
const NODES = [node(1, 47.0000, 12.0000), node(2, 47.0030, 12.0000), node(3, 47.0060, 12.0000), node(4, 47.0090, 12.0000)]
const WAYS = [{ type: 'way', id: 10, nodes: [1, 2], tags: { highway: 'path', sac_scale: 'mountain_hiking' } }, { type: 'way', id: 11, nodes: [2, 3, 4], tags: { highway: 'path', sac_scale: 'alpine_hiking' } }]
const REL = { type: 'relation', id: 900, tags: { type: 'route', route: 'hiking', ref: '712', name: 'Test way' }, members: [{ type: 'way', ref: 10, role: '' }, { type: 'way', ref: 11, role: '' }] }
const FILE = { map: { elements: [...NODES, ...WAYS, REL] }, full: { 900: { elements: [REL, ...WAYS, ...NODES] } } }
const PEAK = { lat: 47.0090, lon: 12.0000, elev: 2500 }

test('the route finder answers from the file: the box lookup and each route, nothing else', async () => {
  const getJson = fileJson(FILE)
  assert.equal((await getJson('https://api.openstreetmap.org/api/0.6/map.json?bbox=11.99100,47.00300,12.00900,47.01500')).elements.length, 7)
  assert.equal((await getJson('https://api.openstreetmap.org/api/0.6/relation/900/full.json')).elements[0].id, 900)
  assert.equal(await getJson('https://api.openstreetmap.org/api/0.6/relation/901/full.json'), null) // a route the extract does not hold
  await assert.rejects(() => getJson('https://api.open-meteo.com/v1/elevation?latitude=1&longitude=1'), /not answered from the file/)
})

test('routes and their stored heights come out in the shapes the site keeps (route_cache, route_heights)', async () => {
  const store = memoryStore()
  // the terrain: 1,000 m at the start, 500 m higher every 0.003 degrees north
  const getElevations = async points => points.map(p => 1000 + Math.round((p.lat - 47) / 0.003 * 500))
  const heightsFor = (id, points) => routeHeights(id, points, { db: store.db, getElevations, wait: async () => {} })
  const found = await findRoutes(PEAK, { getJson: fileJson(FILE), heightsFor })
  assert.equal(found.complete, true)
  assert.equal(found.routes.length, 1)
  const r = found.routes[0]
  assert.deepEqual([r.id, r.ref, r.difficulty, r.heights], [900, '712', 'alpine_hiking', 'terrain'])
  assert.deepEqual(r.points.map(p => p[2]), [1000, 1500, 2000, 2500])
  assert.equal(r.ascentM, 1500)
  assert.ok(r.minutes > 0)
  // one row of heights, under the line's own fingerprint: what the site looks up before it asks anyone
  const points = r.points.map(([lat, lon]) => ({ lat, lon }))
  assert.deepEqual(store.rows, [{ route_id: 900, geom: lineKey(sampleIndexes(points).map(i => points[i])), heights: [1000, 1500, 2000, 2500] }])
})

// scripts/routes/load.mjs: what goes into the database from the peak files
const DAY = 86400e3
const peakFile = (key, more = {}) => ({ peak_key: key, complete: true, routes: [{ id: 900 }], heights: [{ route_id: 900, geom: 'aa', heights: [1000, 1500] }], at: Date.parse('2026-11-19T12:00:00Z'), ...more })

test('the loader only adds: a peak that has a route list keeps it, its routes\' heights are still offered', () => {
  const plan = loadPlan([peakFile('47.000,11.000,2500'), peakFile('46.000,10.000,3000', { heights: [{ route_id: 901, geom: 'bb', heights: [7] }] })], new Set(['46.000,10.000,3000']))
  assert.deepEqual(plan.cache.map(r => r.peak_key), ['47.000,11.000,2500'])
  assert.deepEqual(plan.held, ['46.000,10.000,3000'])
  assert.deepEqual(plan.heights.map(h => h.route_id), [900, 901])
  assert.deepEqual(plan.cache[0].routes, [{ id: 900 }])
})

test('only whole lists are stored, dated from the day they were read; a list the extract cut is left to the lookup of the site', () => {
  const plan = loadPlan([peakFile('47.000,11.000,2500'), peakFile('46.000,10.000,3000', { complete: false }), peakFile('45.000,9.000,4000', { routes: [], heights: [] }), peakFile('44.000,8.000,1200', { complete: false, routes: [], heights: [] })], new Set())
  assert.deepEqual(plan.cache.map(r => [r.peak_key, r.fetched_at]), [['47.000,11.000,2500', '2026-11-19T12:00:00.000Z'], ['45.000,9.000,4000', '2026-11-19T12:00:00.000Z']])
  // a peak without a marked route gets its empty list, as the live lookup stores it; one whose routes were all cut gets none
  assert.deepEqual(plan.cache[1].routes, [])
  assert.deepEqual(plan.left, ['46.000,10.000,3000', '44.000,8.000,1200'])
  // the heights of the routes that were whole go in all the same: the site's lookup then asks for none of them
  assert.deepEqual(plan.heights.map(h => h.route_id), [900])
})

test('a route two peaks share is offered once', () => {
  const plan = loadPlan([peakFile('47.000,11.000,2500'), peakFile('47.010,11.000,2600')], new Set())
  assert.deepEqual(plan.heights, [{ route_id: 900, geom: 'aa', heights: [1000, 1500] }])
})
