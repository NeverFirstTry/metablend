import test from 'node:test'
import assert from 'node:assert/strict'
import { shapeDiff } from './shape.mjs'

const forecast = { city: 'Vienna', consensus: { temp: 7.3, rainPct: 2 }, sources: [{ id: 'icon', temp: 7.1 }, { id: 'gfs', temp: 7.6 }], warning: null, notes: [] }

test('the same shape with other values is no difference', () => {
  assert.deepEqual(shapeDiff(forecast, { ...forecast, city: 'Wien', consensus: { temp: -2, rainPct: 80 }, sources: [{ id: 'ecmwf', temp: -1.5 }] }), [])
})

test('a renamed key is a difference, both ways', () => {
  const live = { ...forecast, consensus: { temperature: 7.3, rainPct: 2 } }
  assert.deepEqual(shapeDiff(forecast, live), ['.consensus.temp is gone', '.consensus.temperature is new'])
})

test('a renamed key inside the list items is a difference', () => {
  const live = { ...forecast, sources: [{ source: 'icon', temp: 7.1 }] }
  assert.deepEqual(shapeDiff(forecast, live), ['.sources[].id is gone', '.sources[].source is new'])
})

test('a value that changed type is a difference', () => {
  assert.deepEqual(shapeDiff(forecast, { ...forecast, consensus: { temp: '7.3', rainPct: 2 } }), ['.consensus.temp was number, now string'])
})

test('a map keyed by data is compared by its values, an optional key may come and go', () => {
  const recorded = { weights: { icon: 1.2, gfs: 0.8 }, temp: 7 }
  const opts = { maps: ['.weights'], optional: ['.cached'] }
  // other sources, and the cached flag of an answer from the route's own cache: the same shape
  assert.deepEqual(shapeDiff(recorded, { weights: { ecmwf: 1.1 }, temp: 6, cached: true }, opts), [])
  // without the options both are differences
  assert.deepEqual(shapeDiff(recorded, { weights: { ecmwf: 1.1 }, temp: 6, cached: true }), ['.weights.icon is gone', '.weights.gfs is gone', '.weights.ecmwf is new', '.cached is new'])
  // a map's values that changed type, and a rename next to the optional key, still count
  assert.deepEqual(shapeDiff(recorded, { weights: { icon: '1.2' }, temperature: 7, cached: true }, opts), ['.temp is gone', '.temperature is new', '.weights.* was number, now string'])
})

test('below a null or an empty list nothing is compared', () => {
  const live = { ...forecast, warning: { level: 3, text: 'Sturm' }, notes: [{ text: 'Neuschnee' }] }
  assert.deepEqual(shapeDiff(forecast, live), [])
  assert.deepEqual(shapeDiff(live, forecast), [])
  // a value that is null today is no type change
  assert.deepEqual(shapeDiff(forecast, { ...forecast, consensus: { temp: null, rainPct: 2 } }), [])
})
