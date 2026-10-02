import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recordVisit, backAction } from './nav.js'

const walk = hrefs => { const trail = []; hrefs.forEach(h => recordVisit(trail, h)); return trail }

test('backAction — list → peak → All peaks goes back in history (no extra step)', () => {
  const trail = walk(['/hike', '/hike?peak=grossglockner'])
  assert.equal(backAction(trail, '/hike'), 'back')
  assert.deepEqual(trail, ['/hike'])
})

test('backAction — a peak opened from a notification or link goes straight to the list', () => {
  const trail = walk(['/hike?peak=grossglockner'])
  assert.equal(backAction(trail, '/hike'), 'replace')
  assert.deepEqual(trail, [])
})

test('backAction — peak → route → back returns to that peak; a route from My routes to the list', () => {
  const p = '/hike?lat=47.07&lon=12.69&elev=3798&name=Gro%C3%9Fglockner'
  assert.equal(backAction(walk(['/hike', p, `${p}&route=osm-14622955`]), p), 'back')
  assert.equal(backAction(walk(['/hike', '/hike?route=gpx-1']), '/hike'), 'back')
  assert.equal(backAction(walk(['/hike', '/hike?route=gpx-1']), p), 'replace')
})

test('recordVisit — a re-render of the same screen is one visit; the phone back button is a visit too', () => {
  const trail = walk(['/hike', '/hike', '/hike?peak=a', '/hike', '/hike?peak=b'])
  assert.deepEqual(trail, ['/hike', '/hike?peak=a', '/hike', '/hike?peak=b'])
  assert.equal(backAction(trail, '/hike'), 'back')
})
