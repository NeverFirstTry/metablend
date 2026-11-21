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

test('buildHike — late on a summer afternoon, today’s window stays today (never across the night) and keeps 3 h for the descent', () => {
  const time = Array.from({ length: 72 }, (_, i) => new Date(Date.UTC(2026, 5, 20) + i * 3600e3).toISOString().slice(0, 16))
  const multi = {
    utc_offset_seconds: 7200, elevation: 2000,
    hourly: { time, temperature_2m_ecmwf_ifs025: time.map(() => 8), temperature_2m_gfs_seamless: time.map(() => 9), wind_speed_850hPa_ecmwf_ifs025: time.map(() => 10), wind_speed_700hPa_ecmwf_ifs025: time.map(() => 12), precipitation_probability_ecmwf_ifs025: time.map(() => 5) }, // wind and rain known: a missing value would (rightly) block the hour
    daily: { sunrise: ['2026-06-20T05:20'], sunset: ['2026-06-20T21:10'] },
  }
  const peak = { name: 'X', lat: 47, lon: 11, elev: 2000 }
  const at = hhmm => Date.parse(`2026-06-20T${hhmm}:00Z`) - 7200e3 // peak-local → UTC
  assert.deepEqual(buildHike({ peak, region: 'europe', multi, now: at('15:05') }).windows.today.window,
    { from: '2026-06-20T15:00', to: '2026-06-20T18:10', hours: 4 })
  assert.deepEqual(buildHike({ peak, region: 'europe', multi, now: at('18:05') }).windows.today, { window: null, next: { reason: 'dark', at: '2026-06-20T18:10' } })
  assert.equal(buildHike({ peak, region: 'europe', multi, now: at('22:05') }).windows.today, null)
})

test('buildHike — tomorrow’s window uses tomorrow’s sunrise and sunset, and closes 3 h before it sets', () => {
  const time = Array.from({ length: 48 }, (_, i) => new Date(Date.UTC(2026, 9, 24) + i * 3600e3).toISOString().slice(0, 16))
  const multi = {
    utc_offset_seconds: 0, elevation: 2000,
    hourly: { time, temperature_2m_ecmwf_ifs025: time.map(() => 1), temperature_2m_gfs_seamless: time.map(() => 2), wind_speed_850hPa_ecmwf_ifs025: time.map(() => 10), wind_speed_700hPa_ecmwf_ifs025: time.map(() => 12), precipitation_probability_ecmwf_ifs025: time.map(() => 5) }, // wind and rain known: a missing value would (rightly) block the hour
    daily: { time: ['2026-10-24', '2026-10-25'], sunrise: ['2026-10-24T06:00', '2026-10-25T07:30'], sunset: ['2026-10-24T18:00', '2026-10-25T17:00'] },
  }
  const p = buildHike({ peak: { name: 'X', lat: 47, lon: 11, elev: 2000 }, region: 'europe', multi, now: Date.UTC(2026, 9, 24, 8) })
  assert.deepEqual(p.windows.tomorrow.window, { from: '2026-10-25T08:00', to: '2026-10-25T14:00', hours: 6 })
})

test('buildHike — no upstream data: empty but well-formed, flagged', () => {
  const p = buildHike({ peak: GLOCKNER, region: 'europe', multi: null, now: Date.UTC(2026, 9, 1, 10) })
  assert.deepEqual([p.hourly.length, p.days.length], [0, 0])
  assert.deepEqual(p.windows, { today: null, tomorrow: null, days: [] })
  assert.deepEqual(p.notes, ['fewer_sources'])
})

test('buildHike — no model reports storm energy: flagged, the window still works', () => {
  const time = Array.from({ length: 48 }, (_, i) => new Date(Date.UTC(2026, 9, 1) + i * 3600e3).toISOString().slice(0, 16))
  const multi = {
    utc_offset_seconds: 0, elevation: 2000,
    hourly: { time, temperature_2m_ecmwf_ifs025: time.map(() => 1), temperature_2m_gfs_seamless: time.map(() => 2), wind_speed_850hPa_ecmwf_ifs025: time.map(() => 10), wind_speed_700hPa_ecmwf_ifs025: time.map(() => 12), precipitation_probability_ecmwf_ifs025: time.map(() => 5) }, // wind and rain known: a missing value would (rightly) block the hour
    daily: { sunrise: ['2026-10-01T06:00'], sunset: ['2026-10-01T18:00'] },
  }
  const p = buildHike({ peak: { name: 'X', lat: 47, lon: 11, elev: 2000 }, region: 'europe', multi, now: Date.UTC(2026, 9, 1, 8) })
  assert.deepEqual(p.notes, ['no_storm_data'])
  assert.equal(p.windows.today.window.from, '2026-10-01T08:00')
})

// ── the week's windows (2026-11-20) ──────────────────────────────────────────────────────────
// The Week tab of a peak asks "Saturday or Sunday?": windows.days holds the window of every day the
// forecast covers to its evening, under its date. A week of hours for a peak at 2,000 m: dry, light
// wind, sunrise 06:00, sunset 18:00; storm energy and rain as the test says.
const week = ({ hours = 192, cape = () => 0, rain = () => 5 } = {}) => {
  const time = Array.from({ length: hours }, (_, i) => new Date(Date.UTC(2026, 9, 1) + i * 3600e3).toISOString().slice(0, 16))
  const dates = [...new Set(time.map(t => t.slice(0, 10)))]
  return {
    utc_offset_seconds: 0, elevation: 2000,
    hourly: { time, temperature_2m_ecmwf_ifs025: time.map(() => 1), temperature_2m_gfs_seamless: time.map(() => 2), wind_speed_850hPa_ecmwf_ifs025: time.map(() => 10), wind_speed_700hPa_ecmwf_ifs025: time.map(() => 12), precipitation_probability_ecmwf_ifs025: time.map(rain), cape_ecmwf_ifs025: time.map(cape) },
    daily: { time: dates, sunrise: dates.map(d => `${d}T06:00`), sunset: dates.map(d => `${d}T18:00`) },
  }
}
const X = { name: 'X', lat: 47, lon: 11, elev: 2000 }
const at8 = Date.UTC(2026, 9, 1, 8)

test('buildHike — every day of the week has its window under its date; today\'s and tomorrow\'s are the answers the two tabs already get', () => {
  const p = buildHike({ peak: X, region: 'europe', multi: week(), now: at8 })
  assert.deepEqual(p.windows.days.map(d => d.date), ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'])
  assert.deepEqual(p.windows.days.map(d => d.date), p.days.map(d => d.date))
  assert.deepEqual(p.windows.days[0].w, p.windows.today)
  assert.deepEqual(p.windows.days[1].w, p.windows.tomorrow)
  assert.deepEqual(p.windows.days[4].w.window, { from: '2026-10-05T06:00', to: '2026-10-05T15:00', hours: 9 }) // closes 3 h before sunset, like any day
})

test('buildHike — a last day whose hours stop before its evening keeps its row and gets no window: a cut-off forecast is not a verdict', () => {
  const p = buildHike({ peak: X, region: 'europe', multi: week({ hours: 24 * 3 + 13 }), now: at8 })
  assert.equal(p.days.at(-1).date, '2026-10-04')
  assert.equal(p.days.at(-1).partial, true)
  assert.deepEqual(p.windows.days.map(d => d.date), ['2026-10-01', '2026-10-02', '2026-10-03'])
})

test('buildHike — a window judged without a storm value says so for its own day (the whole answer is not flagged)', () => {
  const p = buildHike({ peak: X, region: 'europe', multi: week({ cape: t => (t < '2026-10-05' ? 0 : null) }), now: at8 })
  assert.deepEqual(p.notes, [])
  assert.deepEqual(p.windows.days.map(d => d.stormUnknown), [false, false, false, false, true, true, true])
})

test('buildHike — each window says how many models stand behind its thinnest hour; a day without a window has its reason and no count', () => {
  const p = buildHike({ peak: X, region: 'europe', multi: week({ rain: t => (t.startsWith('2026-10-03') ? 90 : 5) }), now: at8 })
  assert.equal(p.windows.days[2].w.window, null)
  assert.equal(p.windows.days[2].w.next.reason, 'rain')
  assert.deepEqual(p.windows.days.map(d => d.n), [2, 2, null, 2, 2, 2, 2])
  assert.equal(p.windows.days[2].stormUnknown, false)
})
