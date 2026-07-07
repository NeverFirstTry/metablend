import { test } from 'node:test'
import assert from 'node:assert/strict'

// weights.js imports the supabase client at module level, which needs env vars
// to construct — provide fakes so the pure math is importable in tests.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-key'
const { buildWeightUpdates } = await import('./weights.js')

const rows = () => ([
  { id: 'a', score: 0, reports: 0, delta_history: [] },
  { id: 'b', score: 10, reports: 5, delta_history: [2, 2] },
  { id: 'c', score: -4, reports: 4, delta_history: [-1, -1] },
])

test('buildWeightUpdates — applies a single delta and re-normalizes everything', () => {
  const { updates, total } = buildWeightUpdates(rows(), { a: 2 }, true)
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
  const { updates } = buildWeightUpdates(rows(), { b: [2, -1] }, true)
  const b = updates.find(u => u.id === 'b')
  assert.equal(b.score, 11)
  assert.equal(b.reports, 7)
  assert.deepEqual(b.history, [2, 2, 2, -1])
})

test('buildWeightUpdates — history is capped at 50 entries', () => {
  const long = [{ id: 'a', score: 0, reports: 60, delta_history: Array(50).fill(1) }]
  const { updates } = buildWeightUpdates(long, { a: [2, 2] }, true)
  assert.equal(updates[0].history.length, 50)
  assert.deepEqual(updates[0].history.slice(-2), [2, 2]) // newest kept, oldest dropped
})

test('buildWeightUpdates — unknown ids and empty maps produce null', () => {
  assert.equal(buildWeightUpdates(rows(), { nope: 2 }, true), null)
  assert.equal(buildWeightUpdates(rows(), {}, true), null)
})

test('buildWeightUpdates — untouched rows keep score/reports and carry no deltas', () => {
  const { updates } = buildWeightUpdates(rows(), { a: -2 }, true)
  const c = updates.find(u => u.id === 'c')
  assert.equal(c.score, -4)
  assert.equal(c.reports, 4)
  assert.equal(c.deltas, null)
})

test('buildWeightUpdates — pre-history schemas get history: null', () => {
  const { updates } = buildWeightUpdates(rows(), { a: 1 }, false)
  assert.equal(updates.find(u => u.id === 'a').history, null)
})

test('buildWeightUpdates — better history earns more weight', () => {
  const { updates, total } = buildWeightUpdates(rows(), { b: 2, c: -2 }, true)
  const w = id => updates.find(u => u.id === id).rawFactor / total
  assert.ok(w('b') > w('c'), 'consistently accurate source outweighs a poor one')
})
