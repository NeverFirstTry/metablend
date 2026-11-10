// An outlook answer is kept up to two and a half hours (the CDN's copy, 2026-11-10). Read later than it
// was built, atNow() must give what building at the later moment gives from the same forecast: the
// hours from now on, today's days, the same headlines and best time. The recorded Vienna answer is
// built at one hour and read at another.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildOutlook } from './build.js'
import { atNow } from './at-now.js'

const multi = JSON.parse(readFileSync(new URL('./__fixtures__/om-multi-vienna.json', import.meta.url)))
const VIENNA = { name: 'Vienna', country: 'Austria', lat: 48.21, lon: 16.37 }
// the moment `min` minutes into the recording's hour `i` (its hours are local, from midnight of day 1)
const at = (i, min = 20) => Date.parse(`${multi.hourly.time[i]}:00Z`) - multi.utc_offset_seconds * 1000 + min * 60e3
// two earlier years of the same weeks, so the days have normals
const climate = (() => {
  const time = [], mx = [], mn = [], pr = []
  for (const y of [2023, 2024]) for (let d = -10; d <= 10; d++) {
    time.push(new Date(Date.parse(`${y}${multi.daily.time[0].slice(4)}T00:00Z`) + d * 864e5).toISOString().slice(0, 10)); mx.push(15); mn.push(5); pr.push(d % 4 === 0 ? 3 : 0)
  }
  return { daily: { time, temperature_2m_max: mx, temperature_2m_min: mn, precipitation_sum: pr } }
})()
const build = now => buildOutlook({ geo: VIENNA, region: 'europe', multi, climate, now }).payload

test('atNow — read two hours after it was built: the hours start now, and headlines and best time are those of a fresh build', () => {
  const built = build(at(9)), later = atNow(built, at(11, 5)), fresh = build(at(11, 5))
  assert.equal(built.hourly[0].t, multi.hourly.time[9])
  assert.equal(later.nowLocal, fresh.nowLocal)
  assert.equal(later.hourly[0].t, multi.hourly.time[11], 'no hour before now is left')
  assert.deepEqual(later.hourly, fresh.hourly.slice(0, later.hourly.length))
  assert.deepEqual(later.headlines, fresh.headlines)
  assert.deepEqual(later.bestTime, fresh.bestTime)
  assert.deepEqual(later.days, fresh.days)
  assert.deepEqual(later.normals, fresh.normals)
  assert.deepEqual(later.vsNormal, fresh.vsNormal)
  assert.deepEqual(later.rainyDays, fresh.rainyDays)
  assert.equal(later.generatedAt, built.generatedAt, 'the age shown stays the data\'s own')
  assert.deepEqual(built.hourly[0].t, multi.hourly.time[9], 'the answer handed in is not changed')
})

test('atNow — read past midnight: today is the new day, yesterday is gone from the days and the normals', () => {
  const built = build(at(23)), later = atNow(built, at(25)), fresh = build(at(25))
  assert.equal(built.days[0].date, multi.daily.time[0])
  assert.equal(later.nowLocal.slice(0, 10), multi.daily.time[1])
  assert.equal(later.hourly[0].t, multi.hourly.time[25])
  assert.deepEqual(later.days.map(d => d.date), built.days.slice(1).map(d => d.date))
  assert.deepEqual(later.days, fresh.days.slice(0, later.days.length))
  assert.deepEqual(later.normals.map(n => n.date), later.days.map(d => d.date))
  assert.deepEqual(later.headlines.today, fresh.headlines.today)
  assert.deepEqual(later.headlines.tomorrow, fresh.headlines.tomorrow)
  assert.deepEqual(later.bestTime, fresh.bestTime)
  assert.deepEqual(later.rainyDays, { forecast: later.days.filter(d => d.rainPct >= 50).length, of: later.days.length, normal: null })
})

test('atNow — in the hour it was built, or by a clock that runs behind, the answer comes back as it is', () => {
  const built = build(at(9))
  assert.equal(atNow(built, at(9, 55)), built)
  assert.equal(atNow(built, at(7)), built)
})

test('atNow — a clock days ahead is not believed: the answer is read as six hours old, never emptied', () => {
  const built = build(at(9)), later = atNow(built, at(9) + 3 * 864e5)
  assert.equal(later.hourly[0].t, multi.hourly.time[15])
  assert.ok(later.hourly.length > 24)
})

test('atNow — what is not an outlook answer passes through', () => {
  assert.equal(atNow(null), null)
  const error = { error: 'not found' }
  assert.equal(atNow(error), error)
})
