import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { routeWeather, forecastUrl } from './weather.js'
import { addDays } from '../localtime.js'

const om = JSON.parse(fs.readFileSync(new URL('./__fixtures__/om-route-3pt.json', import.meta.url), 'utf8'))
const day0 = om[0].hourly.time[0].slice(0, 10)
const NOW = Date.parse(`${day0}T06:00:00Z`) - om[0].utc_offset_seconds * 1000 // 06:00 local, first recorded day
const DATE = addDays(day0, 1)
const PTS = [{ lat: 47.0172, lon: 12.6913, ele: 1920 }, { lat: 47.0603, lon: 12.6779, ele: 2802 }, { lat: 47.0745, lon: 12.6941, ele: 3798 }]
// answers with as many locations as the URL asks for (cycling the recorded three)
const getJson = async url => Array.from({ length: new URL(url).searchParams.get('latitude').split(',').length }, (_, k) => om[k % 3])
const getElevations = async pts => pts.map(() => 2000)
const REASONS = ['storms', 'rain', 'wind', 'cold', 'daylight', 'nodata']

test('routeWeather — three stages, a verdict consistent with them', async () => {
  const r = await routeWeather({ points: PTS, date: DATE, pace: 'normal', now: NOW }, { getJson, getElevations })
  assert.equal(r.stages.length, 3)
  assert.equal(r.todayLocal, day0)
  assert.ok(r.stats.distanceKm > 5 && r.stats.ascentM === 1878)
  assert.ok(r.stages.every(s => /^\d\d:\d\d$/.test(s.eta)))
  assert.equal(r.stages.filter(s => s.high).length, 1)
  if (r.suggestion.none) assert.ok(REASONS.includes(r.suggestion.reason))
  else assert.ok(r.stages.every(s => s.blocker === null), 'a suggested start has no blocked stage')
})

test('routeWeather — my own start time is used for the stages', async () => {
  const r = await routeWeather({ points: PTS, date: DATE, start: '09:15', now: NOW }, { getJson, getElevations })
  assert.equal(r.start, '09:15')
  assert.equal(r.stages[0].eta, '09:15')
})

test('routeWeather — missing elevations are filled; there and back doubles the way', async () => {
  const asked = []
  const r = await routeWeather({ points: PTS.map(p => ({ ...p, ele: null })), date: DATE, roundTrip: true, now: NOW },
    { getJson, getElevations: async pts => { asked.push(pts.length); return pts.map((_, i) => 1500 + i * 500) } })
  assert.deepEqual(asked, [3])
  assert.equal(r.points.length, 5)
  assert.ok(r.points.every(p => typeof p[2] === 'number'))
})

test('routeWeather — the weather request fails or comes back short: null', async () => {
  assert.equal(await routeWeather({ points: PTS, date: DATE, now: NOW }, { getJson: async () => null, getElevations }), null)
  assert.equal(await routeWeather({ points: PTS, date: DATE, now: NOW }, { getJson: async () => [om[0]], getElevations }), null)
})

test('forecastUrl — one multi-point request with per-point elevations and the core models', () => {
  const u = new URL(forecastUrl(PTS))
  assert.equal(u.searchParams.get('latitude'), '47.0172,47.0603,47.0745')
  assert.equal(u.searchParams.get('elevation'), '1920,2802,3798')
  assert.equal(u.searchParams.get('models'), 'ecmwf_ifs025,icon_seamless,gfs_seamless')
})

test('routeWeather — no heights at all: no walking time, no start window, no stage times; it says why', async () => {
  const r = await routeWeather({ points: PTS.map(p => ({ ...p, ele: null })), date: DATE, now: NOW }, { getJson, getElevations: async () => null, wait: async () => {} })
  assert.equal(r.noHeights, true)
  assert.equal(r.stats.minutes, null)
  assert.equal(r.stats.ascentM, null)
  assert.deepEqual(r.suggestion, { none: true, reason: 'heights' })
  assert.deepEqual(r.stages, [])
  assert.equal(typeof r.utcOffsetSec, 'number') // planned-hike alerts still know the local time
})

test('routeWeather — heights it had to fill from the terrain model are reported (shown as approximate)', async () => {
  const filled = await routeWeather({ points: PTS.map(p => ({ ...p, ele: null })), date: DATE, now: NOW }, { getJson, getElevations })
  assert.equal(filled.filledHeights, true)
  const own = await routeWeather({ points: PTS, date: DATE, now: NOW }, { getJson, getElevations })
  assert.equal(own.filledHeights, false)
})

test('routeWeather — a multi-day route (like Lemosho, ~47 h): no single start window, no stage times as one walk; it says why', async () => {
  const far = [{ lat: 47.0, lon: 12.69, ele: 800 }, { lat: 47.3, lon: 12.69, ele: 3000 }, { lat: 47.6, lon: 12.69, ele: 3798 }]
  const r = await routeWeather({ points: far, date: DATE, now: NOW }, { getJson, getElevations })
  assert.equal(r.multiDay, true)
  assert.ok(r.stats.minutes > 12 * 60, String(r.stats.minutes))
  assert.ok(r.stats.ascentM > 2500)
  assert.deepEqual(r.suggestion, { none: true, reason: 'multiday' })
  assert.deepEqual(r.stages, [])
  assert.equal(r.start, null)
  assert.equal(typeof r.utcOffsetSec, 'number') // planned-hike alerts still know the local time
})
