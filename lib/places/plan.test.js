import { test } from 'node:test'
import assert from 'node:assert/strict'
import { REGIONS, missingRegions, toDelete, shrinkProblem, streamComplete, areasProblem, outlinesAgeDays } from './plan.js'

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

test('streamComplete — a pass counts only when the whole stream was read (a broken download can look like the end of a file), or pass 2 stopped at the first way on purpose', () => {
  assert.equal(streamComplete('named', 0, { nodes: 10, ways: 2 }), true)
  assert.equal(streamComplete('named', 18, { nodes: 10, ways: 2 }), false) // curl: transfer cut short
  assert.equal(streamComplete('way-nodes', null, { ways: 2, reached_ways: true }), true) // we stopped the download
  assert.equal(streamComplete('way-nodes', 23, { ways: 2, reached_ways: true }), true) // curl: nobody reading any more
  assert.equal(streamComplete('way-nodes', 56, { ways: 1, reached_ways: false }), false) // ended before the ways: nodes may be missing
  assert.equal(streamComplete('way-nodes', 0, { ways: 2, reached_ways: false }), true)
})

test('areasProblem — a build needs the country outlines, all of them OpenStreetMap\'s, with Western Sahara among them', () => {
  const fine = { release: '2026-10-21.0', areas: 273, newest: '2026-10-13T15:29:50Z', westernSahara: true, notFromOpenStreetMap: [], twice: [] }
  assert.equal(areasProblem(fine), null)
  assert.match(areasProblem(null), /boundaries\.py/)
  assert.match(areasProblem({ ...fine, areas: 40 }), /only 40 country outlines/)
  assert.match(areasProblem({ ...fine, westernSahara: false }), /Western Sahara is missing/)
  assert.match(areasProblem({ ...fine, notFromOpenStreetMap: ['ZZ'] }), /not OpenStreetMap's \(ZZ\)/)
})

test('outlinesAgeDays — a release is named by its date', () => {
  assert.equal(outlinesAgeDays('2026-10-21.0', Date.parse('2026-11-14T12:00:00Z')), 24)
  assert.equal(outlinesAgeDays('2026-10-21.0', Date.parse('2027-01-29T12:00:00Z')), 100)
})
