import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summitWindow, blocker, windChill, descentReserve } from './window.js'

const H = (hh, o = {}) => ({ t: `2026-10-02T${hh}:00`, storm: 'low', rainPct: 10, windKmh: 20, feels: -5, ...o })
const SUN = { sunrise: '06:50', sunset: '18:40' }
const HOURS = ['05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19']

test('summitWindow — the longest good daylight run and what ends it', () => {
  const hours = HOURS.map(hh => H(hh, hh === '09' ? { windKmh: 45 } : hh >= '14' && hh <= '16' ? { storm: 'high' } : {}))
  const r = summitWindow(hours, SUN)
  assert.deepEqual(r.window, { from: '2026-10-02T10:00', to: '2026-10-02T14:00', hours: 4 })
  assert.deepEqual(r.next, { reason: 'storms', at: '2026-10-02T14:00' })
})

test('summitWindow — no good hour: no window, and the first reason', () => {
  const r = summitWindow(['08', '09', '10'].map(hh => H(hh, { rainPct: 80 })), SUN)
  assert.equal(r.window, null)
  assert.deepEqual(r.next, { reason: 'rain', at: '2026-10-02T08:00' })
})

test('summitWindow — fine all day: nothing ends it; after dark: null', () => {
  assert.deepEqual(summitWindow(['08', '09', '10'].map(hh => H(hh)), SUN), {
    window: { from: '2026-10-02T08:00', to: '2026-10-02T11:00', hours: 3 }, next: null,
  })
  assert.equal(summitWindow([H('20'), H('21'), H('22')], SUN), null)
  assert.equal(summitWindow([], SUN), null)
})

test('summitWindow — never ends after sunset', () => {
  const r = summitWindow(['16', '17', '18'].map(hh => H(hh)), { sunrise: '06:50', sunset: '18:40' })
  assert.deepEqual(r.window, { from: '2026-10-02T16:00', to: '2026-10-02T18:40', hours: 3 })
})

test('blocker — storms beat rain beat wind beat cold; unknown storm risk does not block', () => {
  assert.equal(blocker(H('10', { storm: 'moderate', rainPct: 90 })), 'storms')
  assert.equal(blocker(H('10', { rainPct: 30, windKmh: 60 })), 'rain')
  assert.equal(blocker(H('10', { windKmh: 40, feels: -30 })), 'wind')
  assert.equal(blocker(H('10', { feels: -20 })), 'cold')
  assert.equal(blocker(H('10', { storm: null })), null)
})

test('windChill — the Environment Canada / NWS formula; air temperature when warm or calm', () => {
  assert.equal(Math.round(windChill(-14, 35) * 10) / 10, -25.5) // the Großglockner afternoon
  assert.equal(windChill(5, 3), 5)
  assert.equal(windChill(12, 30), 12)
  assert.equal(windChill(null, 30), null)
})

test('blocker — cold counts summit wind: −14° in 35 km/h is −25°, though the models’ own feels-like says −18°', () => {
  assert.equal(blocker(H('10', { temp: -14, windKmh: 35, feels: -18 })), 'cold')
  assert.equal(blocker(H('10', { temp: -9, windKmh: 35, feels: -15 })), null) // −19°
})

test('summitWindow — closes the descent reserve before sunset, and says why', () => {
  const r = summitWindow(HOURS.map(hh => H(hh)), SUN, { reserveH: 3 })
  assert.deepEqual(r.window, { from: '2026-10-02T07:00', to: '2026-10-02T15:40', hours: 9 })
  assert.deepEqual(r.next, { reason: 'dark', at: '2026-10-02T15:40' })
})

test('summitWindow — after the cut-off nothing is left today, however fine the weather', () => {
  const r = summitWindow(['16', '17', '18'].map(hh => H(hh)), SUN, { reserveH: 3 })
  assert.equal(r.window, null)
  assert.deepEqual(r.next, { reason: 'dark', at: '2026-10-02T15:40' })
})

test('summitWindow — a window under an hour is no window', () => {
  const r = summitWindow(['13', '14', '15'].map(hh => H(hh, hh < '15' ? { rainPct: 60 } : {})), SUN, { reserveH: 3 })
  assert.equal(r.window, null) // 15:00–15:40: only the close can cut a run that short, so the close is the reason
  assert.deepEqual(r.next, { reason: 'dark', at: '2026-10-02T15:40' })
})

test('descentReserve — 4 h on alpine grades and from 3,000 m, else 3 h', () => {
  assert.equal(descentReserve({ grade: 'WS', elev: 2500 }), 4)
  assert.equal(descentReserve({ elev: 3200 }), 4)
  assert.equal(descentReserve({ grade: 'T2', elev: 2246 }), 3)
  assert.equal(descentReserve({}), 3)
})
