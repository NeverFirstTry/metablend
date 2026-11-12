import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { shapeDiff, FORECAST_SHAPE, SUMMIT_SHAPE } from './shape.mjs'

// The recording the layout check compares its two live answers with (CI on main went red on 2026-11-12 when
// heavy rain in Vienna switched the forecast's warning on: "its shape differs from the recording (.warning.type is new)")
const answers = JSON.parse(readFileSync(new URL('../layout-fixtures.json', import.meta.url), 'utf8')).answers
const recorded = start => answers[Object.keys(answers).find(k => k.startsWith(start))].body

test('weather is no change of shape: a warning that is on, an answer from the cache, a kept summit answer', () => {
  const city = recorded('GET /api/forecast?city=vienna&lang=en')
  for (const type of ['heavy_rain', 'thunderstorm']) {
    const live = { ...city, warning: { active: true, type }, cached: true }
    assert.deepEqual(shapeDiff(city, live, FORECAST_SHAPE), [])
    assert.deepEqual(shapeDiff(live, city, FORECAST_SHAPE), [], 'recorded on a rainy day, checked on a dry one')
    // what CI reported, without the option
    assert.deepEqual(shapeDiff(city, live, { ...FORECAST_SHAPE, optional: ['.cached'] }), ['.warning.type is new'])
  }
  const summit = recorded('GET /api/hike?')
  assert.deepEqual(shapeDiff(summit, { ...summit, kept: '2026-11-12T20:00:00.000Z' }, SUMMIT_SHAPE), [])
  // a changed API still counts, next to the weather
  assert.deepEqual(shapeDiff(city, { ...city, warning: { on: true, type: 'heavy_rain' } }, FORECAST_SHAPE), ['.warning.active is gone', '.warning.on is new'])
  const { hourly, ...without } = summit
  assert.ok(hourly.length > 0)
  assert.deepEqual(shapeDiff(summit, { ...without, kept: 'x' }, SUMMIT_SHAPE).slice(0, 1), ['.hourly is gone'])
})

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
