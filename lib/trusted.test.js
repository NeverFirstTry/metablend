import test from 'node:test'
import assert from 'node:assert/strict'
import { trustedSources, regionName } from './trusted.js'

const src = (apiId, more = {}) => ({ apiId, displayName: apiId.toUpperCase(), temp: 5, ...more })

test('trustedSources: ties in weight are broken by the recent average, best first, with no share to read as a ranking', () => {
  const rows = trustedSources([src('a'), src('b'), src('c')], { a: 0.04, b: 0.04, c: 0.04 }, { a: 1.3, b: 1.56, c: 1.4 })
  assert.deepEqual(rows, [
    { id: 'b', name: 'B', bar: 100 },
    { id: 'c', name: 'C', bar: 90 },
    { id: 'a', name: 'A', bar: 83 },
  ])
})

test('trustedSources: the recent average decides even when the weights differ', () => {
  const rows = trustedSources([src('a'), src('b')], { a: 0.02, b: 0.04 }, { a: 1.5, b: 1.2 })
  assert.deepEqual(rows.map(r => r.id), ['a', 'b'])
})

test('trustedSources: sources that did not answer, our own blend and retired sources do not count', () => {
  const rows = trustedSources(
    [src('a'), src('down', { down: true }), src('metablend', { synthetic: true })],
    { a: 0.1, down: 0.5, metablend: 0.5, retired: 0.9 },
    { a: 1, down: 2, metablend: 2, retired: 2 },
  )
  assert.deepEqual(rows.map(r => r.id), ['a'])
})

test('trustedSources: a source doing badly has an empty bar, never a negative one', () => {
  const rows = trustedSources([src('a'), src('b')], { a: 0.1, b: 0.1 }, { a: 1, b: -0.5 })
  assert.deepEqual(rows.map(r => r.bar), [100, 0])
})

test('trustedSources: an older forecast without recent averages falls back to the weights', () => {
  const rows = trustedSources([src('a'), src('b')], { a: 0.02, b: 0.04 })
  assert.deepEqual(rows, [{ id: 'b', name: 'B', bar: 100 }, { id: 'a', name: 'A', bar: 50 }])
})

test('trustedSources: at most five; nothing to show without data', () => {
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
