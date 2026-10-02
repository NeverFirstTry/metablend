# Hiking v2: routes and GPX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Routes in the app's Hiking tab — imported GPX files and the marked OpenStreetMap routes up a peak — with walking times, the weather at each stage, a suggested start time, saving on the phone and route-aware hike alerts.

**Architecture:** Pure modules in `lib/route/` (GPX, geometry, DIN timing, stage samples, verdict, OSM parsing) plus two orchestrators with injected network functions (`findRoutes`, `routeWeather`); two API routes (`/api/routes`, `/api/route-weather`); app screens in `app/components/hike/`; the push dispatcher reuses `routeWeather` for planned hikes on a route.

**Tech Stack:** Next.js 16 App Router (plain JS), `node --test`, Supabase, Leaflet (unpkg), OpenStreetMap API, Open-Meteo forecast + elevation APIs, Capacitor Preferences.

**Spec:** `docs/superpowers/specs/2026-10-02-hiking-routes-design.md`

## Global Constraints

- App only (the website keeps the hiking teaser); language and unit follow the app.
- OSM: official API only (`https://api.openstreetmap.org/api/0.6/…`), summit box ±0.006° lat / ±0.009° lon, ≤ 8 relations per peak, cache 7 days in `route_cache` + CDN `s-maxage=86400`; User-Agent from `lib/outlook/http.js`.
- Route weather: one multi-location Open-Meteo request, `SUMMIT_HOURLY`, the 3 `CORE_MODELS`, per-point `elevation`, `forecast_days=8`; rate limit 20/min/IP; `maxDuration = 60`; failures `no-store`.
- Timing: DIN 33466 — 4 km/h flat, 300 m/h up, 500 m/h down, total = max + min/2; `PACE = { slow: 1.25, normal: 1, fast: 0.8 }`.
- Samples: 6–10 points (start, end, highest, every ~1.5 km or 300 m climb); start times in 15-min steps from sunrise; the walk must end by sunset; stage blockers = `blocker()` from `lib/hike/window.js`.
- Limits: GPX ≤ 5 MB; stored routes ≤ 500 points, ≤ 30 routes; OSM routes simplified to 300 points; plan routes ≤ 150 points; request bodies ≤ 500 points.
- lib/ is ESM with relative `.js` imports; app code may use `@/`. Commit and push straight to `main`.

## Review Focus

1. A GPX without any `<ele>` (Strava exports often have it, some planners don't) — elevations must be filled server-side and the climb/timing still sensible. Pinned in Task 5 (elevation fill test).
2. A route walked "downhill" in the data (summit first) — OSM routes are flipped to start low; a GPX keeps its order. Pinned in Task 5 (`findRoutes` "starts low" assertion).
3. Planning for today after the suggested start has passed — the suggestion must not lie in the past. Pinned in Task 4 (`notBefore` test).
4. A route longer than the daylight — explicit "daylight" reason, no fake start. Pinned in Task 4.
5. Weather request returning fewer locations than requested — `routeWeather` returns null (→ 502), not misaligned stages. Pinned in Task 5.

---

## Stage 1 — Route engine and endpoints

### Task 1: Geometry and GPX

**Files:**
- Create: `lib/route/geometry.js`, `lib/route/geometry.test.js`, `lib/route/gpx.js`, `lib/route/gpx.test.js`

**Interfaces:**
- Produces: `haversineM(a, b) → m`, `cumulative(points) → m[]`, `climb(points, step = 5) → { ascentM, descentM }`, `highestIndex(points) → i`, `simplify(points, maxPoints = 500) → points`, `withReturn(points) → points` (there and back); `parseGpx(xml) → { name, points: [{ lat, lon, ele|null }] } | null`. A point is `{ lat, lon, ele }`.

- [ ] **Step 1: Failing tests**

**File (create): `lib/route/geometry.test.js`**
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { haversineM, cumulative, climb, highestIndex, simplify, withReturn } from './geometry.js'

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`)

test('haversineM / cumulative — one degree of latitude, running sums', () => {
  near(haversineM({ lat: 47, lon: 12 }, { lat: 48, lon: 12 }), 111195, 2)
  const c = cumulative([{ lat: 47, lon: 12 }, { lat: 47.001, lon: 12 }, { lat: 47.002, lon: 12 }])
  assert.equal(c.length, 3)
  near(c[2], 222.4, 0.5)
})

test('climb — GPS noise below 5 m does not count', () => {
  const pts = [100, 102, 99, 101, 110, 108, 120, 119, 100].map((ele, i) => ({ lat: 47 + i / 1e4, lon: 12, ele }))
  assert.deepEqual(climb(pts), { ascentM: 20, descentM: 20 })
  assert.deepEqual(climb([{ lat: 1, lon: 1, ele: null }, { lat: 1, lon: 1, ele: null }]), { ascentM: 0, descentM: 0 })
})

test('simplify — keeps ends, highest point and the shape; never more than asked', () => {
  const pts = Array.from({ length: 1000 }, (_, i) => ({ lat: 47 + i / 1e5, lon: 12 + (i === 600 ? 0.01 : 0), ele: i === 300 ? 3000 : 1000 }))
  const s = simplify(pts, 50)
  assert.ok(s.length <= 50)
  assert.equal(s[0], pts[0])
  assert.equal(s[s.length - 1], pts[999])
  assert.ok(s.includes(pts[300]), 'highest point kept')
  assert.ok(s.includes(pts[600]), 'the spike kept')
  assert.deepEqual(simplify(pts.slice(0, 10), 50), pts.slice(0, 10))
  assert.equal(highestIndex(pts), 300)
})

test('withReturn — there and back without doubling the turning point', () => {
  const a = { lat: 1, lon: 1, ele: 1 }, b = { lat: 2, lon: 2, ele: 2 }, c = { lat: 3, lon: 3, ele: 3 }
  assert.deepEqual(withReturn([a, b, c]), [a, b, c, b, a])
})
```

**File (create): `lib/route/gpx.test.js`**
```js
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
```

- [ ] **Step 2: Run — expect failure** (`Cannot find module`): `node --test lib/route/geometry.test.js lib/route/gpx.test.js`

- [ ] **Step 3: Implement**

**File (create): `lib/route/geometry.js`**
```js
// Route geometry (pure — unit tested): distances, climb with a hysteresis
// against GPS noise, and simplification that keeps the shape, the ends and
// the highest point. A point is { lat, lon, ele } (ele may be null).
const R = 6371008.8
const rad = d => (d * Math.PI) / 180

export function haversineM(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// metres from the start at every point
export function cumulative(points) {
  const out = [0]
  for (let i = 1; i < points.length; i++) out.push(out[i - 1] + haversineM(points[i - 1], points[i]))
  return out
}

// a climb only counts once the elevation has moved `step` m from the last
// counted level, so a GPS track's jitter doesn't add hundreds of metres
export function climb(points, step = 5) {
  let up = 0, down = 0, ref = null
  for (const p of points) {
    if (typeof p.ele !== 'number') continue
    if (ref == null) { ref = p.ele; continue }
    const d = p.ele - ref
    if (d >= step) { up += d; ref = p.ele } else if (d <= -step) { down -= d; ref = p.ele }
  }
  return { ascentM: Math.round(up), descentM: Math.round(down) }
}

export function highestIndex(points) {
  let hi = 0
  points.forEach((p, i) => { if ((p.ele ?? -Infinity) > (points[hi].ele ?? -Infinity)) hi = i })
  return hi
}

// distance of p from the segment a–b, flat projection, metres
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}

// Douglas–Peucker ranks every point by how much shape it carries (a child
// never outranks its parent); the top ones are kept, plus the ends and the
// highest point.
export function simplify(points, maxPoints = 500) {
  const n = points.length
  if (n <= maxPoints) return points.slice()
  const lat0 = rad(points[0].lat)
  const xy = points.map(p => [rad(p.lon) * Math.cos(lat0) * R, rad(p.lat) * R])
  const rank = new Float64Array(n).fill(-1)
  const stack = [[0, n - 1, Infinity]]
  while (stack.length) {
    const [a, b, cap] = stack.pop()
    let best = -1, idx = -1
    for (let i = a + 1; i < b; i++) {
      const d = segDist(xy[i], xy[a], xy[b])
      if (d > best) { best = d; idx = i }
    }
    if (idx < 0) continue
    rank[idx] = Math.min(best, cap)
    stack.push([a, idx, rank[idx]], [idx, b, rank[idx]])
  }
  const forced = new Set([0, n - 1, highestIndex(points)])
  const order = [...rank.keys()].filter(i => !forced.has(i)).sort((x, y) => rank[y] - rank[x])
  const keep = new Set([...forced, ...order.slice(0, Math.max(0, maxPoints - forced.size))])
  return [...keep].sort((x, y) => x - y).map(i => points[i])
}

// up to the top and back down the same way
export const withReturn = points => points.concat(points.slice(0, -1).reverse())
```

**File (create): `lib/route/gpx.js`**
```js
// GPX → points (pure — unit tested): track points (<trkpt>) or, without a
// track, route points (<rtept>); segments and tracks joined in file order.
// A small regex reader on purpose: it runs in node tests and in the app alike.
const TAG = tag => new RegExp(`<${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tag}>)`, 'g')
const attr = (s, k) => s.match(new RegExp(`\\b${k}\\s*=\\s*["']([^"']*)["']`))?.[1]
const text = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').trim()

function readPoints(xml, tag) {
  const out = []
  for (const m of xml.matchAll(TAG(tag))) {
    const lat = Number(attr(m[1], 'lat')), lon = Number(attr(m[1], 'lon'))
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue
    const e = m[2]?.match(/<ele>\s*([-+\d.eE]+)\s*<\/ele>/)?.[1]
    const ele = e == null ? null : Number(e)
    out.push({ lat, lon, ele: Number.isFinite(ele) ? ele : null })
  }
  return out
}

export function parseGpx(xml) {
  if (typeof xml !== 'string' || !/<gpx\b/i.test(xml)) return null
  let points = readPoints(xml, 'trkpt')
  if (points.length < 2) points = readPoints(xml, 'rtept')
  if (points.length < 2) return null
  const raw = xml.match(/<(?:trk|rte)\b[^>]*>[\s\S]*?<name>([\s\S]*?)<\/name>/)?.[1]
    ?? xml.match(/<metadata\b[^>]*>[\s\S]*?<name>([\s\S]*?)<\/name>/)?.[1]
  const name = raw ? text(raw).slice(0, 80) : ''
  return { name: name || null, points }
}
```

- [ ] **Step 4: Run** — `node --test lib/route/geometry.test.js lib/route/gpx.test.js` → all pass; `npm test` → all pass.
- [ ] **Step 5: Commit** — `git add lib/route && git commit -m "Routes: geometry and GPX reader"`

### Task 2: Timing and stage samples

**Files:**
- Create: `lib/route/timing.js`, `lib/route/timing.test.js`, `lib/route/samples.js`, `lib/route/samples.test.js`

**Interfaces:**
- Consumes: `haversineM`, `cumulative`, `climb`, `highestIndex` (Task 1).
- Produces: `PACE`, `legMinutes(distM, upM, downM)`, `etas(points, pace = 'normal') → minutes[]`, `routeStats(points, pace) → { distanceKm, ascentM, descentM, minutes }`; `pickSamples(points, opts?) → ascending indexes`.

- [ ] **Step 1: Failing tests**

**File (create): `lib/route/timing.test.js`**
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { legMinutes, etas, routeStats, PACE } from './timing.js'

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`)
const STEP = 300 / 111195.08 // degrees of latitude for 300 m

test('legMinutes — DIN 33466: the larger time plus half the smaller', () => {
  assert.equal(legMinutes(4000, 0, 0), 60)
  assert.equal(legMinutes(3000, 900, 0), 202.5)
  assert.equal(legMinutes(3000, 0, 900), 130.5)
})

test('etas — a steady 900 m climb over 3 km takes 3 h 22.5 min, slow pace 25 % longer', () => {
  const pts = Array.from({ length: 11 }, (_, i) => ({ lat: 47 + i * STEP, lon: 12, ele: i * 90 }))
  near(etas(pts).at(-1), 202.5, 0.5)
  near(etas(pts, 'slow').at(-1), 202.5 * PACE.slow, 0.6)
  assert.equal(etas(pts)[0], 0)
})

test('routeStats — distance, climb and time, rounded for display', () => {
  const pts = Array.from({ length: 11 }, (_, i) => ({ lat: 47 + i * STEP, lon: 12, ele: i * 90 }))
  assert.deepEqual(routeStats(pts, 'normal'), { distanceKm: 3, ascentM: 900, descentM: 0, minutes: 203 })
})
```

**File (create): `lib/route/samples.test.js`**
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickSamples } from './samples.js'

const STEP = 100 / 111195.08 // 100 m north per point

test('pickSamples — a long climb: 6–10 points, start, end and the top included', () => {
  const pts = Array.from({ length: 121 }, (_, i) => ({ lat: 47 + i * STEP, lon: 12, ele: 1000 + Math.min(i, 80) * 20 - Math.max(0, i - 80) * 10 }))
  const s = pickSamples(pts)
  assert.ok(s.length >= 6 && s.length <= 10, `got ${s.length}`)
  assert.equal(s[0], 0)
  assert.equal(s.at(-1), 120)
  assert.ok(s.includes(80), 'the highest point')
  assert.deepEqual(s, [...s].sort((a, b) => a - b))
})

test('pickSamples — short routes get what they have, never duplicates', () => {
  assert.deepEqual(pickSamples([{ lat: 47, lon: 12, ele: 1 }, { lat: 47.001, lon: 12, ele: 2 }]), [0, 1])
  const five = Array.from({ length: 5 }, (_, i) => ({ lat: 47 + i * STEP, lon: 12, ele: i }))
  assert.deepEqual(pickSamples(five), [0, 1, 2, 3, 4])
})
```

- [ ] **Step 2: Run — expect failure**: `node --test lib/route/timing.test.js lib/route/samples.test.js`

- [ ] **Step 3: Implement**

**File (create): `lib/route/timing.js`**
```js
// Walking time (pure — unit tested): DIN 33466, the hiking-time rule of the
// Alpine clubs — 4 km/h on the flat, 300 m/h up, 500 m/h down; the larger
// of the horizontal and vertical times plus half the smaller.
import { haversineM, cumulative, climb } from './geometry.js'

export const PACE = { slow: 1.25, normal: 1, fast: 0.8 }

export function legMinutes(distM, upM, downM) {
  const h = (distM / 4000) * 60, v = (upM / 300) * 60 + (downM / 500) * 60
  return Math.max(h, v) + Math.min(h, v) / 2
}

// minutes from the start at every point
export function etas(points, pace = 'normal') {
  const f = PACE[pace] ?? 1
  const out = [0]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const dz = (b.ele ?? a.ele ?? 0) - (a.ele ?? b.ele ?? 0)
    out.push(out[i - 1] + legMinutes(haversineM(a, b), Math.max(0, dz), Math.max(0, -dz)) * f)
  }
  return out
}

export function routeStats(points, pace = 'normal') {
  const dist = cumulative(points)
  return {
    distanceKm: Math.round(dist.at(-1) / 100) / 10,
    ...climb(points),
    minutes: Math.round(etas(points, pace).at(-1)),
  }
}
```

**File (create): `lib/route/samples.js`**
```js
// Where along a route to check the weather (pure — unit tested): the start,
// the end, the highest point, and a point every ~1.5 km or 300 m of climb,
// whichever comes first — 6 to 10 points (fewer on very short routes).
import { cumulative, highestIndex } from './geometry.js'

export function pickSamples(points, { everyM = 1500, everyUpM = 300, min = 6, max = 10 } = {}) {
  const n = points.length
  if (n < 2) return n ? [0] : []
  const dist = cumulative(points), hi = highestIndex(points)
  const picks = new Set([0, n - 1, hi])
  let lastD = 0, up = 0
  for (let i = 1; i < n - 1; i++) {
    const dz = (points[i].ele ?? 0) - (points[i - 1].ele ?? 0)
    if (dz > 0) up += dz
    if (dist[i] - lastD >= everyM || up >= everyUpM) { picks.add(i); lastD = dist[i]; up = 0 }
  }
  // too few: split the widest gap until there are enough
  const want = Math.min(min, n)
  while (picks.size < want) {
    const s = [...picks].sort((a, b) => a - b)
    let at = 0
    for (let k = 1; k < s.length - 1; k++) if (s[k + 1] - s[k] > s[at + 1] - s[at]) at = k
    if (s[at + 1] - s[at] < 2) break
    picks.add(Math.floor((s[at] + s[at + 1]) / 2))
  }
  let idx = [...picks].sort((a, b) => a - b)
  // too many: keep start, end and the top, spread the rest evenly
  if (idx.length > max) {
    const must = new Set([0, n - 1, hi])
    const rest = idx.filter(i => !must.has(i)), room = max - must.size
    const chosen = Array.from({ length: room }, (_, k) => rest[Math.floor((k * rest.length) / room)])
    idx = [...new Set([...must, ...chosen])].sort((a, b) => a - b)
  }
  return idx
}
```

- [ ] **Step 4: Run** — `node --test lib/route/timing.test.js lib/route/samples.test.js` → pass; `npm test` → pass.
- [ ] **Step 5: Commit** — `git add lib/route && git commit -m "Routes: DIN walking times and weather sample points"`

### Task 3: OpenStreetMap routes (fixtures, `routesNear`, `stitch`)

**Files:**
- Create: `scripts/record-route-fixtures.mjs`, `lib/route/__fixtures__/` (recorded), `lib/route/osm.js`, `lib/route/osm.test.js`

**Interfaces:**
- Consumes: `haversineM` (Task 1).
- Produces: `routesNear(mapJson, summit, radiusM = 1000) → [{ id, ref, name }]`; `stitch(relationFullJson) → { id, ref, name, from, to, symbol, difficulty, points } | null`; `SAC` (difficulty order). Fixtures `osm-glockner-map.json`, `osm-712-full.json`, `om-route-3pt.json`.

- [ ] **Step 1: Record fixtures**

**File (create): `scripts/record-route-fixtures.mjs`**
```js
// Records trimmed real responses into lib/route/__fixtures__/ for the route
// engine tests. Re-run when an upstream format changes:
//   node scripts/record-route-fixtures.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SUMMIT_HOURLY } from '../lib/hike/parse.js'
import { CORE_MODELS } from '../lib/outlook/models.js'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'route', '__fixtures__')
fs.mkdirSync(OUT, { recursive: true })
const UA = { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' }
async function get(url) {
  const r = await fetch(url, { headers: UA })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.json()
}
function save(name, data) {
  const s = JSON.stringify(data)
  fs.writeFileSync(path.join(OUT, name), s)
  console.log(name.padEnd(26), `${(s.length / 1024).toFixed(0)} kB`)
}

// Großglockner's summit box (the same box findRoutes asks for), trimmed to the
// hiking relations, their ways, those ways' nodes and the summit
const map = await get('https://api.openstreetmap.org/api/0.6/map.json?bbox=12.68510,47.06850,12.70310,47.08050')
const rels = map.elements.filter(e => e.type === 'relation' && /^(hiking|foot|mountain_hiking)$/.test(e.tags?.route ?? ''))
const wayIds = new Set(rels.flatMap(r => r.members.filter(m => m.type === 'way').map(m => m.ref)))
const ways = map.elements.filter(e => e.type === 'way' && wayIds.has(e.id))
const nodeIds = new Set(ways.flatMap(w => w.nodes))
const nodes = map.elements.filter(e => e.type === 'node' && (nodeIds.has(e.id) || e.tags?.natural === 'peak'))
save('osm-glockner-map.json', { elements: [...nodes, ...ways, ...rels] })
// 712 Alter Kalser Weg (the Normalweg via Stüdlhütte)
save('osm-712-full.json', await get('https://api.openstreetmap.org/api/0.6/relation/14622955/full.json'))
// three points up the 712 (Lucknerhaus, Stüdlhütte, summit) for the multi-point weather request
const PTS = [[47.0172, 12.6913, 1920], [47.0603, 12.6779, 2802], [47.0745, 12.6941, 3798]]
save('om-route-3pt.json', await get(`https://api.open-meteo.com/v1/forecast?latitude=${PTS.map(p => p[0]).join(',')}&longitude=${PTS.map(p => p[1]).join(',')}&elevation=${PTS.map(p => p[2]).join(',')}&hourly=${SUMMIT_HOURLY.join(',')}&daily=sunrise,sunset&models=${CORE_MODELS.join(',')}&forecast_days=3&timezone=auto`))
```
Run: `node scripts/record-route-fixtures.mjs` → three files, sizes printed.

- [ ] **Step 2: Failing tests**

**File (create): `lib/route/osm.test.js`**
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { routesNear, stitch, SAC } from './osm.js'
import { haversineM } from './geometry.js'

const fx = name => JSON.parse(fs.readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8'))
const SUMMIT = { lat: 47.0745, lon: 12.6941 }

test('routesNear — the hiking relations that reach the Großglockner summit', () => {
  const found = routesNear(fx('osm-glockner-map.json'), SUMMIT)
  assert.ok(found.some(r => r.id === 14622955 && r.ref === '712'), JSON.stringify(found))
  assert.deepEqual(routesNear(fx('osm-glockner-map.json'), SUMMIT, 0), [])
  assert.deepEqual(routesNear(null, SUMMIT), [])
})

test('stitch — the 712 as one continuous line, with its tags', () => {
  const r = stitch(fx('osm-712-full.json'))
  assert.equal(r.id, 14622955)
  assert.equal(r.ref, '712')
  assert.equal(r.name, 'Alter Kalser Weg 712')
  assert.ok(r.points.length >= 70)
  for (let i = 1; i < r.points.length; i++) assert.ok(haversineM(r.points[i - 1], r.points[i]) < 800, `gap at ${i}`)
  assert.ok(r.difficulty === null || SAC.includes(r.difficulty))
  assert.equal(stitch({ elements: [] }), null)
})
```
Run: `node --test lib/route/osm.test.js` → fails (`Cannot find module './osm.js'`).

- [ ] **Step 3: Implement**

**File (create): `lib/route/osm.js`**
```js
// OpenStreetMap routes (pure — unit tested): which hiking relations reach a
// summit, and one relation as an ordered line. Data from the official API
// (map.json for the summit box, relation/{id}/full.json for a route).
import { haversineM } from './geometry.js'

export const SAC = ['hiking', 'mountain_hiking', 'demanding_mountain_hiking', 'alpine_hiking', 'demanding_alpine_hiking', 'difficult_alpine_hiking']
const ROUTE = /^(hiking|foot|mountain_hiking)$/

// 1 km: Alpine club routes usually end at the last hut below the summit (the
// 712 on the Großglockner stops 660 m short); findRoutes walks on from there
export function routesNear(map, summit, radiusM = 1000) {
  const els = map?.elements ?? []
  const nodes = new Map(els.filter(e => e.type === 'node').map(n => [n.id, n]))
  const ways = new Map(els.filter(e => e.type === 'way').map(w => [w.id, w]))
  const reaches = id => (ways.get(id)?.nodes ?? []).some(nid => { const n = nodes.get(nid); return !!n && haversineM(summit, n) <= radiusM })
  return els
    .filter(e => e.type === 'relation' && ROUTE.test(e.tags?.route ?? '') && e.members?.some(m => m.type === 'way' && reaches(m.ref)))
    .map(r => ({ id: r.id, ref: r.tags.ref ?? null, name: r.tags.name ?? r.tags.loc_name ?? null }))
}

// member ways joined end to end (reversed where needed); a member that
// touches neither end is appended — OSM relations aren't always contiguous
export function stitch(full) {
  const els = full?.elements ?? []
  const rel = els.find(e => e.type === 'relation')
  if (!rel) return null
  const nodes = new Map(els.filter(e => e.type === 'node').map(n => [n.id, n]))
  const ways = new Map(els.filter(e => e.type === 'way').map(w => [w.id, w]))
  const members = rel.members.filter(m => m.type === 'way' && ways.has(m.ref)).map(m => ways.get(m.ref))
  const segs = members.map(w => w.nodes.slice())
  if (!segs.length) return null
  let chain = segs.shift()
  while (segs.length) {
    const head = chain[0], tail = chain.at(-1)
    let k = segs.findIndex(s => s[0] === tail || s.at(-1) === tail)
    if (k >= 0) { const s = segs.splice(k, 1)[0]; chain = chain.concat((s[0] === tail ? s : s.reverse()).slice(1)); continue }
    k = segs.findIndex(s => s[0] === head || s.at(-1) === head)
    if (k >= 0) { const s = segs.splice(k, 1)[0]; chain = (s.at(-1) === head ? s : s.reverse()).slice(0, -1).concat(chain); continue }
    chain = chain.concat(segs.shift())
  }
  const ranks = members.map(w => SAC.indexOf(w.tags?.sac_scale)).filter(i => i >= 0)
  const t = rel.tags ?? {}
  return {
    id: rel.id, ref: t.ref ?? null, name: t.name ?? t.loc_name ?? null, from: t.from ?? null, to: t.to ?? null,
    symbol: t['osmc:symbol'] ?? null,
    difficulty: ranks.length ? SAC[Math.max(...ranks)] : null,
    points: chain.map(id => nodes.get(id)).filter(Boolean).map(n => ({ lat: n.lat, lon: n.lon, ele: null })),
  }
}
```

- [ ] **Step 4: Run** — `node --test lib/route/osm.test.js` → pass; `npm test` → pass.
- [ ] **Step 5: Commit** — `git add scripts/record-route-fixtures.mjs lib/route && git commit -m "Routes: OpenStreetMap relations near a summit, stitched into lines"`

### Task 4: Verdict and suggested start

**Files:**
- Create: `lib/route/verdict.js`, `lib/route/verdict.test.js`
- Modify: `lib/hike/text.js` (export `REASON`)

**Interfaces:**
- Consumes: `blocker(hour)` from `lib/hike/window.js` (hours `{ t, storm, rainPct, windKmh, feels, … }`).
- Produces: `toMin('HH:MM') → minutes|null`, `hhmm(minutes) → 'HH:MM'`, `hourAt(hours, date, minute) → hour|null`, `stagesAt({ hoursByStage, offsets, date, start }) → [{ i, minute, eta, hour, blocker }]`, `suggestStart({ hoursByStage, offsets, date, sun, notBefore = 0, step = 15 }) → { start, latest, startMinute } | { none: true, reason, firstBad }`; `REASON` from `lib/hike/text.js`.

- [ ] **Step 1: Failing tests**

**File (create): `lib/route/verdict.test.js`**
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hhmm, toMin, hourAt, stagesAt, suggestStart } from './verdict.js'

const DAY = '2026-10-03', SUN = { sunrise: '07:00', sunset: '19:00' }
const OK = { storm: 'low', rainPct: 0, windKmh: 10, feels: 5 }
const day = (patch = () => ({})) => Array.from({ length: 24 }, (_, h) => ({ t: `${DAY}T${String(h).padStart(2, '0')}:00`, ...OK, ...patch(h) }))
const OFFSETS = [0, 60, 120, 180] // a 3-hour walk, four stages

test('hhmm / toMin / hourAt — rounding and the next day past midnight', () => {
  assert.equal(hhmm(59.6), '01:00')
  assert.equal(hhmm(450), '07:30')
  assert.equal(toMin('07:30'), 450)
  assert.equal(toMin('7:30'), null)
  assert.equal(hourAt([{ t: '2026-10-04T01:00' }], DAY, 1500).t, '2026-10-04T01:00')
})

test('suggestStart — a safe day: first light to the last start that ends by sunset', () => {
  const all = [day(), day(), day(), day()]
  assert.deepEqual(suggestStart({ hoursByStage: all, offsets: OFFSETS, date: DAY, sun: SUN }), { start: '07:00', latest: '16:00', startMinute: 420 })
})

test('suggestStart — storms from 11:00: start early enough to be down before', () => {
  const storms = [0, 1, 2, 3].map(() => day(h => (h >= 11 ? { storm: 'high' } : {})))
  const s = suggestStart({ hoursByStage: storms, offsets: OFFSETS, date: DAY, sun: SUN })
  assert.equal(s.start, '07:00')
  assert.equal(s.latest, '07:45')
})

test('suggestStart — no safe start: the reason and the first bad stage', () => {
  const allDay = [0, 1, 2, 3].map(() => day(() => ({ storm: 'high' })))
  assert.deepEqual(suggestStart({ hoursByStage: allDay, offsets: OFFSETS, date: DAY, sun: SUN }), { none: true, reason: 'storms', firstBad: { i: 0, eta: '07:00' } })
  const windyTop = [day(), day(), day(() => ({ windKmh: 60 })), day()]
  const w = suggestStart({ hoursByStage: windyTop, offsets: OFFSETS, date: DAY, sun: SUN })
  assert.equal(w.reason, 'wind')
  assert.equal(w.firstBad.i, 2)
})

test('suggestStart — never before now; longer than the daylight; no forecast', () => {
  const all = [day(), day(), day(), day()]
  assert.equal(suggestStart({ hoursByStage: all, offsets: OFFSETS, date: DAY, sun: SUN, notBefore: 600 }).start, '10:00')
  assert.deepEqual(suggestStart({ hoursByStage: [day(), day()], offsets: [0, 800], date: DAY, sun: SUN }), { none: true, reason: 'daylight', firstBad: null })
  assert.equal(suggestStart({ hoursByStage: [[], [], [], []], offsets: OFFSETS, date: DAY, sun: SUN }).reason, 'nodata')
})

test('stagesAt — arrival time and blocker per stage', () => {
  const st = stagesAt({ hoursByStage: [day(), day(() => ({ rainPct: 80 }))], offsets: [0, 90], date: DAY, start: 480 })
  assert.deepEqual(st.map(s => [s.eta, s.blocker]), [['08:00', null], ['09:30', 'rain']])
})
```

- [ ] **Step 2: Run — expect failure**: `node --test lib/route/verdict.test.js`

- [ ] **Step 3: Implement**

In `lib/hike/text.js` change `const REASON = {` to `export const REASON = {`.

**File (create): `lib/route/verdict.js`**
```js
// Is the route walkable, and from when? (pure — unit tested) Every stage is
// judged on the blended hour it is reached in, by the summit engine's own
// rules (window.js blocker: storms, rain, wind, cold). The walk starts no
// earlier than first light and must be done by sunset.
import { blocker } from '../hike/window.js'

export const toMin = hm => (typeof hm === 'string' && /^\d\d:\d\d$/.test(hm) ? Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3)) : null)
export function hhmm(m) {
  const r = Math.round(m)
  return `${String(Math.floor(r / 60) % 24).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`
}

// the blended hour a minute of the day falls in ('YYYY-MM-DDTHH:00'; past
// midnight it is the next day's hour)
export function hourAt(hours, date, minute) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCMinutes(Math.floor(minute / 60) * 60)
  const t = `${d.toISOString().slice(0, 13)}:00`
  return hours?.find(h => h.t === t) ?? null
}

export function stagesAt({ hoursByStage, offsets, date, start }) {
  return offsets.map((off, i) => {
    const minute = start + off, hour = hourAt(hoursByStage[i], date, minute)
    return { i, minute, eta: hhmm(minute), hour, blocker: hour ? blocker(hour) : 'nodata' }
  })
}

export function suggestStart({ hoursByStage, offsets, date, sun, notBefore = 0, step = 15 }) {
  const rise = toMin(sun?.sunrise) ?? 6 * 60, set = toMin(sun?.sunset) ?? 19 * 60
  const total = offsets.at(-1) ?? 0
  const first = Math.ceil(Math.max(rise, notBefore) / step) * step
  if (first + total > set) return { none: true, reason: 'daylight', firstBad: null }
  let earliest = null, latest = null, firstBad = null
  for (let s = first; s + total <= set; s += step) {
    const bad = stagesAt({ hoursByStage, offsets, date, start: s }).find(x => x.blocker)
    if (!bad) { earliest ??= s; latest = s } else if (earliest != null) break
    else firstBad ??= bad
  }
  if (earliest == null) return { none: true, reason: firstBad?.blocker ?? 'daylight', firstBad: firstBad ? { i: firstBad.i, eta: firstBad.eta } : null }
  return { start: hhmm(earliest), latest: hhmm(latest), startMinute: earliest }
}
```

- [ ] **Step 4: Run** — `node --test lib/route/verdict.test.js` → pass; `npm test` → pass.
- [ ] **Step 5: Commit** — `git add lib/route lib/hike/text.js && git commit -m "Routes: stage verdicts and the suggested start"`

### Task 5: Orchestration — `findRoutes`, `routeWeather`, body validation

**Files:**
- Create: `lib/route/find.js`, `lib/route/find.test.js`, `lib/route/weather.js`, `lib/route/weather.test.js`, `lib/route/validate.js`, `lib/route/validate.test.js`

**Interfaces:**
- Consumes: everything from Tasks 1–4; `parseSummitMulti`, `SUMMIT_HOURLY` (`lib/hike/parse.js`); `blendSummitHourly` (`lib/hike/blend.js`); `OM_MODELS`, `CORE_MODELS` (`lib/outlook/models.js`); `addDays`, `localHourIso` (`lib/localtime.js`).
- Produces:
  - `findRoutes(peak, { getJson, getElevations, max = 8 }) → routes[] | null`; a route = `{ id, ref, name, from, to, difficulty, roundTrip, distanceKm, ascentM, descentM, minutes, points: [[lat, lon, ele]] }` (stats are for the walk, there and back when `roundTrip`).
  - `routeWeather({ points, date, pace, start, roundTrip, now }, { getJson, getElevations, weights }) → result | null`; result = `{ stats: { distanceKm, ascentM, descentM, minutes, longerThanDay }, samples: [{ i, km, ele }], suggestion: { start, latest, highAt, finish } | { none: true, reason, firstBad, nextDay }, start, stages: [{ i, km, ele, eta, high, temp, feels, wind, rain, storm, icon, blocker }], date, todayLocal, utcOffsetSec, sun, points: [[lat, lon, ele]] }`.
  - `parseRouteBody(body, todayUtc) → { ok: true, value: { points, date, pace, start, roundTrip } } | { ok: false, error }`.

- [ ] **Step 1: Failing tests**

**File (create): `lib/route/find.test.js`**
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { findRoutes } from './find.js'

const fx = name => JSON.parse(fs.readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8'))
const PEAK = { name: 'Großglockner', lat: 47.0745, lon: 12.6941, elev: 3798 }
const calls = []
const getJson = async url => {
  calls.push(url)
  if (url.includes('/map.json?bbox=')) return fx('osm-glockner-map.json')
  if (url.includes('/relation/14622955/full.json')) return fx('osm-712-full.json')
  return null
}
// higher to the north, like the real 712: Lucknerhaus (south) → summit (north)
const getElevations = async pts => pts.map(p => Math.round(1300 + (p.lat - 47) * 30000))

test('findRoutes — the 712 from the OSM API: uphill, timed there and back, simplified', async () => {
  const routes = await findRoutes(PEAK, { getJson, getElevations })
  assert.ok(calls[0].includes('bbox=12.68510,47.06850,12.70310,47.08050'), calls[0])
  const r = routes.find(x => x.id === 14622955)
  assert.ok(r, JSON.stringify(routes.map(x => x.id)))
  assert.equal(r.ref, '712')
  assert.ok(r.points.length <= 300)
  assert.ok(r.points[0][2] < r.points.at(-1)[2], 'starts low')
  assert.deepEqual(r.points.at(-1), [47.0745, 12.6941, 3798], 'walks on to the summit')
  assert.equal(r.roundTrip, true)
  assert.ok(r.distanceKm > 2 && r.minutes > 60 && r.ascentM > 500)
})

test('findRoutes — the OSM API down: null (the route serves the cache)', async () => {
  assert.equal(await findRoutes(PEAK, { getJson: async () => null, getElevations }), null)
})
```

**File (create): `lib/route/weather.test.js`**
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { routeWeather, forecastUrl } from './weather.js'
import { addDays } from '../localtime.js'

const om = JSON.parse(fs.readFileSync(new URL('./__fixtures__/om-route-3pt.json', import.meta.url), 'utf8'))
const day0 = om[0].hourly.time[0].slice(0, 10)
const NOW = Date.parse(`${day0}T06:00:00Z`) - om[0].utc_offset_seconds * 1000 // 06:00 local, first recorded day
const DATE = addDays(day0, 1)
const PTS = [{ lat: 47.0172, lon: 12.6913, ele: 1920 }, { lat: 47.0603, lon: 12.6779, ele: 2802 }, { lat: 47.0745, lon: 12.6941, ele: 3798 }]
// answers with as many locations as the URL asks for (cycling the recorded three)
const getJson = async url => Array.from({ length: new URL(url).searchParams.get('latitude').split(',').length }, (_, k) => om[k % 3])
const getElevations = async pts => pts.map(() => 2000)
const REASONS = ['storms', 'rain', 'wind', 'cold', 'daylight', 'nodata']

test('routeWeather — three stages, a verdict consistent with them', async () => {
  const r = await routeWeather({ points: PTS, date: DATE, pace: 'normal', now: NOW }, { getJson, getElevations })
  assert.equal(r.stages.length, 3)
  assert.equal(r.todayLocal, day0)
  assert.ok(r.stats.distanceKm > 5 && r.stats.ascentM === 1878)
  assert.ok(r.stages.every(s => /^\d\d:\d\d$/.test(s.eta)))
  assert.equal(r.stages.filter(s => s.high).length, 1)
  if (r.suggestion.none) assert.ok(REASONS.includes(r.suggestion.reason))
  else assert.ok(r.stages.every(s => s.blocker === null), 'a suggested start has no blocked stage')
})

test('routeWeather — my own start time is used for the stages', async () => {
  const r = await routeWeather({ points: PTS, date: DATE, start: '09:15', now: NOW }, { getJson, getElevations })
  assert.equal(r.start, '09:15')
  assert.equal(r.stages[0].eta, '09:15')
})

test('routeWeather — missing elevations are filled; there and back doubles the way', async () => {
  const asked = []
  const r = await routeWeather({ points: PTS.map(p => ({ ...p, ele: null })), date: DATE, roundTrip: true, now: NOW },
    { getJson, getElevations: async pts => { asked.push(pts.length); return pts.map((_, i) => 1500 + i * 500) } })
  assert.deepEqual(asked, [3])
  assert.equal(r.points.length, 5)
  assert.ok(r.points.every(p => typeof p[2] === 'number'))
})

test('routeWeather — the weather request fails or comes back short: null', async () => {
  assert.equal(await routeWeather({ points: PTS, date: DATE, now: NOW }, { getJson: async () => null, getElevations }), null)
  assert.equal(await routeWeather({ points: PTS, date: DATE, now: NOW }, { getJson: async () => [om[0]], getElevations }), null)
})

test('forecastUrl — one multi-point request with per-point elevations and the core models', () => {
  const u = new URL(forecastUrl(PTS))
  assert.equal(u.searchParams.get('latitude'), '47.0172,47.0603,47.0745')
  assert.equal(u.searchParams.get('elevation'), '1920,2802,3798')
  assert.equal(u.searchParams.get('models'), 'ecmwf_ifs025,icon_seamless,gfs_seamless')
})
```

**File (create): `lib/route/validate.test.js`**
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRouteBody } from './validate.js'

const TODAY = '2026-10-02'
const body = patch => ({ points: [[47, 12, 1000], [47.01, 12.01, null]], date: '2026-10-03', ...patch })

test('parseRouteBody — a good body, defaults filled', () => {
  assert.deepEqual(parseRouteBody(body(), TODAY), { ok: true, value: {
    points: [{ lat: 47, lon: 12, ele: 1000 }, { lat: 47.01, lon: 12.01, ele: null }], date: '2026-10-03', pace: 'normal', start: null, roundTrip: false,
  } })
  assert.equal(parseRouteBody(body({ pace: 'fast', start: '07:45', roundTrip: true }), TODAY).value.start, '07:45')
})

test('parseRouteBody — rejects what the engine cannot use', () => {
  for (const bad of [null, {}, body({ points: [[47, 12]] }), body({ points: Array(501).fill([47, 12, 1]) }), body({ points: [[91, 12, 1], [47, 12, 1]] }),
    body({ date: '2026-10-20' }), body({ date: 'tomorrow' }), body({ pace: 'toString' }), body({ start: '25:00' }), body({ start: '7:45' })]) {
    assert.equal(parseRouteBody(bad, TODAY).ok, false, JSON.stringify(bad)?.slice(0, 60))
  }
})
```

- [ ] **Step 2: Run — expect failure**: `node --test lib/route/find.test.js lib/route/weather.test.js lib/route/validate.test.js`

- [ ] **Step 3: Implement**

**File (create): `lib/route/find.js`**
```js
// The marked routes up a peak, from the official OpenStreetMap API (network
// through the injected getJson / getElevations — unit tested with recorded
// responses). Not Overpass: it timed out where this API answered in < 1 s.
import { routesNear, stitch } from './osm.js'
import { simplify, haversineM, withReturn } from './geometry.js'
import { routeStats } from './timing.js'

const OSM = 'https://api.openstreetmap.org/api/0.6'
const BOX = { lat: 0.006, lon: 0.009 }
const r5 = v => Math.round(v * 1e5) / 1e5

async function elevationsFor(points, getElevations) {
  const out = []
  for (let i = 0; i < points.length; i += 100) {
    const e = await getElevations(points.slice(i, i + 100))
    if (!e) return null
    out.push(...e)
  }
  return out
}

export async function findRoutes(peak, { getJson, getElevations, max = 8 }) {
  const bbox = [peak.lon - BOX.lon, peak.lat - BOX.lat, peak.lon + BOX.lon, peak.lat + BOX.lat].map(v => v.toFixed(5)).join(',')
  const map = await getJson(`${OSM}/map.json?bbox=${bbox}`, { ms: 12000 })
  if (!map) return null
  const routes = []
  for (const near of routesNear(map, peak).slice(0, max)) {
    const full = await getJson(`${OSM}/relation/${near.id}/full.json`, { ms: 10000 })
    const s = full && stitch(full)
    if (!s || s.points.length < 2) continue
    let points = simplify(s.points, 300)
    const eles = await elevationsFor(points, getElevations)
    if (eles) points = points.map((p, i) => ({ ...p, ele: eles[i] }))
    // the end nearer the summit goes last; up to the point nearest the summit,
    // then on to the summit itself (routes usually stop at the last hut)
    if (haversineM(points[0], peak) < haversineM(points.at(-1), peak)) points = points.slice().reverse()
    let closest = 0
    points.forEach((p, i) => { if (haversineM(p, peak) < haversineM(points[closest], peak)) closest = i })
    points = points.slice(0, closest + 1)
    if (haversineM(points.at(-1), peak) > 100) points.push({ lat: peak.lat, lon: peak.lon, ele: peak.elev })
    // up and back down the same way
    const roundTrip = true
    const stats = routeStats(withReturn(points), 'normal')
    routes.push({
      id: s.id, ref: s.ref, name: s.name, from: s.from, to: s.to, difficulty: s.difficulty, roundTrip, ...stats,
      points: points.map(p => [r5(p.lat), r5(p.lon), p.ele == null ? null : Math.round(p.ele)]),
    })
  }
  return routes
}
```

**File (create): `lib/route/weather.js`**
```js
// Weather along a route (network through injected getJson / getElevations —
// unit tested with a recorded multi-point response): fill elevations, time
// the walk, one Open-Meteo request for the stage points (the three core
// models, each point at its own height), the summit engine's blend per point,
// then the suggested start and the stages.
import { parseSummitMulti, SUMMIT_HOURLY } from '../hike/parse.js'
import { blendSummitHourly } from '../hike/blend.js'
import { OM_MODELS, CORE_MODELS } from '../outlook/models.js'
import { addDays, localHourIso } from '../localtime.js'
import { cumulative, climb, withReturn, highestIndex } from './geometry.js'
import { etas } from './timing.js'
import { pickSamples } from './samples.js'
import { suggestStart, stagesAt, toMin, hhmm } from './verdict.js'

const CORE = OM_MODELS.filter(m => CORE_MODELS.includes(m.model))

export function forecastUrl(points) {
  const list = k => points.map(p => p[k].toFixed(4)).join(',')
  return `https://api.open-meteo.com/v1/forecast?latitude=${list('lat')}&longitude=${list('lon')}&elevation=${points.map(p => Math.round(p.ele ?? 0)).join(',')}`
    + `&hourly=${SUMMIT_HOURLY.join(',')}&daily=sunrise,sunset&models=${CORE_MODELS.join(',')}&forecast_days=8&timezone=auto`
}

export async function routeWeather({ points, date, pace = 'normal', start = null, roundTrip = false, now = Date.now() }, { getJson, getElevations, weights = {} }) {
  let pts = points.map(p => ({ ...p }))
  const missing = pts.flatMap((p, i) => (p.ele == null ? [i] : []))
  for (let k = 0; k < missing.length; k += 100) {
    const chunk = missing.slice(k, k + 100)
    const e = await getElevations(chunk.map(i => pts[i]))
    if (e) chunk.forEach((i, j) => { pts[i].ele = e[j] })
  }
  if (roundTrip) pts = withReturn(pts)

  const dist = cumulative(pts), offsetsAll = etas(pts, pace)
  const idx = pickSamples(pts)
  const samples = idx.map(i => ({ i, km: Math.round(dist[i] / 100) / 10, ele: pts[i].ele == null ? null : Math.round(pts[i].ele), offset: Math.round(offsetsAll[i]) }))
  const raw = await getJson(forecastUrl(idx.map(i => pts[i])), { cache: 'no-store', ms: 15000, retries: 1 })
  const list = Array.isArray(raw) ? raw : raw ? [raw] : []
  if (list.length !== idx.length) return null
  const parsed = list.map(j => parseSummitMulti(j, CORE))
  if (parsed.some(p => !p?.series?.length)) return null

  const utcOffsetSec = parsed[0].utcOffsetSec
  const todayLocal = localHourIso(utcOffsetSec, now).slice(0, 10)
  const nowMin = toMin(new Date(now + utcOffsetSec * 1000).toISOString().slice(11, 16))
  const hoursByStage = parsed.map((p, k) => blendSummitHourly(p.series, weights, { nowLocal: `${todayLocal}T00:00`, elev: samples[k].ele ?? 0, hours: 24 * 8 }))
  const sunOf = d => parsed[0].sunByDate?.[d] ?? parsed[0].sun
  const offsets = samples.map(s => s.offset)
  const suggestFor = d => suggestStart({ hoursByStage, offsets, date: d, sun: sunOf(d), notBefore: d === todayLocal ? nowMin : 0 })

  const suggestion = suggestFor(date)
  if (suggestion.none) {
    const last = hoursByStage[0].at(-1)?.t.slice(0, 10) ?? date
    for (let d = addDays(date, 1); d <= last; d = addDays(d, 1)) {
      const s = suggestFor(d)
      if (!s.none) { suggestion.nextDay = { date: d, start: s.start }; break }
    }
  }
  const hi = highestIndex(idx.map(i => pts[i]))
  const total = offsetsAll.at(-1)
  const startMin = start != null ? toMin(start) : suggestion.startMinute ?? toMin(sunOf(date)?.sunrise) ?? 360
  const stages = stagesAt({ hoursByStage, offsets, date, start: startMin }).map((s, k) => ({
    i: samples[k].i, km: samples[k].km, ele: samples[k].ele, eta: s.eta, high: k === hi,
    temp: s.hour?.temp ?? null, feels: s.hour?.feels ?? null, wind: s.hour?.windKmh ?? null, rain: s.hour?.rainPct ?? null,
    storm: s.hour?.storm ?? null, icon: s.hour?.icon ?? null, blocker: s.blocker,
  }))
  return {
    stats: { distanceKm: Math.round(dist.at(-1) / 100) / 10, ...climb(pts), minutes: Math.round(total), longerThanDay: total > 12 * 60 },
    samples: samples.map(({ offset, ...s }) => s),
    suggestion: suggestion.none
      ? { none: true, reason: suggestion.reason, firstBad: suggestion.firstBad, nextDay: suggestion.nextDay ?? null }
      : { start: suggestion.start, latest: suggestion.latest, highAt: hhmm(suggestion.startMinute + samples[hi].offset), finish: hhmm(suggestion.startMinute + total) },
    start: hhmm(startMin),
    stages, date, todayLocal, utcOffsetSec, sun: sunOf(date),
    points: pts.map(p => [p.lat, p.lon, p.ele == null ? null : Math.round(p.ele)]),
  }
}
```

**File (create): `lib/route/validate.js`**
```js
// The /api/route-weather body (pure — unit tested).
import { PACE } from './timing.js'
import { toMin } from './verdict.js'
import { addDays } from '../localtime.js'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const bad = error => ({ ok: false, error })
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi

export function parseRouteBody(b, todayUtc) {
  if (!b || typeof b !== 'object') return bad('Invalid body')
  if (!Array.isArray(b.points) || b.points.length < 2 || b.points.length > 500) return bad('A route needs 2–500 points')
  const points = []
  for (const p of b.points) {
    if (!Array.isArray(p) || !num(p[0], -90, 90) || !num(p[1], -180, 180)) return bad('Invalid point')
    points.push({ lat: p[0], lon: p[1], ele: num(p[2], -500, 9000) ? p[2] : null })
  }
  if (typeof b.date !== 'string' || !DATE.test(b.date) || b.date < addDays(todayUtc, -1) || b.date > addDays(todayUtc, 7)) return bad('The day must be within the forecast')
  const pace = b.pace ?? 'normal'
  if (typeof pace !== 'string' || !Object.hasOwn(PACE, pace)) return bad('Invalid pace')
  const start = b.start ?? null
  if (start !== null && (toMin(start) == null || toMin(start) >= 24 * 60)) return bad('Invalid start time')
  return { ok: true, value: { points, date: b.date, pace, start, roundTrip: b.roundTrip === true } }
}
```

- [ ] **Step 4: Run** — `node --test lib/route/*.test.js` → pass; `npm test` → pass.
- [ ] **Step 5: Commit** — `git add lib/route && git commit -m "Routes: findRoutes, routeWeather and body validation"`

### Task 6: Database and the two endpoints

**Files:**
- Create: `supabase/migration8.sql`, `app/api/routes/route.js`, `app/api/route-weather/route.js`

**Interfaces:**
- Consumes: `findRoutes`, `routeWeather`, `parseRouteBody` (Task 5); `parsePeakQuery` (`lib/hike/params.js`); `getJson`, `lastUpstreamFailure` (`lib/outlook/http.js`); `fetchElevations` (`lib/hike/sources.js`); `loadOutlookWeights` (`lib/outlook/weights.js`); `getRegion` (`lib/weather.js`).
- Produces: `GET /api/routes?lat&lon&elev&name` → `{ routes }`; `POST /api/route-weather` → the `routeWeather` result; table `route_cache`; column `hike_plans.route jsonb`.

- [ ] **Step 1: Migration**

**File (create): `supabase/migration8.sql`**
```sql
-- Hiking v2: OSM routes per peak, cached a week (OSM API usage policy), and
-- the route a planned hike is walked on.
create table if not exists public.route_cache (
  peak_key text primary key,
  routes jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.route_cache enable row level security;
alter table public.hike_plans add column if not exists route jsonb;
```
Apply it with the Supabase MCP `apply_migration` (name `hiking_routes`), then check `get_advisors` (security) shows nothing new beyond the intentional RLS-without-policy INFO.

- [ ] **Step 2: Endpoints**

**File (create): `app/api/routes/route.js`**
```js
import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { supabase } from '@/lib/supabase'
import { parsePeakQuery } from '@/lib/hike/params'
import { getJson, lastUpstreamFailure } from '@/lib/outlook/http'
import { fetchElevations } from '@/lib/hike/sources'
import { findRoutes } from '@/lib/route/find'

// The marked routes up a peak (OpenStreetMap). One OSM lookup per peak a
// week (route_cache), plus a day on the CDN; an OSM outage serves the stale
// copy rather than nothing.
// GET /api/routes?lat=47.0745&lon=12.6941&elev=3798&name=Großglockner
export const maxDuration = 60

const WEEK = 7 * 86400e3
const limiter = createRateLimiter({ max: 20, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const ok = routes => Response.json({ routes }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } })

export const GET = withErrorLog('routes', async (request) => {
  const peak = parsePeakQuery(new URL(request.url).searchParams)
  if (!peak) return noStore({ error: 'lat, lon and elev are required' }, 400)
  // only cache misses reach this point — CDN hits never invoke the function
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)
  const key = `${peak.lat.toFixed(3)},${peak.lon.toFixed(3)}`
  const { data: cached } = await supabase.from('route_cache').select('routes, fetched_at').eq('peak_key', key).maybeSingle()
  if (cached && Date.now() - Date.parse(cached.fetched_at) < WEEK) return ok(cached.routes)
  const fresh = await findRoutes(peak, { getJson, getElevations: fetchElevations })
  if (fresh) {
    await supabase.from('route_cache').upsert({ peak_key: key, routes: fresh, fetched_at: new Date().toISOString() })
    return ok(fresh)
  }
  if (cached) return ok(cached.routes)
  return noStore({ error: 'Routes unavailable right now', upstream: lastUpstreamFailure() }, 502)
})
```

**File (create): `app/api/route-weather/route.js`**
```js
import { withErrorLog, logError } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { getRegion } from '@/lib/weather'
import { loadOutlookWeights } from '@/lib/outlook/weights'
import { getJson, lastUpstreamFailure } from '@/lib/outlook/http'
import { fetchElevations } from '@/lib/hike/sources'
import { parseRouteBody } from '@/lib/route/validate'
import { routeWeather } from '@/lib/route/weather'

// Weather along a route, walking times and the suggested start.
// POST /api/route-weather { points: [[lat, lon, ele|null]…], date, pace?, start?, roundTrip? }
export const maxDuration = 60

const limiter = createRateLimiter({ max: 20, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const POST = withErrorLog('route-weather', async (request) => {
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)
  const q = parseRouteBody(await request.json().catch(() => null), new Date().toISOString().slice(0, 10))
  if (!q.ok) return noStore({ error: q.error }, 400)
  const p0 = q.value.points[0]
  const weights = await loadOutlookWeights(getRegion(p0.lat, p0.lon))
  const r = await routeWeather(q.value, { getJson, getElevations: fetchElevations, weights })
  if (!r) {
    await logError('route.upstream', new Error('route weather unavailable'), { upstream: lastUpstreamFailure() })
    return noStore({ error: 'Weather along the route is unavailable right now', upstream: lastUpstreamFailure() }, 502)
  }
  return noStore(r, 200)
})
```

- [ ] **Step 3: Lint + tests** — `npx eslint app/api/routes app/api/route-weather lib/route --max-warnings 0`, `npm test` → clean.
- [ ] **Step 4: Commit + push**, wait for the deployment, then smoke on production:
  - `curl -s "https://metablend.app/api/routes?lat=47.0745&lon=12.6941&elev=3798&name=Gro%C3%9Fglockner"` → `routes` contains `"ref":"712"`; a second call returns the same quickly (cache).
  - POST the first route's points with tomorrow's date: `curl -s -X POST https://metablend.app/api/route-weather -H "Content-Type: application/json" -d @body.json` → `stages` (6–10), `suggestion` with `start` or `none`.
  - Bad body → 400.

## Stage 2 — App screens

### Task 7: Saved routes and translations

**Files:**
- Create: `lib/route/saved.js`, `lib/route/saved.test.js`, `lib/route-store.js`, `lib/route/reasons.js`
- Modify: `lib/i18n.js` (route keys, five languages)

**Interfaces:**
- Produces: `MAX_ROUTES`, `upsertRoute(list, route, max) → list`; `listRoutes()`, `getRoute(id)`, `saveRoute(route)`, `removeRoute(id)` (Preferences in the app, `localStorage` on the website for `?app=1` testing); `REASON_KEY` (all route blocker reasons → i18n keys). A saved route = `{ id, name, source: 'gpx'|'osm', roundTrip, points: [[lat, lon, ele]], savedAt, planned? }`.

- [ ] **Step 1: Failing test**

**File (create): `lib/route/saved.test.js`**
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { upsertRoute } from './saved.js'

const r = (id, extra = {}) => ({ id, name: id, points: [], savedAt: 1, ...extra })

test('upsertRoute — newest first, same id replaced', () => {
  assert.deepEqual(upsertRoute([r('a'), r('b')], r('b', { name: 'B2' })).map(x => [x.id, x.name]), [['b', 'B2'], ['a', 'a']])
})

test('upsertRoute — past the limit the oldest unplanned route goes', () => {
  const list = [r('c'), r('b', { planned: true }), r('a', { planned: true })]
  assert.deepEqual(upsertRoute(list, r('d'), 3).map(x => x.id), ['d', 'b', 'a'])
  assert.deepEqual(upsertRoute([r('b', { planned: true }), r('a', { planned: true })], r('d'), 2).map(x => x.id), ['d', 'b', 'a'])
})
```
Run `node --test lib/route/saved.test.js` → fails.

- [ ] **Step 2: Implement**

**File (create): `lib/route/saved.js`**
```js
// The phone's saved routes as a list (pure — unit tested): newest first, the
// same id replaces its old copy, past the limit the oldest route without a
// planned hike is dropped (planned ones stay, even over the limit).
export const MAX_ROUTES = 30

export function upsertRoute(list, route, max = MAX_ROUTES) {
  const out = [{ ...route, savedAt: route.savedAt ?? Date.now() }, ...(list ?? []).filter(x => x.id !== route.id)]
  while (out.length > max) {
    let k = -1
    for (let i = out.length - 1; i > 0; i--) if (!out[i].planned) { k = i; break }
    if (k < 0) break
    out.splice(k, 1)
  }
  return out
}
```

**File (create): `lib/route-store.js`**
```js
// Saved routes on the phone (native Preferences, like the device key); in a
// browser with ?app=1 (testing) localStorage instead. Never throws.
import { isNative } from './native'
import { loadPlugin } from './capacitor-plugin'
import { upsertRoute } from './route/saved.js'

const KEY = 'mb_routes'
const prefs = () => loadPlugin(() => import('@capacitor/preferences'), 'Preferences')

async function read() {
  try {
    const raw = isNative() ? (await (await prefs()).plugin.get({ key: KEY })).value : localStorage.getItem(KEY)
    const v = JSON.parse(raw ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

async function write(list) {
  try {
    const value = JSON.stringify(list)
    if (isNative()) await (await prefs()).plugin.set({ key: KEY, value })
    else localStorage.setItem(KEY, value)
  } catch { /* storage full or blocked: the route just isn't kept */ }
  return list
}

export const listRoutes = read
export const getRoute = async id => (await read()).find(r => r.id === id) ?? null
export const saveRoute = async route => write(upsertRoute(await read(), route))
export const removeRoute = async id => write((await read()).filter(r => r.id !== id))
export const markPlanned = async id => write((await read()).map(r => (r.id === id ? { ...r, planned: true } : r)))
```

**File (create): `lib/route/reasons.js`**
```js
// Why a stage or a day isn't walkable, as i18n keys: the summit engine's
// reasons plus the route-only ones.
import { REASON } from '../hike/text.js'

export const REASON_KEY = { ...REASON, daylight: 'routeReasonDaylight', nodata: 'routeReasonNodata' }
```

i18n: write this script to a scratch file and run it with `node <file> lib/i18n.js` (inserts after the `swNoDaylight:` line of each language block, in the file's en/de/fr/es/it order):

**File (create): `.superpowers/route-i18n.cjs`**
```js
const fs = require('fs')
const f = process.argv[2]
let s = fs.readFileSync(f, 'utf8')
const nl = s.includes('\r\n') ? '\r\n' : '\n'
const K = {
  routesTitle: ['Routes', 'Routen', 'Itinéraires', 'Rutas', 'Percorsi'],
  routesLoading: ['Looking for marked routes…', 'Suche markierte Routen…', 'Recherche d’itinéraires balisés…', 'Buscando rutas señalizadas…', 'Cerco percorsi segnati…'],
  routesNone: ['No marked routes found — import a GPX', 'Keine markierten Routen gefunden – importiere eine GPX', 'Aucun itinéraire balisé trouvé — importez un GPX', 'No se encontraron rutas señalizadas — importa un GPX', 'Nessun percorso segnato trovato — importa un GPX'],
  routesUnavailable: ['Routes unavailable right now — try again later', 'Routen gerade nicht verfügbar – versuch es später', 'Itinéraires indisponibles pour le moment — réessayez plus tard', 'Rutas no disponibles ahora — inténtalo más tarde', 'Percorsi non disponibili ora — riprova più tardi'],
  routeRoundTrip: ['there and back', 'hin und zurück', 'aller-retour', 'ida y vuelta', 'andata e ritorno'],
  importGpx: ['Import GPX', 'GPX importieren', 'Importer un GPX', 'Importar GPX', 'Importa GPX'],
  myRoutes: ['My routes', 'Meine Routen', 'Mes itinéraires', 'Mis rutas', 'I miei percorsi'],
  myRoutesEmpty: ['Imported and saved routes show up here.', 'Importierte und gespeicherte Routen erscheinen hier.', 'Les itinéraires importés et enregistrés apparaissent ici.', 'Las rutas importadas y guardadas aparecen aquí.', 'I percorsi importati e salvati compaiono qui.'],
  routeSave: ['Save route', 'Route speichern', 'Enregistrer', 'Guardar ruta', 'Salva percorso'],
  routeSaved: ['Saved in My routes', 'In Meine Routen gespeichert', 'Enregistré dans Mes itinéraires', 'Guardada en Mis rutas', 'Salvato in I miei percorsi'],
  routeRemove: ['Remove', 'Entfernen', 'Supprimer', 'Quitar', 'Rimuovi'],
  gpxBad: ['This file has no route we can read', 'Diese Datei enthält keine lesbare Route', 'Ce fichier ne contient pas d’itinéraire lisible', 'Este archivo no tiene una ruta legible', 'Questo file non contiene un percorso leggibile'],
  gpxTooBig: ['This file is too big (max 5 MB)', 'Diese Datei ist zu groß (max. 5 MB)', 'Ce fichier est trop volumineux (max. 5 Mo)', 'Este archivo es demasiado grande (máx. 5 MB)', 'Questo file è troppo grande (max 5 MB)'],
  paceSlow: ['Slow', 'Gemütlich', 'Lente', 'Lento', 'Lento'],
  paceNormal: ['Normal', 'Normal', 'Normale', 'Normal', 'Normale'],
  paceFast: ['Fast', 'Zügig', 'Rapide', 'Rápido', 'Veloce'],
  routeStartWindow: ['Start between {from} and {to}', 'Start zwischen {from} und {to}', 'Départ entre {from} et {to}', 'Sal entre las {from} y las {to}', 'Partenza tra le {from} e le {to}'],
  routeStartAt: ['Start at {from}', 'Start um {from}', 'Départ à {from}', 'Sal a las {from}', 'Partenza alle {from}'],
  routeSummitBack: ['summit ~{high}, back ~{finish}', 'Gipfel ~{high}, zurück ~{finish}', 'sommet ~{high}, retour ~{finish}', 'cumbre ~{high}, vuelta ~{finish}', 'vetta ~{high}, ritorno ~{finish}'],
  routeSafeNote: ['Every stage inside the safe window', 'Jede Etappe im sicheren Fenster', 'Chaque étape dans la fenêtre sûre', 'Cada tramo dentro de la ventana segura', 'Ogni tappa nella finestra sicura'],
  routeNoStart: ['No safe start {day}', 'Kein sicherer Start {day}', 'Aucun départ sûr {day}', 'Ninguna salida segura {day}', 'Nessuna partenza sicura {day}'],
  routeWhyNot: ['{reason} — from {eta} at km {km}', '{reason} – ab {eta} bei km {km}', '{reason} — dès {eta} au km {km}', '{reason} — desde las {eta} en el km {km}', '{reason} — dalle {eta} al km {km}'],
  routeNextDay: ['Next safe day: {day}, start {start}', 'Nächster sicherer Tag: {day}, Start {start}', 'Prochain jour sûr : {day}, départ {start}', 'Próximo día seguro: {day}, salida {start}', 'Prossimo giorno sicuro: {day}, partenza {start}'],
  routeOwnStart: ['Own start time', 'Eigene Startzeit', 'Heure de départ', 'Hora de salida propia', 'Orario di partenza'],
  routeUseSuggestion: ['Use the suggestion', 'Vorschlag nehmen', 'Utiliser la suggestion', 'Usar la sugerencia', 'Usa il suggerimento'],
  routeStages: ['Along the way', 'Unterwegs', 'En chemin', 'Por el camino', 'Lungo il percorso'],
  routeLongerThanDay: ['Longer than a day — only the first day is timed', 'Länger als ein Tag – nur der erste Tag wird berechnet', 'Plus long qu’une journée — seul le premier jour est calculé', 'Más de un día — solo se calcula el primer día', 'Più lungo di un giorno — si calcola solo il primo giorno'],
  routeWeatherFail: ['Weather along the route is unavailable right now', 'Wetter entlang der Route gerade nicht verfügbar', 'Météo le long de l’itinéraire indisponible pour le moment', 'El tiempo a lo largo de la ruta no está disponible ahora', 'Meteo lungo il percorso non disponibile ora'],
  routeLoading: ['Checking the weather along the route…', 'Prüfe das Wetter entlang der Route…', 'Vérification de la météo le long de l’itinéraire…', 'Comprobando el tiempo a lo largo de la ruta…', 'Controllo il meteo lungo il percorso…'],
  routeStartLabel: ['Start', 'Start', 'Départ', 'Salida', 'Partenza'],
  routeFinishLabel: ['Finish', 'Ziel', 'Arrivée', 'Llegada', 'Arrivo'],
  routeHigh: ['Highest point', 'Höchster Punkt', 'Point culminant', 'Punto más alto', 'Punto più alto'],
  routeReasonDaylight: ['longer than the daylight', 'länger als das Tageslicht', 'plus long que la journée', 'más largo que la luz del día', 'più lungo della luce del giorno'],
  routeReasonNodata: ['no forecast that far', 'keine Vorhersage so weit', 'pas de prévision si loin', 'sin previsión tan lejana', 'nessuna previsione così lontana'],
  pushRouteStart: ['Start by {start} — summit ~{high} (safe to start until {latest})', 'Start um {start} – Gipfel ~{high} (sicherer Start bis {latest})', 'Départ à {start} — sommet ~{high} (départ sûr jusqu’à {latest})', 'Sal a las {start} — cumbre ~{high} (salida segura hasta las {latest})', 'Partenza alle {start} — vetta ~{high} (partenza sicura fino alle {latest})'],
  pushRouteNone: ['No safe start {day}: {reason}', 'Kein sicherer Start {day}: {reason}', 'Aucun départ sûr {day} : {reason}', 'Ninguna salida segura {day}: {reason}', 'Nessuna partenza sicura {day}: {reason}'],
}
let block = 0
s = s.replace(/^(\s*)swNoDaylight: '[^']*',(\r?\n)/gm, (m, ind) => {
  const add = Object.entries(K).map(([k, v]) => `${ind}${k}: '${v[block].replace(/'/g, "\\'")}',`).join(nl)
  block++
  return m + add + nl
})
if (block !== 5) throw new Error('language blocks: ' + block)
fs.writeFileSync(f, s)
console.log('ok', Object.keys(K).length, 'keys × 5')
```
Run: `node .superpowers/route-i18n.cjs lib/i18n.js` then `rm .superpowers/route-i18n.cjs`.

- [ ] **Step 3: Run** — `node --test lib/route/saved.test.js` → pass; `npm test` → pass (i18n parity included).
- [ ] **Step 4: Commit** — `git add lib/route lib/route-store.js lib/i18n.js && git commit -m "Routes: saved routes on the phone, route texts in five languages"`

### Task 8: Map and elevation profile

**Files:**
- Create: `app/components/hike/RouteMap.jsx`, `app/components/hike/RouteProfile.jsx`

**Interfaces:**
- Consumes: `loadLeaflet` (`lib/leaflet.js`, resolves `L` or null), `cumulative` (Task 1).
- Produces: `<RouteMap points={[[lat, lon, ele]]} highIndex={i} />`, `<RouteProfile points={[[lat, lon, ele]]} stages={[{ i, blocker }]} />`.

- [ ] **Step 1: Components**

**File (create): `app/components/hike/RouteMap.jsx`**
```jsx
'use client'

import { useEffect, useRef } from 'react'
import { loadLeaflet } from '@/lib/leaflet'

const TOPO = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
const OSM = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

// The route on a topographic map: the line, start (green), the highest point
// (white) and the end (red). OpenTopoMap first; its first tile error switches
// to the standard OSM tiles.
export default function RouteMap({ points, highIndex }) {
  const box = useRef(null), map = useRef(null)

  useEffect(() => {
    let gone = false
    loadLeaflet().then(L => {
      if (gone || !L || !box.current || !points?.length) return
      map.current ??= L.map(box.current, { zoomControl: false, scrollWheelZoom: false })
      const m = map.current
      m.eachLayer(l => m.removeLayer(l))
      const topo = L.tileLayer(TOPO, { maxZoom: 17, subdomains: 'abc', attribution: '© OpenTopoMap (CC-BY-SA), © OpenStreetMap contributors' })
      let fell = false
      topo.on('tileerror', () => {
        if (fell) return
        fell = true
        m.removeLayer(topo)
        L.tileLayer(OSM, { maxZoom: 19, subdomains: 'abc', attribution: '© OpenStreetMap contributors' }).addTo(m)
      })
      topo.addTo(m)
      const ll = points.map(p => [p[0], p[1]])
      const line = L.polyline(ll, { color: '#ffd98a', weight: 4, opacity: 0.95 }).addTo(m)
      const dot = (at, fill) => L.circleMarker(at, { radius: 6, color: '#0f1b33', weight: 2, fillColor: fill, fillOpacity: 1 }).addTo(m)
      dot(ll[0], '#8eecc4')
      dot(ll.at(-1), '#ff9a9a')
      if (highIndex != null && ll[highIndex]) dot(ll[highIndex], '#ffffff')
      m.fitBounds(line.getBounds(), { padding: [24, 24] })
    })
    return () => { gone = true }
  }, [points, highIndex])

  useEffect(() => () => { map.current?.remove(); map.current = null }, [])

  return <div ref={box} className="h-64 sm:h-80 rounded-2xl overflow-hidden border border-zinc-800" role="img" aria-label="Route map" />
}
```

**File (create): `app/components/hike/RouteProfile.jsx`**
```jsx
import { cumulative } from '@/lib/route/geometry'

// Elevation over distance, the stage points marked green (fine) or red
// (blocked). Points without an elevation are skipped.
export default function RouteProfile({ points, stages }) {
  const pts = points.map(p => ({ lat: p[0], lon: p[1], ele: p[2] }))
  const dist = cumulative(pts)
  const eles = pts.map(p => p.ele).filter(v => typeof v === 'number')
  if (eles.length < 2) return null
  const W = 600, H = 140, L = 40, R = 8, T = 10, B = 20
  const max = Math.max(...eles), min = Math.min(...eles), total = dist.at(-1) || 1
  const x = d => L + (d / total) * (W - L - R)
  const y = e => T + (1 - (e - min) / Math.max(1, max - min)) * (H - T - B)
  let line = '', first = null, last = null
  pts.forEach((p, i) => {
    if (typeof p.ele !== 'number') return
    line += `${line ? 'L' : 'M'}${x(dist[i]).toFixed(1)},${y(p.ele).toFixed(1)}`
    first ??= i
    last = i
  })
  const area = `${line}L${x(dist[last]).toFixed(1)},${H - B}L${x(dist[first]).toFixed(1)},${H - B}Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${Math.round(min)}–${Math.round(max)} m, ${(total / 1000).toFixed(1)} km`}>
      <path d={area} fill="var(--accent)" opacity="0.15" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" />
      <text x={L - 6} y={y(max) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{Math.round(max)}</text>
      <text x={L - 6} y={y(min)} textAnchor="end" fontSize="10" fill="var(--muted)">{Math.round(min)}</text>
      <text x={W - R} y={H - 4} textAnchor="end" fontSize="10" fill="var(--muted)">{(total / 1000).toFixed(1)} km</text>
      {stages?.map(s => (typeof pts[s.i]?.ele === 'number'
        ? <circle key={s.i} cx={x(dist[s.i])} cy={y(pts[s.i].ele)} r="4" fill={s.blocker ? 'var(--bad)' : 'var(--ok)'} />
        : null))}
    </svg>
  )
}
```

- [ ] **Step 2: Lint** — `npx eslint app/components/hike/RouteMap.jsx app/components/hike/RouteProfile.jsx --max-warnings 0` → clean.
- [ ] **Step 3: Commit** — `git add app/components/hike && git commit -m "Routes: map and elevation profile"`

### Task 9: Route view, peak routes, GPX import, My routes

**Files:**
- Create: `app/components/hike/RouteView.jsx`, `app/components/hike/RouteScreen.jsx`, `app/components/hike/RouteList.jsx`, `app/components/hike/ImportGpx.jsx`, `app/components/hike/MyRoutes.jsx`
- Modify: `app/components/hike/HikeApp.jsx`, `app/components/hike/PeakView.jsx`

**Interfaces:**
- Consumes: Tasks 1–8; `t`, `tn` (`lib/i18n.js`); `fill`, `tempFormatter`, `dayWord`, `dayPhrase` (`lib/outlook/text.js`); `addDays` (`lib/localtime.js`); `localToday` (`lib/app-widget-sync.js`); `STORM_COLOR` (`./SummitStrip`); `SectionTitle` (`../ui`); `REASON_KEY` (Task 7); `listRoutes`, `getRoute`, `saveRoute`, `removeRoute` (Task 7).
- Produces: URL scheme — `/hike?route=<savedId>` (a saved route) and `/hike?<peak params>&route=osm-<relationId>` (an OSM route of that peak); `<RouteView route lang unit onBack onSave saved />`.

- [ ] **Step 1: Components**

**File (create): `app/components/hike/RouteView.jsx`**
```jsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CloudOff, RotateCcw, Save, Check, Footprints } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fill, tempFormatter, dayWord, dayPhrase } from '@/lib/outlook/text'
import { addDays } from '@/lib/localtime'
import { localToday } from '@/lib/app-widget-sync'
import { highestIndex, withReturn } from '@/lib/route/geometry'
import { routeStats } from '@/lib/route/timing'
import { REASON_KEY } from '@/lib/route/reasons'
import { SectionTitle } from '../ui'
import { STORM_COLOR } from './SummitStrip'
import RouteMap from './RouteMap'
import RouteProfile from './RouteProfile'

const PACES = [['slow', 'paceSlow'], ['normal', 'paceNormal'], ['fast', 'paceFast']]
const asPoints = list => list.map(p => ({ lat: p[0], lon: p[1], ele: p[2] }))
const duration = m => `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}`

// One route: map, profile, stats, day / pace / start, the suggestion and the
// stages along the way. route = { id, name, source, roundTrip, points }.
export default function RouteView({ route, lang, unit, onBack, onSave, saved, children }) {
  const today = localToday()
  const [date, setDate] = useState(today)
  const [pace, setPace] = useState('normal')
  const [start, setStart] = useState(null) // null = the suggestion
  const [attempt, setAttempt] = useState(0)
  const [res, setRes] = useState({ key: null, data: null, error: false })
  const key = [date, pace, start ?? '', attempt].join('|')

  useEffect(() => {
    let off = false
    fetch('/api/route-weather', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: route.points, date, pace, start, roundTrip: !!route.roundTrip }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(data => { if (!off) setRes({ key, data, error: false }) }, () => { if (!off) setRes(r => ({ key, data: r.data, error: true })) })
    return () => { off = true }
  }, [key, route, date, pace, start])

  const loading = res.key !== key
  const d = res.data
  const fmt = useMemo(() => tempFormatter(unit), [unit])
  const local = useMemo(() => routeStats(route.roundTrip ? withReturn(asPoints(route.points)) : asPoints(route.points), pace), [route, pace])
  const stats = d?.stats ?? local
  const points = d?.points ?? route.points
  const highIdx = d ? d.stages.find(s => s.high)?.i : highestIndex(asPoints(route.points))
  const days = Array.from({ length: 7 }, (_, k) => addDays(today, k))
  const word = date2 => { const w = dayWord(lang, date2, today); return w.charAt(0).toLocaleUpperCase(lang) + w.slice(1) }
  const s = d?.suggestion
  const why = s?.none && s.firstBad ? fill(t(lang, 'routeWhyNot'), { reason: t(lang, REASON_KEY[s.reason]), eta: s.firstBad.eta, km: d.stages[s.firstBad.i]?.km ?? '–' }) : s?.none ? t(lang, REASON_KEY[s.reason]) : null
  const label = (st, k) => (k === 0 ? t(lang, 'routeStartLabel') : k === d.stages.length - 1 ? t(lang, 'routeFinishLabel') : st.high ? t(lang, 'routeHigh') : `km ${st.km}`)

  return (
    <div className="space-y-4 animate-fade-in">
      <button onClick={onBack} className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5">
        <ArrowLeft size={15} aria-hidden /> {t(lang, 'hikeBack')}
      </button>
      <div>
        <h1 className="mb-rise text-3xl sm:text-4xl font-semibold tracking-tight">{route.name || t(lang, 'routesTitle')}</h1>
        <p className="text-zinc-500 text-xs tracking-wider mt-1">
          {stats.distanceKm} km · ↑{stats.ascentM} m · ↓{stats.descentM} m · ~{duration(stats.minutes)}{route.roundTrip ? ` · ${t(lang, 'routeRoundTrip')}` : ''}
        </p>
      </div>

      <RouteMap points={points} highIndex={highIdx} />
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3"><RouteProfile points={points} stages={d?.stages} /></div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t(lang, 'planPick')}>
        {days.map(x => (
          <button key={x} onClick={() => { setDate(x); setStart(null) }} aria-pressed={date === x}
            className={`press rounded-lg px-3 py-1.5 text-sm ${date === x ? 'bg-emerald-400 text-black font-semibold' : 'bg-zinc-800 hover:text-emerald-400'}`}>{word(x)}</button>
        ))}
      </div>
      <div className="flex gap-1 bg-zinc-800/60 rounded-xl p-1 w-fit" role="group" aria-label="Pace">
        {PACES.map(([p, k]) => (
          <button key={p} onClick={() => setPace(p)} aria-pressed={pace === p}
            className={`press rounded-lg px-3 py-1 text-sm inline-flex items-center gap-1 ${pace === p ? 'bg-zinc-900 text-emerald-400' : 'text-zinc-400'}`}>
            {p === pace && <Footprints size={13} aria-hidden />}{t(lang, k)}
          </button>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2" aria-live="polite">
        {res.error && !loading ? (
          <div className="text-sm text-zinc-400 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2"><CloudOff size={16} aria-hidden /> {t(lang, 'routeWeatherFail')}</span>
            <button onClick={() => setAttempt(a => a + 1)} className="press inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:border-emerald-400 hover:text-emerald-400">
              <RotateCcw size={13} aria-hidden /> {t(lang, 'retry')}
            </button>
          </div>
        ) : !d || loading ? (
          <p className="text-sm text-zinc-500">{t(lang, 'routeLoading')}</p>
        ) : s.none ? (
          <>
            <p className="text-lg font-semibold" style={{ color: 'var(--bad)' }}>{fill(t(lang, 'routeNoStart'), { day: dayPhrase(lang, date, today) })}</p>
            {why && <p className="text-sm text-zinc-400">{why}</p>}
            {s.nextDay && (
              <button onClick={() => { setDate(s.nextDay.date); setStart(null) }} className="press text-sm text-emerald-400 underline underline-offset-4">
                {fill(t(lang, 'routeNextDay'), { day: word(s.nextDay.date), start: s.nextDay.start })}
              </button>
            )}
          </>
        ) : (
          <>
            <p className="text-lg font-semibold" style={{ color: 'var(--ok)' }}>
              {fill(t(lang, s.start === s.latest ? 'routeStartAt' : 'routeStartWindow'), { from: s.start, to: s.latest })} · {fill(t(lang, 'routeSummitBack'), { high: s.highAt, finish: s.finish })}
            </p>
            <p className="text-xs text-zinc-500">{t(lang, 'routeSafeNote')}</p>
          </>
        )}
        {d && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <label className="text-xs text-zinc-500 inline-flex items-center gap-2">
              {t(lang, 'routeOwnStart')}
              <input type="time" step="900" value={start ?? d.start} min={d.sun?.sunrise ?? undefined} max={d.sun?.sunset ?? undefined}
                onChange={e => e.target.value && setStart(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-sm text-zinc-200" />
            </label>
            {start && <button onClick={() => setStart(null)} className="press text-xs text-emerald-400">{t(lang, 'routeUseSuggestion')}</button>}
          </div>
        )}
        {stats.longerThanDay && <p className="text-xs" style={{ color: 'var(--warn)' }}>{t(lang, 'routeLongerThanDay')}</p>}
      </div>

      {d && !loading && (
        <section className="space-y-2">
          <SectionTitle>{t(lang, 'routeStages')}</SectionTitle>
          <ol className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
            {d.stages.map((st, k) => (
              <li key={st.i} className="flex items-center gap-3 px-4 py-2.5 text-sm" style={st.blocker ? { background: 'color-mix(in srgb, var(--bad) 12%, transparent)' } : undefined}>
                <span className="w-12 font-semibold tabular-nums">{st.eta}</span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{label(st, k)}</span>
                  <span className="block text-xs text-zinc-500">{st.ele != null ? `${st.ele} m` : ''}{st.blocker ? ` · ${t(lang, REASON_KEY[st.blocker])}` : ''}</span>
                </span>
                <span aria-hidden>{st.icon ?? ''}</span>
                <span className="w-24 text-right tabular-nums">{fmt(st.temp)} <span className="text-zinc-500 text-xs">({fmt(st.feels)})</span></span>
                <span className="w-16 text-right text-xs text-zinc-400 tabular-nums">{st.wind ?? '–'} km/h</span>
                <span className="w-10 text-right text-xs text-zinc-400 tabular-nums">{st.rain ?? '–'}%</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STORM_COLOR[st.storm] ?? 'var(--muted)' }} />
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {onSave && (
          <button onClick={onSave} disabled={saved} className="press inline-flex items-center gap-1.5 text-sm text-emerald-400 border border-emerald-400/40 rounded-full px-3 py-1.5 hover:bg-emerald-400/10 disabled:opacity-70">
            {saved ? <Check size={14} aria-hidden /> : <Save size={14} aria-hidden />} {t(lang, saved ? 'routeSaved' : 'routeSave')}
          </button>
        )}
        {children}
      </div>
    </div>
  )
}
```

**File (create): `app/components/hike/RouteScreen.jsx`**
```jsx
'use client'

import { useEffect, useState } from 'react'
import { t } from '@/lib/i18n'
import { getRoute, saveRoute } from '@/lib/route-store'
import RouteView from './RouteView'

// Resolves ?route= into a route: 'osm-<id>' from the peak's route list (CDN
// cached), anything else from the phone's saved routes.
export default function RouteScreen({ routeId, peak, lang, unit, onBack }) {
  const [state, setState] = useState({ route: null, missing: false, saved: false })
  // plain values: a peak from URL parameters is a new object on every render
  const lat = peak?.lat, lon = peak?.lon, elev = peak?.elev, peakName = peak?.name ?? ''

  useEffect(() => {
    let off = false
    const done = (route, saved) => { if (!off) setState({ route, missing: !route, saved }) }
    if (routeId.startsWith('osm-') && lat != null) {
      const id = Number(routeId.slice(4))
      fetch(`/api/routes?lat=${lat}&lon=${lon}&elev=${Math.round(elev)}&name=${encodeURIComponent(peakName)}`)
        .then(r => (r.ok ? r.json() : { routes: [] }))
        .then(async ({ routes }) => {
          const r = (routes ?? []).find(x => x.id === id)
          const route = r && { id: routeId, name: [r.ref, r.name].filter(Boolean).join(' ') || t(lang, 'routeUnnamed'), source: 'osm', roundTrip: r.roundTrip, points: r.points }
          done(route, !!(route && (await getRoute(routeId))))
        }, () => done(null, false))
    } else {
      getRoute(routeId).then(r => done(r, !!r), () => done(null, false))
    }
    return () => { off = true }
  }, [routeId, lat, lon, elev, peakName, lang])

  if (state.missing) return <p className="text-sm text-zinc-500">{t(lang, 'routesUnavailable')}</p>
  if (!state.route) return <p className="text-sm text-zinc-500">{t(lang, 'routesLoading')}</p>
  const canSave = state.route.source === 'osm'
  return (
    <RouteView route={state.route} lang={lang} unit={unit} onBack={onBack}
      saved={state.saved} onSave={canSave ? () => saveRoute({ ...state.route, savedAt: Date.now() }).then(() => setState(s => ({ ...s, saved: true }))) : undefined} />
  )
}
```

**File (create): `app/components/hike/RouteList.jsx`**
```jsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Route as RouteIcon, ChevronRight } from 'lucide-react'
import { t } from '@/lib/i18n'
import { SectionTitle } from '../ui'

const duration = m => `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}`

// Peak page → the marked routes up it (OpenStreetMap). A tap opens the route
// with this peak's parameters kept, so back returns here.
export default function RouteList({ peak, lang }) {
  const router = useRouter()
  const [state, setState] = useState({ routes: null, error: false })

  useEffect(() => {
    let off = false
    fetch(`/api/routes?lat=${peak.lat}&lon=${peak.lon}&elev=${Math.round(peak.elev)}&name=${encodeURIComponent(peak.name ?? '')}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(d => { if (!off) setState({ routes: d.routes ?? [], error: false }) }, () => { if (!off) setState({ routes: [], error: true }) })
    return () => { off = true }
  }, [peak.lat, peak.lon, peak.elev, peak.name])

  const open = id => {
    const sp = new URLSearchParams(window.location.search)
    sp.set('route', `osm-${id}`)
    router.push(`/hike?${sp}`)
  }

  return (
    <section className="space-y-2">
      <SectionTitle icon={RouteIcon}>{t(lang, 'routesTitle')}</SectionTitle>
      {state.routes == null ? (
        <p className="text-sm text-zinc-500">{t(lang, 'routesLoading')}</p>
      ) : state.error ? (
        <p className="text-sm text-zinc-500">{t(lang, 'routesUnavailable')}</p>
      ) : !state.routes.length ? (
        <p className="text-sm text-zinc-500">{t(lang, 'routesNone')}</p>
      ) : (
        <ul className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
          {state.routes.map(r => (
            <li key={r.id}>
              <button onClick={() => open(r.id)} className="press w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-zinc-800/50">
                <span className="flex-1 min-w-0">
                  <span className="block font-medium truncate">{[r.ref, r.name].filter(Boolean).join(' ') || t(lang, 'routeUnnamed')}</span>
                  <span className="block text-xs text-zinc-500">
                    {r.distanceKm} km · ↑{r.ascentM} m · ~{duration(r.minutes)}{r.roundTrip ? ` · ${t(lang, 'routeRoundTrip')}` : ''}
                  </span>
                </span>
                <ChevronRight size={16} className="text-zinc-500" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

**File (create): `app/components/hike/ImportGpx.jsx`**
```jsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
import { t } from '@/lib/i18n'
import { parseGpx } from '@/lib/route/gpx'
import { simplify } from '@/lib/route/geometry'
import { saveRoute } from '@/lib/route-store'

const MAX_BYTES = 5 * 1024 * 1024
const r5 = v => Math.round(v * 1e5) / 1e5

// Hiking → Import GPX: the file is read on the phone, simplified and saved to
// My routes right away (so back and reopening work), then opened.
export default function ImportGpx({ lang }) {
  const router = useRouter()
  const [msg, setMsg] = useState(null)

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_BYTES) { setMsg(t(lang, 'gpxTooBig')); return }
    const g = parseGpx(await file.text().catch(() => ''))
    if (!g) { setMsg(t(lang, 'gpxBad')); return }
    const route = {
      id: `gpx-${Date.now().toString(36)}`,
      name: g.name ?? file.name.replace(/\.gpx$/i, ''),
      source: 'gpx', roundTrip: false, savedAt: Date.now(),
      points: simplify(g.points, 500).map(p => [r5(p.lat), r5(p.lon), p.ele == null ? null : Math.round(p.ele)]),
    }
    await saveRoute(route)
    router.push(`/hike?route=${route.id}`)
  }

  return (
    <div className="space-y-1">
      <label className="press inline-flex items-center gap-1.5 text-sm text-emerald-400 border border-emerald-400/40 rounded-full px-3 py-1.5 hover:bg-emerald-400/10 cursor-pointer">
        <Upload size={14} aria-hidden /> {t(lang, 'importGpx')}
        <input type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml,application/octet-stream" className="sr-only" onChange={pick} />
      </label>
      {msg && <p className="text-xs" role="alert" style={{ color: 'var(--warn)' }}>{msg}</p>}
    </div>
  )
}
```

**File (create): `app/components/hike/MyRoutes.jsx`**
```jsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Route as RouteIcon, Trash2 } from 'lucide-react'
import { t } from '@/lib/i18n'
import { listRoutes, removeRoute } from '@/lib/route-store'
import { SectionTitle } from '../ui'
import ImportGpx from './ImportGpx'

// Hiking → My routes: import a GPX, reopen or remove saved routes.
export default function MyRoutes({ lang }) {
  const [routes, setRoutes] = useState(null)

  useEffect(() => {
    let off = false
    listRoutes().then(r => { if (!off) setRoutes(r) })
    return () => { off = true }
  }, [])

  return (
    <section className="space-y-3">
      <SectionTitle icon={RouteIcon}>{t(lang, 'myRoutes')}</SectionTitle>
      <ImportGpx lang={lang} />
      {routes && !routes.length && <p className="text-sm text-zinc-500">{t(lang, 'myRoutesEmpty')}</p>}
      {routes?.length > 0 && (
        <ul className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
          {routes.map(r => (
            <li key={r.id} className="flex items-center gap-2 px-4 py-2.5">
              <Link href={`/hike?route=${encodeURIComponent(r.id)}`} className="flex-1 min-w-0 truncate hover:text-emerald-400">{r.name}</Link>
              <button onClick={() => removeRoute(r.id).then(setRoutes)} aria-label={`${t(lang, 'routeRemove')}: ${r.name}`}
                className="press p-1.5 text-zinc-500 hover:text-red-300"><Trash2 size={15} aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Wire into the Hiking screens**
  - `app/components/hike/HikeApp.jsx`: add `import RouteScreen from './RouteScreen'` and `import MyRoutes from './MyRoutes'`. Replace
    `  const peak = peakFromParams(sp, featured)\n  if (peak) return <PeakView …/>`
    with
    ```jsx
      const peak = peakFromParams(sp, featured)
      const routeId = sp.get('route')
      if (routeId) {
        const back = () => { const q = new URLSearchParams(sp); q.delete('route'); const qs = q.toString(); router.push(`/hike${qs ? `?${qs}` : ''}`) }
        return <RouteScreen key={routeId} routeId={routeId} peak={peak} lang={lang} unit={unit} onBack={back} />
      }
      if (peak) return <PeakView key={peak.id} peak={peak} lang={lang} unit={unit} onBack={() => router.push('/hike')} />
    ```
    and add `<MyRoutes lang={lang} />` right after `<PeakSearch … />`.
  - `app/components/hike/PeakView.jsx`: add `import RouteList from './RouteList'` and render `<RouteList peak={peak} lang={lang} />` directly before `<HikeNotes lang={lang} borrowed />` (PeakView only renders in the app view, so no extra gate; this also lets `?app=1` test it in a browser).

- [ ] **Step 3: Verify** — `npx eslint app lib --max-warnings 0`, `npm test`, `npx next build` → clean. Then with `npx next start -p 3123` open `http://localhost:3123/hike?app=1&peak=grossglockner` (or the Großglockner featured id) in headless Firefox at 390 px: the Routes section lists the 712; open it → map, profile, suggestion or "no safe start", stages. GPX import is checked on a device (checklist, Task 11).
- [ ] **Step 4: Commit + push** — `git add app/components/hike && git commit -m "Routes in the app: peak routes, route view, GPX import, My routes"`

## Stage 3 — Plan a hike on a route

### Task 10: Plans carry a route; the dispatcher alerts on it

**Files:**
- Modify: `lib/push/validate.js` (`parsePlan`), `lib/push/validate.test.js`, `lib/push/store.js`, `lib/push/rules.js` (`decideHikeRoute`, `startChanged`), `lib/push/rules.test.js`, `lib/push/text.js`, `lib/push/text.test.js`, `lib/push/dispatch.js`, `app/api/push/dispatch/route.js`

**Interfaces:**
- Consumes: `routeWeather` (Task 5); `REASON_KEY` (Task 7); `dayPhrase` (`lib/outlook/text.js`).
- Produces: plan `route = { id, name, pace, roundTrip, points: [[lat, lon, ele]] ≤ 150 }`; `decideHikeRoute(plan, rw, now) → { slot, send, window, todayLocal } | null`; message kinds `hike_route_evening` / `hike_route_morning` with `vars = { peak, suggestion, date, todayLocal }`; `runDispatch({ …, routeWeather })`.

- [ ] **Step 1: Failing tests** — append to the three test files:

`lib/push/validate.test.js`:
```js
test('parsePlan — an optional route: kept trimmed, rejected when malformed', () => {
  const base = { name: 'Großglockner', lat: 47.0745, lon: 12.6941, elev: 3798, date: '2026-10-03' }
  const route = { id: 'osm-14622955', name: '712 Alter Kalser Weg', pace: 'normal', roundTrip: true, points: [[47.02, 12.69, 1920], [47.07, 12.69, 3798]] }
  assert.deepEqual(parsePlan({ ...base, route }, '2026-10-02').value.route, route)
  assert.equal(parsePlan({ ...base, route: { ...route, points: Array(151).fill([47, 12, 1]) } }, '2026-10-02').ok, false)
  assert.equal(parsePlan({ ...base, route: { ...route, pace: 'run' } }, '2026-10-02').ok, false)
  assert.equal(parsePlan(base, '2026-10-02').value.route, undefined)
})
```

`lib/push/rules.test.js`:
```js
test('decideHikeRoute — evening before with the start; morning only if it moved ≥ 30 min or turned unsafe', () => {
  const now = Date.parse('2026-10-02T17:00:00Z') // 19:00 at UTC+2
  const rw = { utcOffsetSec: 7200, suggestion: { start: '07:30', latest: '09:00', highAt: '10:45', finish: '14:10' } }
  const plan = { date: '2026-10-03', sent_evening: false, sent_morning: false }
  assert.deepEqual(decideHikeRoute(plan, rw, now), { slot: 'evening', send: true, window: { start: '07:30', latest: '09:00' }, todayLocal: '2026-10-02' })
  const morning = Date.parse('2026-10-03T05:00:00Z') // 07:00 local
  const sent = { date: '2026-10-03', sent_evening: true, sent_morning: false, last_window: { start: '07:30', latest: '09:00' } }
  assert.equal(decideHikeRoute(sent, { ...rw, suggestion: { ...rw.suggestion, start: '07:45' } }, morning).send, false)
  assert.equal(decideHikeRoute(sent, { ...rw, suggestion: { ...rw.suggestion, start: '08:15' } }, morning).send, true)
  assert.equal(decideHikeRoute(sent, { ...rw, suggestion: { none: true, reason: 'storms' } }, morning).send, true)
  assert.equal(decideHikeRoute(plan, null, now), null)
})
```

`lib/push/text.test.js`:
```js
test('pushText — route alerts: the start, or why there is none', () => {
  const ok = pushText('en', 'C', { kind: 'hike_route_evening', vars: { peak: '712 Alter Kalser Weg', date: '2026-10-03', todayLocal: '2026-10-02', suggestion: { start: '07:30', latest: '09:00', highAt: '10:45' } } })
  assert.equal(ok.body, 'Start by 07:30 — summit ~10:45 (safe to start until 09:00)')
  const none = pushText('de', 'C', { kind: 'hike_route_morning', vars: { peak: 'X', date: '2026-10-03', todayLocal: '2026-10-03', suggestion: { none: true, reason: 'storms' } } })
  assert.match(none.body, /^Kein sicherer Start heute: Gewitter/)
})
```
(If `decideHikeRoute` / `pushText` aren't imported in those test files yet, add them to the existing import lines.) Run `npm test` → the new tests fail.

- [ ] **Step 2: Implement**
  - `lib/push/validate.js` — in `parsePlan`, before the final `return`, add:
    ```js
      let route
      if (b.route != null) {
        const r = b.route
        const okPoint = p => Array.isArray(p) && inRange(p[0], -90, 90) && inRange(p[1], -180, 180) && (p[2] == null || inRange(p[2], -500, 9000))
        if (typeof r !== 'object' || typeof r.name !== 'string' || r.name.length > 80 || !['slow', 'normal', 'fast'].includes(r.pace)
          || !Array.isArray(r.points) || r.points.length < 2 || r.points.length > 150 || !r.points.every(okPoint)
          || (r.id != null && (typeof r.id !== 'string' || r.id.length > 40))) return bad('Invalid route')
        route = { id: r.id ?? null, name: r.name.trim(), pace: r.pace, roundTrip: r.roundTrip === true, points: r.points.map(p => [p[0], p[1], p[2] ?? null]) }
      }
    ```
    and change the return to `return { ok: true, value: { name, lat: b.lat, lon: b.lon, elev: Math.round(b.elev), date: b.date, ...(route ? { route } : {}) } }`.
  - `lib/push/store.js` — `openPlans`: add `route` to the selected columns; `addPlan` and `listPlans`: select `'id, name, lat, lon, elev, date, route_name:route->>name'`.
  - `lib/push/rules.js` — after `decideHike` add:
    ```js
    const hm = s => (typeof s === 'string' ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)) : null)

    // the suggested start moved enough (or the day flipped) to send the morning update
    export function startChanged(prev, next) {
      if (!prev) return true
      if (!!prev.none !== !!next.none) return true
      if (next.none) return false
      return Math.abs(hm(prev.start) - hm(next.start)) >= 30
    }

    // A planned hike on a route: the same evening / morning slots as
    // decideHike, with the suggested start in place of the summit window.
    export function decideHikeRoute(plan, rw, now) {
      if (!rw?.suggestion) return null
      const local = localParts(now, rw.utcOffsetSec ?? 0)
      const s = rw.suggestion
      const window = s.none ? { none: true, reason: s.reason } : { start: s.start, latest: s.latest }
      const base = { window, todayLocal: local.date }
      if (!plan.sent_evening && plan.date === addDays(local.date, 1) && within(local.hour, [18, 20])) return { slot: 'evening', send: true, ...base }
      if (!plan.sent_morning && plan.date === local.date && within(local.hour, [6, 8])) {
        return { slot: 'morning', send: !plan.sent_evening || startChanged(plan.last_window, window), ...base }
      }
      return null
    }
    ```
  - `lib/push/text.js` — import `dayPhrase` alongside `fill` from `'../outlook/text.js'` and `REASON_KEY` from `'../route/reasons.js'`; add before `case 'test':`:
    ```js
        case 'hike_route_evening':
        case 'hike_route_morning': {
          const s = v.suggestion ?? {}
          const body = s.none
            ? tr('pushRouteNone', { day: dayPhrase(lang, v.date, v.todayLocal), reason: t(lang, REASON_KEY[s.reason] ?? 'routeReasonNodata') })
            : tr('pushRouteStart', { start: s.start, high: s.highAt, latest: s.latest })
          return { title: tr('pushHikeTitle', { peak: v.peak }), body }
        }
    ```
  - `lib/push/dispatch.js` — `runDispatch({ store, getJson, sender, now = Date.now(), dry = false, base = 'https://metablend.app', routeWeather = null })`; group only `plans.filter(p => !p.route)` into `peaks`; after the peaks loop add:
    ```js
      for (const p of plans.filter(x => x.route?.points?.length >= 2)) {
        const d = byId.get(p.device_id)
        if (!d || !routeWeather) continue
        const rw = await routeWeather({ points: p.route.points.map(([lat, lon, ele]) => ({ lat, lon, ele })), date: p.date, pace: p.route.pace ?? 'normal', roundTrip: !!p.route.roundTrip, now })
        const r = decideHikeRoute(p, rw, now)
        if (!r) continue
        if (logOf(d.id).some(e => e.ref === `${p.id}:${r.slot}`)) continue
        const patch = r.slot === 'evening' ? { sent_evening: true, last_window: r.window } : { sent_morning: true, last_window: r.window }
        if (!r.send) { planUpdates.push([p.id, patch]); continue }
        const msg = { kind: `hike_route_${r.slot}`, ref: `${p.id}:${r.slot}`, vars: { peak: p.route.name || p.name, suggestion: rw.suggestion, date: p.date, todayLocal: r.todayLocal } }
        outbox.push({ device: d, msg, url: p.route.id ? `/hike?route=${encodeURIComponent(p.route.id)}` : peakHref(p, NO_FEATURED), plan: [p.id, patch] })
      }
    ```
    and import `decideHikeRoute` from `./rules.js`.
  - `app/api/push/dispatch/route.js` — import `routeWeather` (`@/lib/route/weather`), `fetchElevations` (`@/lib/hike/sources`) and `getJson as outlookGetJson` (`@/lib/outlook/http`); pass `routeWeather: q => routeWeather(q, { getJson: outlookGetJson, getElevations: fetchElevations })` into `runDispatch`.

- [ ] **Step 3: Run** — `npm test` → all pass (existing dispatcher tests unchanged: plans without `route` behave as before).
- [ ] **Step 4: Commit** — `git add lib/push app/api/push/dispatch && git commit -m "Hike alerts for a route: the suggested start the evening before, a morning update if it moves"`

### Task 11: Plan a hike from the route view; privacy text; checklist

**Files:**
- Modify: `app/components/hike/PlanHike.jsx`, `app/components/hike/RouteScreen.jsx`, `app/privacy/content.jsx`, `mobile/README.md`

**Interfaces:**
- Consumes: `simplify` (Task 1), `highestIndex` (Task 1), `markPlanned` (Task 7), plan route format (Task 10).
- Produces: `<PlanHike peak lang unit todayLocal route? />`.

- [ ] **Step 1: PlanHike takes a route** — in `PlanHike.jsx`:
  - signature `export default function PlanHike({ peak, lang, unit, todayLocal, route = null })`;
  - imports: `import { simplify } from '@/lib/route/geometry'`, `import { markPlanned } from '@/lib/route-store'`;
  - the POST body becomes:
    ```js
    const body = { name: peak.name, lat: peak.lat, lon: peak.lon, elev: peak.elev, date }
    if (route) {
      const pts = simplify(route.points.map(p => ({ lat: p[0], lon: p[1], ele: p[2] })), 150)
      body.route = { id: route.id ?? null, name: route.name.slice(0, 80), pace: 'normal', roundTrip: !!route.roundTrip, points: pts.map(p => [p.lat, p.lon, p.ele]) }
    }
    const r = await pushApi('plans', { method: 'POST', body })
    if (r.status === 200 && route?.id) markPlanned(route.id)
    ```
- [ ] **Step 2: RouteScreen renders it** — in `RouteScreen.jsx` import `PlanHike`, `highestIndex` and `isNative`; pass as `children` of `RouteView` when `isNative()`:
  ```jsx
  const top = state.route.points[highestIndex(state.route.points.map(p => ({ lat: p[0], lon: p[1], ele: p[2] })))]
  const planPeak = { name: state.route.name, lat: top[0], lon: top[1], elev: Math.round(top[2] ?? peak?.elev ?? 0) }
  // …
  <RouteView …>{isNative() && <PlanHike peak={planPeak} lang={lang} unit={unit} todayLocal={localToday()} route={state.route} />}</RouteView>
  ```
  (import `localToday` from `@/lib/app-widget-sync`). Saving an OSM route first is not required: the plan stores its own simplified copy.
- [ ] **Step 3: Privacy** — in `app/privacy/content.jsx`, in each language's "Notifications (app)" paragraph, after "planned peaks and dates" add the route sentence: en "Routes stay on your phone; a route you plan a hike on is stored with the plan to send its alerts and deleted with it." · de "Routen bleiben auf deinem Telefon; eine Route, auf der du eine Tour planst, wird mit dem Plan gespeichert, um ihre Hinweise zu senden, und mit ihm gelöscht." · fr "Les itinéraires restent sur votre téléphone ; un itinéraire sur lequel vous planifiez une randonnée est enregistré avec le plan pour envoyer ses alertes et supprimé avec lui." · es "Las rutas se quedan en tu teléfono; una ruta en la que planificas una excursión se guarda con el plan para enviar sus avisos y se borra con él." · it "I percorsi restano sul tuo telefono; un percorso su cui pianifichi un'escursione viene salvato con il piano per inviarne gli avvisi e cancellato con esso." (only for languages present in the file).
- [ ] **Step 4: Checklist** — append to `mobile/README.md`:
  ```markdown
  ## Routes (hiking v2)

  - [ ] Großglockner → Routes lists "712 Alter Kalser Weg" (there and back); opening it shows the map, the profile and a suggestion or "No safe start".
  - [ ] Pace Slow / Fast changes the walking time and the suggestion; another day re-checks.
  - [ ] Own start time (15-min steps) moves the stages; "Use the suggestion" goes back.
  - [ ] Hiking → Import GPX with a Komoot / Outdooractive / Strava file opens it and lists it under My routes; a file without elevations still shows a climb.
  - [ ] A broken / huge file shows the message, nothing crashes.
  - [ ] Plan this hike on a route → the evening before at 18:00 the alert reads "Start by … — summit ~…"; tapping it opens the route.
  ```
- [ ] **Step 5: Verify + commit + push** — `npx eslint app lib --max-warnings 0`, `npm test`, `npx next build` → clean; `git add app lib mobile/README.md && git commit -m "Plan a hike on a route; privacy note; route checklist"`; push; check the deployment is READY.
```
