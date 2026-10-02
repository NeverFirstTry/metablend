import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hhmm, toMin, hourAt, stagesAt, suggestStart } from './verdict.js'

const DAY = '2026-10-03', SUN = { sunrise: '07:00', sunset: '19:00' }
const OK = { storm: 'low', rainPct: 0, windKmh: 10, feels: 5 }
const day = (patch = () => ({})) => Array.from({ length: 24 }, (_, h) => ({ t: `${DAY}T${String(h).padStart(2, '0')}:00`, ...OK, ...patch(h) }))
const OFFSETS = [0, 60, 120, 180] // a 3-hour walk, four stages

test('hhmm / toMin / hourAt — rounding and the next day past midnight', () => {
  assert.equal(hhmm(59.6), '01:00')
  assert.equal(hhmm(450), '07:30')
  assert.equal(toMin('07:30'), 450)
  assert.equal(toMin('7:30'), null)
  assert.equal(hourAt([{ t: '2026-10-04T01:00' }], DAY, 1500).t, '2026-10-04T01:00')
})

test('suggestStart — a safe day: first light to the last start that ends by sunset', () => {
  const all = [day(), day(), day(), day()]
  assert.deepEqual(suggestStart({ hoursByStage: all, offsets: OFFSETS, date: DAY, sun: SUN }), { start: '07:00', latest: '16:00', startMinute: 420 })
})

test('suggestStart — storms from 11:00: start early enough to be down before', () => {
  const storms = [0, 1, 2, 3].map(() => day(h => (h >= 11 ? { storm: 'high' } : {})))
  const s = suggestStart({ hoursByStage: storms, offsets: OFFSETS, date: DAY, sun: SUN })
  assert.equal(s.start, '07:00')
  assert.equal(s.latest, '07:45')
})

test('suggestStart — no safe start: the reason and the first bad stage', () => {
  const allDay = [0, 1, 2, 3].map(() => day(() => ({ storm: 'high' })))
  assert.deepEqual(suggestStart({ hoursByStage: allDay, offsets: OFFSETS, date: DAY, sun: SUN }), { none: true, reason: 'storms', firstBad: { i: 0, eta: '07:00' } })
  const windyTop = [day(), day(), day(() => ({ windKmh: 60 })), day()]
  const w = suggestStart({ hoursByStage: windyTop, offsets: OFFSETS, date: DAY, sun: SUN })
  assert.equal(w.reason, 'wind')
  assert.equal(w.firstBad.i, 2)
})

test('suggestStart — never before now; longer than the daylight; no forecast', () => {
  const all = [day(), day(), day(), day()]
  assert.equal(suggestStart({ hoursByStage: all, offsets: OFFSETS, date: DAY, sun: SUN, notBefore: 600 }).start, '10:00')
  assert.deepEqual(suggestStart({ hoursByStage: [day(), day()], offsets: [0, 800], date: DAY, sun: SUN }), { none: true, reason: 'daylight', firstBad: null })
  assert.equal(suggestStart({ hoursByStage: [[], [], [], []], offsets: OFFSETS, date: DAY, sun: SUN }).reason, 'nodata')
})

test('stagesAt — arrival time and blocker per stage', () => {
  const st = stagesAt({ hoursByStage: [day(), day(() => ({ rainPct: 80 }))], offsets: [0, 90], date: DAY, start: 480 })
  assert.deepEqual(st.map(s => [s.eta, s.blocker]), [['08:00', null], ['09:30', 'rain']])
})

test('suggestStart — too late today when the walk would fit the day but not what is left of it', () => {
  const all = [day(), day(), day(), day()]
  assert.deepEqual(suggestStart({ hoursByStage: all, offsets: OFFSETS, date: DAY, sun: SUN, notBefore: 17 * 60 }), { none: true, reason: 'late', firstBad: null })
})
