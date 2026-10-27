import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRouteBody, parseHeightsBody } from './validate.js'

const TODAY = '2026-10-02'
const body = patch => ({ points: [[47, 12, 1000], [47.01, 12.01, null]], date: '2026-10-03', ...patch })

test('parseRouteBody — a good body, defaults filled', () => {
  assert.deepEqual(parseRouteBody(body(), TODAY), { ok: true, value: {
    points: [{ lat: 47, lon: 12, ele: 1000 }, { lat: 47.01, lon: 12.01, ele: null }], date: '2026-10-03', pace: 'normal', start: null, roundTrip: false,
  } })
  assert.equal(parseRouteBody(body({ pace: 'fast', start: '07:45', roundTrip: true }), TODAY).value.start, '07:45')
})

test('parseRouteBody — rejects what the engine cannot use', () => {
  for (const bad of [null, {}, body({ points: [[47, 12]] }), body({ points: Array(501).fill([47, 12, 1]) }), body({ points: [[91, 12, 1], [47, 12, 1]] }),
    body({ date: '2026-10-20' }), body({ date: 'tomorrow' }), body({ pace: 'toString' }), body({ start: '25:00' }), body({ start: '7:45' })]) {
    assert.equal(parseRouteBody(bad, TODAY).ok, false, JSON.stringify(bad)?.slice(0, 60))
  }
})

test('parseHeightsBody — the points of a saved route to fill with heights', () => {
  assert.deepEqual(parseHeightsBody({ points: [[47, 12, null], [47.01, 12.01, 1200]] }), { ok: true, value: { points: [{ lat: 47, lon: 12, ele: null }, { lat: 47.01, lon: 12.01, ele: 1200 }] } })
  for (const bad of [null, {}, { points: [[47, 12]] }, { points: Array(501).fill([47, 12, 1]) }, { points: [[47, 'x', 1], [47, 12, 1]] }]) {
    assert.equal(parseHeightsBody(bad).ok, false, JSON.stringify(bad)?.slice(0, 60))
  }
})
