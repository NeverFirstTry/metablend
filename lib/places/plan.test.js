import { test } from 'node:test'
import assert from 'node:assert/strict'
import { REGIONS, missingRegions, toDelete, shrinkProblem } from './plan.js'

test('missingRegions — a build needs every region\'s lines; a broken extract run must not become a world without Europe', () => {
  assert.deepEqual(missingRegions(REGIONS.map(r => `${r}.ndjson`)), [])
  assert.deepEqual(missingRegions(['africa.ndjson', 'asia.ndjson', 'europe.ndjson.part']), REGIONS.filter(r => r !== 'africa' && r !== 'asia'))
  assert.deepEqual(missingRegions([]), REGIONS)
})

test('toDelete — the rows we have that the new data no longer has', () => {
  assert.deepEqual(toDelete(['osm-N1', 'osm-N2', 'osm-W3'], new Set(['osm-N2', 'osm-N9'])), ['osm-N1', 'osm-W3'])
  assert.deepEqual(toDelete([1, 2], new Set([1, 2, 3])), [])
})

test('shrinkProblem — deleting more than a tenth of a table stops the load, unless asked for', () => {
  assert.equal(shrinkProblem({ table: 'summits', current: 568000, deleting: 30000 }), null)
  assert.match(shrinkProblem({ table: 'summits', current: 568000, deleting: 300000 }), /summits: 300000 of 568000 rows .* --allow-shrink/)
  assert.equal(shrinkProblem({ table: 'summits', current: 568000, deleting: 300000, allowShrink: true }), null)
  assert.equal(shrinkProblem({ table: 'towns', current: 0, deleting: 0 }), null) // the first load
})
