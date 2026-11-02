import { test } from 'node:test'
import assert from 'node:assert/strict'

// weights.js imports the supabase client at module level, which needs env vars
// to construct — provide fakes so the pure math is importable in tests.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-key'
const { buildWeightUpdates, claimDay } = await import('./weights.js')

const rows = () => ([
  { id: 'a', score: 0, reports: 0, delta_history: [] },
  { id: 'b', score: 10, reports: 5, delta_history: [2, 2] },
  { id: 'c', score: -4, reports: 4, delta_history: [-1, -1] },
])

test('buildWeightUpdates — applies a single delta and re-normalizes everything', () => {
  const { updates, total } = buildWeightUpdates(rows(), { a: 2 })
  assert.equal(updates.length, 3) // untouched rows included in normalization
  const a = updates.find(u => u.id === 'a')
  assert.equal(a.score, 2)
  assert.equal(a.reports, 1)
  assert.deepEqual(a.history, [2])
  assert.deepEqual(a.deltas, [2])
  const weightSum = updates.reduce((s, u) => s + u.rawFactor / total, 0)
  assert.ok(Math.abs(weightSum - 1) < 1e-9, 'weights are a partition')
})

test('buildWeightUpdates — array deltas (temp + wind) count as separate reports', () => {
  const { updates } = buildWeightUpdates(rows(), { b: [2, -1] })
  const b = updates.find(u => u.id === 'b')
  assert.equal(b.score, 11)
  assert.equal(b.reports, 7)
  assert.deepEqual(b.history, [2, 2, 2, -1])
})

test('buildWeightUpdates — history is capped at 50 entries', () => {
  const long = [{ id: 'a', score: 0, reports: 60, delta_history: Array(50).fill(1) }]
  const { updates } = buildWeightUpdates(long, { a: [2, 2] })
  assert.equal(updates[0].history.length, 50)
  assert.deepEqual(updates[0].history.slice(-2), [2, 2]) // newest kept, oldest dropped
})

test('buildWeightUpdates — unknown ids and empty maps produce null', () => {
  assert.equal(buildWeightUpdates(rows(), { nope: 2 }), null)
  assert.equal(buildWeightUpdates(rows(), {}), null)
})

test('buildWeightUpdates — untouched rows keep score/reports and carry no deltas', () => {
  const { updates } = buildWeightUpdates(rows(), { a: -2 })
  const c = updates.find(u => u.id === 'c')
  assert.equal(c.score, -4)
  assert.equal(c.reports, 4)
  assert.equal(c.deltas, null)
})

test('buildWeightUpdates — better history earns more weight', () => {
  const { updates, total } = buildWeightUpdates(rows(), { b: 2, c: -2 })
  const w = id => updates.find(u => u.id === id).rawFactor / total
  assert.ok(w('b') > w('c'), 'consistently accurate source outweighs a poor one')
})

test('buildWeightUpdates — a source scored for the first time joins with a fresh row (a new source gets calibrated too)', () => {
  const { updates, total } = buildWeightUpdates(rows(), { meteofrance: 2 })
  const m = updates.find(u => u.id === 'meteofrance')
  assert.ok(m, 'the new source is in the update')
  assert.equal(m.score, 2)
  assert.equal(m.reports, 1)
  assert.deepEqual(m.history, [2])
  assert.equal(updates.length, 4)
  const weightSum = updates.reduce((sum, u) => sum + u.rawFactor / total, 0)
  assert.ok(Math.abs(weightSum - 1) < 1e-9, 'still a partition')
})

// a feedback table in memory with the few query steps claimDay uses
function fakeDb(table = []) {
  let seq = 0
  const query = (filters = [], sorts = []) => ({
    eq: (k, v) => query([...filters, r => r[k] === v], sorts),
    order: k => query(filters, [...sorts, k]),
    limit: async n => {
      let rows = table.filter(r => filters.every(f => f(r)))
      for (const k of [...sorts].reverse()) rows = [...rows].sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0))
      return { data: rows.slice(0, n), error: null }
    },
  })
  return {
    table,
    from: () => ({
      select: () => query(),
      insert: row => ({ select: () => ({ single: async () => { const r = { ...row, id: `id${++seq}`, created_at: seq }; table.push(r); return { data: r, error: null } } }) }),
    }),
  }
}

test('claimDay — a scoring job runs once per day: the first run claims it, a later one stops without a second claim', async () => {
  const db = fakeDb()
  assert.equal(await claimDay('__calibrate__', '2026-11-01', db), true)
  assert.equal(await claimDay('__calibrate__', '2026-11-01', db), false)
  assert.equal(db.table.length, 1)
  assert.equal(await claimDay('__calibrate__', '2026-11-02', db), true) // the next day
  assert.equal(await claimDay('__meteostat__', '2026-11-01', db), true) // another job
})

test('claimDay — two deliveries of the same cron at once: only the earliest claim runs', async () => {
  const db = fakeDb()
  const [a, b] = await Promise.all([claimDay('__calibrate__', '2026-11-01', db), claimDay('__calibrate__', '2026-11-01', db)])
  assert.deepEqual([a, b].sort(), [false, true])
})
