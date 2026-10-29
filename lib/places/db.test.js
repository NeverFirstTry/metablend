import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makePlaces } from './db.js'

const thenable = value => ({ then: ok => ok(value) })
function fakeDb({ summits = [{ id: 'osm-N1' }], rpc = {} } = {}) {
  const calls = []
  return {
    calls,
    from: table => ({ select: () => ({ limit: () => { calls.push(`ready? ${table}`); return thenable(Array.isArray(summits) ? { data: summits, error: null } : { data: null, error: summits }) } }) }),
    rpc: (fn, args) => { calls.push(`${fn} ${JSON.stringify(args)}`); return thenable(rpc[fn] ?? { data: [], error: null }) },
  }
}

test('places — rows in the app\'s shape (elev, km, notability only when there is one)', async () => {
  const db = fakeDb({ rpc: { places_search: { data: [{ id: 'osm-N3', kind: 'peak', name: '富士山', names: { en: 'Mount Fuji' }, ele: 3776, notability: 3, country: 'JP', region: 'Shizuoka', lat: 35.36, lon: 138.73, km: null }], error: null } } })
  const places = makePlaces(db, { now: () => 0 })
  assert.deepEqual(await places.search('fuji', null), [{ id: 'osm-N3', name: '富士山', names: { en: 'Mount Fuji' }, lat: 35.36, lon: 138.73, elev: 3776, kind: 'peak', country: 'JP', region: 'Shizuoka', notability: 3 }])
  assert.match(db.calls.at(-1), /places_search \{"q":"fuji","lat":null,"lon":null,"lim":10\}/)
})

test('places — ready only once the summits table is there and has rows; remembered for ten minutes', async () => {
  let t = 0
  const empty = makePlaces(fakeDb({ summits: [] }), { now: () => t })
  assert.equal(await empty.ready(), false) // SQL run, data not loaded yet: the old sources stay
  const missing = makePlaces(fakeDb({ summits: { code: 'PGRST205', message: 'no table' } }), { now: () => t })
  assert.equal(await missing.ready(), false)
  const db = fakeDb()
  const loaded = makePlaces(db, { now: () => t })
  assert.equal(await loaded.ready(), true)
  await loaded.ready()
  assert.equal(db.calls.filter(c => c.startsWith('ready?')).length, 1)
  t = 11 * 60e3
  await loaded.ready()
  assert.equal(db.calls.filter(c => c.startsWith('ready?')).length, 2)
})

test('places — a database error answers null (the caller falls back), never throws', async () => {
  const places = makePlaces(fakeDb({ rpc: { summits_pool: { data: null, error: { code: '57014', message: 'timeout' } } } }), { now: () => 0 })
  assert.equal(await places.pool(47.27, 11.4), null)
})
