import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { regionsAt, regionsFor } from './regions.js'

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

test('regionsFor — with the place\'s country: its own regions only, else its nearest land region within 10 km', () => {
  const cc = (lat, lon, c) => [...new Set(regionsFor(data, lat, lon, c).map(r => r.slice(0, 2)))]
  const land = (lat, lon, c) => regionsFor(data, lat, lon, c).filter(r => !/^[A-Z]{2}8\d\d$/.test(r))
  assert.deepEqual(cc(48.5726, 7.8153, 'DE'), ['DE']) // Kehl (the coarse outline puts it in Bas-Rhin)
  assert.deepEqual(cc(47.6603, 9.1758, 'DE'), ['DE']) // Konstanz, on the lake shore
  assert.deepEqual(cc(45.9409, 13.6217, 'IT'), ['IT']) // Gorizia (also inside Slovenia's outline)
  assert.deepEqual(cc(49.7497, 18.6326, 'PL'), ['PL']) // Cieszyn
  assert.deepEqual(cc(48.2082, 16.3738, 'at'), ['AT']) // Vienna, any case
  assert.equal(land(36.5271, -6.2886, 'ES').length, 1) // Cádiz: only a sea zone's outline — plus the land region next to it
  assert.ok(regionsFor(data, 36.5271, -6.2886, 'ES').includes('ES852')) // …and the sea zone stays
  // countries whose feeds don't use region codes our map has: not covered (yet)
  assert.deepEqual(regionsFor(data, 48.8566, 2.3522, 'FR'), []) // Paris: NUTS codes
  assert.deepEqual(regionsFor(data, 65.8355, 24.1368, 'SE'), []) // Haparanda: Sweden sends its own outlines — and not Finland's region next door
  assert.deepEqual(regionsFor(data, 49.7461, 18.6261, 'CZ'), []) // Český Těšín
  assert.deepEqual(regionsFor(data, 53.3498, -6.2603, 'IE'), []) // Dublin: FIPS codes
  assert.deepEqual(regionsFor(data, 47.5596, 7.5886, 'CH'), []) // Basel: Switzerland isn't covered
  assert.deepEqual(regionsFor(data, 43.7384, 7.4246, 'MC'), []) // Monaco: not covered, though inside France's outline
  assert.deepEqual(regionsFor(data, 40, -30, 'PT'), []) // far out at sea
  assert.deepEqual(regionsFor(data, 45.9409, 13.6217, null), ['IT020']) // no country known: the covered countries' regions there
  assert.deepEqual(regionsFor(data, 48.8566, 2.3522, null), []) // Paris, no country known
})
