// The rain radar (UX review D1 and D2, owner: before launch): Leaflet as it comes out of the box (white zoom
// buttons, a bright blue pin, the "Leaflet" credit and the OpenStreetMap credit twice) and a picture with no time
// and no legend. Now the theme's zoom buttons, a plain dot for the place, one credit line, the picture's time on
// the map and a three-step legend in RainViewer's own colours (scheme 2, Universal Blue: 20, 30, 40 dBZ).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { radarLegend, radarTime } from './radar.js'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const LANGS = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko']

test('the legend: light, moderate, heavy in the colours the radar tiles use', () => {
  assert.deepEqual(radarLegend('en').map(x => [x.label, x.color]), [['Light', '#00a3e0'], ['Moderate', '#005588'], ['Heavy', '#ffaa00']])
  for (const l of LANGS) assert.equal(radarLegend(l).filter(x => x.label && !x.label.startsWith('radar')).length, 3, l)
})

test('the picture\'s time, in the reader\'s words', () => {
  const t = Date.parse('2026-11-21T00:10:00Z') / 1000
  assert.match(radarTime('en', t, 'UTC'), /^Radar 00:10$/)
  assert.match(radarTime('de', t, 'Europe/Vienna'), /^Radar 01:10$/)
  assert.equal(radarTime('en', null), null)
})

test('the card shows the legend under the map; the time waits for the picture', async () => {
  const { default: RainRadar } = await import('../app/components/RainRadar.jsx')
  const html = render(h(RainRadar, { lat: 48.2, lon: 16.37, bare: true }))
  for (const c of ['#00a3e0', '#005588', '#ffaa00']) assert.ok(html.includes(c), c)
  assert.doesNotMatch(html, /Radar \d\d:\d\d/)
})

// source-match-ok: Leaflet only runs in a browser; the map options and styles are read here, the walk shows them
test('no Leaflet credit box, a plain dot for the place, the theme\'s zoom buttons', () => {
  const src = readFileSync(new URL('../app/components/RainRadar.jsx', import.meta.url), 'utf8')
  assert.match(src, /attributionControl: false/)
  assert.match(src, /L\.circleMarker\(\[lat, lon\], \{[^}]*className: 'radar-place'/)
  assert.doesNotMatch(src, /L\.marker\(/)
  assert.match(readFileSync(new URL('../app/heatmap/page.js', import.meta.url), 'utf8'), /attributionControl\.setPrefix\(false\)/)
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
  assert.match(css, /html \.leaflet-container \.leaflet-bar a \{[^}]*background: var\(--surface\)/)
  assert.match(css, /\.radar-place \{[^}]*fill: var\(--foreground\)/)
})
