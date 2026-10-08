import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { refreshAll } from './refresh.js'

const germany = JSON.parse(fs.readFileSync(new URL('./__fixtures__/feed-germany.json', import.meta.url), 'utf8'))
const NOW = Math.min(...germany.warnings.map(w => Date.parse(w.alert.sent)))

test('refreshAll — every feed parsed and saved under its country', async () => {
  const saved = []
  const summary = await refreshAll({
    feeds: [['germany', 'DE'], ['austria', 'AT']],
    fetchFeed: async slug => (slug === 'germany' ? germany : { warnings: [] }),
    save: async (country, rows, at) => { saved.push([country, rows.length, at]) },
    now: NOW,
  })
  assert.deepEqual(saved.map(s => s[0]).sort(), ['AT', 'DE'])
  assert.ok(saved.find(s => s[0] === 'DE')[1] > 0)
  assert.equal(saved.find(s => s[0] === 'AT')[1], 0) // an empty feed clears that country
  assert.ok(saved.every(s => s[2] === NOW))
  assert.deepEqual(summary.failed, [])
  assert.equal(summary.countries, 2)
})

test('refreshAll — a failed feed keeps that country\'s rows (no save) and the rest still refresh', async () => {
  const saved = []
  const summary = await refreshAll({
    feeds: [['germany', 'DE'], ['spain', 'ES'], ['italy', 'IT']],
    fetchFeed: async slug => (slug === 'spain' ? null : slug === 'italy' ? Promise.reject(new Error('timeout')) : germany),
    save: async country => { saved.push(country) },
    now: NOW,
  })
  assert.deepEqual(saved, ['DE'])
  assert.deepEqual(summary.failed.map(f => f[0]).sort(), ['ES', 'IT'])
})

test('refreshAll — a failing save counts as failed, never throws', async () => {
  const summary = await refreshAll({
    feeds: [['germany', 'DE']], fetchFeed: async () => germany,
    save: async () => { throw new Error('db down') }, now: NOW,
  })
  assert.deepEqual(summary.failed, [['DE', 'db down']])
})

test('refreshAll — an answer without a warnings list (maintenance page) counts as failed and keeps the rows', async () => {
  const saved = []
  const summary = await refreshAll({
    feeds: [['spain', 'ES'], ['germany', 'DE']],
    fetchFeed: async slug => (slug === 'spain' ? { message: 'Service under maintenance' } : germany),
    save: async country => { saved.push(country) },
    now: NOW,
  })
  assert.deepEqual(saved, ['DE'])
  assert.deepEqual(summary.failed.map(f => f[0]), ['ES'])
})
