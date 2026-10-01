import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readAll } from './paging.js'

test('readAll — pages past the 1000-row cap until a short page', async () => {
  const rows = Array.from({ length: 2300 }, (_, i) => i)
  const asked = []
  const all = await readAll((from, to) => { asked.push([from, to]); return Promise.resolve({ data: rows.slice(from, to + 1), error: null }) })
  assert.equal(all.length, 2300)
  assert.deepEqual(asked, [[0, 999], [1000, 1999], [2000, 2999]])
})

test('readAll — a database error stops the run instead of reading as "nothing sent"', async () => {
  await assert.rejects(readAll(() => Promise.resolve({ data: null, error: { message: 'timeout' } })), /timeout/)
})
