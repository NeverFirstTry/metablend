// lib/places/areas.js: a position's country from outlines, point in polygon.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { areaIndex, areaCode, countryLookup, LINE_M } from './areas.js'

const square = (w, s, e, n) => [[[w, s], [e, s], [e, n], [w, n], [w, s]]]
const poly = (...rings) => ({ type: 'Polygon', coordinates: rings.flat() })
const M = 1 / 110540 // one metre in degrees of latitude

test('areaIndex: inside and outside, a hole, several parts, a slanted edge across many bands of latitude', () => {
  const a = areaIndex(poly(square(10, 46, 12, 48)))
  assert.equal(a.holds(11, 47), true)
  assert.equal(a.holds(9.9, 47), false)
  assert.equal(a.holds(11, 48.1), false)
  const holed = areaIndex({ type: 'Polygon', coordinates: [square(10, 46, 12, 48)[0], square(10.5, 46.5, 11.5, 47.5)[0]] })
  assert.equal(holed.holds(11, 47), false, 'in the hole')
  assert.equal(holed.holds(10.2, 46.2), true)
  const parts = areaIndex({ type: 'MultiPolygon', coordinates: [square(10, 46, 11, 47), square(20, 50, 21, 51)] })
  assert.equal(parts.holds(20.5, 50.5), true)
  assert.equal(parts.holds(15, 48), false, 'between the parts')
  const tri = areaIndex(poly([[[0, 0], [10, 0], [0, 10], [0, 0]]]))
  assert.equal(tri.holds(2, 2), true)
  assert.equal(tri.holds(6, 6), false, 'beyond the slanted edge')
  assert.equal(areaIndex({ type: 'Polygon', coordinates: [] }).holds(0, 0), false)
})

test('areaIndex: within a metre of the line counts, either side; five metres off does not', () => {
  const a = areaIndex(poly(square(10, 46, 12, 48)))
  assert.equal(LINE_M, 1)
  assert.equal(a.holds(11, 48 + 0.5 * M), true, 'half a metre outside the northern edge')
  assert.equal(a.holds(11, 48 + 5 * M), false)
  assert.equal(a.holds(12, 47), true, 'on the eastern edge itself')
  assert.equal(a.holds(10 - 5 * M, 47), false)
})

test('areaCode: the file\'s own codes, as the owner decided', () => {
  assert.equal(areaCode('AT'), 'AT')
  assert.equal(areaCode('EH'), 'EH')
  assert.deepEqual(['XK', 'XW', 'XG', 'XE', 'XS', 'XJ'].map(areaCode), ['XK', 'PS', 'PS', 'BQ', 'BQ', 'SJ'])
  for (const disputed of ['XH', 'XI', 'XU', 'XO', 'XA', 'XD', 'XC', 'XL', 'XQ', 'XX', 'XT', 'XZ', 'XB', 'XM', 'XN', 'XP', 'XR', 'XY']) assert.equal(areaCode(disputed), null, disputed)
})

test('countryLookup: the smallest outline that holds the position; a summit on a border line goes to the smaller country; a disputed area gives no country', () => {
  const where = countryLookup([
    { cc: 'AA', area: 9, geometry: poly(square(0, 0, 3, 3)) },                // a big country
    { cc: 'BB', area: 4, geometry: poly(square(3, 0, 5, 2)) },                // its smaller neighbour to the east
    { cc: 'EH', area: 1, geometry: poly(square(0, 0, 1, 1)) },                // a territory inside the big one
    { cc: 'XH', area: 0.25, geometry: poly(square(5, 0, 5.5, 0.5)) },         // disputed, in no country's outline
    { cc: 'XW', area: 0.25, geometry: poly(square(6, 0, 6.5, 0.5)) },         // the file's code for a part of PS
  ])
  assert.deepEqual(where(2, 2), { country: 'AA', disputed: false, inArea: true })
  assert.deepEqual(where(0.5, 0.5), { country: 'EH', disputed: false, inArea: true }, 'the territory before the state around it')
  assert.deepEqual(where(3, 1), { country: 'BB', disputed: false, inArea: true }, 'on the line between AA and BB: the smaller')
  assert.deepEqual(where(3 - 0.4 * M, 1), { country: 'BB', disputed: false, inArea: true }, 'forty centimetres on AA\'s side is still the line')
  assert.deepEqual(where(3 - 20 * M, 1), { country: 'AA', disputed: false, inArea: true })
  assert.deepEqual(where(5.2, 0.2), { country: null, disputed: true, inArea: true })
  assert.deepEqual(where(6.2, 0.2), { country: 'PS', disputed: false, inArea: true })
  assert.deepEqual(where(40, 40), { country: null, disputed: false, inArea: false })
})
