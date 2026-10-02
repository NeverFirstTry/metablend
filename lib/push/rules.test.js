import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cityEvents, decide, decideHike, decideHikeRoute, windowChanged, localParts } from './rules.js'

const VIE = 7200 // Vienna in summer time
const at = (hhmm, date = '2026-10-01', off = VIE) => Date.parse(`${date}T${hhmm}:00Z`) - off * 1000

// an outlook whose hourly items start at `start` (city-local), one per entry
function outlook({ start = '2026-10-01T13:00', off = VIE, hours = [], tempMax = 21, tempMin = 12, city = 'Vienna' } = {}) {
  const base = Date.parse(`${start}:00Z`)
  return {
    city, utcOffsetSec: off, nowLocal: start, sun: { sunrise: '07:00', sunset: '18:40' },
    hourly: hours.map((h, i) => ({ t: new Date(base + i * 3600e3).toISOString().slice(0, 16), temp: 15, rainPct: 0, windKmh: 10, code: 1, ...h })),
    days: [{ date: start.slice(0, 10), tempMax, tempMin }],
  }
}
const dry = n => Array.from({ length: n }, () => ({ rainPct: 5 }))
const ALL = { alert_rain: true, alert_storm: true, alert_severe: true, alert_heat: true, briefing: false, briefing_hour: 7 }

test('localParts — the city clock from its offset', () => {
  assert.deepEqual(localParts(at('13:05'), VIE), { date: '2026-10-01', hour: 13, iso: '2026-10-01T13:05' })
  assert.deepEqual(localParts(at('00:30', '2026-10-02', 36000), 36000), { date: '2026-10-02', hour: 0, iso: '2026-10-02T00:30' })
})

test('rain soon — first wet hour 30 min–2 h ahead after dry hours', () => {
  const o = outlook({ hours: [...dry(2), { rainPct: 80 }, { rainPct: 90 }] }) // 13, 14 dry · 15:00 wet
  assert.deepEqual(cityEvents(o, at('13:05')).rain, { from: '2026-10-01T15:00', pct: 80 })
  assert.deepEqual(cityEvents(o, at('14:05')).rain, { from: '2026-10-01T15:00', pct: 80 }) // lead 55 min
  assert.equal(cityEvents(o, at('14:35')).rain, null) // lead 25 min: too late to help
  assert.equal(cityEvents(outlook({ hours: [...dry(3), { rainPct: 80 }] }), at('13:05')).rain, null) // 16:00, lead 175 min
  assert.equal(cityEvents(outlook({ hours: [{ rainPct: 70 }, { rainPct: 80 }] }), at('13:05')).rain, null) // raining already
  assert.equal(cityEvents(outlook({ hours: [{ rainPct: 50 }, { rainPct: 45 }, { rainPct: 80 }] }), at('13:05')).rain, null) // no dry spell
  assert.equal(cityEvents(outlook({ hours: [...dry(2), { rainPct: 59 }] }), at('13:05')).rain, null)
})

test('thunderstorms — span of the storm hours, and they replace "rain soon"', () => {
  const o = outlook({ hours: [...dry(2), { rainPct: 80, code: 95 }, { rainPct: 85, code: 95 }, { rainPct: 40, code: 3 }] })
  const ev = cityEvents(o, at('13:05'))
  assert.deepEqual(ev.storm, { from: '2026-10-01T15:00', to: '2026-10-01T17:00' })
  assert.deepEqual(decide(ALL, ev, []).map(m => m.kind), ['storm']) // the storm message covers the rain
  // …but only for phones that get it: rain-only phones still hear about the rain
  assert.deepEqual(decide({ ...ALL, alert_storm: false }, ev, []).map(m => m.kind), ['rain'])
  // and a storm already announced for this spell still covers it
  const told = [{ kind: 'storm', ref: '2026-10-01T15:00', sent_at: at('12:05') }]
  assert.deepEqual(decide(ALL, ev, told), [])
})

test('severe — heavy rain / snow / freezing rain codes and strong wind, one per type', () => {
  const o = outlook({ hours: [...dry(4), { code: 65 }, { code: 82 }, { windKmh: 70 }] }) // 17:00, 18:00, 19:00
  assert.deepEqual(cityEvents(o, at('13:05')).severe, [
    { type: 'heavy_rain', from: '2026-10-01T17:00' },
    { type: 'wind', from: '2026-10-01T19:00' },
  ])
})

test('forecast hours with missing values never alert or crash', () => {
  const o = outlook({ hours: [{ rainPct: null, code: null, windKmh: null }, { rainPct: null }, { rainPct: null, code: undefined }] })
  const ev = cityEvents(o, at('13:05'))
  assert.equal(ev.rain, null); assert.equal(ev.storm, null); assert.deepEqual(ev.severe, [])
})

test('decide — switches, quiet hours (severe exempt) and priority under the cap', () => {
  const o = outlook({ start: '2026-10-01T23:00', hours: [{ rainPct: 5 }, { rainPct: 5 }, { rainPct: 90, code: 65 }] })
  const night = decide(ALL, cityEvents(o, at('23:05')), [])
  assert.deepEqual(night.map(m => m.kind), ['severe']) // rain suppressed at night, severe gets through
  assert.deepEqual(decide({ ...ALL, alert_severe: false }, cityEvents(o, at('23:05')), []), [])

  const day = outlook({ hours: [...dry(2), { rainPct: 80 }, { rainPct: 80 }, { code: 65 }], tempMax: 31 })
  const two = [{ kind: 'rain', ref: 'x', sent_at: at('08:00') }, { kind: 'heat', ref: 'y', sent_at: at('08:00') }]
  assert.deepEqual(decide(ALL, cityEvents(day, at('13:05')), two).map(m => m.kind), ['severe']) // one slot left
})

test('decide — the cap counts the city-local day, not the UTC one', () => {
  const o = outlook({ start: '2026-10-01T07:00', hours: [...dry(2), { rainPct: 80 }] })
  const lateYesterday = [1, 2, 3].map(i => ({ kind: 'storm', ref: `r${i}`, sent_at: at('23:30', '2026-09-30') }))
  assert.deepEqual(decide(ALL, cityEvents(o, at('07:05')), lateYesterday).map(m => m.kind), ['rain'])
})

test('decide — no second alert for the same rain spell or storm (late / double runs)', () => {
  const o = outlook({ hours: [...dry(2), { rainPct: 80 }] })
  const ev = cityEvents(o, at('13:05'))
  const sent = decide(ALL, ev, [])
  assert.deepEqual(sent.map(m => [m.kind, m.ref]), [['rain', '2026-10-01T15:00']])
  const log = sent.map(m => ({ ...m, sent_at: at('13:05') }))
  assert.deepEqual(decide(ALL, ev, log), []) // same run again
  const later = cityEvents(outlook({ start: '2026-10-01T14:00', hours: [{ rainPct: 5 }, { rainPct: 5 }, { rainPct: 5 }, { rainPct: 80 }] }), at('15:05'))
  assert.deepEqual(decide(ALL, later, log), []) // new onset 17:00 is < 3 h from 15:00
})

test('decide — heat on its own before noon, or folded into the briefing', () => {
  const o = outlook({ start: '2026-10-01T07:00', hours: dry(10), tempMax: 31 })
  assert.deepEqual(decide(ALL, cityEvents(o, at('07:05')), []).map(m => m.kind), ['heat'])
  assert.deepEqual(decide(ALL, cityEvents(o, at('12:05')), []), []) // too late in the day
  const withBrief = decide({ ...ALL, briefing: true, briefing_hour: 7 }, cityEvents(o, at('07:05')), [])
  assert.deepEqual(withBrief.map(m => m.kind), ['briefing'])
  assert.equal(withBrief[0].vars.heat, true)
  assert.equal(withBrief[0].vars.city, 'Vienna')
})

test('decide — the briefing at its hour, up to 2 h late, once a day, in any time zone', () => {
  const dev = { ...ALL, alert_heat: false, briefing: true, briefing_hour: 7 }
  for (const off of [VIE, 36000, -14400]) {
    const o = outlook({ start: '2026-10-01T07:00', off, hours: dry(12) })
    assert.deepEqual(decide(dev, cityEvents(o, at('07:05', '2026-10-01', off)), []).map(m => m.kind), ['briefing'])
    assert.deepEqual(decide(dev, cityEvents(o, at('09:05', '2026-10-01', off)), []).map(m => m.kind), ['briefing'])
    assert.deepEqual(decide(dev, cityEvents(o, at('10:05', '2026-10-01', off)), []), [])
    assert.deepEqual(decide(dev, cityEvents(o, at('06:05', '2026-10-01', off)), []), [])
    const log = [{ kind: 'briefing', ref: '2026-10-01', sent_at: at('07:05', '2026-10-01', off) }]
    assert.deepEqual(decide(dev, cityEvents(o, at('08:05', '2026-10-01', off)), log), [])
  }
})

test('windowChanged — ≥ 1 h either end, or the window appearing / disappearing', () => {
  const w = (from, to) => ({ window: { from: `2026-10-02T${from}`, to: `2026-10-02T${to}` } })
  assert.equal(windowChanged(w('07:00', '11:00'), w('07:30', '11:30')), false)
  assert.equal(windowChanged(w('07:00', '11:00'), w('08:00', '11:00')), true)
  assert.equal(windowChanged(w('07:00', '11:00'), { window: null }), true)
  assert.equal(windowChanged({ window: null }, { window: null }), false)
})

test('decideHike — evening before, then a morning update only if it changed', () => {
  const win = { window: { from: '2026-10-02T07:00', to: '2026-10-02T11:00', hours: 4 }, next: null }
  const hike = { utcOffsetSec: VIE, nowLocal: '2026-10-01T18:00', notes: [], windows: { today: null, tomorrow: win } }
  const plan = { date: '2026-10-02', sent_evening: false, sent_morning: false, last_window: null }
  const ev = decideHike(plan, hike, at('18:05'))
  assert.equal(ev.slot, 'evening'); assert.equal(ev.send, true); assert.equal(ev.window, win)
  assert.equal(decideHike(plan, hike, at('17:05')), null)
  assert.equal(decideHike(plan, hike, at('21:05')), null) // slot is 3 h old

  const morningHike = { ...hike, nowLocal: '2026-10-02T06:00', windows: { today: win, tomorrow: null } }
  const sentPlan = { ...plan, sent_evening: true, last_window: win }
  const same = decideHike(sentPlan, morningHike, at('06:05', '2026-10-02'))
  assert.equal(same.slot, 'morning'); assert.equal(same.send, false)
  const moved = { ...morningHike, windows: { today: { window: { from: '2026-10-02T09:00', to: '2026-10-02T12:00' } }, tomorrow: null } }
  assert.equal(decideHike(sentPlan, moved, at('06:05', '2026-10-02')).send, true)
  // planned too late for the evening slot: the morning run sends the window anyway
  const late = decideHike(plan, morningHike, at('06:05', '2026-10-02'))
  assert.equal(late.slot, 'morning'); assert.equal(late.send, true)
  assert.equal(decideHike(plan, null, at('18:05')), null)
})

test('decideHikeRoute — evening before with the start; morning only if it moved ≥ 30 min or turned unsafe', () => {
  const now = Date.parse('2026-10-02T17:00:00Z') // 19:00 at UTC+2
  const rw = { utcOffsetSec: 7200, suggestion: { start: '07:30', latest: '09:00', highAt: '10:45', finish: '14:10' } }
  const plan = { date: '2026-10-03', sent_evening: false, sent_morning: false }
  assert.deepEqual(decideHikeRoute(plan, rw, now), { slot: 'evening', send: true, window: { start: '07:30', latest: '09:00' }, todayLocal: '2026-10-02' })
  const morning = Date.parse('2026-10-03T05:00:00Z') // 07:00 local
  const sent = { date: '2026-10-03', sent_evening: true, sent_morning: false, last_window: { start: '07:30', latest: '09:00' } }
  assert.equal(decideHikeRoute(sent, { ...rw, suggestion: { ...rw.suggestion, start: '07:45' } }, morning).send, false)
  assert.equal(decideHikeRoute(sent, { ...rw, suggestion: { ...rw.suggestion, start: '08:15' } }, morning).send, true)
  assert.equal(decideHikeRoute(sent, { ...rw, suggestion: { none: true, reason: 'storms' } }, morning).send, true)
  assert.equal(decideHikeRoute(plan, null, now), null)
})
