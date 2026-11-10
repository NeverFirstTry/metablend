// Leaflet comes from our own site, not a CDN (2026-11-09): the copy in public/vendor is the published
// 1.9.4, byte for byte, and the loader asks nothing but that copy.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { loadLeaflet } from './leaflet.js'

const PUBLIC = new URL('../public', import.meta.url)
const file = p => new URL(`${PUBLIC}${p}`)
const sha256 = p => crypto.createHash('sha256').update(fs.readFileSync(file(p))).digest('base64')

test('the vendored Leaflet is the published 1.9.4: the hashes leafletjs.com gives for its script and stylesheet, the images and the licence beside them', () => {
  assert.equal(sha256('/vendor/leaflet-1.9.4/leaflet.js'), '20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=')
  assert.equal(sha256('/vendor/leaflet-1.9.4/leaflet.css'), 'p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=')
  // every image the stylesheet names, and the BSD licence its terms ask to keep with the files
  const css = fs.readFileSync(file('/vendor/leaflet-1.9.4/leaflet.css'), 'utf8')
  const images = [...css.matchAll(/url\((images\/[^)]+)\)/g)].map(m => m[1])
  assert.ok(images.length >= 3, images.join(' '))
  for (const img of [...images, 'images/marker-icon-2x.png', 'images/marker-shadow.png']) assert.ok(fs.existsSync(file(`/vendor/leaflet-1.9.4/${img}`)), img)
  assert.match(fs.readFileSync(file('/vendor/leaflet-1.9.4/LICENSE'), 'utf8'), /BSD 2-Clause License/)
})

test('loadLeaflet — a stylesheet and a script from our own origin, both files there; no other host', async () => {
  const made = []
  const page = { querySelector: () => null, createElement: tag => ({ tag }), head: { appendChild: el => made.push(el) }, body: { appendChild: el => made.push(el) } }
  globalThis.window = {}
  globalThis.document = page
  try {
    const loading = loadLeaflet()
    const urls = made.map(el => el.href ?? el.src)
    assert.deepEqual(urls, ['/vendor/leaflet-1.9.4/leaflet.css', '/vendor/leaflet-1.9.4/leaflet.js'])
    for (const url of urls) assert.ok(fs.existsSync(file(url)), url)
    globalThis.window.L = { version: '1.9.4' }
    made[1].onload()
    assert.equal((await loading).version, '1.9.4')
  } finally {
    delete globalThis.window
    delete globalThis.document
  }
})
