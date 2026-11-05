import test from 'node:test'
import assert from 'node:assert/strict'
import { trustedSources, regionName } from './trusted.js'

const src = (apiId, more = {}) => ({ apiId, displayName: apiId.toUpperCase(), temp: 5, ...more })

test('trustedSources: best first, each with its share among the sources that answered', () => {
  const rows = trustedSources([src('a'), src('b'), src('c')], { a: 0.1, b: 0.3, c: 0.1 })
  assert.deepEqual(rows, [
    { id: 'b', name: 'B', share: 60 },
    { id: 'a', name: 'A', share: 20 },
    { id: 'c', name: 'C', share: 20 },
  ])
})

test('trustedSources: sources that did not answer, our own blend and retired weights do not count', () => {
  const rows = trustedSources(
    [src('a'), src('down', { down: true }), src('metablend', { synthetic: true })],
    { a: 0.1, down: 0.5, metablend: 0.5, retired: 0.9 },
  )
  assert.deepEqual(rows, [{ id: 'a', name: 'A', share: 100 }])
})

test('trustedSources: at most five; nothing to show without weights', () => {
  const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  assert.equal(trustedSources(many.map(id => src(id)), Object.fromEntries(many.map(id => [id, 0.1]))).length, 5)
  assert.deepEqual(trustedSources([src('a')], {}), [])
  assert.deepEqual(trustedSources(undefined, undefined), [])
})

test('regionName: the translated name without its flag or globe', () => {
  assert.equal(regionName('en', 'europe'), 'Europe')
  assert.equal(regionName('en', 'north_america'), 'North America')
  assert.equal(regionName('en', 'nowhere'), 'Global')
})
