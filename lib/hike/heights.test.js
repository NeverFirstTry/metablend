import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseEle, parseOverpassEle, parseElevations, overpassQuery, osmApiUrls, resolveHeights } from './heights.js'

const fx = name => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)))

test('parseEle — metres, decimals, feet; junk rejected', () => {
  assert.equal(parseEle('2076'), 2076)
  assert.equal(parseEle('2076 m'), 2076)
  assert.equal(parseEle('2076,6'), 2077)
  assert.equal(parseEle('6800 ft'), 2073)
  for (const v of ['', 'ca. 2000', '2076;2080', '12000', undefined]) assert.equal(parseEle(v), null, String(v))
})

test('parseOverpassEle — the recorded Schneeberg lookup', () => {
  const m = parseOverpassEle(fx('overpass-schneeberg.json'))
  assert.ok(Object.keys(m).length >= 5)
  assert.ok(Object.entries(m).every(([k, v]) => /^[NWR]\d+$/.test(k) && Number.isInteger(v)))
  assert.equal(parseOverpassEle(null), null)
})

test('parseElevations — the recorded elevation response, aligned; wrong length → null', () => {
  assert.equal(parseElevations(fx('elevation-3.json'), 3).length, 3)
  assert.equal(parseElevations(fx('elevation-3.json'), 2), null)
  assert.equal(parseElevations(null, 1), null)
})

test('overpassQuery — nodes, ways and relations by id; nothing to ask → null', () => {
  assert.equal(overpassQuery([{ id: 'osm-N1' }, { id: 'osm-W2' }, { id: 'gn-5' }, { id: 'osm-N3' }]),
    '[out:json][timeout:8];(node(id:1,3);way(id:2););out tags;')
  assert.equal(overpassQuery([{ id: 'gn-5' }]), null)
})

test('osmApiUrls — one OpenStreetMap multi-fetch per element type', () => {
  assert.deepEqual(osmApiUrls([{ id: 'osm-N1' }, { id: 'osm-W2' }, { id: 'osm-N3' }, { id: 'gn-5' }]), [
    'https://api.openstreetmap.org/api/0.6/nodes.json?nodes=1,3',
    'https://api.openstreetmap.org/api/0.6/ways.json?ways=2',
  ])
  assert.deepEqual(osmApiUrls([{ id: 'gn-5' }]), [])
})

test('resolveHeights — OpenStreetMap first, terrain model only for the rest (flagged), failures reported', async () => {
  const found = [{ id: 'osm-N1', elev: null }, { id: 'osm-N2', elev: null }, { id: 'osm-N3', elev: null }]
  const asked = []
  const r = await resolveHeights(found, {
    osmEle: async () => ({ N1: 2076 }),
    demEle: async need => { asked.push(need.map(p => p.id)); return [1990, null] },
  })
  assert.deepEqual(asked, [['osm-N2', 'osm-N3']]) // the terrain model only for peaks OSM had no height for
  assert.deepEqual(r.peaks.map(p => [p.id, p.elev, p.elevApprox ?? false]), [['osm-N1', 2076, false], ['osm-N2', 1990, true], ['osm-N3', null, false]])
  assert.deepEqual([r.osmDown, r.demDown], [false, false])
  const down = await resolveHeights(found, { osmEle: async () => null, demEle: async () => null })
  assert.deepEqual([down.osmDown, down.demDown], [true, true])
  assert.ok(down.peaks.every(p => p.elev === null))
})
