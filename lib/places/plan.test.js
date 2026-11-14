import { test } from 'node:test'
import assert from 'node:assert/strict'
import { REGIONS, missingRegions, toDelete, shrinkProblem, streamComplete, areasProblem, countriesOf, areasQuery, areasAnswer } from './plan.js'

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

test('areasProblem — a build needs the country areas asked to the end, or every summit is filed by its nearest town again', () => {
  assert.equal(areasProblem({ finished: true, countries: 245, failed: [], ids: 1 }), null)
  assert.match(areasProblem(null), /countries\.mjs/)
  assert.match(areasProblem({ countries: 245 }), /not asked to the end/)
})

test('countriesOf — the countries with a boundary in OpenStreetMap, each with its relations (a territory can have several)', () => {
  const answer = { elements: [
    { type: 'relation', id: 16239, tags: { 'ISO3166-1': 'AT' } },
    { type: 'relation', id: 2202162, tags: { 'ISO3166-1': 'FR' } },
    { type: 'relation', id: 9, tags: { 'ISO3166-1': 'RE' } }, { type: 'relation', id: 7, tags: { 'ISO3166-1': 'RE' } },
    { type: 'relation', id: 5, tags: { 'ISO3166-1': 'at' } }, { type: 'relation', id: 6, tags: {} },
  ] }
  assert.deepEqual(countriesOf(answer), [{ cc: 'AT', relations: [16239] }, { cc: 'FR', relations: [2202162] }, { cc: 'RE', relations: [7, 9] }])
  assert.equal(countriesOf({ elements: [], remark: 'runtime error: Query timed out' }), null)
  assert.equal(countriesOf(null), null)
})

test('areasQuery and areasAnswer — several countries in one question, each list under its own name; a cut-short or stale answer is none', () => {
  const ql = areasQuery([{ cc: 'AT', relations: [16239] }, { cc: 'RE', relations: [7, 9] }])
  assert.match(ql, /area\(3600016239\);\)->\.a;make country cc="AT";out;/)
  assert.match(ql, /\(area\(3600000007\);area\(3600000009\);\)->\.a;make country cc="RE"/)
  assert.match(ql, /nw\(area\.a\)\[tourism=alpine_hut\]/)
  const now = Date.parse('2026-11-14T08:00:00Z')
  const fresh = { timestamp_osm_base: '2026-11-14T07:58:51Z' }
  const elements = [
    { type: 'country', id: 1, tags: { cc: 'AT' } }, { type: 'node', id: 26865139 }, { type: 'way', id: 45 }, { type: 'relation', id: 3 },
    { type: 'country', id: 2, tags: { cc: 'LI' } },
    { type: 'country', id: 3, tags: { cc: 'IT' } }, { type: 'node', id: 256042799 },
  ]
  assert.deepEqual(areasAnswer({ osm3s: fresh, elements }, { now }), { AT: ['N26865139', 'W45'], LI: [], IT: ['N256042799'] })
  assert.equal(areasAnswer({ osm3s: fresh, elements, remark: 'runtime error: Query run out of memory' }, { now }), null)
  assert.equal(areasAnswer({ osm3s: { timestamp_osm_base: '2026-07-15T15:22:01Z' }, elements }, { now }), null) // a mirror four months behind
  assert.equal(areasAnswer({ elements }, { now }), null) // no date at all
})
