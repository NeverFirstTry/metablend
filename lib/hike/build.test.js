import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildHike } from './build.js'

const fx = name => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)))
const GLOCKNER = { name: 'Großglockner', lat: 47.0745, lon: 12.6945, elev: 3798 }

test('buildHike — the recorded Großglockner response becomes summit hours, days and windows', () => {
  const multi = fx('om-summit-glockner.json')
  const now = Date.parse(`${multi.hourly.time[30]}:00Z`) - multi.utc_offset_seconds * 1000 + 10 * 60e3 // day 2, 06:10 local
  const p = buildHike({ peak: GLOCKNER, region: 'europe', multi, now })
  assert.deepEqual(p.peak, GLOCKNER)
  assert.equal(p.hourly[0].t, multi.hourly.time[30])
  assert.ok(p.sources.length >= 5)
  assert.ok(p.hourly.every(h => typeof h.temp === 'number'))
  assert.ok(p.hourly.some(h => typeof h.windKmh === 'number'))
  assert.ok(p.hourly.some(h => typeof h.freezingLevel === 'number'))
  assert.ok(p.hourly.some(h => h.storm !== null))
  assert.ok(p.days.length >= 2)
  assert.ok('window' in p.windows.today)
  assert.ok('window' in p.windows.tomorrow)
})

test('buildHike — no upstream data: empty but well-formed, flagged', () => {
  const p = buildHike({ peak: GLOCKNER, region: 'europe', multi: null, now: Date.UTC(2026, 9, 1, 10) })
  assert.deepEqual([p.hourly.length, p.days.length], [0, 0])
  assert.deepEqual(p.windows, { today: null, tomorrow: null })
  assert.deepEqual(p.notes, ['fewer_sources'])
})

test('buildHike — no model reports storm energy: flagged, the window still works', () => {
  const time = Array.from({ length: 48 }, (_, i) => new Date(Date.UTC(2026, 9, 1) + i * 3600e3).toISOString().slice(0, 16))
  const multi = {
    utc_offset_seconds: 0, elevation: 2000,
    hourly: { time, temperature_2m_ecmwf_ifs025: time.map(() => 1), temperature_2m_gfs_seamless: time.map(() => 2) },
    daily: { sunrise: ['2026-10-01T06:00'], sunset: ['2026-10-01T18:00'] },
  }
  const p = buildHike({ peak: { name: 'X', lat: 47, lon: 11, elev: 2000 }, region: 'europe', multi, now: Date.UTC(2026, 9, 1, 8) })
  assert.deepEqual(p.notes, ['no_storm_data'])
  assert.equal(p.windows.today.window.from, '2026-10-01T08:00')
})
