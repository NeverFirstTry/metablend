// The route screen (UX review 2026-11-20, O2 to O5; owner: before launch): the map's credit under the map
// instead of over a fifth of it; a flagged row says why, with the icon that matches; Save and Plan beside the
// title instead of after the whole table; and Plan for the day already picked instead of asking again.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { default: RouteMap } = await import('../app/components/hike/RouteMap.jsx')
const { default: RouteView } = await import('../app/components/hike/RouteView.jsx')
const { default: PlanHike } = await import('../app/components/hike/PlanHike.jsx')
const { stageFlag } = await import('./route/flag.js')
const en = (await import('./i18n/en.js')).default

const route = { id: 'osm-1', name: 'Alter Kalser Weg', source: 'osm', roundTrip: true, points: [[47.05, 12.68, 2801], [47.06, 12.69, 3200], [47.074, 12.694, 3798]] }

test('O2: the credit is a line under the map, every name and licence in it; none inside the map', () => {
  const html = render(h(RouteMap, { points: route.points, highIndex: 2 }))
  const map = html.indexOf('aria-label="Route map"'), credit = html.indexOf('openstreetmap.org/copyright')
  assert.ok(map >= 0 && credit > map, 'after the map')
  for (const s of ['Leaflet', 'OpenStreetMap', 'SRTM', 'OpenTopoMap', 'CC-BY-SA']) assert.ok(html.includes(s), s)
  assert.match(readFileSync(new URL('../app/components/hike/RouteMap.jsx', import.meta.url), 'utf8'), /attributionControl: false/)
})

test('O3: a flagged row says why, and rain shows the rain icon', () => {
  assert.deepEqual(stageFlag('en', { blocker: 'rain', rain: 30, icon: '🌤' }), { text: 'rain possible, 30%', icon: '🌧' })
  assert.deepEqual(stageFlag('en', { blocker: 'storms', rain: 10, icon: '⛈' }), { text: en.reasonStorms, icon: '⛈' })
  assert.deepEqual(stageFlag('en', { blocker: 'wind', rain: 0, icon: '🌤' }), { text: en.reasonWind, icon: '🌤' })
  assert.equal(stageFlag('en', { blocker: null, rain: 30, icon: '🌤' }), null)
})

test('O4: Save and Plan stand beside the title, before the map', () => {
  const html = render(h(RouteView, { route, lang: 'en', unit: 'C', onBack() {}, backLabel: 'Großglockner', onSave() {}, saved: false, children: () => h('span', null, 'PLAN') }))
  const save = html.indexOf(en.routeSave), plan = html.indexOf('PLAN'), map = html.indexOf('aria-label="Route map"')
  assert.ok(save > 0 && save < map, 'Save before the map')
  assert.ok(plan > 0 && plan < map, 'Plan before the map')
})

test('O5: on a route, Plan names the day already picked', () => {
  const peak = { name: 'Alter Kalser Weg', lat: 47.074, lon: 12.694, elev: 3798 }
  const today = '2026-11-20'
  const todayPicked = () => render(h(PlanHike, { peak, lang: 'en', unit: 'C', todayLocal: today, route, date: today })) // today cannot be planned
  const picked = render(h(PlanHike, { peak, lang: 'en', unit: 'C', todayLocal: today, route, date: '2026-11-22' }))
  assert.match(picked, /Remind me for Sunday/)
  // what a plan brings is said before the tap here too (N1), once: after the tap only 'Planned. ...' stands
  assert.ok(picked.includes(en.planExplain), 'the direct button says what it does before the tap')
  assert.ok(!todayPicked().includes(en.planExplain), 'the chips button says it in its panel, after it opens')
  assert.ok(todayPicked().includes(en.planHike), 'today: the usual button and its day chips')
  const onPeak = render(h(PlanHike, { peak, lang: 'en', unit: 'C', todayLocal: today }))
  assert.ok(onPeak.includes(en.planHike), 'on a peak: as before')
})
