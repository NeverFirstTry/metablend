// Route rows say where a route starts (UX review P2, owner: before launch): a hiker picks a route by its start,
// and 997 m of ascent only make sense with the height it starts from. A route without a name says so, and one
// line tells the two grade scales apart (the peak's SAC WS, the routes' T6).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { routeStart } from './route/start.js'

const LANGS = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko']
const pts = [[47.05531, 12.68108, 2801.4], [47.06, 12.69, 3200], [47.07, 12.69, 3798]]

test('the start: its place where OpenStreetMap names it, always its height', () => {
  assert.equal(routeStart('en', { from: null, points: pts }), 'Start at 2801 m')
  assert.equal(routeStart('en', { from: 'Lucknerhaus', points: [[47, 12.7, 1918], ...pts] }), 'From Lucknerhaus, 1918 m')
  assert.equal(routeStart('de', { from: null, points: pts }), 'Start auf 2801 m')
  // no height at the start: no line (the terrain model fills nearly every route)
  assert.equal(routeStart('en', { from: 'Kals', points: [[47, 12.6, null], ...pts] }), null)
  assert.equal(routeStart('en', { from: null, points: [[47, 12.6, null]] }), null)
  assert.equal(routeStart('en', { from: null }), null)
})

test('an unnamed route says so, and the scale line names both scales, in every language', async () => {
  for (const l of LANGS) {
    const p = (await import(`./i18n/${l}.js`)).default
    assert.ok(p.routeScaleNote.includes('T1-T6') && p.routeScaleNote.includes('L-EX'), `${l}: ${p.routeScaleNote}`)
    assert.ok(p.routeStartHeight.includes('{ele}') && p.routeStartPlace.includes('{place}') && p.routeStartPlace.includes('{ele}'), l)
  }
  assert.equal((await import('./i18n/en.js')).default.routeUnnamed, 'Unnamed marked route')
  assert.equal((await import('./i18n/de.js')).default.routeUnnamed, 'Markierte Route ohne Namen')
})

// source-match-ok: the list fills from a fetch in an effect, which a static render never runs; the text is tested above
test('the route list shows the start under each route and the scale line under the list', () => {
  const src = readFileSync(new URL('../app/components/hike/RouteList.jsx', import.meta.url), 'utf8')
  assert.match(src, /routeStart\(lang, r\)/)
  assert.match(src, /t\(lang, 'routeScaleNote'\)/)
})
