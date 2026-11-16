import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isWet, nearestStations, indexMetars, pickObs, observationAt, observedDay, scoreHourly, scoreDaily, scoreCheck, dueItems, nextDueAt } from './verify.js'

test('isWet — precipitation at the station, not vicinity / obscuration / blowing snow', () => {
  for (const wx of ['RA', '-SHRA BR', '+TSRA', 'FZDZ', 'SN', '-RASN']) assert.equal(isWet(wx), true, wx)
  for (const wx of ['VCSH', 'BR', 'FG HZ', 'BLSN', 'TS', '', null]) assert.equal(isWet(wx), false, String(wx))
})

const AIRPORTS = {
  LOWW: { la: 48.11, lo: 16.57, t: 'l' },
  XXXX: { la: 48.30, lo: 16.40, t: 'm' },
  LOAN: { la: 47.84, lo: 16.22, t: 's' },
  LZIB: { la: 48.17, lo: 17.21, t: 'l' }, // ~62 km — just outside
  LOWL: { la: 48.23, lo: 14.19, t: 'm' },
}

test('nearestStations — large/medium airports within 60 km, nearest first; nothing in range → []', () => {
  assert.deepEqual(nearestStations(48.21, 16.37, AIRPORTS), ['XXXX', 'LOWW'])
  assert.deepEqual(nearestStations(0, 0, AIRPORTS), [])
})

test('indexMetars — per station, oldest first, reports without a temperature skipped', () => {
  const idx = indexMetars([
    { icaoId: 'LOWW', obsTime: 1790690400, temp: 12, wxString: '-RA' },
    { icaoId: 'LOWW', obsTime: 1790688600, temp: 11, wxString: null },
    { icaoId: 'LOWW', obsTime: 1790692200, temp: null },
    { icaoId: 'EDDM', reportTime: '2026-09-29T12:20:00Z', temp: 9 },
  ])
  assert.deepEqual(idx.get('LOWW').map(o => [o.temp, o.wet]), [[11, false], [12, true]])
  assert.equal(idx.get('EDDM')[0].tMs, Date.parse('2026-09-29T12:20:00Z'))
  assert.deepEqual(pickObs(idx, ['NONE', 'EDDM']), idx.get('EDDM'))
  assert.equal(pickObs(idx, ['NONE']), null)
})

const series = (startIso, n, stepMin, fn) =>
  Array.from({ length: n }, (_, i) => ({ tMs: Date.parse(startIso) + i * stepMin * 60e3, ...fn(i) }))

test('observationAt — nearest report within ±30 min', () => {
  const obs = series('2026-09-29T00:20:00Z', 5, 60, i => ({ temp: 10 + i, wet: i === 2 }))
  assert.deepEqual(observationAt(obs, Date.parse('2026-09-29T02:00:00Z')), { temp: 12, wet: true })
  assert.equal(observationAt(obs, Date.parse('2026-09-29T08:00:00Z')), null)
})

test('observedDay — max/min/wet over the local day, needs ≥ 18 reports', () => {
  const start = Date.parse('2026-09-28T22:00:00Z') // local midnight at UTC+2
  const obs = series('2026-09-28T22:20:00Z', 24, 60, i => ({ temp: i === 13 ? 21 : i === 4 ? 6 : 12, wet: i === 20 }))
  assert.deepEqual(observedDay(obs, start), { max: 21, min: 6, wet: true, n: 24 })
  assert.equal(observedDay(obs.slice(0, 10), start), null)
})

test('scoreHourly / scoreDaily — temperature deltas by range, rain from the Brier score', () => {
  assert.deepEqual(scoreHourly({ temp: 11, rain: 0.9 }, { temp: 12, wet: true }, 'h48'), [2, 2])
  assert.deepEqual(scoreHourly({ temp: 18, rain: null }, { temp: 12, wet: false }, 'h48'), [-1])
  assert.equal(scoreHourly({ temp: 18 }, null, 'h48'), null)
  assert.deepEqual(scoreDaily({ max: 20, min: 9, rain: 0 }, { max: 23, min: 9.5, wet: true }, 'd7'), [1, 2, -2])
})

test('scoreCheck — the nearest airport that has what the check needs: a field that reports only by day is passed over for a day’s check', () => {
  const start = Date.parse('2026-11-14T00:00:00Z')
  const reports = (n, temp) => Array.from({ length: n }, (_, i) => ({ tMs: start + i * 864e5 / n, temp: temp + (i % 2), wet: false }))
  // Rome on 2026-11-16: Urbe sent 9 to 12 reports a day, Ciampino 48
  const index = new Map([['LIRU', reports(10, 14)], ['LIRA', reports(48, 12)]])
  const day = { cp: { key: 'd1', max: 13, min: 12 }, startMs: start }
  assert.deepEqual(scoreCheck('d', day, index, ['LIRU', 'LIRA'], 'd3'), scoreDaily(day.cp, observedDay(index.get('LIRA'), start), 'd3'))
  assert.ok(scoreCheck('d', day, index, ['LIRU', 'LIRA'], 'd3'), 'the day is scored from the second airport')
  assert.equal(scoreCheck('d', day, index, ['LIRU'], 'd3'), null, 'ten reports are not a day')
  // an hour's check needs one report near its time: the nearer field has one, so it is used
  const hour = { cp: { key: 'h6', temp: 14, rain: 0 }, targetMs: start }
  assert.deepEqual(scoreCheck('h', hour, index, ['LIRU', 'LIRA'], 'h48'), scoreHourly(hour.cp, observationAt(index.get('LIRU'), start), 'h48'))
  assert.equal(scoreCheck('h', hour, index, ['XXXX'], 'h48'), null, 'an airport that sent nothing')
  assert.equal(scoreCheck('h', hour, index, [], 'h48'), null)
})

test('dueItems — only checkpoints whose time has come; beyond the METAR window they are stale', () => {
  const row = {
    kind: 'h', utc_offset_sec: 7200, verified: { h6: 'scored' },
    checkpoints: [{ key: 'h6', t: '2026-09-29T20:00:00.000Z' }, { key: 'h12', t: '2026-09-30T02:00:00.000Z' }, { key: 'h24', t: '2026-09-30T14:00:00.000Z' }],
  }
  assert.deepEqual(dueItems(row, Date.parse('2026-09-30T05:00:00Z')).map(i => [i.cp.key, i.stale]), [['h12', false]])
  assert.deepEqual(dueItems(row, Date.parse('2026-10-03T13:00:00Z')).map(i => [i.cp.key, i.stale]), [['h12', true], ['h24', true]])
})

test('dueItems — a daily checkpoint waits for the local day (+ grace) to end', () => {
  const row = { kind: 'd', utc_offset_sec: 7200, verified: {}, checkpoints: [{ key: 'd1', date: '2026-09-30' }] }
  // local day = 2026-09-29T22:00Z … 2026-09-30T22:00Z, + 2 h grace
  assert.equal(dueItems(row, Date.parse('2026-09-30T23:30:00Z')).length, 0)
  assert.equal(dueItems(row, Date.parse('2026-10-01T00:30:00Z')).length, 1)
})

test('nextDueAt — earliest unverified checkpoint, null when all are done', () => {
  const row = { kind: 'h', utc_offset_sec: 0, verified: {}, checkpoints: [{ key: 'h6', t: '2026-09-29T20:00:00.000Z' }, { key: 'h12', t: '2026-09-30T02:00:00.000Z' }] }
  assert.equal(nextDueAt(row), '2026-09-29T22:00:00.000Z')
  assert.equal(nextDueAt(row, { h6: 'scored' }), '2026-09-30T04:00:00.000Z')
  assert.equal(nextDueAt(row, { h6: 'scored', h12: 'expired' }), null)
})
