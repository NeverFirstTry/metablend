// A tap on a peak or a route answers at once (UX review P5, owner: before launch): on a poor line both waited
// for the server before the screen changed (721 and 664 ms; the route's title after 2.0 s). Inside the Hiking tab
// the address now changes in the browser, and a route opened from the peak's list is taken from that list.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { hikeLinkClick } from './hike/nav.js'
import { keepRouteList, knownRouteList } from './route/list-cache.js'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')

// a click on an <a> inside <main>, with the browser's own pieces faked
function click({ href = '/hike?peak=ortler', inMain = true, button = 0, mods = {}, target = '', prevented = false, here = 'https://metablend.app/hike' } = {}) {
  const pushed = []
  globalThis.location = new URL(here)
  globalThis.window = { history: { pushState: (s, t, url) => pushed.push(url), replaceState: () => {} }, scrollTo: () => {} }
  const a = { href: new URL(href, here).href, target, closest: sel => (sel === 'main' ? (inMain ? {} : null) : null) }
  const e = { defaultPrevented: prevented, button, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...mods,
    target: { closest: sel => (sel === 'a[href]' ? a : null) }, preventDefault() { this.defaultPrevented = true } }
  hikeLinkClick(e)
  return { prevented: e.defaultPrevented, pushed }
}

test('a plain tap on a Hiking link changes the address in the browser, before the router asks the server', () => {
  assert.deepEqual(click(), { prevented: true, pushed: ['/hike?peak=ortler'] })
  assert.deepEqual(click({ href: '/hike?peak=grossglockner&route=osm-1' }).pushed, ['/hike?peak=grossglockner&route=osm-1'])
})

test('everything else is left to the browser and the router', () => {
  for (const [why, o] of [
    ['another page', { href: '/more' }], ['another site', { href: 'https://example.com/hike' }],
    ['the tab bar, outside the page', { inMain: false }], ['a new tab', { mods: { metaKey: true } }], ['ctrl', { mods: { ctrlKey: true } }],
    ['middle button', { button: 1 }], ['target=_blank', { target: '_blank' }], ['already handled', { prevented: true }],
    ['the address it is at', { href: '/hike?peak=ortler', here: 'https://metablend.app/hike?peak=ortler' }],
  ]) {
    const r = click(o)
    assert.equal(r.pushed.length, 0, why)
    if (why !== 'already handled') assert.equal(r.prevented, false, why)
  }
})

test('the route list is kept per peak while the app runs', () => {
  assert.equal(knownRouteList('/api/routes?x=1'), null)
  keepRouteList('/api/routes?x=1', [{ id: 7 }])
  assert.deepEqual(knownRouteList('/api/routes?x=1'), [{ id: 7 }])
})

test('a route opened from the list shows at once, title and all, without asking again', async () => {
  const { routesApiPath } = await import('./hike/params.js')
  const { default: RouteScreen } = await import('../app/components/hike/RouteScreen.jsx')
  const peak = { name: 'Großglockner', lat: 47.07455, lon: 12.69388, elev: 3798 }
  keepRouteList(routesApiPath(peak), [{ id: 14622955, name: 'Alter Kalser Weg 712', ref: '712', roundTrip: true, points: [[47.05, 12.68, 2801], [47.07, 12.69, 3798]] }])
  const html = render(h(RouteScreen, { routeId: 'osm-14622955', peak, lang: 'en', unit: 'C', onBack: () => {} }))
  assert.match(html, /Alter Kalser Weg 712/)
})

// source-match-ok: the listener and the router calls live in client components that need Next's router to render
test('the wiring: the Hiking tab listens, the list and the import open routes in the browser', () => {
  const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
  assert.match(read('app/components/hike/HikeApp.jsx'), /addEventListener\('click', hikeLinkClick, true\)/)
  assert.match(read('app/components/hike/RouteList.jsx'), /goHike\(/)
  assert.match(read('app/components/hike/RouteList.jsx'), /keepRouteList\(url, /)
  assert.match(read('app/components/hike/ImportGpx.jsx'), /goHike\(/)
})

// Fable's review: the kept route lists had no cap (PeakView keeps 30 forecasts), and without the router's push
// nothing scrolled a newly opened peak or route to its top.
test('the route lists kept are the last 30 peaks', () => {
  for (let i = 0; i < 35; i++) keepRouteList(`/api/routes?cap=${i}`, [{ id: i }])
  assert.equal(knownRouteList('/api/routes?cap=0'), null, 'the oldest went')
  assert.deepEqual(knownRouteList('/api/routes?cap=34'), [{ id: 34 }])
  keepRouteList('/api/routes?cap=5', [{ id: 5 }]) // read again: it is the newest now
  for (let i = 35; i < 40; i++) keepRouteList(`/api/routes?cap=${i}`, [{ id: i }])
  assert.deepEqual(knownRouteList('/api/routes?cap=5'), [{ id: 5 }])
})

test('a peak or route opened in the browser starts at its top; a replace (the way back) keeps the place', async () => {
  const { goHike } = await import('./hike/nav.js')
  const calls = []
  globalThis.window = { history: { pushState: () => calls.push('push'), replaceState: () => calls.push('replace') }, scrollTo: o => calls.push(['top', o.top]) }
  goHike('/hike?peak=ortler')
  assert.deepEqual(calls, ['push', ['top', 0]])
  calls.length = 0
  goHike('/hike', { replace: true })
  assert.deepEqual(calls, ['replace'])
})
