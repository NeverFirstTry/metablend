import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { regionsAt } from './regions.js'

const data = JSON.parse(fs.readFileSync(new URL('./regions.json', import.meta.url), 'utf8'))
const country = (lat, lon) => [...new Set(regionsAt(data, lat, lon).map(c => c.slice(0, 2)))]

test('regionsAt — cities land in their own country\'s regions', () => {
  assert.deepEqual(country(48.2082, 16.3738), ['AT']) // Vienna
  assert.deepEqual(country(47.2692, 11.4041), ['AT']) // Innsbruck
  assert.deepEqual(country(46.8289, 12.7695), ['AT']) // Lienz
  assert.deepEqual(country(52.52, 13.405), ['DE']) // Berlin
  assert.deepEqual(country(40.4168, -3.7038), ['ES']) // Madrid
  assert.deepEqual(country(48.8566, 2.3522), ['FR']) // Paris
})

test('regionsAt — border cities match only their own country', () => {
  assert.deepEqual(country(47.8095, 13.055), ['AT']) // Salzburg, ~5 km from Germany
  assert.deepEqual(country(47.5833, 12.1667), ['AT']) // Kufstein
  assert.deepEqual(country(48.5734, 7.7521), ['FR']) // Strasbourg, on the Rhine
})

test('regionsAt — the sea, junk and uncovered countries match nothing', () => {
  assert.deepEqual(regionsAt(data, 40, -30), []) // mid-Atlantic
  assert.deepEqual(regionsAt(data, 47.3769, 8.5417), []) // Zurich: no Swiss outlines
  assert.deepEqual(regionsAt(data, Number.NaN, 10), [])
})

test('regionsAt — holes and multi-part regions', () => {
  const ring = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]
  const toy = { v: 1, regions: [
    { c: 'XX001', b: [0, 0, 10, 10], p: [[ring(0, 0, 10, 10), ring(4, 4, 6, 6)]] }, // a square with a hole
    { c: 'XX002', b: [20, 0, 32, 2], p: [[ring(20, 0, 22, 2)], [ring(30, 0, 32, 2)]] }, // two islands
  ] }
  assert.deepEqual(regionsAt(toy, 1, 1), ['XX001'])
  assert.deepEqual(regionsAt(toy, 5, 5), []) // in the hole
  assert.deepEqual(regionsAt(toy, 1, 31), ['XX002'])
  assert.deepEqual(regionsAt(toy, 1, 26), []) // between the islands
})

test('regions.json — small enough to ship, every region usable', () => {
  assert.ok(fs.statSync(new URL('./regions.json', import.meta.url)).size <= 2.5 * 1024 * 1024)
  assert.ok(data.regions.length > 1900)
  for (const r of data.regions) {
    assert.match(r.c, /^[A-Z]{2}[A-Z0-9]+$/, r.c)
    assert.ok(r.p.length > 0 && r.p.every(poly => poly[0].length >= 4), r.c)
  }
})
