import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tabOf, tabHref, retapScrollsUp } from './app-tabs.js'

test('tabOf — which app tab a page belongs to', () => {
  assert.equal(tabOf('/'), '/')
  assert.equal(tabOf('/hike'), '/hike')
  assert.equal(tabOf('/hike'), '/hike')
  assert.equal(tabOf('/more'), '/more')
  assert.equal(tabOf('/privacy'), null) // reached from More, but not a tab of its own
})

test('tabHref — back to a tab brings back where you were in it; tapping the open tab goes to its start', () => {
  const last = { '/hike': '/hike?peak=grossglockner&route=osm-1', '/': '/?city=Lienz' }
  assert.equal(tabHref('/hike', last, '/'), '/hike?peak=grossglockner&route=osm-1')
  assert.equal(tabHref('/', last, '/hike'), '/?city=Lienz')
  assert.equal(tabHref('/more', last, '/'), '/more') // never visited
  assert.equal(tabHref('/hike', last, '/hike'), '/hike') // already there: to the peak list
})

test('rememberTabUrl — only tabs whose state is in the URL are remembered (Hiking)', async () => {
  const { rememberTabUrl, lastTabUrls } = await import('./app-tabs.js')
  rememberTabUrl('/hike', '/hike?peak=ortler')
  rememberTabUrl('/', '/?city=Lienz') // the Forecast tab restores itself from memory, not from an old URL
  assert.deepEqual(lastTabUrls(), { '/hike': '/hike?peak=ortler' })
})

test('retapScrollsUp — tapping the tab you are on, at its start, scrolls up instead of navigating (an open peak or page goes back to the start)', () => {
  assert.equal(retapScrollsUp('/', '/', { pathname: '/', search: '' }), true)
  assert.equal(retapScrollsUp('/', '/', { pathname: '/', search: '?city=Lienz' }), true) // the forecast on screen is the start
  assert.equal(retapScrollsUp('/hike', '/hike', { pathname: '/hike', search: '' }), true)
  assert.equal(retapScrollsUp('/hike', '/hike', { pathname: '/hike', search: '?peak=grossglockner' }), false) // to the peak list
  assert.equal(retapScrollsUp('/more', '/more', { pathname: '/more', search: '' }), true)
  assert.equal(retapScrollsUp('/hike', '/', { pathname: '/', search: '' }), false) // another tab: go there
})
