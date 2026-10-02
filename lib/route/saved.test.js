import { test } from 'node:test'
import assert from 'node:assert/strict'
import { upsertRoute } from './saved.js'

const r = (id, extra = {}) => ({ id, name: id, points: [], savedAt: 1, ...extra })

test('upsertRoute — newest first, same id replaced', () => {
  assert.deepEqual(upsertRoute([r('a'), r('b')], r('b', { name: 'B2' })).map(x => [x.id, x.name]), [['b', 'B2'], ['a', 'a']])
})

test('upsertRoute — past the limit the oldest unplanned route goes', () => {
  const list = [r('c'), r('b', { planned: true }), r('a', { planned: true })]
  assert.deepEqual(upsertRoute(list, r('d'), 3).map(x => x.id), ['d', 'b', 'a'])
  assert.deepEqual(upsertRoute([r('b', { planned: true }), r('a', { planned: true })], r('d'), 2).map(x => x.id), ['d', 'b', 'a'])
})
