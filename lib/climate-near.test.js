// A place the archive gives nothing for (after the move to a plan without the archive host: every new
// place) borrows the climate table of the nearest kept place within 25 km and 300 m of height
// (lib/climate-store.js, nearClimate). Too far, too high or too low, or a height not known: no table, and
// the outlook goes without normals while the planner says unavailable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadClimate, nearClimate, NEAR_KM, NEAR_M } from './climate-store.js'
import { haversineKm } from './geo.js'

const table = (elev, mark) => ({ v: 2, elev, years: 10, max: [mark], min: [0], wet: [0], months: [] })
// Lienz (673 m) asks; kept: Oberlienz 4 km away but on the slope, Dölsach 5 km in the valley, Matrei 22 km, Spittal 50 km
const HERE = [46.83, 12.77]
const ROWS = [
  { key: '46.85,12.72', data: table(1400, 'slope') },
  { key: '46.83,12.84', data: table(730, 'valley') },
  { key: '47.00,12.54', data: table(975, 'matrei') },
  { key: '46.80,13.50', data: table(560, 'far') },
]
function fakeDb(rows) {
  const calls = []
  return { calls, from: () => ({
    select: cols => ({
      or: async filter => { calls.push(['band', filter]); return { data: rows.map(r => ({ key: r.key, elev: r.data.elev })) } },
      eq: (col, key) => ({ limit: async () => { calls.push(['read', key]); return { data: rows.filter(r => r.key === key).map(r => (cols === 'data' ? { data: r.data } : { data: r.data, fetched_at: '2026-06-01T00:00:00Z' })) } } }),
    }),
    upsert: async v => { calls.push(['write', v.key]); return { error: null } },
  }) }
}

test('the nearest kept place at a similar height stands in; the nearer one on the slope does not', async () => {
  assert.equal(NEAR_KM, 25); assert.equal(NEAR_M, 300)
  assert.ok(haversineKm(...HERE, 46.85, 12.72) < haversineKm(...HERE, 46.83, 12.84), 'the slope is nearer than the valley town')
  const db = fakeDb(ROWS)
  const got = await nearClimate(...HERE, { db, heightOf: async () => 673 })
  assert.equal(got.max[0], 'valley')
  // the rows are asked by the band of latitudes around the place, then one read of the pick
  assert.deepEqual(db.calls.map(c => c[0]), ['band', 'read'])
  for (const band of ['46.5', '46.8', '47.1']) assert.ok(db.calls[0][1].includes(`key.like."${band}*"`), band)
  assert.deepEqual(db.calls[1], ['read', '46.83,12.84'])
})

test('nothing stands in when every kept place is too far or at another height, or a height is not known', async () => {
  assert.equal(await nearClimate(...HERE, { db: fakeDb([ROWS[0], ROWS[3]]), heightOf: async () => 673 }), null, 'the slope is too high, Spittal too far')
  assert.equal(await nearClimate(...HERE, { db: fakeDb(ROWS), heightOf: async () => null }), null, 'the place\'s own height is not known')
  assert.equal(await nearClimate(...HERE, { db: fakeDb([{ key: '46.83,12.84', data: { ...table(730, 'old'), elev: undefined } }]), heightOf: async () => 673 }), null, 'a kept table without a height')
  assert.equal(await nearClimate(...HERE, { db: fakeDb([]), heightOf: async () => 673 }), null)
  // on the mountain above the valley the higher neighbour is the right one
  assert.equal((await nearClimate(...HERE, { db: fakeDb(ROWS), heightOf: async () => 1500 })).max[0], 'slope')
})

test('loadClimate: no own table and the archive gives nothing: the neighbour\'s table, and nothing is written', async () => {
  const db = fakeDb(ROWS)
  const got = await loadClimate(...HERE, { db, fetchJson: async () => null, heightOf: async () => 673, now: Date.parse('2026-12-20T00:00:00Z') })
  assert.equal(got.max[0], 'valley')
  assert.equal(db.calls.some(c => c[0] === 'write'), false)
  // with no neighbour either there is no reference at all
  assert.equal(await loadClimate(10, 10, { db: fakeDb([]), fetchJson: async () => null, heightOf: async () => 400, now: Date.now() }), null)
})

test('a kept table of the earlier form (no height) is asked again while the archive answers, and still serves when it does not', async () => {
  const old = { v: 1, years: 10, max: [1], min: [0], wet: [0], months: [] }
  const row = () => [{ key: '46.83,12.77', data: old }]
  const daily = { time: ['2016-01-01'], temperature_2m_max: [3], temperature_2m_min: [-2], temperature_2m_mean: [0], precipitation_sum: [2] }
  const db = fakeDb(row())
  const fresh = await loadClimate(...HERE, { db, fetchJson: async () => ({ elevation: 673.4, daily }), now: Date.parse('2026-11-12T00:00:00Z') })
  assert.equal(fresh.v, 2)
  assert.equal(fresh.elev, 673)
  assert.deepEqual(db.calls.at(-1), ['write', '46.83,12.77'])
  assert.equal(await loadClimate(...HERE, { db: fakeDb(row()), fetchJson: async () => null, now: Date.parse('2026-11-12T00:00:00Z') }), old)
})

test('OPEN_METEO_ARCHIVE=off: the archive is never asked; a kept table serves whatever its age, a new place borrows a neighbour\'s', async () => {
  const asked = []
  const fetchJson = async url => { asked.push(url); return null }
  process.env.OPEN_METEO_ARCHIVE = 'off'
  try {
    // a new place: straight to the neighbour, no request first
    assert.equal((await loadClimate(...HERE, { db: fakeDb(ROWS), fetchJson, heightOf: async () => 673, now: Date.now() })).max[0], 'valley')
    // the place's own table from two years ago: it serves, nothing is asked
    const old = table(673, 'own')
    const own = { calls: [], from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: [{ data: old, fetched_at: '2024-11-01T00:00:00Z' }] }) }) }), upsert: async () => { throw new Error('nothing may be written') } }) }
    assert.equal(await loadClimate(...HERE, { db: own, fetchJson, now: Date.parse('2026-12-20T00:00:00Z') }), old)
    assert.deepEqual(asked, [], 'no archive request at all')
  } finally { delete process.env.OPEN_METEO_ARCHIVE }
  // without the setting the same new place asks the archive first
  await loadClimate(...HERE, { db: fakeDb(ROWS), fetchJson, heightOf: async () => 673, now: Date.now() })
  assert.equal(asked.length, 1)
})
