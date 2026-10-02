# More Mountains Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the Hiking screen's featured list from 41 Alps peaks to ~200 peaks worldwide, each with the SAC grade of its usual route, shown as "Near you" plus collapsible regions.

**Architecture:** The hand-picked list stays in `scripts/build-featured-peaks.mjs`, which resolves exact coordinates through Photon (OpenStreetMap) and writes `lib/hike/featured.json`; it now validates every row with a pure checker and refuses to write a broken list. A pure module `lib/hike/featured-list.js` holds the region/grade vocabularies and the list logic (nearest, by region, last city's position). A new `PeakDirectory` component renders Near you + regions for the app and, without links, for the website teaser.

**Tech Stack:** Next.js 16 (App Router), React, Tailwind v4, lucide-react, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-02-more-mountains-design.md`

## Global Constraints

- Today's 41 ids stay exactly as they are: saved hike plans, widgets and shared links point at `?peak=<id>`.
- `grade` — the usual route in good summer conditions on the SAC scales: hiking `T1`–`T6`; for routes over glaciers or with climbing `L`, `WS`, `ZS` or `S`. Huts: the usual way to the hut.
- The build script refuses to write the file when an id repeats, a region or grade is not in the lists, a height is missing, or Photon finds nothing within 3 km of the hint.
- Near you: device position only when already granted (permission state `granted`, no prompt) or after "Near me"; else the last city looked at (`mb_forecast_last` in localStorage); else no block.
- Regions collapsible, closed by default; the region of the nearest peak starts open.
- New texts in en, de, fr, es, it: `hikeNearYou`, `hikeAllPeaks`, `gradeNote`, `region_<id>`.
- Commit and push straight to `main`; CHANGELOG entry when it ships.

**Plan ruling (spec deviation, small):** the region list gains `central-europe` (Brocken, Feldberg, Arber, Sněžka … — the easy hills outside the Alps had nowhere to go) and `mediterranean-islands` becomes `mediterranean` ("Apennines & Mediterranean" — Gran Sasso and Vesuvius are not islands). Teide and Pico Ruivo go under `pyrenees-iberia` (Spain / Portugal). Task 1 updates the spec.

## Review Focus

- Search results showing a featured peak would print the region id ("Großglockner · eastern-alps") — `mergePeaks` must not pass the region id as a place name (test in Task 1).
- `hrefFor` is a new function on every HikeApp render — an effect depending on it would re-run forever (geolocation loop); depend on a boolean (Task 3 code uses `linked`).
- An older cached forecast without `lat`/`lon`, or broken JSON in localStorage → no city, no crash (test in Task 1).
- A region id without a translation would show `region_xyz` — every region needs a text (test in Task 3).
- 200 cards on the website teaser would bury the page — the teaser uses the grouped directory too (Task 3).

---

### Task 1: Featured-list logic, search fix, spec regions

**Files:**
- Create: `lib/hike/featured-list.js`, `lib/hike/featured-list.test.js`
- Modify: `lib/hike/search.js` (`mergePeaks`), `lib/hike/search.test.js`, `docs/superpowers/specs/2026-10-02-more-mountains-design.md`

**Interfaces:**
- Produces: `REGIONS: string[]` (ordered ids), `GRADES: string[]`, `checkPeak(entry, seenIds: Set) → string|null` (error text or null; adds the id to `seenIds`), `nearest(peaks, pos, n = 10) → [{...peak, km}]` (empty without a valid pos), `byRegion(peaks) → [{ region, peaks }]` (REGIONS order, empty regions left out), `lastCityPos(getItem) → { lat, lon } | null`.
- `mergePeaks` featured entries: `region: null`, plus `grade`.

- [ ] **Step 1: Failing tests** — create `lib/hike/featured-list.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { REGIONS, GRADES, checkPeak, nearest, byRegion, lastCityPos } from './featured-list.js'

const P = (id, lat, lon, region, over = {}) => ({ id, name: id, lat, lon, elev: 2000, country: 'AT', kind: 'peak', region, grade: 'T2', ...over })

test('checkPeak — a good entry passes; every broken field is named', () => {
  const seen = new Set()
  assert.equal(checkPeak(P('rax', 47.69, 15.69, 'eastern-alps'), seen), null)
  assert.match(checkPeak(P('rax', 47.69, 15.69, 'eastern-alps'), seen), /repeats/)
  assert.match(checkPeak(P('a', 47, 15, 'alps'), new Set()), /region/)
  assert.match(checkPeak(P('b', 47, 15, 'eastern-alps', { grade: 'T7' }), new Set()), /grade/)
  assert.match(checkPeak(P('c', 47, 15, 'eastern-alps', { elev: null }), new Set()), /height/)
  assert.match(checkPeak(P('d', 95, 15, 'eastern-alps'), new Set()), /coordinates/)
  assert.match(checkPeak(P('E e', 47, 15, 'eastern-alps'), new Set()), /id/)
  assert.ok(REGIONS.includes('central-europe') && REGIONS.includes('mediterranean'))
  assert.deepEqual(GRADES, ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'L', 'WS', 'ZS', 'S'])
})

test('nearest — by distance with km; nothing without a usable position', () => {
  const peaks = [P('far', 46.0, 7.7, 'western-alps'), P('near', 47.8, 13.1, 'eastern-alps'), P('mid', 47.4, 11.0, 'eastern-alps')]
  const r = nearest(peaks, { lat: 47.8, lon: 13.0 }, 2)
  assert.deepEqual(r.map(p => p.id), ['near', 'mid'])
  assert.ok(r[0].km < 10 && r[1].km > 100)
  assert.deepEqual(nearest(peaks, null), [])
  assert.deepEqual(nearest(peaks, { lat: NaN, lon: 13 }), [])
})

test('byRegion — REGIONS order, empty regions left out, unknown regions dropped', () => {
  const peaks = [P('teide', 28.27, -16.64, 'pyrenees-iberia'), P('rax', 47.69, 15.69, 'eastern-alps'), P('x', 0, 0, 'atlantis'), P('zugspitze', 47.42, 10.98, 'eastern-alps')]
  assert.deepEqual(byRegion(peaks).map(g => [g.region, g.peaks.map(p => p.id)]), [['eastern-alps', ['rax', 'zugspitze']], ['pyrenees-iberia', ['teide']]])
})

test('lastCityPos — the cached forecast of the last city; null for missing, old or broken data', () => {
  const store = data => key => data[key] ?? null
  const json = JSON.stringify({ ts: 1, json: { city: 'Lienz', lat: 46.83, lon: 12.77 } })
  assert.deepEqual(lastCityPos(store({ mb_forecast_last: 'lienz', mb_forecast_lienz: json })), { lat: 46.83, lon: 12.77 })
  assert.equal(lastCityPos(store({})), null)
  assert.equal(lastCityPos(store({ mb_forecast_last: 'lienz', mb_forecast_lienz: JSON.stringify({ json: { city: 'Lienz' } }) })), null)
  assert.equal(lastCityPos(store({ mb_forecast_last: 'lienz', mb_forecast_lienz: '{broken' })), null)
  assert.equal(lastCityPos(() => { throw new Error('blocked') }), null)
})
```

and in `lib/hike/search.test.js` change the expected first entry of the `mergePeaks` test (line 61) to carry the grade and no region, after adding `region: 'eastern-alps', grade: 'T2'` to that test's featured fixture (line 53):

```js
  const featured = [{ id: 'schneeberg', name: 'Schneeberg (Klosterwappen)', aka: ['Schneeberg'], lat: 47.7675, lon: 15.8069, elev: 2076, country: 'AT', kind: 'peak', region: 'eastern-alps', grade: 'T2' }]
```
```js
  assert.deepEqual(r[0], { id: 'schneeberg', name: 'Schneeberg (Klosterwappen)', lat: 47.7675, lon: 15.8069, elev: 2076, country: 'AT', region: null, kind: 'peak', grade: 'T2' })
```

- [ ] **Step 2: Run** `node --test lib/hike/featured-list.test.js lib/hike/search.test.js` → FAIL (module not found; mergePeaks shape).

- [ ] **Step 3: Implement** — create `lib/hike/featured-list.js`:

```js
// The featured peaks list: the region and grade vocabularies, the build
// script's checker, and what the Hiking screen does with the list.
import { haversineKm } from '../geo.js'

// display order of the "All peaks" groups; names in lib/i18n.js (region_<id>)
export const REGIONS = [
  'eastern-alps', 'western-alps', 'dolomites', 'central-europe', 'pyrenees-iberia',
  'british-isles', 'scandinavia', 'carpathians', 'balkans-greece', 'mediterranean',
  'africa', 'north-america', 'south-america', 'asia', 'oceania',
]

// SAC hiking scale, then the mountaineering scale for glacier / climbing routes
export const GRADES = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'L', 'WS', 'ZS', 'S']

const inRange = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi

// What is wrong with one entry, or null. Remembers the id in `seen`.
export function checkPeak(p, seen) {
  if (typeof p.id !== 'string' || !/^[a-z0-9-]+$/.test(p.id)) return `bad id "${p.id}"`
  if (seen.has(p.id)) return `${p.id}: id repeats`
  seen.add(p.id)
  if (typeof p.name !== 'string' || !p.name.trim()) return `${p.id}: no name`
  if (!inRange(p.lat, -90, 90) || !inRange(p.lon, -180, 180)) return `${p.id}: bad coordinates`
  if (!Number.isInteger(p.elev) || !inRange(p.elev, 0, 9000)) return `${p.id}: no height`
  if (typeof p.country !== 'string' || !/^[A-Z]{2}$/.test(p.country)) return `${p.id}: bad country`
  if (!['peak', 'hut'].includes(p.kind)) return `${p.id}: bad kind`
  if (!REGIONS.includes(p.region)) return `${p.id}: unknown region "${p.region}"`
  if (!GRADES.includes(p.grade)) return `${p.id}: unknown grade "${p.grade}"`
  return null
}

export function nearest(peaks, pos, n = 10) {
  if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lon)) return []
  return peaks
    .map(p => ({ ...p, km: haversineKm(pos.lat, pos.lon, p.lat, p.lon) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n)
}

export function byRegion(peaks) {
  return REGIONS
    .map(region => ({ region, peaks: peaks.filter(p => p.region === region) }))
    .filter(g => g.peaks.length)
}

// The last city looked at on the forecast page, from its cached forecast
// (app/page.js cacheForecast). getItem = key => localStorage.getItem(key).
export function lastCityPos(getItem) {
  try {
    const name = getItem('mb_forecast_last')
    if (!name) return null
    const json = JSON.parse(getItem(`mb_forecast_${name}`) ?? 'null')?.json
    return Number.isFinite(json?.lat) && Number.isFinite(json?.lon) ? { lat: json.lat, lon: json.lon } : null
  } catch {
    return null
  }
}
```

and in `lib/hike/search.js` `mergePeaks`, replace the featured mapping with:

```js
  const feat = featured.map(f => ({
    id: f.id, name: f.name, lat: f.lat, lon: f.lon, elev: f.elev,
    // a featured peak's region is a list group ("eastern-alps"), not a place
    // name like a search hit's state — the result row shows only the country
    country: f.country ?? null, region: null, kind: f.kind ?? 'peak', grade: f.grade ?? null,
  }))
```

- [ ] **Step 4: Run** `node --test lib/hike/featured-list.test.js lib/hike/search.test.js` → PASS.

- [ ] **Step 5: Spec** — in `docs/superpowers/specs/2026-10-02-more-mountains-design.md` replace the region list with:
  `eastern-alps`, `western-alps`, `dolomites`, `central-europe`, `pyrenees-iberia`, `british-isles`, `scandinavia`, `carpathians`, `balkans-greece`, `mediterranean`, `africa`, `north-america`, `south-america`, `asia`, `oceania` — and add the sentence: "Central Europe holds the uplands (Brocken, Feldberg, Sněžka …); Mediterranean holds the Apennines and the islands; Teide and Pico Ruivo go under Pyrenees & Iberia."

- [ ] **Step 6: Commit** — `git add lib/hike docs/superpowers/specs/2026-10-02-more-mountains-design.md && git commit -m "Featured list logic: regions, grades, nearest, by region, last city; search rows don't show region ids"`

### Task 2: The list — ~200 peaks with region and grade

**Files:**
- Modify: `scripts/build-featured-peaks.mjs` (whole file), `lib/hike/featured.json` (generated)
- Create: `lib/hike/featured.test.js`

**Interfaces:**
- Consumes: `checkPeak`, `REGIONS` (Task 1).
- Produces: `featured.json` entries `{ id, name, aka?, lat, lon, elev, country, kind, region, grade }`.

- [ ] **Step 1: Failing data test** — create `lib/hike/featured.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { REGIONS, checkPeak } from './featured-list.js'

const featured = JSON.parse(fs.readFileSync(new URL('./featured.json', import.meta.url)))

// the ids that existed before the list grew: plans, widgets and links use them
const OLD_IDS = ['grossglockner', 'wildspitze', 'grossvenediger', 'olperer', 'kitzsteinhorn', 'hoher-dachstein', 'hochkoenig',
  'hafelekarspitze', 'hochschwab', 'patscherkofel', 'schneeberg', 'rax', 'oetscher', 'schafberg', 'traunstein',
  'erzherzog-johann-huette', 'schiestlhaus', 'zugspitze', 'watzmann', 'alpspitze', 'wendelstein', 'herzogstand',
  'dufourspitze', 'matterhorn', 'jungfrau', 'piz-bernina', 'eiger', 'titlis', 'saentis', 'pilatus', 'rigi',
  'hoernlihuette', 'gran-paradiso', 'ortler', 'marmolada', 'tre-cime', 'rifugio-auronzo', 'mont-blanc',
  'aiguille-du-midi', 'refuge-du-gouter', 'triglav']

test('featured.json — every entry valid, ~200 of them, every region filled, old ids kept', () => {
  const seen = new Set()
  for (const p of featured) assert.equal(checkPeak(p, seen), null)
  assert.ok(featured.length >= 190, `${featured.length} entries`)
  for (const r of REGIONS) assert.ok(featured.some(p => p.region === r), `region ${r} is empty`)
  for (const id of OLD_IDS) assert.ok(seen.has(id), `${id} is gone`)
})
```

- [ ] **Step 2: Run** `node --test lib/hike/featured.test.js` → FAIL (entries have no region / grade).

- [ ] **Step 3: Replace `scripts/build-featured-peaks.mjs`** with:

```js
// Builds lib/hike/featured.json: hand-picked peaks and huts worldwide with
// their published heights, region and the SAC grade of the usual route
// (T1–T6 hiking; L / WS / ZS / S over glaciers or with climbing). Exact
// coordinates come from OpenStreetMap via Photon — the match nearest the hint,
// within 3 km. Refuses to write a broken list. Re-run after editing LIST:
//   node scripts/build-featured-peaks.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { haversineKm } from '../lib/geo.js'
import { checkPeak } from '../lib/hike/featured-list.js'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'hike', 'featured.json')
const UA = { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' }

// [id, display name, OSM search text, hint lat, hint lon, height m, country, kind, region, grade, aka]
const LIST = [
  // ── Eastern Alps ──
  ['grossglockner', 'Großglockner', 'Großglockner', 47.0745, 12.6945, 3798, 'AT', 'peak', 'eastern-alps', 'WS', ['Grossglockner']],
  ['wildspitze', 'Wildspitze', 'Wildspitze', 46.885, 10.867, 3768, 'AT', 'peak', 'eastern-alps', 'WS'],
  ['grossvenediger', 'Großvenediger', 'Großvenediger', 47.109, 12.346, 3657, 'AT', 'peak', 'eastern-alps', 'L', ['Grossvenediger']],
  ['olperer', 'Olperer', 'Olperer', 47.052, 11.662, 3476, 'AT', 'peak', 'eastern-alps', 'WS'],
  ['kitzsteinhorn', 'Kitzsteinhorn', 'Kitzsteinhorn', 47.188, 12.687, 3203, 'AT', 'peak', 'eastern-alps', 'T4'],
  ['hoher-dachstein', 'Hoher Dachstein', 'Hoher Dachstein', 47.475, 13.606, 2995, 'AT', 'peak', 'eastern-alps', 'WS', ['Dachstein']],
  ['hochkoenig', 'Hochkönig', 'Hochkönig', 47.420, 13.062, 2941, 'AT', 'peak', 'eastern-alps', 'T4', ['Hochkoenig']],
  ['hafelekarspitze', 'Hafelekarspitze (Nordkette)', 'Hafelekarspitze', 47.312, 11.386, 2334, 'AT', 'peak', 'eastern-alps', 'T2', ['Nordkette']],
  ['hochschwab', 'Hochschwab', 'Hochschwab', 47.618, 15.142, 2277, 'AT', 'peak', 'eastern-alps', 'T3'],
  ['patscherkofel', 'Patscherkofel', 'Patscherkofel', 47.209, 11.461, 2246, 'AT', 'peak', 'eastern-alps', 'T2'],
  ['schneeberg', 'Schneeberg (Klosterwappen)', 'Klosterwappen', 47.767, 15.807, 2076, 'AT', 'peak', 'eastern-alps', 'T2', ['Schneeberg']],
  ['rax', 'Rax (Heukuppe)', 'Heukuppe', 47.689, 15.689, 2007, 'AT', 'peak', 'eastern-alps', 'T2', ['Rax', 'Raxalpe']],
  ['oetscher', 'Ötscher', 'Ötscher', 47.863, 15.201, 1893, 'AT', 'peak', 'eastern-alps', 'T3', ['Oetscher']],
  ['schafberg', 'Schafberg', 'Schafberg', 47.776, 13.434, 1783, 'AT', 'peak', 'eastern-alps', 'T2'],
  ['traunstein', 'Traunstein', 'Traunstein', 47.873, 13.834, 1691, 'AT', 'peak', 'eastern-alps', 'T3'],
  ['erzherzog-johann-huette', 'Erzherzog-Johann-Hütte', 'Erzherzog-Johann-Hütte', 47.069, 12.697, 3454, 'AT', 'hut', 'eastern-alps', 'L', ['Adlersruhe', 'Erzherzog Johann Huette']],
  ['schiestlhaus', 'Schiestlhaus', 'Schiestlhaus', 47.622, 15.148, 2153, 'AT', 'hut', 'eastern-alps', 'T2'],
  ['grosser-priel', 'Großer Priel', 'Großer Priel', 47.717, 14.063, 2515, 'AT', 'peak', 'eastern-alps', 'T3', ['Grosser Priel']],
  ['hoher-sonnblick', 'Hoher Sonnblick', 'Hoher Sonnblick', 47.054, 12.957, 3106, 'AT', 'peak', 'eastern-alps', 'L', ['Sonnblick']],
  ['ankogel', 'Ankogel', 'Ankogel', 47.050, 13.247, 3252, 'AT', 'peak', 'eastern-alps', 'L'],
  ['hochalmspitze', 'Hochalmspitze', 'Hochalmspitze', 47.015, 13.320, 3360, 'AT', 'peak', 'eastern-alps', 'WS'],
  ['weisskugel', 'Weißkugel', 'Weißkugel', 46.799, 10.727, 3739, 'AT', 'peak', 'eastern-alps', 'WS', ['Weisskugel', 'Palla Bianca']],
  ['similaun', 'Similaun', 'Similaun', 46.765, 10.879, 3606, 'AT', 'peak', 'eastern-alps', 'L'],
  ['habicht', 'Habicht', 'Habicht', 47.045, 11.287, 3277, 'AT', 'peak', 'eastern-alps', 'T4'],
  ['serles', 'Serles', 'Serles', 47.120, 11.377, 2717, 'AT', 'peak', 'eastern-alps', 'T4'],
  ['birkkarspitze', 'Birkkarspitze', 'Birkkarspitze', 47.411, 11.437, 2749, 'AT', 'peak', 'eastern-alps', 'T4'],
  ['piz-buin', 'Piz Buin', 'Piz Buin', 46.844, 10.119, 3312, 'AT', 'peak', 'eastern-alps', 'WS'],
  ['schesaplana', 'Schesaplana', 'Schesaplana', 47.053, 9.708, 2964, 'AT', 'peak', 'eastern-alps', 'T3'],
  ['grimming', 'Grimming', 'Grimming', 47.521, 14.010, 2351, 'AT', 'peak', 'eastern-alps', 'T4'],
  ['gaisberg', 'Gaisberg', 'Gaisberg', 47.805, 13.112, 1287, 'AT', 'peak', 'eastern-alps', 'T1'],
  ['schoeckl', 'Schöckl', 'Schöckl', 47.199, 15.468, 1445, 'AT', 'peak', 'eastern-alps', 'T1', ['Schoeckl']],
  ['gerlitzen', 'Gerlitzen', 'Gerlitzen', 46.695, 13.916, 1911, 'AT', 'peak', 'eastern-alps', 'T1'],
  ['dobratsch', 'Dobratsch', 'Dobratsch', 46.603, 13.672, 2166, 'AT', 'peak', 'eastern-alps', 'T2', ['Villacher Alpe']],
  ['untersberg', 'Untersberg (Salzburger Hochthron)', 'Salzburger Hochthron', 47.712, 13.009, 1853, 'AT', 'peak', 'eastern-alps', 'T2', ['Untersberg']],
  ['zwoelferhorn', 'Zwölferhorn', 'Zwölferhorn', 47.743, 13.353, 1522, 'AT', 'peak', 'eastern-alps', 'T1', ['Zwoelferhorn']],
  ['kitzbueheler-horn', 'Kitzbüheler Horn', 'Kitzbüheler Horn', 47.464, 12.425, 1996, 'AT', 'peak', 'eastern-alps', 'T2', ['Kitzbueheler Horn']],
  ['hohe-salve', 'Hohe Salve', 'Hohe Salve', 47.477, 12.189, 1829, 'AT', 'peak', 'eastern-alps', 'T2'],
  ['schmittenhoehe', 'Schmittenhöhe', 'Schmittenhöhe', 47.328, 12.737, 1965, 'AT', 'peak', 'eastern-alps', 'T1', ['Schmittenhoehe']],
  ['loser', 'Loser', 'Loser', 47.663, 13.784, 1838, 'AT', 'peak', 'eastern-alps', 'T2'],
  ['zugspitze', 'Zugspitze', 'Zugspitze', 47.421, 10.985, 2962, 'DE', 'peak', 'eastern-alps', 'T4'],
  ['watzmann', 'Watzmann (Mittelspitze)', 'Watzmann', 47.555, 12.922, 2713, 'DE', 'peak', 'eastern-alps', 'T5', ['Watzmann']],
  ['alpspitze', 'Alpspitze', 'Alpspitze', 47.414, 11.052, 2628, 'DE', 'peak', 'eastern-alps', 'T4'],
  ['wendelstein', 'Wendelstein', 'Wendelstein', 47.703, 12.012, 1838, 'DE', 'peak', 'eastern-alps', 'T2'],
  ['herzogstand', 'Herzogstand', 'Herzogstand', 47.614, 11.308, 1731, 'DE', 'peak', 'eastern-alps', 'T2'],
  ['hochvogel', 'Hochvogel', 'Hochvogel', 47.379, 10.437, 2592, 'DE', 'peak', 'eastern-alps', 'T4'],
  ['nebelhorn', 'Nebelhorn', 'Nebelhorn', 47.421, 10.344, 2224, 'DE', 'peak', 'eastern-alps', 'T3'],
  ['hochkalter', 'Hochkalter', 'Hochkalter', 47.569, 12.869, 2607, 'DE', 'peak', 'eastern-alps', 'T5'],
  ['hoher-goell', 'Hoher Göll', 'Hoher Göll', 47.594, 13.065, 2522, 'DE', 'peak', 'eastern-alps', 'T4', ['Hoher Goell']],
  ['benediktenwand', 'Benediktenwand', 'Benediktenwand', 47.653, 11.463, 1801, 'DE', 'peak', 'eastern-alps', 'T3'],
  ['wank', 'Wank', 'Wank', 47.513, 11.141, 1780, 'DE', 'peak', 'eastern-alps', 'T2'],
  ['wallberg', 'Wallberg', 'Wallberg', 47.664, 11.793, 1722, 'DE', 'peak', 'eastern-alps', 'T2'],
  ['jenner', 'Jenner', 'Jenner', 47.579, 13.022, 1874, 'DE', 'peak', 'eastern-alps', 'T2'],
  ['hochfelln', 'Hochfelln', 'Hochfelln', 47.761, 12.558, 1674, 'DE', 'peak', 'eastern-alps', 'T2'],
  ['piz-bernina', 'Piz Bernina', 'Piz Bernina', 46.382, 9.908, 4049, 'CH', 'peak', 'eastern-alps', 'ZS'],
  ['piz-languard', 'Piz Languard', 'Piz Languard', 46.505, 9.956, 3262, 'CH', 'peak', 'eastern-alps', 'T3'],
  ['ortler', 'Ortler', 'Ortler', 46.509, 10.545, 3905, 'IT', 'peak', 'eastern-alps', 'WS', ['Ortles']],
  ['hochfeiler', 'Hochfeiler', 'Hochfeiler', 46.973, 11.728, 3509, 'IT', 'peak', 'eastern-alps', 'L', ['Gran Pilastro']],
  ['jof-di-montasio', 'Jôf di Montasio', 'Jôf di Montasio', 46.438, 13.431, 2754, 'IT', 'peak', 'eastern-alps', 'T5', ['Montasch']],
  ['monte-baldo', 'Monte Baldo (Cima Valdritta)', 'Cima Valdritta', 45.717, 10.856, 2218, 'IT', 'peak', 'eastern-alps', 'T3', ['Monte Baldo']],
  ['monte-grappa', 'Monte Grappa', 'Monte Grappa', 45.871, 11.802, 1775, 'IT', 'peak', 'eastern-alps', 'T1'],
  ['triglav', 'Triglav', 'Triglav', 46.378, 13.837, 2864, 'SI', 'peak', 'eastern-alps', 'T5'],
  ['mangart', 'Mangart', 'Mangart', 46.443, 13.654, 2679, 'SI', 'peak', 'eastern-alps', 'T4', ['Mangrt']],
  ['krn', 'Krn', 'Krn', 46.267, 13.659, 2244, 'SI', 'peak', 'eastern-alps', 'T3'],
  // ── Western Alps ──
  ['dufourspitze', 'Dufourspitze (Monte Rosa)', 'Dufourspitze', 45.937, 7.867, 4634, 'CH', 'peak', 'western-alps', 'ZS', ['Monte Rosa']],
  ['matterhorn', 'Matterhorn', 'Matterhorn', 45.976, 7.658, 4478, 'CH', 'peak', 'western-alps', 'ZS', ['Cervino']],
  ['jungfrau', 'Jungfrau', 'Jungfrau', 46.537, 7.962, 4158, 'CH', 'peak', 'western-alps', 'ZS'],
  ['eiger', 'Eiger', 'Eiger', 46.577, 8.005, 3967, 'CH', 'peak', 'western-alps', 'ZS'],
  ['titlis', 'Titlis', 'Titlis', 46.772, 8.437, 3238, 'CH', 'peak', 'western-alps', 'L'],
  ['saentis', 'Säntis', 'Säntis', 47.249, 9.343, 2502, 'CH', 'peak', 'western-alps', 'T3', ['Saentis']],
  ['pilatus', 'Pilatus (Tomlishorn)', 'Tomlishorn', 46.974, 8.253, 2128, 'CH', 'peak', 'western-alps', 'T2', ['Pilatus']],
  ['rigi', 'Rigi Kulm', 'Rigi', 47.056, 8.485, 1798, 'CH', 'peak', 'western-alps', 'T1', ['Rigi']],
  ['hoernlihuette', 'Hörnlihütte', 'Hörnlihütte', 45.982, 7.674, 3260, 'CH', 'hut', 'western-alps', 'T3', ['Hornlihutte', 'Hoernlihuette']],
  ['weissmies', 'Weissmies', 'Weissmies', 46.128, 8.012, 4017, 'CH', 'peak', 'western-alps', 'L'],
  ['allalinhorn', 'Allalinhorn', 'Allalinhorn', 46.046, 7.895, 4027, 'CH', 'peak', 'western-alps', 'L'],
  ['breithorn', 'Breithorn', 'Breithorn', 45.941, 7.746, 4164, 'CH', 'peak', 'western-alps', 'L'],
  ['lagginhorn', 'Lagginhorn', 'Lagginhorn', 46.157, 8.003, 4010, 'CH', 'peak', 'western-alps', 'WS'],
  ['dom', 'Dom', 'Dom', 46.094, 7.859, 4545, 'CH', 'peak', 'western-alps', 'WS'],
  ['weisshorn', 'Weisshorn', 'Weisshorn', 46.101, 7.716, 4506, 'CH', 'peak', 'western-alps', 'ZS'],
  ['finsteraarhorn', 'Finsteraarhorn', 'Finsteraarhorn', 46.537, 8.126, 4274, 'CH', 'peak', 'western-alps', 'WS'],
  ['moench', 'Mönch', 'Mönch', 46.558, 7.997, 4107, 'CH', 'peak', 'western-alps', 'WS', ['Moench']],
  ['toedi', 'Tödi', 'Tödi', 46.811, 8.915, 3614, 'CH', 'peak', 'western-alps', 'WS', ['Toedi']],
  ['grand-combin', 'Grand Combin', 'Grand Combin de Grafeneire', 45.938, 7.299, 4314, 'CH', 'peak', 'western-alps', 'WS'],
  ['schilthorn', 'Schilthorn', 'Schilthorn', 46.558, 7.835, 2970, 'CH', 'peak', 'western-alps', 'T3'],
  ['grosser-mythen', 'Grosser Mythen', 'Grosser Mythen', 47.031, 8.681, 1899, 'CH', 'peak', 'western-alps', 'T3'],
  ['niesen', 'Niesen', 'Niesen', 46.645, 7.651, 2362, 'CH', 'peak', 'western-alps', 'T2'],
  ['stanserhorn', 'Stanserhorn', 'Stanserhorn', 46.929, 8.340, 1898, 'CH', 'peak', 'western-alps', 'T2'],
  ['maennlichen', 'Männlichen', 'Männlichen', 46.613, 7.940, 2343, 'CH', 'peak', 'western-alps', 'T1', ['Maennlichen']],
  ['faulhorn', 'Faulhorn', 'Faulhorn', 46.675, 8.022, 2681, 'CH', 'peak', 'western-alps', 'T2'],
  ['brienzer-rothorn', 'Brienzer Rothorn', 'Brienzer Rothorn', 46.787, 8.047, 2350, 'CH', 'peak', 'western-alps', 'T2'],
  ['gornergrat', 'Gornergrat', 'Gornergrat', 45.983, 7.785, 3135, 'CH', 'peak', 'western-alps', 'T1'],
  ['monte-generoso', 'Monte Generoso', 'Monte Generoso', 45.931, 9.020, 1701, 'CH', 'peak', 'western-alps', 'T1'],
  ['gran-paradiso', 'Gran Paradiso', 'Gran Paradiso', 45.518, 7.266, 4061, 'IT', 'peak', 'western-alps', 'L'],
  ['monviso', 'Monviso', 'Monviso', 44.667, 7.090, 3841, 'IT', 'peak', 'western-alps', 'WS', ['Monte Viso']],
  ['mont-blanc', 'Mont Blanc', 'Mont Blanc', 45.833, 6.865, 4806, 'FR', 'peak', 'western-alps', 'WS', ['Monte Bianco']],
  ['aiguille-du-midi', 'Aiguille du Midi', 'Aiguille du Midi', 45.879, 6.887, 3842, 'FR', 'peak', 'western-alps', 'T1'],
  ['refuge-du-gouter', 'Refuge du Goûter', 'Refuge du Goûter', 45.851, 6.832, 3835, 'FR', 'hut', 'western-alps', 'WS', ['Gouter']],
  ['barre-des-ecrins', 'Barre des Écrins', 'Barre des Écrins', 44.922, 6.360, 4102, 'FR', 'peak', 'western-alps', 'WS', ['Barre des Ecrins']],
  ['grande-casse', 'Grande Casse', 'Grande Casse', 45.405, 6.827, 3855, 'FR', 'peak', 'western-alps', 'WS'],
  ['mont-buet', 'Mont Buet', 'Mont Buet', 46.025, 6.851, 3096, 'FR', 'peak', 'western-alps', 'T3'],
  ['le-brevent', 'Le Brévent', 'Le Brévent', 45.935, 6.838, 2525, 'FR', 'peak', 'western-alps', 'T2', ['Brevent']],
  ['mont-ventoux', 'Mont Ventoux', 'Mont Ventoux', 44.174, 5.279, 1909, 'FR', 'peak', 'western-alps', 'T1'],
  // ── Dolomites ──
  ['marmolada', 'Marmolada (Punta Penia)', 'Punta Penia', 46.434, 11.851, 3343, 'IT', 'peak', 'dolomites', 'L', ['Marmolada']],
  ['tre-cime', 'Drei Zinnen (Große Zinne)', 'Große Zinne', 46.619, 12.305, 2999, 'IT', 'peak', 'dolomites', 'ZS', ['Tre Cime', 'Cima Grande', 'Drei Zinnen']],
  ['rifugio-auronzo', 'Rifugio Auronzo', 'Rifugio Auronzo', 46.612, 12.296, 2320, 'IT', 'hut', 'dolomites', 'T1'],
  ['piz-boe', 'Piz Boè', 'Piz Boè', 46.509, 11.829, 3152, 'IT', 'peak', 'dolomites', 'T3', ['Piz Boe']],
  ['langkofel', 'Langkofel', 'Langkofel', 46.523, 11.731, 3181, 'IT', 'peak', 'dolomites', 'ZS', ['Sassolungo']],
  ['seceda', 'Seceda', 'Seceda', 46.600, 11.727, 2519, 'IT', 'peak', 'dolomites', 'T2'],
  ['sass-pordoi', 'Sass Pordoi', 'Sass Pordoi', 46.499, 11.813, 2952, 'IT', 'peak', 'dolomites', 'T3'],
  ['piccolo-lagazuoi', 'Lagazuoi', 'Piccolo Lagazuoi', 46.528, 12.009, 2778, 'IT', 'peak', 'dolomites', 'T3', ['Piccolo Lagazuoi']],
  ['tofana-di-rozes', 'Tofana di Rozes', 'Tofana di Rozes', 46.539, 12.053, 3225, 'IT', 'peak', 'dolomites', 'T5'],
  ['antelao', 'Antelao', 'Antelao', 46.452, 12.262, 3264, 'IT', 'peak', 'dolomites', 'WS'],
  ['civetta', 'Civetta', 'Civetta', 46.381, 12.054, 3220, 'IT', 'peak', 'dolomites', 'WS'],
  ['pelmo', 'Monte Pelmo', 'Monte Pelmo', 46.428, 12.137, 3168, 'IT', 'peak', 'dolomites', 'WS', ['Pelmo']],
  ['schlern', 'Schlern (Petz)', 'Petz', 46.504, 11.580, 2563, 'IT', 'peak', 'dolomites', 'T2', ['Schlern', 'Sciliar']],
  ['peitlerkofel', 'Peitlerkofel', 'Peitlerkofel', 46.663, 11.811, 2875, 'IT', 'peak', 'dolomites', 'T4', ['Sass de Putia']],
  ['nuvolau', 'Nuvolau', 'Nuvolau', 46.519, 12.046, 2575, 'IT', 'peak', 'dolomites', 'T2'],
  // ── Central European uplands ──
  ['brocken', 'Brocken', 'Brocken', 51.799, 10.616, 1141, 'DE', 'peak', 'central-europe', 'T1'],
  ['feldberg', 'Feldberg (Schwarzwald)', 'Feldberg', 47.874, 8.004, 1493, 'DE', 'peak', 'central-europe', 'T1'],
  ['grosser-arber', 'Großer Arber', 'Großer Arber', 49.113, 13.136, 1456, 'DE', 'peak', 'central-europe', 'T1', ['Grosser Arber']],
  ['fichtelberg', 'Fichtelberg', 'Fichtelberg', 50.429, 12.954, 1215, 'DE', 'peak', 'central-europe', 'T1'],
  ['wasserkuppe', 'Wasserkuppe', 'Wasserkuppe', 50.498, 9.938, 950, 'DE', 'peak', 'central-europe', 'T1'],
  ['grand-ballon', 'Grand Ballon', 'Grand Ballon', 47.901, 7.098, 1424, 'FR', 'peak', 'central-europe', 'T1'],
  ['snezka', 'Sněžka', 'Sněžka', 50.736, 15.740, 1603, 'CZ', 'peak', 'central-europe', 'T1', ['Snezka', 'Schneekoppe', 'Śnieżka']],
  // ── Pyrenees & Iberia ──
  ['aneto', 'Aneto', 'Aneto', 42.631, 0.657, 3404, 'ES', 'peak', 'pyrenees-iberia', 'L'],
  ['monte-perdido', 'Monte Perdido', 'Monte Perdido', 42.675, 0.034, 3355, 'ES', 'peak', 'pyrenees-iberia', 'T5', ['Mont Perdu']],
  ['vignemale', 'Vignemale (Pique Longue)', 'Pique Longue', 42.774, -0.147, 3298, 'FR', 'peak', 'pyrenees-iberia', 'L', ['Vignemale']],
  ['pic-du-midi-de-bigorre', 'Pic du Midi de Bigorre', 'Pic du Midi de Bigorre', 42.936, 0.142, 2877, 'FR', 'peak', 'pyrenees-iberia', 'T2'],
  ['canigou', 'Canigou', 'Pic du Canigou', 42.519, 2.457, 2784, 'FR', 'peak', 'pyrenees-iberia', 'T3', ['Canigó']],
  ['pica-d-estats', "Pica d'Estats", "Pica d'Estats", 42.666, 1.398, 3143, 'ES', 'peak', 'pyrenees-iberia', 'T3'],
  ['mulhacen', 'Mulhacén', 'Mulhacén', 37.053, -3.311, 3479, 'ES', 'peak', 'pyrenees-iberia', 'T2', ['Mulhacen']],
  ['penalara', 'Peñalara', 'Peñalara', 40.850, -3.956, 2428, 'ES', 'peak', 'pyrenees-iberia', 'T2', ['Penalara']],
  ['montserrat', 'Montserrat (Sant Jeroni)', 'Sant Jeroni', 41.605, 1.811, 1236, 'ES', 'peak', 'pyrenees-iberia', 'T2', ['Montserrat']],
  ['torre-de-cerredo', 'Torre de Cerredo', 'Torre de Cerredo', 43.198, -4.853, 2650, 'ES', 'peak', 'pyrenees-iberia', 'T4'],
  ['teide', 'Teide', 'Teide', 28.272, -16.642, 3715, 'ES', 'peak', 'pyrenees-iberia', 'T2', ['Pico del Teide']],
  ['pico-ruivo', 'Pico Ruivo', 'Pico Ruivo', 32.759, -16.942, 1862, 'PT', 'peak', 'pyrenees-iberia', 'T2'],
  // ── British Isles ──
  ['ben-nevis', 'Ben Nevis', 'Ben Nevis', 56.797, -5.004, 1345, 'GB', 'peak', 'british-isles', 'T2'],
  ['yr-wyddfa', 'Yr Wyddfa (Snowdon)', 'Yr Wyddfa', 53.068, -4.076, 1085, 'GB', 'peak', 'british-isles', 'T2', ['Snowdon']],
  ['scafell-pike', 'Scafell Pike', 'Scafell Pike', 54.454, -3.212, 978, 'GB', 'peak', 'british-isles', 'T3'],
  ['helvellyn', 'Helvellyn', 'Helvellyn', 54.527, -3.016, 950, 'GB', 'peak', 'british-isles', 'T3'],
  ['pen-y-fan', 'Pen y Fan', 'Pen y Fan', 51.884, -3.437, 886, 'GB', 'peak', 'british-isles', 'T1'],
  ['carrauntoohil', 'Carrauntoohil', 'Carrauntoohil', 51.999, -9.743, 1039, 'IE', 'peak', 'british-isles', 'T3'],
  // ── Scandinavia & Iceland ──
  ['galdhoepiggen', 'Galdhøpiggen', 'Galdhøpiggen', 61.636, 8.313, 2469, 'NO', 'peak', 'scandinavia', 'T3', ['Galdhopiggen']],
  ['snoehetta', 'Snøhetta', 'Snøhetta', 62.320, 9.268, 2286, 'NO', 'peak', 'scandinavia', 'T3', ['Snohetta']],
  ['besseggen', 'Besseggen (Veslfjellet)', 'Veslfjellet', 61.507, 8.725, 1743, 'NO', 'peak', 'scandinavia', 'T3', ['Besseggen']],
  ['kebnekaise', 'Kebnekaise', 'Kebnekaise', 67.900, 18.517, 2097, 'SE', 'peak', 'scandinavia', 'T3'],
  ['hvannadalshnukur', 'Hvannadalshnúkur', 'Hvannadalshnúkur', 64.014, -16.678, 2110, 'IS', 'peak', 'scandinavia', 'L', ['Hvannadalshnukur']],
  // ── Carpathians & Tatras ──
  ['gerlachovsky-stit', 'Gerlachovský štít', 'Gerlachovský štít', 49.164, 20.134, 2655, 'SK', 'peak', 'carpathians', 'WS', ['Gerlach']],
  ['rysy', 'Rysy', 'Rysy', 49.179, 20.088, 2501, 'SK', 'peak', 'carpathians', 'T4'],
  ['krivan', 'Kriváň', 'Kriváň', 49.162, 19.999, 2494, 'SK', 'peak', 'carpathians', 'T4', ['Krivan']],
  ['kasprowy-wierch', 'Kasprowy Wierch', 'Kasprowy Wierch', 49.232, 19.982, 1987, 'PL', 'peak', 'carpathians', 'T2'],
  ['giewont', 'Giewont', 'Giewont', 49.251, 19.934, 1895, 'PL', 'peak', 'carpathians', 'T3'],
  ['moldoveanu', 'Moldoveanu', 'Moldoveanu', 45.600, 24.736, 2544, 'RO', 'peak', 'carpathians', 'T3'],
  ['hoverla', 'Hoverla', 'Hoverla', 48.160, 24.500, 2061, 'UA', 'peak', 'carpathians', 'T2', ['Goverla']],
  // ── Balkans & Greece ──
  ['mytikas', 'Olympus (Mytikas)', 'Mytikas', 40.086, 22.359, 2918, 'GR', 'peak', 'balkans-greece', 'T5', ['Olympus', 'Olymp']],
  ['musala', 'Musala', 'Musala', 42.179, 23.585, 2925, 'BG', 'peak', 'balkans-greece', 'T2'],
  ['vihren', 'Vihren', 'Vihren', 41.767, 23.399, 2914, 'BG', 'peak', 'balkans-greece', 'T3'],
  ['bobotov-kuk', 'Bobotov Kuk (Durmitor)', 'Bobotov Kuk', 43.128, 19.029, 2523, 'ME', 'peak', 'balkans-greece', 'T3', ['Durmitor']],
  ['korab', 'Korab', 'Korab', 41.790, 20.546, 2764, 'MK', 'peak', 'balkans-greece', 'T3'],
  ['parnassus', 'Parnassus (Liakoura)', 'Liakoura', 38.537, 22.623, 2457, 'GR', 'peak', 'balkans-greece', 'T2', ['Parnassus', 'Parnassos']],
  // ── Apennines & Mediterranean ──
  ['etna', 'Etna', 'Etna', 37.751, 14.994, 3357, 'IT', 'peak', 'mediterranean', 'T3'],
  ['vesuvius', 'Vesuvius', 'Vesuvio', 40.821, 14.426, 1281, 'IT', 'peak', 'mediterranean', 'T1', ['Vesuvio', 'Vesuv']],
  ['corno-grande', 'Gran Sasso (Corno Grande)', 'Corno Grande', 42.469, 13.566, 2912, 'IT', 'peak', 'mediterranean', 'T4', ['Gran Sasso']],
  ['stromboli', 'Stromboli', 'Stromboli', 38.794, 15.213, 924, 'IT', 'peak', 'mediterranean', 'T2'],
  ['monte-cinto', 'Monte Cinto', 'Monte Cinto', 42.379, 8.946, 2706, 'FR', 'peak', 'mediterranean', 'T4'],
  ['psiloritis', 'Psiloritis (Mount Ida)', 'Psiloritis', 35.227, 24.769, 2456, 'GR', 'peak', 'mediterranean', 'T2', ['Mount Ida', 'Ida']],
  // ── Africa ──
  ['kilimanjaro', 'Kilimanjaro (Uhuru Peak)', 'Uhuru Peak', -3.076, 37.353, 5895, 'TZ', 'peak', 'africa', 'T3', ['Kilimanjaro', 'Kibo']],
  ['mount-meru', 'Mount Meru', 'Mount Meru', -3.247, 36.748, 4562, 'TZ', 'peak', 'africa', 'T3'],
  ['point-lenana', 'Mount Kenya (Point Lenana)', 'Point Lenana', -0.152, 37.318, 4985, 'KE', 'peak', 'africa', 'T3', ['Mount Kenya']],
  ['toubkal', 'Toubkal', 'Toubkal', 31.060, -7.916, 4167, 'MA', 'peak', 'africa', 'T3', ['Jbel Toubkal']],
  ['table-mountain', "Table Mountain (Maclear's Beacon)", "Maclear's Beacon", -33.963, 18.425, 1086, 'ZA', 'peak', 'africa', 'T2', ['Table Mountain']],
  // ── North America ──
  ['denali', 'Denali', 'Denali', 63.069, -151.007, 6190, 'US', 'peak', 'north-america', 'WS', ['Mount McKinley']],
  ['mount-whitney', 'Mount Whitney', 'Mount Whitney', 36.579, -118.292, 4421, 'US', 'peak', 'north-america', 'T3'],
  ['mount-rainier', 'Mount Rainier', 'Mount Rainier', 46.853, -121.760, 4392, 'US', 'peak', 'north-america', 'WS'],
  ['mount-elbert', 'Mount Elbert', 'Mount Elbert', 39.118, -106.445, 4401, 'US', 'peak', 'north-america', 'T2'],
  ['longs-peak', 'Longs Peak', 'Longs Peak', 40.255, -105.616, 4346, 'US', 'peak', 'north-america', 'T5'],
  ['pikes-peak', 'Pikes Peak', 'Pikes Peak', 38.841, -105.044, 4302, 'US', 'peak', 'north-america', 'T2'],
  ['half-dome', 'Half Dome', 'Half Dome', 37.746, -119.533, 2695, 'US', 'peak', 'north-america', 'T4'],
  ['mount-st-helens', 'Mount St. Helens', 'Mount Saint Helens', 46.191, -122.196, 2549, 'US', 'peak', 'north-america', 'T3', ['Mount St Helens']],
  ['mount-washington', 'Mount Washington', 'Mount Washington', 44.271, -71.303, 1917, 'US', 'peak', 'north-america', 'T3'],
  ['mount-temple', 'Mount Temple', 'Mount Temple', 51.351, -116.206, 3543, 'CA', 'peak', 'north-america', 'T5'],
  ['pico-de-orizaba', 'Pico de Orizaba', 'Pico de Orizaba', 19.030, -97.269, 5636, 'MX', 'peak', 'north-america', 'L', ['Citlaltépetl']],
  // ── South America ──
  ['aconcagua', 'Aconcagua', 'Aconcagua', -32.653, -70.011, 6961, 'AR', 'peak', 'south-america', 'T4'],
  ['chimborazo', 'Chimborazo', 'Chimborazo', -1.469, -78.817, 6263, 'EC', 'peak', 'south-america', 'WS'],
  ['cotopaxi', 'Cotopaxi', 'Cotopaxi', -0.681, -78.438, 5897, 'EC', 'peak', 'south-america', 'L'],
  ['huayna-potosi', 'Huayna Potosí', 'Huayna Potosí', -16.262, -68.154, 6088, 'BO', 'peak', 'south-america', 'WS', ['Huayna Potosi']],
  ['villarrica', 'Villarrica', 'Volcán Villarrica', -39.421, -71.939, 2847, 'CL', 'peak', 'south-america', 'L'],
  // ── Asia & Caucasus ──
  ['everest', 'Mount Everest', 'Mount Everest', 27.988, 86.925, 8849, 'NP', 'peak', 'asia', 'ZS', ['Everest', 'Sagarmatha', 'Chomolungma']],
  ['kala-patthar', 'Kala Patthar', 'Kala Patthar', 27.996, 86.829, 5644, 'NP', 'peak', 'asia', 'T3'],
  ['gokyo-ri', 'Gokyo Ri', 'Gokyo Ri', 27.962, 86.684, 5357, 'NP', 'peak', 'asia', 'T3'],
  ['island-peak', 'Island Peak (Imja Tse)', 'Imja Tse', 27.922, 86.936, 6189, 'NP', 'peak', 'asia', 'WS', ['Island Peak']],
  ['fuji', 'Mount Fuji', 'Mount Fuji', 35.361, 138.727, 3776, 'JP', 'peak', 'asia', 'T3', ['Fuji', 'Fujisan']],
  ['kinabalu', 'Mount Kinabalu', 'Mount Kinabalu', 6.075, 116.558, 4095, 'MY', 'peak', 'asia', 'T3', ['Kinabalu']],
  ['rinjani', 'Mount Rinjani', 'Rinjani', -8.411, 116.457, 3726, 'ID', 'peak', 'asia', 'T3', ['Gunung Rinjani']],
  ['elbrus', 'Elbrus', 'Elbrus', 43.355, 42.439, 5642, 'RU', 'peak', 'asia', 'L'],
  ['ararat', 'Mount Ararat', 'Ağrı Dağı', 39.702, 44.298, 5137, 'TR', 'peak', 'asia', 'L', ['Ararat', 'Agri Dagi']],
  // ── Oceania & Pacific ──
  ['aoraki', 'Aoraki / Mount Cook', 'Aoraki / Mount Cook', -43.595, 170.142, 3724, 'NZ', 'peak', 'oceania', 'ZS', ['Mount Cook', 'Aoraki']],
  ['ngauruhoe', 'Mount Ngauruhoe', 'Mount Ngauruhoe', -39.157, 175.632, 2291, 'NZ', 'peak', 'oceania', 'T4'],
  ['taranaki', 'Mount Taranaki', 'Taranaki Maunga', -39.296, 174.063, 2518, 'NZ', 'peak', 'oceania', 'T4', ['Mount Egmont', 'Taranaki']],
  ['roys-peak', 'Roys Peak', 'Roys Peak', -44.646, 169.040, 1578, 'NZ', 'peak', 'oceania', 'T2'],
  ['kosciuszko', 'Mount Kosciuszko', 'Mount Kosciuszko', -36.456, 148.263, 2228, 'AU', 'peak', 'oceania', 'T1', ['Kosciuszko']],
  ['mauna-kea', 'Mauna Kea', 'Mauna Kea', 19.821, -155.468, 4207, 'US', 'peak', 'oceania', 'T2'],
]

const r5 = v => Math.round(v * 1e5) / 1e5
const sleep = ms => new Promise(r => setTimeout(r, ms))
// volcanoes are natural=volcano in OSM, not natural=peak
const TAGS = { peak: 'osm_tag=natural:peak&osm_tag=natural:volcano', hut: 'osm_tag=tourism:alpine_hut' }

const toEntry = ([id, name, , lat, lon, elev, country, kind, region, grade, aka]) =>
  ({ id, name, ...(aka ? { aka } : {}), lat, lon, elev, country, kind, region, grade })

// 1. every row valid before asking anyone anything
const seen = new Set()
const bad = LIST.map(row => checkPeak(toEntry(row), seen)).filter(Boolean)
if (bad.length) { console.error(bad.join('\n')); process.exit(1) }

// 2. exact coordinates: the OpenStreetMap match nearest the hint, within 3 km
async function resolve(row) {
  const [id, , query, lat, lon, , , kind] = row
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&${TAGS[kind]}&limit=10&lat=${lat}&lon=${lon}`, { headers: UA })
  const features = res.ok ? (await res.json()).features ?? [] : []
  const best = features
    .map(f => ({ lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }))
    .map(p => ({ ...p, km: haversineKm(lat, lon, p.lat, p.lon) }))
    .sort((a, b) => a.km - b.km)[0]
  if (!best || best.km > 3) return { id, missing: best ? `nearest match ${best.km.toFixed(1)} km away` : 'no match' }
  return { ...toEntry(row), lat: r5(best.lat), lon: r5(best.lon) }
}

const out = [], missing = []
for (const row of LIST) {
  const r = await resolve(row)
  if (r.missing) missing.push(`${r.id}: ${r.missing}`)
  else out.push(r)
  await sleep(300) // be fair to the public Photon instance
}
if (missing.length) {
  console.error(`No OpenStreetMap summit within 3 km — fix the hint or the search text:\n${missing.join('\n')}`)
  process.exit(1)
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')
console.log(`${out.length} featured peaks → ${path.relative(process.cwd(), OUT)}`)
```

- [ ] **Step 4: Build the list** — `node scripts/build-featured-peaks.mjs` (about 1–2 minutes). For every line it prints under "No OpenStreetMap summit within 3 km": look the summit up (`https://nominatim.openstreetmap.org/search?q=<name>&format=json` or the Photon URL without `osm_tag`), correct that row's search text or hint coordinates, and run again. A row that still has no OpenStreetMap summit is removed (keep the total ≥ 190 and every region non-empty). Expected end: `NNN featured peaks → lib/hike/featured.json`.

- [ ] **Step 5: Run** `node --test lib/hike/featured.test.js` → PASS; `npm test` → all pass.

- [ ] **Step 6: Commit** — `git add scripts/build-featured-peaks.mjs lib/hike/featured.json lib/hike/featured.test.js && git commit -m "Featured peaks: ~200 worldwide with region and SAC grade; the builder refuses a broken list"`

### Task 3: Hiking screen — Near you, regions, grades; teaser; peak page

**Files:**
- Create: `app/components/hike/PeakDirectory.jsx`
- Modify: `lib/i18n.js` (5 languages), `app/components/hike/FeaturedList.jsx`, `app/components/hike/HikeApp.jsx`, `app/hike/page.js`, `app/components/hike/PeakView.jsx`, `lib/hike/featured.test.js`

**Interfaces:**
- Consumes: `nearest`, `byRegion`, `lastCityPos`, `REGIONS` (Task 1); `featured.json` with `region`, `grade` (Task 2).
- Produces: `<PeakDirectory peaks lang hrefFor? pos? />`.

- [ ] **Step 1: Failing test** — append to `lib/hike/featured.test.js`:

```js
import { t, LANGUAGES } from '../i18n.js'

test('every region and the new screen texts have words in every language', () => {
  for (const { code } of LANGUAGES) {
    for (const r of REGIONS) assert.notEqual(t(code, `region_${r}`), `region_${r}`, `${code} region_${r}`)
    for (const k of ['hikeNearYou', 'hikeAllPeaks', 'gradeNote']) assert.notEqual(t(code, k), k, `${code} ${k}`)
  }
})
```
(move the new `import` line to the top of the file next to the others). Run `node --test lib/hike/featured.test.js` → FAIL.

- [ ] **Step 2: Texts** — in `lib/i18n.js`, add after each language's `hikeBack:` line:

en:
```js
    hikeNearYou: 'Near you',
    hikeAllPeaks: 'All peaks',
    gradeNote: 'SAC grade of the usual route in good conditions — check locally.',
    'region_eastern-alps': 'Eastern Alps',
    'region_western-alps': 'Western Alps',
    region_dolomites: 'Dolomites',
    'region_central-europe': 'Central European uplands',
    'region_pyrenees-iberia': 'Pyrenees & Iberia',
    'region_british-isles': 'British Isles',
    region_scandinavia: 'Scandinavia & Iceland',
    region_carpathians: 'Carpathians & Tatras',
    'region_balkans-greece': 'Balkans & Greece',
    region_mediterranean: 'Apennines & Mediterranean',
    region_africa: 'Africa',
    'region_north-america': 'North America',
    'region_south-america': 'South America',
    region_asia: 'Asia & Caucasus',
    region_oceania: 'Oceania & Pacific',
```
de:
```js
    hikeNearYou: 'In deiner Nähe',
    hikeAllPeaks: 'Alle Gipfel',
    gradeNote: 'SAC-Bewertung des üblichen Wegs bei guten Verhältnissen – vor Ort prüfen.',
    'region_eastern-alps': 'Ostalpen',
    'region_western-alps': 'Westalpen',
    region_dolomites: 'Dolomiten',
    'region_central-europe': 'Mittelgebirge',
    'region_pyrenees-iberia': 'Pyrenäen & Iberien',
    'region_british-isles': 'Britische Inseln',
    region_scandinavia: 'Skandinavien & Island',
    region_carpathians: 'Karpaten & Tatra',
    'region_balkans-greece': 'Balkan & Griechenland',
    region_mediterranean: 'Apennin & Mittelmeer',
    region_africa: 'Afrika',
    'region_north-america': 'Nordamerika',
    'region_south-america': 'Südamerika',
    region_asia: 'Asien & Kaukasus',
    region_oceania: 'Ozeanien & Pazifik',
```
fr:
```js
    hikeNearYou: 'Près de vous',
    hikeAllPeaks: 'Tous les sommets',
    gradeNote: 'Cotation CAS de l’itinéraire habituel par bonnes conditions — à vérifier sur place.',
    'region_eastern-alps': 'Alpes orientales',
    'region_western-alps': 'Alpes occidentales',
    region_dolomites: 'Dolomites',
    'region_central-europe': 'Massifs d’Europe centrale',
    'region_pyrenees-iberia': 'Pyrénées & Ibérie',
    'region_british-isles': 'Îles Britanniques',
    region_scandinavia: 'Scandinavie & Islande',
    region_carpathians: 'Carpates & Tatras',
    'region_balkans-greece': 'Balkans & Grèce',
    region_mediterranean: 'Apennins & Méditerranée',
    region_africa: 'Afrique',
    'region_north-america': 'Amérique du Nord',
    'region_south-america': 'Amérique du Sud',
    region_asia: 'Asie & Caucase',
    region_oceania: 'Océanie & Pacifique',
```
es:
```js
    hikeNearYou: 'Cerca de ti',
    hikeAllPeaks: 'Todas las cumbres',
    gradeNote: 'Grado SAC de la ruta habitual con buenas condiciones: compruébalo en el lugar.',
    'region_eastern-alps': 'Alpes orientales',
    'region_western-alps': 'Alpes occidentales',
    region_dolomites: 'Dolomitas',
    'region_central-europe': 'Macizos de Europa central',
    'region_pyrenees-iberia': 'Pirineos e Iberia',
    'region_british-isles': 'Islas Británicas',
    region_scandinavia: 'Escandinavia e Islandia',
    region_carpathians: 'Cárpatos y Tatras',
    'region_balkans-greece': 'Balcanes y Grecia',
    region_mediterranean: 'Apeninos y Mediterráneo',
    region_africa: 'África',
    'region_north-america': 'América del Norte',
    'region_south-america': 'América del Sur',
    region_asia: 'Asia y Cáucaso',
    region_oceania: 'Oceanía y Pacífico',
```
it:
```js
    hikeNearYou: 'Vicino a te',
    hikeAllPeaks: 'Tutte le vette',
    gradeNote: 'Grado CAS della via normale in buone condizioni — verifica sul posto.',
    'region_eastern-alps': 'Alpi orientali',
    'region_western-alps': 'Alpi occidentali',
    region_dolomites: 'Dolomiti',
    'region_central-europe': 'Rilievi dell’Europa centrale',
    'region_pyrenees-iberia': 'Pirenei e penisola iberica',
    'region_british-isles': 'Isole britanniche',
    region_scandinavia: 'Scandinavia e Islanda',
    region_carpathians: 'Carpazi e Tatra',
    'region_balkans-greece': 'Balcani e Grecia',
    region_mediterranean: 'Appennini e Mediterraneo',
    region_africa: 'Africa',
    'region_north-america': 'Nord America',
    'region_south-america': 'Sud America',
    region_asia: 'Asia e Caucaso',
    region_oceania: 'Oceania e Pacifico',
```
Run `node --test lib/hike/featured.test.js` → PASS.

- [ ] **Step 3: Rows show grade and distance** — in `app/components/hike/FeaturedList.jsx` replace the right-hand span:

```jsx
            <span className="text-zinc-500 text-xs tabular-nums shrink-0">
              {[p.km != null ? `${Math.round(p.km)} km` : null, `${p.elev} m`, p.grade, p.country].filter(Boolean).join(' · ')}
            </span>
```

- [ ] **Step 4: Create `app/components/hike/PeakDirectory.jsx`:**

```jsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapPin, MountainSnow, ChevronDown } from 'lucide-react'
import { t } from '@/lib/i18n'
import { nearest, byRegion, lastCityPos } from '@/lib/hike/featured-list'
import { SectionTitle } from '../ui'
import FeaturedList from './FeaturedList'

// The featured peaks: the 10 nearest (the position when already allowed or
// after "Near me", else the last city looked at), then every peak by region
// in collapsible groups — the nearest peak's region open. Without hrefFor
// (the website teaser) plain cards and no Near you block.
export default function PeakDirectory({ peaks, lang, hrefFor = null, pos = null }) {
  const linked = !!hrefFor // hrefFor is a new function every render: depend on this
  const [autoPos, setAutoPos] = useState(null)

  useEffect(() => {
    if (!linked) return
    let off = false
    const set = p => { if (!off) setAutoPos(p) }
    const fromCity = () => set(lastCityPos(k => localStorage.getItem(k)))
    const geo = navigator.geolocation
    if (!geo || !navigator.permissions?.query) { fromCity(); return () => { off = true } }
    navigator.permissions.query({ name: 'geolocation' }).then(s => {
      if (s.state !== 'granted') return fromCity()
      geo.getCurrentPosition(p => set({ lat: p.coords.latitude, lon: p.coords.longitude }), fromCity, { maximumAge: 600000, timeout: 10000 })
    }, fromCity)
    return () => { off = true }
  }, [linked])

  const here = pos ?? autoPos
  const near = useMemo(() => (linked ? nearest(peaks, here, 10) : []), [linked, peaks, here])
  const groups = useMemo(() => byRegion(peaks), [peaks])
  const openRegion = near[0]?.region ?? null

  return (
    <div className="space-y-6">
      {near.length > 0 && (
        <section className="space-y-3">
          <SectionTitle icon={MapPin}>{t(lang, 'hikeNearYou')}</SectionTitle>
          <FeaturedList peaks={near} hrefFor={hrefFor} />
        </section>
      )}
      <section className="space-y-2">
        <SectionTitle icon={MountainSnow}>{t(lang, 'hikeAllPeaks')}</SectionTitle>
        {groups.map(g => (
          <details key={g.region} open={g.region === openRegion} className="group border-b border-zinc-800 last:border-b-0">
            <summary className="press flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm [&::-webkit-details-marker]:hidden">
              <span className="font-medium min-w-0 truncate">{t(lang, `region_${g.region}`)}</span>
              <span className="inline-flex items-center gap-2 text-xs text-zinc-500 tabular-nums shrink-0">
                {g.peaks.length}
                <ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden />
              </span>
            </summary>
            <div className="pb-3"><FeaturedList peaks={g.peaks} hrefFor={hrefFor} /></div>
          </details>
        ))}
        <p className="text-xs text-zinc-500 pt-1">{t(lang, 'gradeNote')}</p>
      </section>
    </div>
  )
}
```

- [ ] **Step 5: HikeApp uses it** — in `app/components/hike/HikeApp.jsx`:
  - imports: remove `import FeaturedList from './FeaturedList'`, `import { SectionTitle } from '../ui'` and `import { haversineKm } from '@/lib/geo'`; add `import PeakDirectory from './PeakDirectory'`; change `import { Suspense, useEffect, useMemo, useState } from 'react'` only if `useMemo` is still used (it is, for `ids`).
  - delete the `const list = useMemo(...)` block (lines with `haversineKm` sorting).
  - replace
    ```jsx
          <section className="space-y-3">
            <SectionTitle icon={MountainSnow}>{t(lang, 'hikeFeatured')}</SectionTitle>
            <FeaturedList peaks={list} hrefFor={hrefFor} />
          </section>
    ```
    with
    ```jsx
          <PeakDirectory peaks={featured} lang={lang} hrefFor={hrefFor} pos={pos} />
    ```

- [ ] **Step 6: The teaser** — in `app/hike/page.js` replace

```jsx
      <section className="mt-8 space-y-3">
        <div className="text-emerald-400 text-xs tracking-widest uppercase">{t(lang, 'hikeFeatured')}</div>
        <FeaturedList peaks={featured} />
      </section>
```
with
```jsx
      <section className="mt-8">
        <PeakDirectory peaks={featured} lang={lang} />
      </section>
```
and the import `import FeaturedList from '../components/hike/FeaturedList'` with `import PeakDirectory from '../components/hike/PeakDirectory'`.

- [ ] **Step 7: Peak page** — in `app/components/hike/PeakView.jsx` replace

```jsx
          {peak.country ? ` · ${peak.country}` : ''}
          {d ? ` · ${tn(lang, 'hikeModels', d.sources.length)}` : ''}
        </p>
```
with
```jsx
          {peak.grade ? ` · SAC ${peak.grade}` : ''}
          {peak.country ? ` · ${peak.country}` : ''}
          {d ? ` · ${tn(lang, 'hikeModels', d.sources.length)}` : ''}
        </p>
        {peak.grade && <p className="text-zinc-500 text-xs mt-1">{t(lang, 'gradeNote')}</p>}
```

- [ ] **Step 8: Verify** — `npx eslint app lib --max-warnings 0`, `npm test`, `npx next build` → clean. Visual check (local `npx next start -p 3123`, headless Edge 430 px, app mode via `/hike?app=1` then `/hike`): All peaks shows the regions closed with counts; with a cached city (open `/?city=Lienz` first) Near you lists Großglockner-area peaks with km and Eastern Alps opens; a peak page shows "SAC WS" and the note; the teaser `/hike` without app mode shows the regions and no Near you; search "glockner" shows "Großglockner · AT" (no region id). Stop the server (kill the process on port 3123).

- [ ] **Step 9: Commit** — `git add lib/i18n.js lib/hike/featured.test.js app/components/hike app/hike/page.js && git commit -m "Hiking: Near you + peaks by region with SAC grades; grade on the peak page; teaser grouped"`

### Task 4: Ship

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: CHANGELOG** — under today's date (add `## 2026-10-02` entries at the top section's "Added"), add:

```markdown
### Added — more mountains (app)
- **~200 featured peaks** instead of 41: more Alps (Dolomites, Swiss and French
  4000ers, easy day-hike summits), the rest of Europe (Pyrenees, Tatras,
  Scandinavia, British Isles, Balkans, Etna …) and world classics (Kilimanjaro,
  Rockies, Andes, Himalaya trekking peaks, Fuji, New Zealand).
- **SAC grade** of the usual route on every featured peak (T1–T6, or L / WS /
  ZS / S over glaciers and with climbing), in the list and on the peak page.
- **Near you**: the 10 featured peaks nearest to you (or to the last city you
  looked at); **All peaks** grouped by region, folded, yours open. The website
  teaser lists the regions too.
```

- [ ] **Step 2: Verify + push** — `npm test`, `npx next build` → clean; `git add CHANGELOG.md && git commit -m "Changelog: more mountains"`; `git push origin main`; wait for the deployment, then `curl -s https://metablend.app/hike | grep -c "region_"` → `0` (no raw keys) and `curl -s "https://metablend.app/api/peaks?q=kilimanjaro" | grep -o '"grade":"T3"'` → one hit.
