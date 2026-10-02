import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseGpx } from './gpx.js'

const KOMOOT = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="komoot" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Tour</name></metadata>
  <trk><name>Hochstadel &amp; Lienzer Dolomiten</name>
    <trkseg>
      <trkpt lat="46.820100" lon="12.801200"><ele>720.5</ele><time>2026-07-01T06:00:00Z</time></trkpt>
      <trkpt lat="46.821000" lon="12.802000"><ele>740.0</ele></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lon='12.803' lat='46.822'/>
    </trkseg>
  </trk>
</gpx>`

test('parseGpx — a Komoot-style track: name, segments joined, missing ele is null', () => {
  const g = parseGpx(KOMOOT)
  assert.equal(g.name, 'Hochstadel & Lienzer Dolomiten')
  assert.deepEqual(g.points, [
    { lat: 46.8201, lon: 12.8012, ele: 720.5 },
    { lat: 46.821, lon: 12.802, ele: 740 },
    { lat: 46.822, lon: 12.803, ele: null },
  ])
})

test('parseGpx — a route-only file (<rtept>)', () => {
  const g = parseGpx('<gpx><rte><name>Plan</name><rtept lat="47" lon="12"><ele>1000</ele></rtept><rtept lat="47.01" lon="12.01"/></rte></gpx>')
  assert.equal(g.name, 'Plan')
  assert.equal(g.points.length, 2)
})

test('parseGpx — junk, a single point and out-of-range coordinates give no route', () => {
  assert.equal(parseGpx('hello'), null)
  assert.equal(parseGpx(null), null)
  assert.equal(parseGpx('<gpx><trk><trkseg><trkpt lat="47" lon="12"/></trkseg></trk></gpx>'), null)
  assert.equal(parseGpx('<gpx><trk><trkseg><trkpt lat="95" lon="12"/><trkpt lat="47" lon="200"/></trkseg></trk></gpx>'), null)
})
