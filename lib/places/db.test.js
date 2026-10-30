import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makePlaces } from './db.js'

const thenable = value => ({ then: ok => ok(value) })
function fakeDb({ rpc = {} } = {}) {
  const calls = []
  return {
    calls,
    rpc: (fn, args) => { calls.push(`${fn} ${JSON.stringify(args)}`); return thenable(rpc[fn] ?? { data: [], error: null }) },
  }
}

test('places — rows in the app\'s shape (elev, km, notability only when there is one)', async () => {
  const db = fakeDb({ rpc: { places_search: { data: [{ id: 'osm-N3', kind: 'peak', name: '富士山', names: { en: 'Mount Fuji' }, ele: 3776, notability: 3, country: 'JP', region: 'Shizuoka', lat: 35.36, lon: 138.73, km: null }], error: null } } })
  const places = makePlaces(db, { now: () => 0 })
  assert.deepEqual(await places.search('fuji', null), [{ id: 'osm-N3', name: '富士山', names: { en: 'Mount Fuji' }, lat: 35.36, lon: 138.73, elev: 3776, kind: 'peak', country: 'JP', region: 'Shizuoka', notability: 3 }])
  assert.match(db.calls.at(-1), /places_search \{"q":"fuji","near_lat":null,"near_lon":null,"lim":10\}/)
})

test('places — ready only once a load has finished (places_ready), never during a first one; remembered for ten minutes', async () => {
  let t = 0
  const loading = makePlaces(fakeDb({ rpc: { places_ready: { data: false, error: null } } }), { now: () => t })
  assert.equal(await loading.ready(), false) // rows going in, no load finished: the old sources stay
  const missing = makePlaces(fakeDb({ rpc: { places_ready: { data: null, error: { code: 'PGRST202', message: 'no function' } } } }), { now: () => t })
  assert.equal(await missing.ready(), false) // places.sql not run yet
  const db = fakeDb({ rpc: { places_ready: { data: true, error: null } } })
  const loaded = makePlaces(db, { now: () => t })
  assert.equal(await loaded.ready(), true)
  await loaded.ready()
  assert.equal(db.calls.filter(c => c.startsWith('places_ready')).length, 1)
  t = 11 * 60e3
  await loaded.ready()
  assert.equal(db.calls.filter(c => c.startsWith('places_ready')).length, 2)
})

test('places — a database error answers null (the caller falls back), never throws', async () => {
  const places = makePlaces(fakeDb({ rpc: { summits_pool: { data: null, error: { code: '57014', message: 'timeout' } } } }), { now: () => 0 })
  assert.equal(await places.pool(47.27, 11.4), null)
})

test('places — around a point: summits and huts, or one kind only', async () => {
  const db = fakeDb()
  const places = makePlaces(db, { now: () => 0 })
  await places.near(46.02, 7.75)
  assert.match(db.calls.at(-1), /^summits_near \{"lat":46.02,"lon":7.75,"radius_km":25,"lim":12\}$/)
  await places.near(46.02, 7.75, 25, 3, ['hut'])
  assert.match(db.calls.at(-1), /"kinds":\["hut"\]/)
})
