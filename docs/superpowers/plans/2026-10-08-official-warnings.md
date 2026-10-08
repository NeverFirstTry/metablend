# Official weather warnings (Europe) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show MeteoAlarm's official warnings for a city or peak (strip + card), and send orange/red ones through the existing "Severe weather" alerts.

**Architecture:** A build script turns MeteoAlarm's EMMA_ID region outlines into a simplified server-side `lib/warnings/regions.json`; a 15-minute job reads 35 country feeds, parses CAP warnings (pure `parseFeed`) and stores them in a Supabase `warnings` table; `/api/warnings` matches a point to regions (pure `regionsAt`) and returns its warnings; the forecast and peak pages render a strip and a card; the push dispatcher reads the same table through an injected `warningsAt(lat, lon)`.

**Tech Stack:** Next.js 16 App Router (Node runtime), Supabase (supabase-js, pg_cron, pg_net), node:test, Tailwind v4, the app's i18n (13 languages).

**Spec:** `docs/superpowers/specs/2026-10-08-official-warnings-design.md`

## Global Constraints

- Coverage: the 35 MeteoAlarm countries whose regions are in the outline set; Switzerland, the UK and Ukraine are out (no outlines) — they show nothing, model-based alerts as now.
- Notifications: orange (3) and red (4) only; yellow (2) shows in the app, never notifies.
- Official warnings replace the model-based `severe` alerts for a home city whose position is in a warning region; elsewhere the model-based alerts stay. No new setting: the `alert_severe` switch.
- Quiet hours 22–07 (`RULES.quietFrom/quietTo`): red is sent at once (and is not counted against the daily cap of 3); orange waits and is sent after 07:00 if still active.
- One message per warning id; again only when its level rises; never once it has expired.
- Attribution on every warning shown: the issuing service's name + "MeteoAlarm" (CC BY 4.0-equivalent terms).
- Colour never alone: every level is a word plus ⚠ / ⚠⚠ / ⚠⚠⚠; texts use the existing AA tokens (`--warn` yellow, `--hot` orange, `--bad` red), covered by `lib/sky-contrast.test.js`.
- All UI and push texts in the 13 languages (`lib/i18n/<code>.js`); `lib/i18n/parity.test.js` must pass; placeholders identical across languages.
- `lib/warnings/regions.json` is server-only (imported only by API routes), ≤ 2.5 MB.
- No new npm dependencies.
- Windows: write files containing backslashes with the Write/Edit tools, never bash heredocs or `node -e`.
- Commit and push straight to `main`; CHANGELOG entry at the end.

## Review Focus

- **An updated or extended warning** (an `Update` that `references` the old identifier) must show once, as the new version — never twice. → Task 2 test "Update and Cancel replace what they reference".
- **A city a few km from a border** (Salzburg, Kufstein, Strasbourg) must get its own country's region only. → Task 1 test "border cities match only their own country".
- **One country's feed failing mid-run** must leave that country's stored warnings in place and still refresh the others. → Task 3 test "a failed feed keeps that country's rows".
- **A warning without the reader's language** must fall back to English, then to whatever text exists — never show empty text. → Task 4 test "text falls back to English, then the first language".
- **An orange warning issued during quiet hours that ends before 07:00** must never be sent; a red one at 02:00 must be. → Task 6 test "quiet hours: orange waits, red goes, expired never".

---

### Task 1: Region map

**Files:**
- Create: `scripts/build-warning-regions.mjs`, `lib/warnings/regions.js`, `lib/warnings/regions.json` (generated), `lib/warnings/regions.test.js`

**Interfaces:**
- Produces: `regionsAt(data, lat, lon) → string[]` (EMMA_IDs containing the point; `[]` outside coverage). `data` is the parsed `regions.json`: `{ v: 1, regions: [{ c: 'AT803', b: [minLon, minLat, maxLon, maxLat], p: [[[lon, lat], …], …][] }] }` — `p` is a list of polygons, each a list of rings (first outer, then holes).

- [ ] **Step 1: Write the failing tests** — `lib/warnings/regions.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { regionsAt } from './regions.js'

const data = JSON.parse(fs.readFileSync(new URL('./regions.json', import.meta.url), 'utf8'))
const country = (lat, lon) => [...new Set(regionsAt(data, lat, lon).map(c => c.slice(0, 2)))]

test('regionsAt — cities land in their own country\'s regions', () => {
  assert.deepEqual(country(48.2082, 16.3738), ['AT']) // Vienna
  assert.deepEqual(country(47.2692, 11.4041), ['AT']) // Innsbruck
  assert.deepEqual(country(46.8289, 12.7695), ['AT']) // Lienz
  assert.deepEqual(country(52.52, 13.405), ['DE']) // Berlin
  assert.deepEqual(country(40.4168, -3.7038), ['ES']) // Madrid
  assert.deepEqual(country(48.8566, 2.3522), ['FR']) // Paris
})

test('regionsAt — border cities match only their own country', () => {
  assert.deepEqual(country(47.8095, 13.055), ['AT']) // Salzburg, ~5 km from Germany
  assert.deepEqual(country(47.5833, 12.1667), ['AT']) // Kufstein
  assert.deepEqual(country(48.5734, 7.7521), ['FR']) // Strasbourg, on the Rhine
})

test('regionsAt — the sea, junk and uncovered countries match nothing', () => {
  assert.deepEqual(regionsAt(data, 40, -30), []) // mid-Atlantic
  assert.deepEqual(regionsAt(data, 47.3769, 8.5417), []) // Zurich: no Swiss outlines
  assert.deepEqual(regionsAt(data, Number.NaN, 10), [])
})

test('regionsAt — holes and multi-part regions', () => {
  const ring = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]
  const toy = { v: 1, regions: [
    { c: 'XX001', b: [0, 0, 10, 10], p: [[ring(0, 0, 10, 10), ring(4, 4, 6, 6)]] }, // a square with a hole
    { c: 'XX002', b: [20, 0, 32, 2], p: [[ring(20, 0, 22, 2)], [ring(30, 0, 32, 2)]] }, // two islands
  ] }
  assert.deepEqual(regionsAt(toy, 1, 1), ['XX001'])
  assert.deepEqual(regionsAt(toy, 5, 5), []) // in the hole
  assert.deepEqual(regionsAt(toy, 1, 31), ['XX002'])
  assert.deepEqual(regionsAt(toy, 1, 26), []) // between the islands
})

test('regions.json — small enough to ship, every region usable', () => {
  assert.ok(fs.statSync(new URL('./regions.json', import.meta.url)).size <= 2.5 * 1024 * 1024)
  assert.ok(data.regions.length > 1900)
  for (const r of data.regions) {
    assert.match(r.c, /^[A-Z]{2}[A-Z0-9]+$/, r.c)
    assert.ok(r.p.length > 0 && r.p.every(poly => poly[0].length >= 4), r.c)
  }
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test lib/warnings/regions.test.js`
Expected: FAIL — `Cannot find module …/regions.js` (and regions.json missing).

- [ ] **Step 3: Write `lib/warnings/regions.js`**

```js
// Which MeteoAlarm warning regions (EMMA_IDs) contain a point (pure — unit
// tested). `data` is lib/warnings/regions.json (scripts/build-warning-regions.mjs):
// { v, regions: [{ c, b, p }] } — c the EMMA_ID, b its [minLon, minLat,
// maxLon, maxLat], p its polygons, each a list of rings [[lon, lat], …]
// (the outer ring first, then holes). Server-only: the file is ~2 MB.
export function regionsAt(data, lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return []
  const out = []
  for (const r of data.regions) {
    const [x0, y0, x1, y1] = r.b
    if (lon < x0 || lon > x1 || lat < y0 || lat > y1) continue
    if (r.p.some(rings => inPolygon(rings, lon, lat))) out.push(r.c)
  }
  return out
}

// ray casting: does a horizontal ray from the point cross the ring an odd number of times?
function inRing(ring, x, y) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const inPolygon = (rings, x, y) => inRing(rings[0], x, y) && !rings.slice(1).some(hole => inRing(hole, x, y))
```

- [ ] **Step 4: Write `scripts/build-warning-regions.mjs`**

```js
// Builds lib/warnings/regions.json from MeteoAlarm's EMMA_ID region outlines
// (as bundled by the open-source NiklasJordan/meteoalarm package; data ©
// MeteoAlarm / EUMETNET, CC BY 4.0-equivalent terms). Re-run about once a
// year:   node scripts/build-warning-regions.mjs
// Outlines are simplified (Douglas–Peucker, ~0.005° ≈ 400 m) and rounded to
// 4 decimals so the file stays ~2 MB; each region gets a bounding box.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = 'https://raw.githubusercontent.com/NiklasJordan/meteoalarm/HEAD/src/meteoalarm/assets/geocodes.json'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../lib/warnings/regions.json')
const TOL = 0.005

const round = v => Math.round(v * 1e4) / 1e4
// perpendicular distance from p to the line a–b (in degrees; fine at this scale)
function dist(p, a, b) {
  const [x, y] = p, [x1, y1] = a, [x2, y2] = b
  const dx = x2 - x1, dy = y2 - y1
  if (!dx && !dy) return Math.hypot(x - x1, y - y1)
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}
function dp(pts, tol) {
  if (pts.length < 3) return pts
  let max = 0, at = 0
  for (let i = 1; i < pts.length - 1; i++) { const d = dist(pts[i], pts[0], pts.at(-1)); if (d > max) { max = d; at = i } }
  if (max <= tol) return [pts[0], pts.at(-1)]
  return [...dp(pts.slice(0, at + 1), tol).slice(0, -1), ...dp(pts.slice(at), tol)]
}
// a closed ring keeps ≥ 4 points (3 corners + closing point); tiny islands fall back to a finer tolerance
function simplifyRing(ring) {
  for (const tol of [TOL, TOL / 5, 0]) {
    const s = tol ? dp(ring, tol) : ring
    if (s.length >= 4) return s.map(([x, y]) => [round(x), round(y)])
  }
  return null
}

const json = await fetch(SRC).then(r => { if (!r.ok) throw new Error(`${r.status} ${SRC}`); return r.json() })
const regions = []
for (const f of json.features) {
  const code = f.properties?.code
  if (!code || f.properties?.type !== 'EMMA_ID') continue
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : []
  const p = polys.map(rings => rings.map(simplifyRing).filter(Boolean)).filter(rings => rings.length)
  if (!p.length) continue
  const xs = p.flat(2).map(c => c[0]), ys = p.flat(2).map(c => c[1])
  regions.push({ c: code, b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], p })
}
regions.sort((a, b) => a.c.localeCompare(b.c))
const out = JSON.stringify({ v: 1, source: 'MeteoAlarm EMMA_ID geocodes (CC BY 4.0)', built: new Date().toISOString().slice(0, 10), regions })
writeFileSync(OUT, out)
console.log(`${regions.length} regions, ${(out.length / 1048576).toFixed(2)} MB → ${OUT}`)
```

- [ ] **Step 5: Build the map**

Run: `node scripts/build-warning-regions.mjs`
Expected: `~2000 regions, ≤ 2.5 MB → …/lib/warnings/regions.json`. If larger than 2.5 MB, raise `TOL` to `0.008` and re-run.

- [ ] **Step 6: Run the tests**

Run: `node --test lib/warnings/regions.test.js`
Expected: PASS (5 tests). If a border city fails, lower `TOL` to `0.003`, rebuild, re-run (and recheck the size).

- [ ] **Step 7: Commit**

```bash
git add scripts/build-warning-regions.mjs lib/warnings/regions.js lib/warnings/regions.json lib/warnings/regions.test.js
git commit -m "Warnings: MeteoAlarm region map (simplified EMMA_ID outlines) and point lookup"
```

---

### Task 2: Feed parsing

**Files:**
- Create: `lib/warnings/feeds.js`, `lib/warnings/parse.js`, `lib/warnings/parse.test.js`, `lib/warnings/__fixtures__/feed-germany.json`, `lib/warnings/__fixtures__/feed-spain.json`

**Interfaces:**
- Consumes: `regions.json` (Task 1) in a test.
- Produces:
  - `FEEDS: [slug, countryCode][]` (35 entries), `feedUrl(slug) → string`.
  - `WARNING_TYPES: string[]` = `['wind','snow_ice','thunderstorm','fog','heat','cold','coastal','forest_fire','avalanche','rain','flood','rain_flood','other']`.
  - `parseFeed(json, country, now) → Warning[]`, where `Warning = { id, country, regions: string[], level: 2|3|4, type, onset: string (ISO with the issuer's offset), expires: string (same), texts: { [lang2]: { event, headline, description, instruction } }, sender: string, web: string|null }`.

- [ ] **Step 1: Save two real feeds as fixtures** (trimmed to 40 warnings each):

Run (PowerShell or bash):
```bash
node --input-type=module -e "for (const [c, f] of [['germany','feed-germany'],['spain','feed-spain']]) { const j = await (await fetch('https://feeds.meteoalarm.org/api/v1/warnings/feeds-' + c)).json(); j.warnings = j.warnings.slice(0, 40); (await import('node:fs')).writeFileSync('lib/warnings/__fixtures__/' + f + '.json', JSON.stringify(j)) }"
```
Expected: two files, each with `warnings` (≤ 40). If a feed has 0 warnings that day, take `italy` or `poland` instead and adjust the test's country code and prefix.

- [ ] **Step 2: Write the failing tests** — `lib/warnings/parse.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parseFeed, WARNING_TYPES } from './parse.js'
import { FEEDS, feedUrl } from './feeds.js'

const fixture = name => JSON.parse(fs.readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), 'utf8'))
const sentOf = json => Math.min(...json.warnings.map(w => Date.parse(w.alert.sent)))

test('parseFeed — real German and Spanish warnings', () => {
  for (const [name, cc] of [['feed-germany', 'DE'], ['feed-spain', 'ES']]) {
    const json = fixture(name)
    const list = parseFeed(json, cc, sentOf(json))
    assert.ok(list.length > 0, name)
    for (const w of list) {
      assert.equal(w.country, cc)
      assert.ok(w.regions.length > 0 && w.regions.every(r => r.startsWith(cc)), w.id)
      assert.ok([2, 3, 4].includes(w.level), w.id)
      assert.ok(WARNING_TYPES.includes(w.type), `${w.id} ${w.type}`)
      assert.ok(Date.parse(w.expires) > sentOf(json))
      assert.ok(Object.keys(w.texts).length > 0)
      for (const tx of Object.values(w.texts)) assert.equal(typeof tx.headline, 'string')
    }
  }
})

const alert = (id, extra = {}, info = {}) => ({
  alert: {
    identifier: id, msgType: 'Alert', status: 'Actual', sender: 'x@example.org', sent: '2026-10-08T06:00:00+02:00', ...extra,
    info: [{
      language: 'de-DE', event: 'GEWITTER', headline: 'Amtliche WARNUNG vor GEWITTER', description: 'Es treten Gewitter auf.', instruction: '',
      onset: '2026-10-08T14:00:00+02:00', expires: '2026-10-08T20:00:00+02:00', senderName: 'Deutscher Wetterdienst', web: 'https://dwd.de',
      parameter: [{ valueName: 'awareness_level', value: '3; orange; Severe' }, { valueName: 'awareness_type', value: '3; Thunderstorm' }],
      area: [{ areaDesc: 'Kreis X', geocode: [{ valueName: 'EMMA_ID', value: 'DE103' }, { valueName: 'WARNCELLID', value: '9' }] }],
      ...info,
    }, { language: 'en-GB', event: 'THUNDERSTORMS', headline: 'Official WARNING of THUNDERSTORMS', description: 'Thunderstorms.', instruction: 'Stay inside.', onset: '2026-10-08T14:00:00+02:00', expires: '2026-10-08T20:00:00+02:00', parameter: [], area: [] }],
  },
})
const NOW = Date.parse('2026-10-08T08:00:00+02:00')

test('parseFeed — one record per alert, with its level, type, regions and texts per language', () => {
  const [w] = parseFeed({ warnings: [alert('a')] }, 'DE', NOW)
  assert.equal(w.id, 'a')
  assert.equal(w.level, 3)
  assert.equal(w.type, 'thunderstorm')
  assert.deepEqual(w.regions, ['DE103'])
  assert.equal(w.onset, '2026-10-08T14:00:00+02:00')
  assert.equal(w.sender, 'Deutscher Wetterdienst')
  assert.deepEqual(Object.keys(w.texts).sort(), ['de', 'en'])
  assert.equal(w.texts.en.instruction, 'Stay inside.')
})

test('parseFeed — expired, green, test-only and area-less alerts are dropped', () => {
  assert.deepEqual(parseFeed({ warnings: [alert('a')] }, 'DE', Date.parse('2026-10-08T21:00:00+02:00')), [])
  assert.deepEqual(parseFeed({ warnings: [alert('g', {}, { parameter: [{ valueName: 'awareness_level', value: '1; green; Minor' }] })] }, 'DE', NOW), [])
  assert.deepEqual(parseFeed({ warnings: [alert('t', { status: 'Test' })] }, 'DE', NOW), [])
  assert.deepEqual(parseFeed({ warnings: [alert('n', {}, { area: [{ areaDesc: 'X', geocode: [] }] })] }, 'DE', NOW), [])
  assert.deepEqual(parseFeed(null, 'DE', NOW), [])
})

test('parseFeed — Update and Cancel replace what they reference', () => {
  const update = alert('b', { msgType: 'Update', references: 'x@example.org,a,2026-10-08T06:00:00+02:00' }, { parameter: [{ valueName: 'awareness_level', value: '4; red; Extreme' }, { valueName: 'awareness_type', value: '3; Thunderstorm' }] })
  const list = parseFeed({ warnings: [alert('a'), update] }, 'DE', NOW)
  assert.deepEqual(list.map(w => [w.id, w.level]), [['b', 4]])
  const cancel = alert('c', { msgType: 'Cancel', references: 'x@example.org,b,2026-10-08T07:00:00+02:00' })
  assert.deepEqual(parseFeed({ warnings: [alert('a'), update, cancel] }, 'DE', NOW), [])
})

test('parseFeed — an unknown awareness type is kept as "other"', () => {
  const [w] = parseFeed({ warnings: [alert('o', {}, { parameter: [{ valueName: 'awareness_level', value: '2; yellow; Moderate' }, { valueName: 'awareness_type', value: '99; Something' }] })] }, 'DE', NOW)
  assert.equal(w.type, 'other')
})

test('FEEDS — 35 countries, each with outlines in the region map', () => {
  const data = JSON.parse(fs.readFileSync(new URL('./regions.json', import.meta.url), 'utf8'))
  const prefixes = new Set(data.regions.map(r => r.c.slice(0, 2)))
  assert.equal(FEEDS.length, 35)
  for (const [slug, cc] of FEEDS) assert.ok(prefixes.has(cc), `${slug} ${cc}`)
  assert.equal(feedUrl('austria'), 'https://feeds.meteoalarm.org/api/v1/warnings/feeds-austria')
})
```

- [ ] **Step 3: Run to verify they fail**

Run: `node --test lib/warnings/parse.test.js`
Expected: FAIL — `Cannot find module …/parse.js`.

- [ ] **Step 4: Write `lib/warnings/feeds.js`**

```js
// MeteoAlarm's open country feeds (no key) for the countries the region map
// covers. Switzerland, the UK and Ukraine have feeds but no outlines in
// lib/warnings/regions.json, so they are left out (see the spec).
export const FEEDS = [
  ['austria', 'AT'], ['belgium', 'BE'], ['bosnia-herzegovina', 'BA'], ['bulgaria', 'BG'], ['croatia', 'HR'],
  ['cyprus', 'CY'], ['czechia', 'CZ'], ['denmark', 'DK'], ['estonia', 'EE'], ['finland', 'FI'],
  ['france', 'FR'], ['germany', 'DE'], ['greece', 'GR'], ['hungary', 'HU'], ['iceland', 'IS'],
  ['ireland', 'IE'], ['israel', 'IL'], ['italy', 'IT'], ['latvia', 'LV'], ['lithuania', 'LT'],
  ['luxembourg', 'LU'], ['malta', 'MT'], ['moldova', 'MD'], ['montenegro', 'ME'], ['netherlands', 'NL'],
  ['norway', 'NO'], ['poland', 'PL'], ['portugal', 'PT'], ['republic-of-north-macedonia', 'MK'], ['romania', 'RO'],
  ['serbia', 'RS'], ['slovakia', 'SK'], ['slovenia', 'SI'], ['spain', 'ES'], ['sweden', 'SE'],
]
export const feedUrl = slug => `https://feeds.meteoalarm.org/api/v1/warnings/feeds-${slug}`
```

- [ ] **Step 5: Write `lib/warnings/parse.js`**

```js
// MeteoAlarm country feed → warnings (pure — unit tested). Each feed entry is
// a CAP 1.2 alert with one `info` per language; level and type come from the
// MeteoAlarm parameters, the areas from EMMA_ID geocodes. Feeds keep expired
// alerts, and an Update or Cancel replaces the alerts it references.
const TYPES = { 1: 'wind', 2: 'snow_ice', 3: 'thunderstorm', 4: 'fog', 5: 'heat', 6: 'cold', 7: 'coastal', 8: 'forest_fire', 9: 'avalanche', 10: 'rain', 12: 'flood', 13: 'rain_flood' }
export const WARNING_TYPES = [...Object.values(TYPES), 'other']

const param = (info, name) => info?.parameter?.find(p => p.valueName === name)?.value ?? null
const lead = s => Number.parseInt(String(s ?? ''), 10)
const lang2 = l => String(l ?? '').slice(0, 2).toLowerCase() || 'xx'
// CAP references: "sender,identifier,sent sender,identifier,sent …"
const referenced = refs => String(refs ?? '').trim().split(/\s+/).map(t => t.split(',')[1]).filter(Boolean)

export function parseFeed(json, country, now = Date.now()) {
  const alerts = (json?.warnings ?? []).map(w => w?.alert).filter(Boolean)
  const replaced = new Set(alerts.filter(a => a.msgType === 'Update' || a.msgType === 'Cancel').flatMap(a => referenced(a.references)))
  const out = []
  for (const a of alerts) {
    if (a.msgType === 'Cancel' || a.status !== 'Actual' || replaced.has(a.identifier)) continue
    const infos = (a.info ?? []).filter(Boolean)
    const main = infos.find(i => param(i, 'awareness_level')) ?? infos[0]
    if (!main) continue
    const level = lead(param(main, 'awareness_level'))
    if (!(level >= 2 && level <= 4)) continue
    const expires = main.expires
    if (!expires || !(Date.parse(expires) > now)) continue
    const regions = [...new Set(infos.flatMap(i => (i.area ?? []).flatMap(ar => (ar.geocode ?? []).filter(g => g.valueName === 'EMMA_ID').map(g => g.value))))]
    if (!regions.length) continue
    const texts = {}
    for (const i of infos) {
      texts[lang2(i.language)] ??= { event: i.event ?? '', headline: i.headline ?? '', description: i.description ?? '', instruction: i.instruction ?? '' }
    }
    out.push({
      id: a.identifier, country, regions, level,
      type: TYPES[lead(param(main, 'awareness_type'))] ?? 'other',
      onset: main.onset ?? main.effective ?? a.sent, expires, texts,
      sender: main.senderName ?? a.sender ?? '', web: main.web ?? null,
    })
  }
  return out
}
```

- [ ] **Step 6: Run the tests**

Run: `node --test lib/warnings/parse.test.js`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add lib/warnings/feeds.js lib/warnings/parse.js lib/warnings/parse.test.js lib/warnings/__fixtures__
git commit -m "Warnings: MeteoAlarm feed parser (levels, types, languages, updates and cancels)"
```

---

### Task 3: Storage and the refresh job

**Files:**
- Create: `supabase/warnings.sql`, `lib/warnings/store.js`, `lib/warnings/refresh.js`, `lib/warnings/refresh.test.js`, `app/api/warnings/refresh/route.js`
- Modify: `supabase/cron.sql` (append the job)

**Interfaces:**
- Consumes: `FEEDS`, `feedUrl`, `parseFeed` (Task 2); `jobKeyProblem` (`lib/auth.js`); `getJson` (`lib/outlook/http.js`); `logError`, `withErrorLog` (`lib/log.js`); `supabase` (`lib/supabase.js`).
- Produces:
  - `saveCountry(db, country, rows, runAt) → Promise<void>` and `warningsIn(db, regionIds, now) → Promise<Warning[]>` (rows shaped like Task 2's `Warning`).
  - `refreshAll({ feeds, fetchFeed, save, now, concurrency }) → Promise<{ countries, warnings, failed: [code, message][] }>`.
  - `GET /api/warnings/refresh` (calibrate key) → that summary.

- [ ] **Step 1: Write the failing tests** — `lib/warnings/refresh.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { refreshAll } from './refresh.js'

const germany = JSON.parse(fs.readFileSync(new URL('./__fixtures__/feed-germany.json', import.meta.url), 'utf8'))
const NOW = Math.min(...germany.warnings.map(w => Date.parse(w.alert.sent)))

test('refreshAll — every feed parsed and saved under its country', async () => {
  const saved = []
  const summary = await refreshAll({
    feeds: [['germany', 'DE'], ['austria', 'AT']],
    fetchFeed: async slug => (slug === 'germany' ? germany : { warnings: [] }),
    save: async (country, rows, at) => { saved.push([country, rows.length, at]) },
    now: NOW,
  })
  assert.deepEqual(saved.map(s => s[0]).sort(), ['AT', 'DE'])
  assert.ok(saved.find(s => s[0] === 'DE')[1] > 0)
  assert.equal(saved.find(s => s[0] === 'AT')[1], 0) // an empty feed clears that country
  assert.ok(saved.every(s => s[2] === NOW))
  assert.deepEqual(summary.failed, [])
  assert.equal(summary.countries, 2)
})

test('refreshAll — a failed feed keeps that country\'s rows (no save) and the rest still refresh', async () => {
  const saved = []
  const summary = await refreshAll({
    feeds: [['germany', 'DE'], ['spain', 'ES'], ['italy', 'IT']],
    fetchFeed: async slug => (slug === 'spain' ? null : slug === 'italy' ? Promise.reject(new Error('timeout')) : germany),
    save: async country => { saved.push(country) },
    now: NOW,
  })
  assert.deepEqual(saved, ['DE'])
  assert.deepEqual(summary.failed.map(f => f[0]).sort(), ['ES', 'IT'])
})

test('refreshAll — a failing save counts as failed, never throws', async () => {
  const summary = await refreshAll({
    feeds: [['germany', 'DE']], fetchFeed: async () => germany,
    save: async () => { throw new Error('db down') }, now: NOW,
  })
  assert.deepEqual(summary.failed, [['DE', 'db down']])
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test lib/warnings/refresh.test.js`
Expected: FAIL — `Cannot find module …/refresh.js`.

- [ ] **Step 3: Write `lib/warnings/refresh.js`**

```js
// The 15-minute refresh (deps injected — unit tested with fakes): each
// country's feed → parseFeed → save. A feed that fails leaves that country's
// stored warnings alone (they expire on their own); the others still refresh.
import { parseFeed } from './parse.js'

export async function refreshAll({ feeds, fetchFeed, save, now = Date.now(), concurrency = 6 }) {
  const done = [], failed = []
  let next = 0
  async function worker() {
    while (next < feeds.length) {
      const [slug, country] = feeds[next++]
      try {
        const json = await fetchFeed(slug)
        if (!json) throw new Error('no answer')
        const rows = parseFeed(json, country, now)
        await save(country, rows, now)
        done.push([country, rows.length])
      } catch (e) {
        failed.push([country, String(e?.message ?? e)])
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, feeds.length) }, worker))
  return { countries: done.length, warnings: done.reduce((s, [, n]) => s + n, 0), failed }
}
```

- [ ] **Step 4: Write `lib/warnings/store.js`**

```js
// The warnings table (server-only; `db` is the supabase client, passed in).
// onset / expires keep the issuer's own ISO text (its local clock, shown as
// is); ends_at is the same instant as a timestamp, for filtering.
export async function saveCountry(db, country, rows, runAt) {
  const stamp = new Date(runAt).toISOString()
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map(r => ({ ...r, ends_at: new Date(r.expires).toISOString(), fetched_at: stamp }))
    const { error } = await db.from('warnings').upsert(chunk, { onConflict: 'id' })
    if (error) throw new Error(error.message)
  }
  // whatever this run didn't see again is gone (expired, cancelled, replaced)
  const { error } = await db.from('warnings').delete().eq('country', country).lt('fetched_at', stamp)
  if (error) throw new Error(error.message)
}

export async function warningsIn(db, regionIds, now = Date.now()) {
  if (!regionIds.length) return []
  const { data, error } = await db
    .from('warnings')
    .select('id, country, regions, level, type, onset, expires, texts, sender, web')
    .overlaps('regions', regionIds)
    .gt('ends_at', new Date(now).toISOString())
  if (error) throw new Error(error.message)
  return data ?? []
}
```

- [ ] **Step 5: Write `supabase/warnings.sql`**

```sql
-- Official weather warnings (spec 2026-10-08): MeteoAlarm country feeds,
-- refreshed every 15 minutes by /api/warnings/refresh. RLS on, no policies:
-- only the API (service-role key) reads and writes.
create table if not exists public.warnings (
  id text primary key,
  country text not null,
  regions text[] not null,
  level smallint not null check (level between 2 and 4),
  type text not null,
  onset text,
  expires text not null,
  ends_at timestamptz not null,
  texts jsonb not null default '{}'::jsonb,
  sender text,
  web text,
  fetched_at timestamptz not null default now()
);
create index if not exists warnings_regions_idx on public.warnings using gin (regions);
create index if not exists warnings_ends_idx on public.warnings (ends_at);
create index if not exists warnings_country_idx on public.warnings (country, fetched_at);
alter table public.warnings enable row level security;
```

- [ ] **Step 6: Append the job to `supabase/cron.sql`**

```sql

-- Official warnings: every MeteoAlarm country feed, every quarter hour, just
-- before the quarter-hourly push run (:02/:17/…) reads them.
select cron.schedule(
  'warnings-refresh',
  '0,15,30,45 * * * *',
  $job$
  select net.http_get(
    url := 'https://metablend.app/api/warnings/refresh',
    headers := jsonb_build_object(
      'x-calibrate-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'calibrate_secret')
    ),
    timeout_milliseconds := 120000
  );
  $job$
);
```

- [ ] **Step 7: Write `app/api/warnings/refresh/route.js`**

```js
import { withErrorLog, logError } from '@/lib/log'
import { jobKeyProblem } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getJson } from '@/lib/outlook/http'
import { FEEDS, feedUrl } from '@/lib/warnings/feeds'
import { refreshAll } from '@/lib/warnings/refresh'
import { saveCountry } from '@/lib/warnings/store'

// GET /api/warnings/refresh — pg_cron every 15 min (supabase/cron.sql),
// with the calibrate key. Reads the 35 MeteoAlarm country feeds into the
// warnings table; a failing feed keeps its country's rows.
export const maxDuration = 120

export const GET = withErrorLog('warnings.refresh', async (request) => {
  const denied = jobKeyProblem(request)
  if (denied) return Response.json({ error: denied.error }, { status: denied.status })
  const summary = await refreshAll({
    feeds: FEEDS,
    fetchFeed: slug => getJson(feedUrl(slug), { ms: 15000, cache: 'no-store' }),
    save: (country, rows, at) => saveCountry(supabase, country, rows, at),
  })
  if (summary.failed.length) await logError('warnings.upstream', new Error(`${summary.failed.length} feeds failed`), { failed: summary.failed })
  return Response.json(summary)
})
```

- [ ] **Step 8: Run tests and lint**

Run: `node --test lib/warnings/refresh.test.js && npx eslint lib/warnings app/api/warnings --max-warnings 0`
Expected: PASS (3 tests), no lint output.

- [ ] **Step 9: Commit**

```bash
git add supabase/warnings.sql supabase/cron.sql lib/warnings/store.js lib/warnings/refresh.js lib/warnings/refresh.test.js app/api/warnings/refresh/route.js
git commit -m "Warnings: table, 15-minute refresh job from the MeteoAlarm country feeds"
```

---

### Task 4: Texts and the lookup API

**Files:**
- Create: `lib/warnings/text.js`, `lib/warnings/text.test.js`, `app/api/warnings/route.js`
- Modify: `lib/i18n/{en,de,fr,es,it,nl,pl,cs,sl,pt,ja,zh,ko}.js` (an `// official warnings` block before the closing `}`)

**Interfaces:**
- Consumes: `regionsAt` (Task 1), `warningsIn` (Task 3), `pickLang` (`lib/share.js`), `dayWord` (`lib/outlook/text.js`), `t` (`lib/i18n.js`).
- Produces:
  - `WARNING_KEYS: string[]`, `levelWord(lang, level)`, `levelHint(lang, level)`, `levelIcons(level) → '⚠'|'⚠⚠'|'⚠⚠⚠'`, `typeWord(lang, type)`, `warningText(w, lang) → { event, headline, description, instruction }`, `warningSpan(lang, w, todayLocal) → string`, `sortWarnings(list) → list`, `stripWarning(list, now) → Warning|null`, `warningOnDay(list, date) → Warning|null`.
  - `GET /api/warnings?lat&lon&lang` → `{ covered: boolean, warnings: [{ id, level, type, onset, expires, sender, web, text }] }`.

- [ ] **Step 1: Write the failing tests** — `lib/warnings/text.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { t } from '../i18n.js'
import { WARNING_KEYS, levelWord, levelIcons, typeWord, warningText, warningSpan, sortWarnings, stripWarning, warningOnDay } from './text.js'
import { WARNING_TYPES } from './parse.js'

const w = (id, level, onset, expires, extra = {}) => ({ id, level, type: 'thunderstorm', onset, expires, texts: {}, ...extra })

test('every warning text exists in English (parity covers the other 12)', () => {
  for (const k of WARNING_KEYS) assert.notEqual(t('en', k), k, k)
  for (const type of WARNING_TYPES) assert.ok(WARNING_KEYS.includes(`warnType_${type}`), type)
})

test('levels — a word and an icon count, never colour alone', () => {
  assert.deepEqual([2, 3, 4].map(l => levelWord('en', l)), ['Yellow', 'Orange', 'Red'])
  assert.deepEqual([2, 3, 4].map(levelIcons), ['⚠', '⚠⚠', '⚠⚠⚠'])
  assert.equal(typeWord('en', 'snow_ice'), 'Snow and ice')
  assert.equal(typeWord('en', 'nonsense'), t('en', 'warnType_other'))
})

test('warningText — text falls back to English, then the first language', () => {
  const texts = { de: { headline: 'Gewitter' }, en: { headline: 'Thunderstorms' } }
  assert.equal(warningText({ texts }, 'de').headline, 'Gewitter')
  assert.equal(warningText({ texts }, 'ja').headline, 'Thunderstorms')
  assert.equal(warningText({ texts: { es: { headline: 'Tormentas' } } }, 'ja').headline, 'Tormentas')
  assert.deepEqual(warningText({ texts: {} }, 'en'), { event: '', headline: '', description: '', instruction: '' })
})

test('warningSpan — the issuer\'s own clock, with today / tomorrow / weekday', () => {
  assert.equal(warningSpan('en', w('a', 3, '2026-10-08T15:00:00+02:00', '2026-10-08T21:00:00+02:00'), '2026-10-08'), 'today 15:00–21:00')
  assert.equal(warningSpan('en', w('a', 3, '2026-10-08T22:00:00+02:00', '2026-10-09T06:00:00+02:00'), '2026-10-08'), 'today 22:00 – tomorrow 06:00')
})

test('sortWarnings / stripWarning — most serious first; the strip only for orange or red within 24 h', () => {
  const now = Date.parse('2026-10-08T08:00:00+02:00')
  const y = w('y', 2, '2026-10-08T09:00:00+02:00', '2026-10-08T20:00:00+02:00')
  const o = w('o', 3, '2026-10-08T15:00:00+02:00', '2026-10-08T21:00:00+02:00')
  const late = w('l', 4, '2026-10-10T12:00:00+02:00', '2026-10-10T20:00:00+02:00')
  assert.deepEqual(sortWarnings([y, late, o]).map(x => x.id), ['l', 'o', 'y'])
  assert.equal(stripWarning([y, o, late], now)?.id, 'o') // red starts in 52 h: not on the strip yet
  assert.equal(stripWarning([y], now), null)
})

test('warningOnDay — an orange or red warning touching that local day', () => {
  const o = w('o', 3, '2026-10-09T22:00:00+02:00', '2026-10-10T06:00:00+02:00')
  assert.equal(warningOnDay([o], '2026-10-10')?.id, 'o')
  assert.equal(warningOnDay([o], '2026-10-11'), null)
  assert.equal(warningOnDay([w('y', 2, '2026-10-10T08:00:00+02:00', '2026-10-10T12:00:00+02:00')], '2026-10-10'), null)
  assert.equal(warningOnDay(null, '2026-10-10'), null)
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test lib/warnings/text.test.js`
Expected: FAIL — `Cannot find module …/text.js`.

- [ ] **Step 3: Write `lib/warnings/text.js`**

```js
// What the app and its notifications say about an official warning (pure —
// unit tested). The official texts are the issuer's own; we only label the
// level and type, and say when, in the issuer's own clock.
import { t } from '../i18n.js'
import { dayWord } from '../outlook/text.js'
import { WARNING_TYPES } from './parse.js'

const LEVEL = { 2: 'warnYellow', 3: 'warnOrange', 4: 'warnRed' }
const HINT = { 2: 'warnYellowHint', 3: 'warnOrangeHint', 4: 'warnRedHint' }
export const WARNING_KEYS = [
  'warnTitle', 'warnMore', 'warnSource', 'warnAdvice', 'warnShow', ...Object.values(LEVEL), ...Object.values(HINT),
  ...WARNING_TYPES.map(type => `warnType_${type}`),
]

export const levelWord = (lang, level) => t(lang, LEVEL[level] ?? 'warnYellow')
export const levelHint = (lang, level) => t(lang, HINT[level] ?? 'warnYellowHint')
export const levelIcons = level => '⚠'.repeat(Math.max(1, Math.min(3, level - 1)))
export const typeWord = (lang, type) => t(lang, WARNING_TYPES.includes(type) ? `warnType_${type}` : 'warnType_other')

const EMPTY = { event: '', headline: '', description: '', instruction: '' }
export function warningText(w, lang) {
  const tx = w?.texts ?? {}
  return { ...EMPTY, ...(tx[lang] ?? tx.en ?? Object.values(tx)[0] ?? {}) }
}

// "today 15:00–21:00", "today 22:00 – tomorrow 06:00", "Saturday 06:00–14:00"
export function warningSpan(lang, w, todayLocal) {
  const [d1, t1] = [w.onset.slice(0, 10), w.onset.slice(11, 16)]
  const [d2, t2] = [w.expires.slice(0, 10), w.expires.slice(11, 16)]
  const day = d => dayWord(lang, d, todayLocal)
  return d1 === d2 ? `${day(d1)} ${t1}–${t2}` : `${day(d1)} ${t1} – ${day(d2)} ${t2}`
}

export const sortWarnings = list => [...(list ?? [])].sort((a, b) => b.level - a.level || Date.parse(a.onset) - Date.parse(b.onset))

// the strip: the most serious orange / red warning that is on, or starts within 24 h
export function stripWarning(list, now = Date.now()) {
  return sortWarnings(list).find(w => w.level >= 3 && Date.parse(w.expires) > now && Date.parse(w.onset) - now <= 24 * 3600e3) ?? null
}

// a planned hike's day: the most serious orange / red warning touching that local date
export function warningOnDay(list, date) {
  return sortWarnings(list).find(w => w.level >= 3 && w.onset.slice(0, 10) <= date && w.expires.slice(0, 10) >= date) ?? null
}
```

- [ ] **Step 4: Add the texts to all 13 languages** — before the closing `}` of each `lib/i18n/<code>.js` (detect `\r\n` like the earlier scripts did; write the insertion script with the Write tool). English:

```js
  // official warnings
  warnTitle: 'Official warnings',
  warnMore: '+{n} more',
  warnSource: '{sender} · via MeteoAlarm',
  warnAdvice: 'What to do',
  warnShow: 'Show the full warning',
  warnYellow: 'Yellow', warnOrange: 'Orange', warnRed: 'Red',
  warnYellowHint: 'Be aware', warnOrangeHint: 'Be prepared', warnRedHint: 'Take action',
  warnType_wind: 'Wind', warnType_snow_ice: 'Snow and ice', warnType_thunderstorm: 'Thunderstorms',
  warnType_fog: 'Fog', warnType_heat: 'Heat', warnType_cold: 'Cold', warnType_coastal: 'Coastal event',
  warnType_forest_fire: 'Forest fire danger', warnType_avalanche: 'Avalanches', warnType_rain: 'Rain',
  warnType_flood: 'Flooding', warnType_rain_flood: 'Rain and flooding', warnType_other: 'Weather warning',
```

German (the pattern for the other 11 — translate naturally, keep `{n}` and `{sender}`; the colour words are the national services' own terms):

```js
  // official warnings
  warnTitle: 'Amtliche Warnungen',
  warnMore: '+{n} weitere',
  warnSource: '{sender} · über MeteoAlarm',
  warnAdvice: 'Was tun',
  warnShow: 'Ganze Warnung anzeigen',
  warnYellow: 'Gelb', warnOrange: 'Orange', warnRed: 'Rot',
  warnYellowHint: 'Aufmerksam sein', warnOrangeHint: 'Vorbereitet sein', warnRedHint: 'Handeln',
  warnType_wind: 'Wind', warnType_snow_ice: 'Schnee und Glätte', warnType_thunderstorm: 'Gewitter',
  warnType_fog: 'Nebel', warnType_heat: 'Hitze', warnType_cold: 'Kälte', warnType_coastal: 'Küstenereignis',
  warnType_forest_fire: 'Waldbrandgefahr', warnType_avalanche: 'Lawinen', warnType_rain: 'Regen',
  warnType_flood: 'Hochwasser', warnType_rain_flood: 'Regen und Hochwasser', warnType_other: 'Wetterwarnung',
```

- [ ] **Step 5: Write `app/api/warnings/route.js`**

```js
import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { supabase } from '@/lib/supabase'
import { pickLang } from '@/lib/share'
import regionData from '@/lib/warnings/regions.json'
import { regionsAt } from '@/lib/warnings/regions'
import { warningsIn } from '@/lib/warnings/store'
import { sortWarnings, warningText } from '@/lib/warnings/text'

// GET /api/warnings?lat=48.21&lon=16.37&lang=de → the official warnings at
// that point, most serious first. covered: false outside MeteoAlarm's
// regions (the page then shows nothing). CDN-cached 5 minutes per URL —
// the page rounds the position to ~1 km.
const limiter = createRateLimiter({ max: 60, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const GET = withErrorLog('warnings', async (request) => {
  const sp = new URL(request.url).searchParams
  const num = k => (sp.get(k) ? Number(sp.get(k)) : Number.NaN)
  const lat = num('lat'), lon = num('lon')
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return noStore({ error: 'Needs lat and lon.' }, 400)
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)
  const lang = pickLang(sp.get('lang'))
  const ids = regionsAt(regionData, lat, lon)
  const rows = ids.length ? await warningsIn(supabase, ids) : []
  const warnings = sortWarnings(rows).map(w => ({
    id: w.id, level: w.level, type: w.type, onset: w.onset, expires: w.expires,
    sender: w.sender, web: w.web, text: warningText(w, lang),
  }))
  return Response.json({ covered: ids.length > 0, warnings }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' } })
})
```

- [ ] **Step 6: Run tests and lint**

Run: `node --test lib/warnings/text.test.js lib/i18n/parity.test.js && npx eslint lib app/api/warnings --max-warnings 0`
Expected: PASS; no lint output.

- [ ] **Step 7: Commit**

```bash
git add lib/warnings/text.js lib/warnings/text.test.js app/api/warnings/route.js lib/i18n
git commit -m "Warnings: texts in 13 languages and the /api/warnings lookup"
```

---

### Task 5: On the screen — strip and card

**Files:**
- Create: `lib/warnings/useWarnings.js`, `app/components/outlook/WarningStrip.jsx`, `app/components/outlook/WarningsCard.jsx`, `lib/warnings/__fixtures__/api-vienna.json`
- Modify: `app/page.js:903` (strip above `<NowLine>`), `app/components/outlook/TabToday.jsx` (card after `<Headline>`), `app/components/hike/PeakView.jsx` (card after the window `<Headline>`), `scripts/a11y-check.mjs` (a page with mocked warnings)

**Interfaces:**
- Consumes: `/api/warnings` (Task 4); `levelWord`, `levelHint`, `levelIcons`, `typeWord`, `warningSpan`, `stripWarning` (Task 4); `t` (`lib/i18n`).
- Produces: `useWarnings(lat, lon, lang) → { covered, warnings } | null`; `<WarningStrip lat lon lang todayLocal onOpen />`; `<WarningsCard lat lon lang todayLocal />` rendered with `id="warnings"`.

- [ ] **Step 1: Write `lib/warnings/useWarnings.js`**

```js
'use client'

import { useEffect, useState } from 'react'

// The warnings at a spot, for the strip and the card at once (one fetch per
// ~1 km cell and language, shared, refreshed every 10 minutes).
const cache = new Map() // key → { at, data, req }
const round = v => Math.round(v * 100) / 100

export function useWarnings(lat, lon, lang) {
  const key = Number.isFinite(lat) && Number.isFinite(lon) ? `${round(lat)},${round(lon)},${lang}` : null
  const [data, setData] = useState(() => (key ? cache.get(key)?.data ?? null : null))
  useEffect(() => {
    if (!key) return
    let off = false
    const load = () => {
      const hit = cache.get(key)
      if (hit?.data && Date.now() - hit.at < 10 * 60e3) { setData(hit.data); return }
      const [la, lo, lg] = key.split(',')
      const req = hit?.req ?? fetch(`/api/warnings?lat=${la}&lon=${lo}&lang=${lg}`).then(r => (r.ok ? r.json() : null), () => null)
      cache.set(key, { ...hit, req })
      req.then(d => { cache.set(key, { at: Date.now(), data: d, req: null }); if (!off) setData(d) })
    }
    load()
    const id = setInterval(load, 10 * 60e3)
    return () => { off = true; clearInterval(id) }
  }, [key])
  return data
}
```

- [ ] **Step 2: Write `app/components/outlook/WarningStrip.jsx`**

```jsx
'use client'

import { TriangleAlert } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fill } from '@/lib/outlook/text'
import { useWarnings } from '@/lib/warnings/useWarnings'
import { levelWord, levelIcons, typeWord, warningSpan, stripWarning } from '@/lib/warnings/text'

const TONE = { 3: 'var(--hot)', 4: 'var(--bad)' }

// Orange and red only, on every forecast tab, above the temperature: one line
// that opens the "Official warnings" card (option C of the spec).
export default function WarningStrip({ lat, lon, lang, todayLocal, onOpen }) {
  const data = useWarnings(lat, lon, lang)
  const w = stripWarning(data?.warnings, Date.now())
  if (!w) return null
  const more = (data.warnings?.length ?? 1) - 1
  return (
    <button onClick={onOpen}
      className="press w-full text-left mb-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm bg-zinc-900"
      style={{ borderColor: TONE[w.level], borderLeftWidth: 4 }}>
      <TriangleAlert size={16} style={{ color: TONE[w.level] }} className="shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="font-semibold" style={{ color: TONE[w.level] }}>{levelWord(lang, w.level)} <span aria-hidden>{levelIcons(w.level)}</span></span>
        {' · '}<span className="font-medium">{typeWord(lang, w.type)}</span>
        {' · '}<span className="text-zinc-400">{warningSpan(lang, w, todayLocal)}</span>
        {more > 0 && <span className="text-zinc-500"> · {fill(t(lang, 'warnMore'), { n: more })}</span>}
      </span>
    </button>
  )
}
```

- [ ] **Step 3: Write `app/components/outlook/WarningsCard.jsx`**

```jsx
'use client'

import { useState } from 'react'
import { TriangleAlert, ChevronDown } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fill } from '@/lib/outlook/text'
import { useWarnings } from '@/lib/warnings/useWarnings'
import { levelWord, levelHint, levelIcons, typeWord, warningSpan } from '@/lib/warnings/text'
import { SectionTitle } from '../ui'

const TONE = { 2: 'var(--warn)', 3: 'var(--hot)', 4: 'var(--bad)' }

// Every official warning for the spot, now and upcoming: level (word + ⚠
// count), type and time; a row opens the issuer's own text and advice.
export default function WarningsCard({ lat, lon, lang, todayLocal }) {
  const data = useWarnings(lat, lon, lang)
  const [open, setOpen] = useState(null)
  const list = data?.warnings ?? []
  if (!list.length) return null
  return (
    <section id="warnings" className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-1 scroll-mt-4" aria-label={t(lang, 'warnTitle')}>
      <SectionTitle icon={TriangleAlert}>{t(lang, 'warnTitle')}</SectionTitle>
      {list.map(w => (
        <div key={w.id} className="border-t border-zinc-800 first-of-type:border-0">
          <button onClick={() => setOpen(open === w.id ? null : w.id)} aria-expanded={open === w.id}
            className="w-full flex items-start gap-3 py-2.5 text-left text-sm" title={t(lang, 'warnShow')}>
            <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold" style={{ color: TONE[w.level], borderColor: TONE[w.level] }}>
              {levelWord(lang, w.level)} <span aria-hidden>{levelIcons(w.level)}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{typeWord(lang, w.type)}</span>
              <span className="block text-zinc-400 text-xs">{warningSpan(lang, w, todayLocal)} · {levelHint(lang, w.level)}</span>
            </span>
            <ChevronDown size={16} className={`shrink-0 text-zinc-500 transition-transform ${open === w.id ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {open === w.id && (
            <div className="pb-3 space-y-2 text-sm">
              {w.text.headline && <p className="font-medium">{w.text.headline}</p>}
              {w.text.description && <p className="text-zinc-300 whitespace-pre-line">{w.text.description}</p>}
              {w.text.instruction && (<><p className="text-xs text-zinc-500">{t(lang, 'warnAdvice')}</p><p className="text-zinc-300 whitespace-pre-line">{w.text.instruction}</p></>)}
              <p className="text-xs text-zinc-500">
                {w.web ? <a href={w.web} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 underline">{fill(t(lang, 'warnSource'), { sender: w.sender })}</a> : fill(t(lang, 'warnSource'), { sender: w.sender })}
              </p>
            </div>
          )}
        </div>
      ))}
    </section>
  )
}
```

- [ ] **Step 4: Place them**
  - `app/page.js`, directly above `<NowLine data={data} …` (line ~903), import `WarningStrip` and add:

```jsx
{outlook && <WarningStrip lat={data.lat} lon={data.lon} lang={lang} todayLocal={outlook.nowLocal.slice(0, 10)}
  onOpen={() => { setTab('today'); requestAnimationFrame(() => document.getElementById('warnings')?.scrollIntoView({ block: 'start' })) }} />}
```
  - `app/components/outlook/TabToday.jsx`, after the `<Headline … />` line, import `WarningsCard` and add:

```jsx
{now?.lat != null && now?.lon != null && <WarningsCard lat={now.lat} lon={now.lon} lang={lang} todayLocal={todayLocal} />}
```
  - `app/components/hike/PeakView.jsx`, after the window `<Headline … />` (line ~92), import `WarningsCard` and add:

```jsx
<WarningsCard lat={peak.lat} lon={peak.lon} lang={lang} todayLocal={todayLocal} />
```

- [ ] **Step 5: A fixture and an a11y page with mocked warnings** — save `lib/warnings/__fixtures__/api-vienna.json`:

```json
{ "covered": true, "warnings": [
  { "id": "demo-o", "level": 3, "type": "thunderstorm", "onset": "2030-01-01T15:00:00+01:00", "expires": "2030-01-01T21:00:00+01:00", "sender": "GeoSphere Austria", "web": "https://warnungen.zamg.at",
    "text": { "event": "Gewitter", "headline": "Orange warning: thunderstorms", "description": "Thunderstorms with heavy rain and hail are likely.", "instruction": "Stay away from trees and open ground." } },
  { "id": "demo-y", "level": 2, "type": "wind", "onset": "2030-01-02T06:00:00+01:00", "expires": "2030-01-02T14:00:00+01:00", "sender": "GeoSphere Austria", "web": null,
    "text": { "event": "Wind", "headline": "Yellow warning: wind", "description": "Gusts around 70 km/h.", "instruction": "" } }
] }
```
  In `scripts/a11y-check.mjs` add a `['/?city=Vienna', null, 'warnings']` entry to `PAGES` and, for entries whose third element is `'warnings'`, before navigating:

```js
await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/warnings*' }] })
// (once, next to the other listeners) answer /api/warnings from the fixture
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data)
  if (m.method !== 'Fetch.requestPaused') return
  // the fixture is dated 2030-01-01/02: move it to today and tomorrow (Vienna) so the strip shows too
  const day = k => new Date(Date.now() + 2 * 3600e3 + k * 86400e3).toISOString().slice(0, 10)
  const json = readFileSync(new URL('../lib/warnings/__fixtures__/api-vienna.json', import.meta.url), 'utf8')
    .replaceAll('2030-01-01', day(0)).replaceAll('2030-01-02', day(1)).replaceAll('T15:00:00', 'T00:00:00')
  send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(json).toString('base64') })
})
```
  and `await send('Fetch.disable')` after that page. (Onset moved to 00:00 today, so the orange warning is on now and the strip shows.)

- [ ] **Step 6: Verify** — `npm test`, `npx eslint app lib scripts --max-warnings 0`, `npx next build`, `npx next start -p 3123`, then `A11Y_ONLY=dark/day,light/day,large npm run a11y` → exit 0. Screenshot `/?city=Vienna` at 390 px with the mock (strip, card closed and open) and a peak page; read them.

- [ ] **Step 7: Commit**

```bash
git add lib/warnings/useWarnings.js app/components/outlook/WarningStrip.jsx app/components/outlook/WarningsCard.jsx app/page.js app/components/outlook/TabToday.jsx app/components/hike/PeakView.jsx scripts/a11y-check.mjs lib/warnings/__fixtures__/api-vienna.json
git commit -m "Warnings: strip above the forecast and the Official warnings card (forecast and peak pages)"
```

---

### Task 6: Alerts

**Files:**
- Modify: `lib/push/rules.js` (cityEvents, decide), `lib/push/dispatch.js` (warningsAt, quick run, hike line), `lib/push/text.js` (warning message, hike line), `app/api/push/dispatch/route.js` (wire `warningsAt`), `lib/i18n/*.js` (push texts, 13 languages)
- Test: `lib/push/rules.test.js`, `lib/push/dispatch.test.js`, `lib/push/text.test.js`

**Interfaces:**
- Consumes: `regionsAt` (Task 1), `warningsIn` (Task 3), `levelWord`, `typeWord`, `warningSpan`, `warningOnDay` (Task 4).
- Produces: `cityEvents(outlook, now, nowcast = null, warnings = null)` — `warnings` is `null` when the city is outside coverage, else the list (possibly empty); `ev.official`, `ev.warnings`; message `{ kind: 'warning', ref: '<id>@<level>', vars: { city, level, type, onset, expires, todayLocal } }`; `runDispatch({ …, warningsAt })` where `warningsAt(lat, lon) → Promise<Warning[] | null>`; hike messages get `vars.warning = { level, type } | null`.

- [ ] **Step 1: Write the failing rule tests** — append to `lib/push/rules.test.js`. The file already defines `VIE`, `at(hhmm, date, off)` (local Vienna time → ms), `outlook({ start, hours })` and `ALL` (every switch on); use them, don't redeclare them:

```js
const sev = { id: 'd', ...ALL, alert_rain: false, alert_storm: false, alert_heat: false }
const warn = (id, level, onset, expires) => ({ id, level, type: 'thunderstorm', onset, expires })
const calm = start => outlook({ start, hours: [{}, {}, {}] })

test('warnings — orange and red become alerts, once per warning, again on an upgrade', () => {
  const now = at('10:00', '2026-10-08')
  const o = warn('w1', 3, '2026-10-08T15:00:00+02:00', '2026-10-08T21:00:00+02:00')
  const y = warn('w2', 2, '2026-10-08T12:00:00+02:00', '2026-10-08T18:00:00+02:00')
  const ev = cityEvents(calm('2026-10-08T10:00'), now, null, [o, y])
  assert.deepEqual(decide(sev, ev, []).map(m => [m.kind, m.ref]), [['warning', 'w1@3']])
  assert.deepEqual(decide(sev, ev, [{ kind: 'warning', ref: 'w1@3', sent_at: now - 60e3 }]), [])
  const up = cityEvents(calm('2026-10-08T10:00'), now, null, [{ ...o, level: 4 }])
  assert.deepEqual(decide(sev, up, [{ kind: 'warning', ref: 'w1@3', sent_at: now - 60e3 }]).map(m => m.ref), ['w1@4'])
  const down = cityEvents(calm('2026-10-08T10:00'), now, null, [o])
  assert.deepEqual(decide(sev, down, [{ kind: 'warning', ref: 'w1@4', sent_at: now - 60e3 }]), [])
})

test('warnings — quiet hours: orange waits, red goes, expired never', () => {
  const night = at('02:00', '2026-10-08')
  const o = warn('o', 3, '2026-10-08T03:00:00+02:00', '2026-10-08T09:00:00+02:00')
  const r = warn('r', 4, '2026-10-08T03:00:00+02:00', '2026-10-08T09:00:00+02:00')
  assert.deepEqual(decide(sev, cityEvents(calm('2026-10-08T02:00'), night, null, [o, r]), []).map(m => m.ref), ['r@4'])
  const morning = at('07:05', '2026-10-08')
  assert.deepEqual(decide(sev, cityEvents(calm('2026-10-08T07:00'), morning, null, [o]), []).map(m => m.ref), ['o@3'])
  const short = warn('s', 3, '2026-10-08T03:00:00+02:00', '2026-10-08T06:00:00+02:00')
  assert.deepEqual(decide(sev, cityEvents(calm('2026-10-08T07:00'), morning, null, [short]), []), [])
})

test('warnings — a red one is never held back by the daily cap', () => {
  const now = at('12:00', '2026-10-08')
  const log = [1, 2, 3].map(i => ({ kind: 'rain', ref: `x${i}`, sent_at: now - i * 60e3 }))
  const ev = cityEvents(calm('2026-10-08T12:00'), now, null, [warn('r', 4, '2026-10-08T13:00:00+02:00', '2026-10-08T18:00:00+02:00')])
  assert.deepEqual(decide(sev, ev, log).map(m => m.ref), ['r@4'])
})

test('warnings — only for warnings starting within 12 h; switch off → nothing', () => {
  const now = at('10:00', '2026-10-08')
  const later = warn('l', 3, '2026-10-09T08:00:00+02:00', '2026-10-09T12:00:00+02:00')
  assert.deepEqual(decide(sev, cityEvents(calm('2026-10-08T10:00'), now, null, [later]), []), [])
  const soon = warn('n', 3, '2026-10-08T12:00:00+02:00', '2026-10-08T16:00:00+02:00')
  assert.deepEqual(decide({ ...sev, alert_severe: false }, cityEvents(calm('2026-10-08T10:00'), now, null, [soon]), []), [])
})

test('warnings — they replace the model-based severe alerts only where MeteoAlarm covers the city', () => {
  const now = at('10:05', '2026-10-08')
  const snowy = outlook({ start: '2026-10-08T10:00', hours: [{}, {}, {}, { code: 75 }] }) // heavy snow at 13:00
  assert.ok(cityEvents(snowy, now, null, null).severe.length > 0) // not covered: model-based stays
  assert.equal(cityEvents(snowy, now, null, []).severe.length, 0) // covered, nothing official: no model-based guess
  assert.equal(cityEvents(snowy, now, null, []).official, true)
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test lib/push/rules.test.js`
Expected: FAIL — no `warning` messages produced (`[]` vs `[['warning','w1@3']]`).

- [ ] **Step 3: Change `lib/push/rules.js`**
  - In `RULES` add `warnLeadH: 12`.
  - `const PRIORITY = { warning: -1, severe: 0, storm: 1, rain: 2, heat: 3 }` and `const WEATHER = new Set(['rain', 'storm', 'severe', 'heat', 'warning'])`.
  - `export function cityEvents(outlook, now, nowcast = null, warnings = null)`; just before `return ev`:

```js
  // official warnings (MeteoAlarm): null = the city is outside coverage. Where
  // covered they replace the model-based severe guesses, even when silent.
  ev.official = Array.isArray(warnings)
  ev.warnings = (warnings ?? [])
    .filter(w => w.level >= 3 && Date.parse(w.expires) > now && Date.parse(w.onset) - now <= RULES.warnLeadH * 3600e3)
    .sort((a, b) => b.level - a.level)
  if (ev.official) ev.severe = []
```
  - In `decide`, inside `if (device.alert_severe) {`, before the existing `for (const s of ev.severe)` loop:

```js
    for (const w of ev.warnings) {
      if (quiet && w.level < 4) continue // orange waits for the morning; red never does
      const sentLevel = e => Number(e.ref.slice(e.ref.lastIndexOf('@') + 1))
      if (seen('warning', e => e.ref.startsWith(`${w.id}@`) && sentLevel(e) >= w.level)) continue
      want.push({ kind: 'warning', ref: `${w.id}@${w.level}`, vars: { city: ev.city, level: w.level, type: w.type, onset: w.onset, expires: w.expires, todayLocal: local.date } })
    }
```
  - Replace `const out = want.slice(0, Math.max(0, RULES.cap - usedToday))` with:

```js
  // a red warning always goes; everything else shares the daily cap
  const isRed = m => m.kind === 'warning' && m.vars.level === 4
  const out = [...want.filter(isRed), ...want.filter(m => !isRed(m)).slice(0, Math.max(0, RULES.cap - usedToday))]
```

- [ ] **Step 4: Run the rule tests**

Run: `node --test lib/push/rules.test.js`
Expected: PASS (existing + 5 new).

- [ ] **Step 5: Write the failing dispatch and text tests**
  - Append to `lib/push/dispatch.test.js`. It already defines `at(hhmm, date)`, `rainy` (an outlook), `dev(id, over)` and `fakeStore({ devices, plans, log })`; the sender is an inline `{ send }` object:

```js
test('dispatch — the quarter-hourly run also sends official warnings for the home city', async () => {
  const now = at('10:00', '2026-10-08')
  const calls = []
  const r = await runDispatch({
    store: fakeStore({ devices: [dev('a', { lang: 'en', alert_rain: false, alert_severe: true })] }),
    getJson: async url => (url.includes('/api/outlook') ? { ...rainy, lat: 48.21, lon: 16.37, nowLocal: '2026-10-08T10:00', hourly: [] } : null),
    warningsAt: async (lat, lon) => { calls.push([lat, lon]); return [{ id: 'w', level: 3, type: 'wind', onset: '2026-10-08T12:00:00+02:00', expires: '2026-10-08T18:00:00+02:00' }] },
    sender: { send: async () => ({ ok: true }) }, now, dry: true, only: 'rain',
  })
  assert.deepEqual(calls, [[48.21, 16.37]])
  assert.deepEqual(r.messages.map(m => [m.kind, m.ref]), [['warning', 'w@3']])
})

test('dispatch — a city outside MeteoAlarm (warningsAt → null) keeps the model-based alerts', async () => {
  const r = await runDispatch({
    store: fakeStore({ devices: [dev('a', { lang: 'en' })] }), getJson: async () => rainy,
    warningsAt: async () => null, sender: { send: async () => ({ ok: true }) }, now: NOW, dry: true,
  })
  assert.ok(r.messages.some(m => m.kind === 'rain'))
})
```
  - Append to `lib/push/text.test.js`:

```js
test('pushText — an official warning: level and city in the title, type and time in the body', () => {
  const m = pushText('en', 'C', { kind: 'warning', vars: { city: 'Vienna', level: 3, type: 'thunderstorm', onset: '2026-10-08T15:00:00+02:00', expires: '2026-10-08T21:00:00+02:00', todayLocal: '2026-10-08' } })
  assert.equal(m.title, '⚠️ Orange warning in Vienna')
  assert.equal(m.body, 'Thunderstorms, today 15:00–21:00')
})

test('pushText — a hike alert names an orange or red warning for the day', () => {
  const m = pushText('en', 'C', { kind: 'hike_morning', vars: { peak: 'Schneeberg', window: null, date: '2026-10-08', todayLocal: '2026-10-08', warning: { level: 3, type: 'thunderstorm' } } })
  assert.match(m.body, /Orange warning: Thunderstorms/)
})
```
- [ ] **Step 6: Run to verify they fail**

Run: `node --test lib/push/dispatch.test.js lib/push/text.test.js`
Expected: FAIL — `warningsAt` never called / `pushText` returns `null` for `warning`.

- [ ] **Step 7: Change `lib/push/dispatch.js`**
  - Signature: add `warningsAt = null` to the destructured options.
  - Under the header comment add: `// only: 'rain' is the quarter-hourly run: rain and official-warning alerts, no plans`, and `const QUICK = new Set(['rain', 'warning'])`.
  - Group filter: `const on = only === 'rain' ? (d.alert_rain || d.alert_severe) : (d.alert_rain || d.alert_storm || d.alert_severe || d.alert_heat || d.briefing)`.
  - After the nowcast fetch:

```js
    const wantsWarnings = !!warningsAt && ds.some(d => d.alert_severe) && outlook.lat != null && outlook.lon != null
    const warnings = wantsWarnings ? await warningsAt(outlook.lat, outlook.lon).catch(() => null) : null
    const ev = cityEvents(outlook, now, nowcast, warnings)
```
    (replacing `const ev = cityEvents(outlook, now, nowcast)`), and the outbox filter becomes `if (!only || QUICK.has(msg.kind)) outbox.push({ device: d, msg, url })`.
  - Peak plans: inside `for (const [path, ps] of peaks)`, after `const hike = await getJson(...)`:

```js
    const dayWarnings = warningsAt ? await warningsAt(ps[0].lat, ps[0].lon).catch(() => null) : null
```
    and in the `msg` vars add `warning: pickWarning(dayWarnings, p.date)`.
  - Route plans: before `const msg = …` add `const dayWarnings = warningsAt ? await warningsAt(p.route.points[0][0], p.route.points[0][1]).catch(() => null) : null` and add `warning: pickWarning(dayWarnings, p.date)` to its vars.
  - At the top: `import { warningOnDay } from '../warnings/text.js'` and `const pickWarning = (list, date) => { const w = warningOnDay(list, date); return w ? { level: w.level, type: w.type } : null }`.

- [ ] **Step 8: Change `lib/push/text.js`**
  - Import: `import { levelWord, typeWord, warningSpan } from '../warnings/text.js'`.
  - New case before `case 'test':`

```js
    case 'warning':
      return {
        title: tr('pushWarnTitle', { level: levelWord(lang, v.level), city: v.city }),
        body: `${typeWord(lang, v.type)}, ${warningSpan(lang, v, v.todayLocal)}`,
      }
```
  - In both hike cases, append the warning line to the body parts: for `hike_evening`/`hike_morning` use `body: [w.title, w.sub, warnLine(v)].filter(Boolean).join(' · ')`; for the route cases `body: [body, warnLine(v)].filter(Boolean).join(' · ')` (rename the local `body` constant there to `text` and return `body: [text, warnLine(v)]…`). Define inside `pushText` after `const v = …`:

```js
  const warnLine = x => (x.warning ? tr('pushWarnLine', { level: levelWord(lang, x.warning.level), type: typeWord(lang, x.warning.type) }) : null)
```
  - `windowText` with `window: null` returns `{ title: <no daylight>, sub: null }` (`lib/hike/text.js:14`), so the hike test's body is "<no daylight> · ⚠️ Orange warning: Thunderstorms".

- [ ] **Step 9: Push texts in 13 languages** (with the Task 4 insertion approach). English and German:

```js
  pushWarnTitle: '⚠️ {level} warning in {city}',
  pushWarnLine: '⚠️ {level} warning: {type}',
```
```js
  pushWarnTitle: '⚠️ Warnstufe {level} für {city}',
  pushWarnLine: '⚠️ Warnstufe {level}: {type}',
```

- [ ] **Step 10: Wire `app/api/push/dispatch/route.js`**

```js
import { supabase } from '@/lib/supabase'
import regionData from '@/lib/warnings/regions.json'
import { regionsAt } from '@/lib/warnings/regions'
import { warningsIn } from '@/lib/warnings/store'

// official warnings at a spot; null outside MeteoAlarm's regions (model-based alerts then)
const warningsAt = async (lat, lon) => {
  const ids = regionsAt(regionData, lat, lon)
  return ids.length ? warningsIn(supabase, ids) : null
}
```
  and pass `warningsAt` into the `runDispatch({ … })` call.

- [ ] **Step 11: Run everything**

Run: `npm test && npx eslint app lib --max-warnings 0`
Expected: all tests pass (incl. parity), no lint output.

- [ ] **Step 12: Commit**

```bash
git add lib/push app/api/push/dispatch/route.js lib/i18n
git commit -m "Warnings: orange and red official warnings through the Severe weather alerts (quick run, hike days)"
```

---

### Task 7: Credits, database, ship

**Files:**
- Modify: `app/terms/content.jsx` (credit), `CHANGELOG.md`, `mobile/README.md` (nothing to build — note only if useful)

- [ ] **Step 1: Credit MeteoAlarm** — in `app/terms/content.jsx`, after the Open-Meteo `<li>` add:

```jsx
      <li><a href="https://meteoalarm.org" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400">MeteoAlarm</a> (EUMETNET, CC BY 4.0) — official weather warnings of Europe&apos;s national weather services</li>
```

- [ ] **Step 2: Database** — apply `supabase/warnings.sql` and the new `warnings-refresh` block of `supabase/cron.sql` (Supabase connector: `apply_migration` named `warnings_table`, then `execute_sql` for the cron block; without the connector, the owner pastes both into the SQL editor). Then trigger one refresh: GET `https://metablend.app/api/warnings/refresh` with the `x-calibrate-key` header (key read from `.env.local` in a script, printing only the status and summary). Expected after deploy: `200 { countries: 35, warnings: N, failed: [] }` (a few `failed` are tolerable — check `error_log` `warnings.upstream`).

- [ ] **Step 3: CHANGELOG** — under the newest date:

```markdown
### Added — official weather warnings (Europe)
- The national weather services' warnings via MeteoAlarm in 35 countries: an
  "Official warnings" card on the forecast and peak pages (yellow, orange, red —
  each as a word and ⚠ count — with the issuer's own text and advice), and a
  slim strip at the top of the forecast for orange and red.
- "Severe weather" alerts send official orange and red warnings for your home
  city (red at any hour, orange after 7:00) and name them in planned-hike
  alerts; outside MeteoAlarm's countries the model-based alerts stay.
```

- [ ] **Step 4: Verify and push** — `npm test`, `npx next build`, `npm run a11y` (full, ~25 min; or `A11Y_ONLY=dark/day,light/day,large`), then `git add app/terms/content.jsx CHANGELOG.md && git commit -m "Warnings: MeteoAlarm credit; changelog"` and `git push origin main`. After the deploy: `/api/warnings?lat=…&lon=…` for a place with a current warning (pick one from the table) returns it; the forecast page there shows the card.
