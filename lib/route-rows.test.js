// My routes (UX review G2, owner: before launch): a row was only a name. Its second line now carries the route
// screen's own figures, worked out on the phone (no request per row).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { rowLine } from './route/row.js'
import { walkStats } from './route/heights.js'

const up = [[47.05, 12.68, 2801], [47.055, 12.685, 3000], [47.06, 12.69, 3200], [47.067, 12.692, 3500], [47.074, 12.694, 3798]]
const osm = { id: 'osm-1', name: 'Alter Kalser Weg', source: 'osm', roundTrip: true, points: up }

test('the line has the route screen\'s distance and ascent for the same route', () => {
  const s = walkStats(up.map(([lat, lon, ele]) => ({ lat, lon, ele })), 'normal', { roundTrip: true })
  assert.equal(rowLine('en', osm), `${s.distanceKm} km · ↑≈${s.ascentM} m · there and back`)
})

test('a GPX with its own heights has no ≈; one way has no "there and back"; German words', () => {
  const gpx = { id: 'gpx-1', name: 'Mine', source: 'gpx', roundTrip: false, points: up }
  assert.match(rowLine('en', gpx), /^\d+(\.\d)? km · ↑\d+ m$/)
  assert.match(rowLine('de', osm), / · hin und zurück$/)
})

test('without heights only the distance, as on the route screen; a broken entry gives no line', () => {
  const flat = { id: 'gpx-2', name: 'Flat', source: 'gpx', points: up.map(([lat, lon]) => [lat, lon, null]) }
  assert.match(rowLine('en', flat), /^\d+(\.\d)? km$/)
  assert.equal(rowLine('en', { id: 'x', name: 'x', points: [] }), null)
  assert.equal(rowLine('en', { id: 'x', name: 'x' }), null)
})

// source-match-ok: My routes reads the phone's storage in an effect, which a static render never runs
test('My routes shows the line under each name', () => {
  const src = readFileSync(new URL('../app/components/hike/MyRoutes.jsx', import.meta.url), 'utf8')
  assert.match(src, /rowLine\(lang, r\)/)
})
