import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spaced } from './spaced.js'

test('spaced — calls go out at least gapMs apart (Nominatim: one request a second), in order, each with its own answer', async () => {
  let t = 0
  const waits = []
  const slot = spaced(1100, { now: () => t, sleep: async ms => { waits.push(ms); t += ms } })
  const answers = await Promise.all([slot(async () => 'a'), slot(async () => 'b'), slot(async () => 'c')])
  assert.deepEqual(answers, ['a', 'b', 'c'])
  assert.deepEqual(waits, [1100, 1100]) // the first goes at once
  t += 5000 // a quiet spell: the next one goes at once again
  await slot(async () => 'd')
  assert.equal(waits.length, 2)
})
