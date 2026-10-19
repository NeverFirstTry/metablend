import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { lookupWarnings } from './lookup.js'

const regionData = JSON.parse(fs.readFileSync(new URL('./regions.json', import.meta.url), 'utf8'))
const w = (id, extra = {}) => ({ id, level: 3, type: 'wind', onset: '2026-10-20T10:00:00+02:00', expires: '2026-10-20T20:00:00+02:00', ...extra })

test('lookupWarnings — a region-code country: its regions, covered even with no warning on', async () => {
  const calls = []
  const r = await lookupWarnings(48.2082, 16.3738, 'AT', { regionData, inRegions: async ids => { calls.push(ids); return [w('a')] }, atPoint: async () => { throw new Error('not asked') } })
  assert.equal(r.covered, true)
  assert.deepEqual(r.warnings.map(x => x.id), ['a'])
  assert.ok(calls[0].every(id => id.startsWith('AT')))
})

test('lookupWarnings — an outline country: the warnings whose outline holds the spot; covered with none', async () => {
  const r = await lookupWarnings(59.33, 18.07, 'SE', { regionData, inRegions: async () => [], atPoint: async () => [w('s')] })
  assert.equal(r.covered, true)
  assert.deepEqual(r.warnings.map(x => x.id), ['s'])
  const quiet = await lookupWarnings(59.33, 18.07, 'SE', { regionData, inRegions: async () => [], atPoint: async () => [] })
  assert.deepEqual(quiet, { covered: true, warnings: [] })
})

test('lookupWarnings — no country known: outlines still count when one holds the spot; a broken outline lookup never breaks the rest', async () => {
  const found = await lookupWarnings(59.33, 18.07, null, { regionData, inRegions: async () => [], atPoint: async () => [w('s')] })
  assert.deepEqual(found, { covered: true, warnings: [found.warnings[0]] })
  const none = await lookupWarnings(59.33, 18.07, null, { regionData, inRegions: async () => [], atPoint: async () => [] })
  assert.equal(none.covered, false)
  const broken = await lookupWarnings(48.2082, 16.3738, 'AT', { regionData, inRegions: async () => [w('a')], atPoint: async () => { throw new Error('column missing') } })
  assert.deepEqual(broken.warnings.map(x => x.id), ['a'])
  const notCovered = await lookupWarnings(47.37, 8.54, 'CH', { regionData, inRegions: async () => [w('x')], atPoint: async () => [w('y')] })
  assert.deepEqual(notCovered, { covered: false, warnings: [] })
})

test('lookupWarnings — a warning found both ways comes once', async () => {
  const r = await lookupWarnings(48.2082, 16.3738, null, { regionData, inRegions: async () => [w('a')], atPoint: async () => [w('a'), w('b')] })
  assert.deepEqual(r.warnings.map(x => x.id).sort(), ['a', 'b'])
})
