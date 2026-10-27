import { test } from 'node:test'
import assert from 'node:assert/strict'
import { upsertRoute, needsHeights, applyHeights } from './saved.js'

const r = (id, extra = {}) => ({ id, name: id, points: [], savedAt: 1, ...extra })

test('upsertRoute — newest first, same id replaced', () => {
  assert.deepEqual(upsertRoute([r('a'), r('b')], r('b', { name: 'B2' })).map(x => [x.id, x.name]), [['b', 'B2'], ['a', 'a']])
})

test('upsertRoute — past the limit the oldest unplanned route goes', () => {
  const list = [r('c'), r('b', { planned: true }), r('a', { planned: true })]
  assert.deepEqual(upsertRoute(list, r('d'), 3).map(x => x.id), ['d', 'b', 'a'])
  assert.deepEqual(upsertRoute([r('b', { planned: true }), r('a', { planned: true })], r('d'), 2).map(x => x.id), ['d', 'b', 'a'])
})

test('needsHeights — a saved route without heights on (nearly) every point', () => {
  assert.equal(needsHeights(r('a', { points: [[47, 12, 1000], [47.01, 12, 1100]] })), false)
  assert.equal(needsHeights(r('b', { points: [[47, 12, null], [47.01, 12, null]] })), true)
  assert.equal(needsHeights(r('c', { points: 'nonsense' })), false) // nothing to fill
})

test('applyHeights — filled points replace a route\'s, only while it is unchanged and only when more heights are known', () => {
  const bare = [[47, 12, null], [47.01, 12, null]]
  const full = [[47, 12, 1000], [47.01, 12, 1100]]
  const list = [r('a', { points: bare, planned: true }), r('b', { points: bare }), r('c', { points: [[46, 11, null], [46.01, 11, null]] })]
  const fills = new Map([
    ['a', { from: bare, to: full }],
    ['b', { from: bare, to: bare }], // the terrain model gave nothing: kept as it was
    ['c', { from: bare, to: full }], // changed since it was read (re-imported): not overwritten
    ['gone', { from: bare, to: full }], // removed meanwhile: not brought back
  ])
  const out = applyHeights(list, fills)
  assert.equal(out.changed, 1)
  assert.deepEqual(out.list.map(x => [x.id, x.points[0][2], !!x.planned]), [['a', 1000, true], ['b', null, false], ['c', null, false]])
  assert.deepEqual(applyHeights(list, new Map()), { list, changed: 0 })
})
