import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withThreads, saveCountry } from './store.js'

test('withThreads — an Update keeps the thread of the warning it replaces', () => {
  const known = new Map([['a', 'a'], ['b', 'a'], ['k', 'k0'], ['old', null]])
  const rows = [
    { id: 'k', refs: [] }, // stored before: its thread stays
    { id: 'c', refs: ['b'] }, // replaces b (thread a)
    { id: 'd', refs: ['gone', 'older'] }, // names nothing stored: the oldest it names
    { id: 'e', refs: [] }, // new
    { id: 'old', refs: [] }, // stored before the thread column: itself
  ]
  assert.deepEqual(withThreads(rows, known).map(r => [r.id, r.thread, 'refs' in r]),
    [['k', 'k0', false], ['c', 'a', false], ['d', 'older', false], ['e', 'e', false], ['old', 'old', false]])
})

test('saveCountry — reads the stored threads of that country and saves each row with its thread', async () => {
  const stored = [{ id: 'b', thread: 'a' }]
  const calls = { filters: [], upserts: [], deletes: 0 }
  const db = {
    from: () => ({
      select: cols => {
        const q = { eq: (k, v) => { calls.filters.push([cols, k, v]); return q }, order: () => q, range: async (a, b) => ({ data: stored.slice(a, b + 1), error: null }) }
        return q
      },
      upsert: async rows => { calls.upserts.push(...rows); return { error: null } },
      delete: () => ({ eq: () => ({ lt: async () => { calls.deletes++; return { error: null } } }) }),
    }),
  }
  await saveCountry(db, 'DE', [{ id: 'c', refs: ['b'], country: 'DE', expires: '2026-10-08T20:00:00+02:00' }], Date.parse('2026-10-08T08:00:00Z'))
  assert.deepEqual(calls.filters, [['id, thread', 'country', 'DE']])
  assert.equal(calls.upserts[0].thread, 'a')
  assert.ok(!('refs' in calls.upserts[0]))
  assert.equal(calls.deletes, 1)
})
