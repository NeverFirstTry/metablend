# Hiking Engine (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Summit forecasts and worldwide peak search as two JSON APIs (`/api/hike`, `/api/peaks`) plus a featured Alps peak list — the engine the app-exclusive hiking UI (phase 2) is built on.

**Architecture:** Pure, unit-tested modules under `lib/hike/` (parse → physics → blend → window → build; params; search), two thin Next.js route handlers that fetch upstream data and hand it to the pure builders, and two scripts (fixture recording, featured-list building). Reuses the outlook's model list, blend helpers, daylight rule, learned weights, HTTP helper and caching pattern.

**Tech Stack:** Next.js 16 App Router route handlers (plain JS), ESM `lib/` (relative imports with `.js`), `node --test` via `npm test`, Open-Meteo forecast / elevation / geocoding APIs, Photon (OpenStreetMap) search API, Supabase (read-only here, via existing `loadOutlookWeights`).

**Spec:** `docs/superpowers/specs/2026-09-30-hiking-app-design.md` (phase 1 = §3; error handling §7; testing §8).

## Global Constraints

- `lib/` is ESM: relative imports end in `.js`; app code imports via `@/lib/...`.
- No new npm dependencies in this phase.
- Pure modules never touch the network; route handlers fetch, builders compute.
- `/api/hike`: CDN `Cache-Control: public, s-maxage=1800, stale-while-revalidate=3600`; errors `no-store`; rate limit 40/min per IP.
- `/api/peaks`: CDN `s-maxage=86400, stale-while-revalidate=604800`; errors `no-store`; rate limit 60/min per IP; Photon `limit=15` (fair use: "please be fair — extensive usage will be throttled").
- Summit window limits (spec §3.2): daylight, rain < 30 %, storm risk low, summit wind < 40 km/h, apparent temperature > −20 °C.
- Storm thresholds (spec §3.2): high = CAPE ≥ 1000 J/kg and rain ≥ 30 %, or lightning potential ≥ 1; moderate = CAPE ≥ 300 and rain ≥ 20 %; else low; null when no model reports CAPE or lightning.
- Summit wind levels: 850 hPa ≈ 1500 m, 700 hPa ≈ 3000 m, 600 hPa ≈ 4200 m; below 1500 m the 10 m wind.
- Weights: the region's learned outlook weights (`h48` / `d7`) — summits have no observations of their own.
- OpenStreetMap data (Photon) needs "© OpenStreetMap contributors" attribution in the UI (phase 2 — noted, not built here).
- Windows quirks: run tests with `npm test`; commit messages with double quotes via `git commit -F <file>`.
- Commit and push straight to `main` after each task.

## Review Focus

- Junk query values (`elev=abc`, `lat=47,07`, missing `lon`, `elev=-5`) → HTTP 400, never a 500 or a NaN forecast. Pinned in Task 6 (`parsePeakQuery` tests).
- Peaks below 1500 m or above 4200 m (e.g. 800 m hill, Mont Blanc 4806 m) → summit wind still sensible (10 m wind / 600 hPa). Pinned in Task 3.
- Searches with umlauts, ß or English spellings ("glockner", "Raxalpe", "Oetscher") find the featured peak. Pinned in Task 7.
- Elevation service down → Photon hits without a height are dropped, featured matches still returned with 200. Pinned in Task 7 (`mergePeaks` with `null` heights).
- After dark, today's window is `null` (no daylight left), not a "window" at night. Pinned in Task 5.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `lib/outlook/blend.js` (modify) | export `weightFn` for reuse |
| `lib/outlook/headlines.js` (modify) | extract + export `inDaylight(hhmm, sun)`; `bestTimeOutside` uses it |
| `scripts/record-hike-fixtures.mjs` (new) | records real upstream responses into `lib/hike/__fixtures__/` |
| `lib/hike/parse.js` (new) | `SUMMIT_HOURLY`, `parseSummitMulti` — raw multi-model JSON → per-model series |
| `lib/hike/physics.js` (new) | `summitWind`, `freezingLevel`, `stormRisk`, `STORM` |
| `lib/hike/blend.js` (new) | `blendSummitHourly`, `summitDays` |
| `lib/hike/window.js` (new) | `LIMITS`, `blocker`, `summitWindow` |
| `lib/hike/params.js` (new) | `parsePeakQuery`, `parseSearchQuery` |
| `lib/hike/build.js` (new) | `buildHike` — the `/api/hike` payload |
| `lib/hike/sources.js` (new) | upstream fetchers (summit, Photon, elevation, geocoding) |
| `app/api/hike/route.js` (new) | summit forecast endpoint |
| `lib/hike/search.js` (new) | `normalize`, `matchFeatured`, `parsePhoton`, `parseGeocodingPeaks`, `mergePeaks` |
| `scripts/build-featured-peaks.mjs` (new) | builds `lib/hike/featured.json` |
| `lib/hike/featured.json` (generated) | ~43 featured Alps peaks and huts |
| `app/api/peaks/route.js` (new) | peak search endpoint |
| `README.md`, `CHANGELOG.md` (modify) | document the engine |

---

### Task 1: Shared helpers from the outlook

**Files:**
- Modify: `lib/outlook/blend.js` (the `function weightFn(weights)` line)
- Modify: `lib/outlook/headlines.js` (`minutes` helper + `bestTimeOutside`)
- Test: `lib/outlook/blend.test.js`, `lib/outlook/headlines.test.js`

**Interfaces:**
- Produces: `weightFn(weights) → (id) => number` from `lib/outlook/blend.js`; `inDaylight(hhmm: 'HH:MM', sun: {sunrise, sunset}|null) → boolean` from `lib/outlook/headlines.js`.

- [ ] **Step 1: Write the failing tests**

Add to `lib/outlook/blend.test.js` (and add `weightFn` to its import list from `./blend.js`):

```js
test('weightFn — learned weight, else the average of the known ones, else 1', () => {
  const w = weightFn({ a: 0.6, b: 0.2 })
  assert.equal(w('a'), 0.6)
  assert.equal(w('zzz'), 0.4)
  assert.equal(weightFn({})('x'), 1)
})
```

Add to `lib/outlook/headlines.test.js` (and add `inDaylight` to its import list from `./headlines.js`):

```js
test('inDaylight — sunrise to 30 min before sunset; 07–21 without sun times', () => {
  const sun = { sunrise: '06:58', sunset: '18:50' }
  assert.equal(inDaylight('06:00', sun), false)
  assert.equal(inDaylight('07:00', sun), true)
  assert.equal(inDaylight('18:00', sun), true)
  assert.equal(inDaylight('19:00', sun), false)
  assert.equal(inDaylight('21:00', null), true)
  assert.equal(inDaylight('22:00', { sunrise: null, sunset: null }), false)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `weightFn` / `inDaylight` is not exported (SyntaxError on import).

- [ ] **Step 3: Implement**

In `lib/outlook/blend.js` change `function weightFn(weights) {` to `export function weightFn(weights) {`.

In `lib/outlook/headlines.js` replace the block from `const minutes = hm => ...` through the `const pool = ...` line of `bestTimeOutside` with:

```js
const minutes = hm => (typeof hm === 'string' && /^\d\d:\d\d$/.test(hm) ? Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3)) : null)

// Daylight for an hour starting at 'HH:MM': after sunrise with at least
// 30 min of light left; 07–21 when the sun times are unknown.
export function inDaylight(hhmm, sun) {
  const m = minutes(hhmm), rise = minutes(sun?.sunrise), set = minutes(sun?.sunset)
  if (m == null) return false
  return rise != null && set != null ? m >= rise && m + 30 <= set : m >= 7 * 60 && m <= 21 * 60
}

// The nicest daylight hour among the given hours: rain hurts most, then
// distance from a pleasant 21 °C (doubly so outside 15–25 °C), then wind —
// but only real wind: a breeze under 15 km/h costs nothing. Daylight keeps a
// calm evening after dark from winning.
export function bestTimeOutside(hours, sun = null) {
  const pool = (hours ?? []).filter(h => inDaylight(h.t.slice(11, 16), sun))
```

(The rest of `bestTimeOutside` — `if (!pool.length) return null`, the score, the wet check, the return — stays unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS (the existing `bestTimeOutside` daylight tests still pass).

- [ ] **Step 5: Commit**

```bash
git add lib/outlook/blend.js lib/outlook/blend.test.js lib/outlook/headlines.js lib/outlook/headlines.test.js
git commit -m "Outlook: export weightFn and inDaylight for the hiking engine"
git push origin main
```

---

### Task 2: Fixtures and the summit parser

**Files:**
- Create: `lib/hike/parse.js`
- Create: `scripts/record-hike-fixtures.mjs`
- Create (generated): `lib/hike/__fixtures__/om-summit-glockner.json`, `photon-schneeberg.json`, `elevation-3.json`, `geocoding-zugspitze.json`
- Test: `lib/hike/parse.test.js`

**Interfaces:**
- Consumes: `OM_MODELS` (`lib/outlook/models.js`), `num` (`lib/outlook/parse.js`).
- Produces: `SUMMIT_HOURLY: string[]`; `parseSummitMulti(json) → { utcOffsetSec, elevation, series: [{ id, hourly: [{ t, temp, feels, pop, precip, code, cape, fl, lpi, cloud, wind10, w850, w700, w600 }] }], sun: { sunrise, sunset } } | null`.

- [ ] **Step 1: Write `lib/hike/parse.js` with only the variable list** (the recorder needs it)

```js
// Pure parser for the summit request: the outlook's models, downscaled to the
// peak's height, with the variables a summit forecast needs. One series per
// model:
//   { id, hourly: [{ t, temp, feels, pop, precip, code, cape, fl, lpi, cloud,
//                    wind10, w850, w700, w600 }] }
// A variable a model doesn't publish is null — that model just doesn't vote
// on it.
import { OM_MODELS } from '../outlook/models.js'
import { num } from '../outlook/parse.js'

export const SUMMIT_HOURLY = [
  'temperature_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation',
  'weather_code', 'cape', 'freezing_level_height', 'lightning_potential', 'cloud_cover',
  'wind_speed_10m', 'wind_speed_850hPa', 'wind_speed_700hPa', 'wind_speed_600hPa',
]
```

- [ ] **Step 2: Write `scripts/record-hike-fixtures.mjs` and record**

```js
// Records trimmed real API responses into lib/hike/__fixtures__/ for the
// hiking engine tests. Re-run when an upstream format changes:
//   node scripts/record-hike-fixtures.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { OM_MODELS } from '../lib/outlook/models.js'
import { SUMMIT_HOURLY } from '../lib/hike/parse.js'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'hike', '__fixtures__')
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
  console.log(name.padEnd(28), `${(s.length / 1024).toFixed(0)} kB`)
}

const models = OM_MODELS.map(m => m.model).join(',')
save('om-summit-glockner.json', await get(`https://api.open-meteo.com/v1/forecast?latitude=47.0745&longitude=12.6945&elevation=3798&hourly=${SUMMIT_HOURLY.join(',')}&daily=sunrise,sunset&models=${models}&forecast_days=3&timezone=auto`))
save('photon-schneeberg.json', await get('https://photon.komoot.io/api/?q=Schneeberg&osm_tag=natural:peak&osm_tag=natural:volcano&osm_tag=tourism:alpine_hut&limit=15&lat=47.8&lon=15.8'))
save('elevation-3.json', await get('https://api.open-meteo.com/v1/elevation?latitude=47.7675,47.0745,46.3783&longitude=15.8069,12.6945,13.8367'))
save('geocoding-zugspitze.json', await get('https://geocoding-api.open-meteo.com/v1/search?name=Zugspitze&count=20&language=en'))
```

Run: `node scripts/record-hike-fixtures.mjs`
Expected: four lines with file names and sizes; the Photon file contains `natural`/`tourism` features (if Photon rejects repeated `osm_tag`, the file has zero features — then note it and use a single `osm_tag=natural:peak` in both this script and Task 6's `fetchPhotonRaw`).

- [ ] **Step 3: Write the failing parser tests** — `lib/hike/parse.test.js`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseSummitMulti } from './parse.js'

const fx = name => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)))

test('parseSummitMulti — the recorded Großglockner response, one series per model at 3798 m', () => {
  const p = parseSummitMulti(fx('om-summit-glockner.json'))
  assert.equal(p.elevation, 3798)
  assert.ok(p.series.length >= 5)
  const icon = p.series.find(s => s.id === 'icon')
  assert.ok(icon.hourly.length >= 48)
  const h = icon.hourly[12]
  for (const k of ['temp', 'feels', 'pop', 'cape', 'fl', 'w700']) assert.equal(typeof h[k], 'number', k)
  assert.match(p.sun.sunrise, /^\d\d:\d\d$/)
})

test('parseSummitMulti — a variable a model lacks is null, not a crash', () => {
  const json = {
    utc_offset_seconds: 3600, elevation: 2000,
    hourly: { time: ['2026-10-01T00:00', '2026-10-01T01:00'], temperature_2m_ecmwf_ifs025: [1, 2], cape_ecmwf_ifs025: [null, 50] },
    daily: {},
  }
  const p = parseSummitMulti(json)
  assert.deepEqual(p.series.map(s => s.id), ['ecmwf'])
  assert.equal(p.series[0].hourly[0].cape, null)
  assert.equal(p.series[0].hourly[1].cape, 50)
  assert.equal(p.series[0].hourly[0].fl, null)
  assert.deepEqual(p.sun, { sunrise: null, sunset: null })
})

test('parseSummitMulti — garbage in, null out', () => {
  assert.equal(parseSummitMulti(null), null)
  assert.equal(parseSummitMulti({ hourly: {} }), null)
})
```

- [ ] **Step 4: Run to verify they fail**

Run: `npm test`
Expected: FAIL — `parseSummitMulti` is not exported.

- [ ] **Step 5: Implement** — append to `lib/hike/parse.js`

```js
const FIELDS = {
  temp: 'temperature_2m', feels: 'apparent_temperature', pop: 'precipitation_probability',
  precip: 'precipitation', code: 'weather_code', cape: 'cape', fl: 'freezing_level_height',
  lpi: 'lightning_potential', cloud: 'cloud_cover', wind10: 'wind_speed_10m',
  w850: 'wind_speed_850hPa', w700: 'wind_speed_700hPa', w600: 'wind_speed_600hPa',
}

export function parseSummitMulti(json, models = OM_MODELS) {
  const h = json?.hourly
  if (!Array.isArray(h?.time)) return null
  const series = []
  for (const { id, model } of models) {
    const col = name => h[`${name}_${model}`]
    if (!Array.isArray(col('temperature_2m'))) continue
    const hourly = []
    h.time.forEach((t, i) => {
      const p = { t }
      for (const [key, name] of Object.entries(FIELDS)) p[key] = num(col(name)?.[i])
      if (p.temp != null) hourly.push(p)
    })
    if (hourly.length) series.push({ id, hourly })
  }
  const d = json.daily ?? {}
  // sunrise/sunset come back unsuffixed or once per model, depending on version
  const sunCol = k => d[k] ?? Object.entries(d).find(([key]) => key.startsWith(`${k}_`))?.[1]
  const hm = v => (typeof v === 'string' ? v.slice(11, 16) : null)
  return {
    utcOffsetSec: num(json.utc_offset_seconds) ?? 0,
    elevation: num(json.elevation),
    series,
    sun: { sunrise: hm(sunCol('sunrise')?.[0]), sunset: hm(sunCol('sunset')?.[0]) },
  }
}
```

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/hike/parse.js lib/hike/parse.test.js lib/hike/__fixtures__ scripts/record-hike-fixtures.mjs
git commit -m "Hike: summit multi-model parser + recorded fixtures"
git push origin main
```

---

### Task 3: Summit physics — wind, freezing level, storm risk

**Files:**
- Create: `lib/hike/physics.js`
- Test: `lib/hike/physics.test.js`

**Interfaces:**
- Produces: `summitWind(elev: number, p: { wind10, w850, w700, w600 }) → number|null`; `freezingLevel(p: { fl, temp }, elev: number) → number|null` (metres, rounded to 10, ≥ 0); `stormRisk({ cape, pop, lpi }) → 'low'|'moderate'|'high'|null`; `STORM` thresholds object.

- [ ] **Step 1: Write the failing tests** — `lib/hike/physics.test.js`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summitWind, freezingLevel, stormRisk } from './physics.js'

const P = o => ({ wind10: null, w850: null, w700: null, w600: null, ...o })

test('summitWind — interpolates between the pressure levels around the summit', () => {
  assert.equal(summitWind(2250, P({ w850: 20, w700: 40 })), 30) // halfway 1500 → 3000 m
  assert.equal(summitWind(3600, P({ w700: 30, w600: 50 })), 40) // halfway 3000 → 4200 m
  assert.equal(summitWind(3000, P({ w700: 33, w600: 50 })), 33) // exactly on a level
})

test('summitWind — low hills use the 10 m wind, very high peaks the top level', () => {
  assert.equal(summitWind(800, P({ wind10: 12, w850: 30 })), 12)
  assert.equal(summitWind(4806, P({ w700: 40, w600: 65 })), 65) // Mont Blanc
})

test('summitWind — missing levels fall back to the nearest one, then the 10 m wind', () => {
  assert.equal(summitWind(2000, P({ w700: 35 })), 35)
  assert.equal(summitWind(3500, P({ w850: 25 })), 25)
  assert.equal(summitWind(3500, P({ wind10: 9 })), 9)
  assert.equal(summitWind(3500, P({})), null)
})

test('freezingLevel — the model value where published, else from the summit temperature', () => {
  assert.equal(freezingLevel({ fl: 2847, temp: 0 }, 3000), 2850)
  assert.equal(freezingLevel({ fl: null, temp: 3.25 }, 3000), 3500)
  assert.equal(freezingLevel({ fl: null, temp: -6.5 }, 3000), 2000)
  assert.equal(freezingLevel({ fl: null, temp: -30 }, 1000), 0)
  assert.equal(freezingLevel({ fl: null, temp: null }, 1000), null)
})

test('stormRisk — CAPE with rain, lightning potential, or unknown', () => {
  assert.equal(stormRisk({ cape: 1200, pop: 35, lpi: null }), 'high')
  assert.equal(stormRisk({ cape: 1200, pop: 10, lpi: null }), 'low') // energy but no trigger
  assert.equal(stormRisk({ cape: 400, pop: 25, lpi: null }), 'moderate')
  assert.equal(stormRisk({ cape: 100, pop: 90, lpi: null }), 'low')
  assert.equal(stormRisk({ cape: null, pop: 50, lpi: 2 }), 'high')
  assert.equal(stormRisk({ cape: null, pop: 50, lpi: null }), null)
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find `./physics.js`.

- [ ] **Step 3: Implement** — `lib/hike/physics.js`

```js
// Summit physics (pure — unit tested): wind at the summit's height, the
// freezing level, and the hourly thunderstorm risk.

// Standard-atmosphere heights of the requested pressure levels.
const LEVELS = [['w850', 1500], ['w700', 3000], ['w600', 4200]]
const LAPSE = 0.0065 // °C per metre
const r1 = v => Math.round(v * 10) / 10

// 10 m model wind sits on smoothed terrain and understates ridge wind, so
// from 1500 m up the summit wind comes from the pressure levels bracketing
// the summit, linearly interpolated. A missing level falls back to the
// nearest one reported, then to the 10 m wind.
export function summitWind(elev, p) {
  if (elev < 1500) return p.wind10 ?? p.w850 ?? null
  const have = LEVELS.filter(([k]) => typeof p[k] === 'number')
  if (!have.length) return p.wind10 ?? null
  const below = [...have].reverse().find(([, z]) => z <= elev)
  const above = have.find(([, z]) => z >= elev)
  if (below && above && below[1] !== above[1]) {
    const f = (elev - below[1]) / (above[1] - below[1])
    return r1(p[below[0]] + (p[above[0]] - p[below[0]]) * f)
  }
  return p[(below ?? above)[0]]
}

// The model's freezing level where it publishes one (GFS, ICON), otherwise
// worked out from the summit temperature with the standard lapse rate.
export function freezingLevel(p, elev) {
  const round10 = v => Math.max(0, Math.round(v / 10) * 10)
  if (typeof p.fl === 'number') return round10(p.fl)
  if (typeof p.temp !== 'number') return null
  return round10(elev + p.temp / LAPSE)
}

// Starting thresholds (spec §3.2) — one table, tuned later against real days.
export const STORM = { highCape: 1000, highPop: 30, modCape: 300, modPop: 20, lpiHigh: 1 }

// 'low' | 'moderate' | 'high', or null when no model reported storm energy.
export function stormRisk({ cape, pop, lpi }) {
  if (typeof lpi === 'number' && lpi >= STORM.lpiHigh) return 'high'
  if (typeof cape !== 'number') return null
  const rain = pop ?? 0
  if (cape >= STORM.highCape && rain >= STORM.highPop) return 'high'
  if (cape >= STORM.modCape && rain >= STORM.modPop) return 'moderate'
  return 'low'
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/hike/physics.js lib/hike/physics.test.js
git commit -m "Hike: summit wind from pressure levels, freezing level, storm risk"
git push origin main
```

---

### Task 4: Blending the summit hours and days

**Files:**
- Create: `lib/hike/blend.js`
- Test: `lib/hike/blend.test.js`

**Interfaces:**
- Consumes: `band`, `rainProb`, `weightFn`, `horizonForLeadHours` (`lib/outlook/blend.js`); `weatherIcon` (`lib/weather.js`); `summitWind`, `freezingLevel`, `stormRisk` (Task 3); series shape from Task 2.
- Produces: `blendSummitHourly(series, weightsByHorizon, { nowLocal, elev, hours = 168 }) → [{ t, temp, lo, hi, feels, rainPct, windKmh, freezingLevel, fzlLo, fzlHi, cape, storm, icon, n }]`; `summitDays(hourly, days = 7) → [{ date, partial, tempMax, tempMin, feelsMin, windMax, rainPct, freezingMin, freezingMax, storm, icon }]`.

- [ ] **Step 1: Write the failing tests** — `lib/hike/blend.test.js`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blendSummitHourly, summitDays } from './blend.js'
import { weatherIcon } from '../weather.js'

const EMPTY = { temp: null, feels: null, pop: null, precip: null, code: null, cape: null, fl: null, lpi: null, cloud: null, wind10: null, w850: null, w700: null, w600: null }
const series = (id, pts) => ({ id, hourly: pts.map(([t, o]) => ({ t, ...EMPTY, ...o })) })
const NOW = '2026-10-01T10:00'

test('blendSummitHourly — weighted summit consensus with band, wind from the levels, storm risk', () => {
  const out = blendSummitHourly([
    series('icon', [[NOW, { temp: -2, feels: -8, pop: 40, cape: 1200, fl: 3200, w700: 30, w600: 50, code: 95 }]]),
    series('gfs', [[NOW, { temp: 0, feels: -4, pop: 20, cape: 800, fl: 3400, w700: 50, w600: 70, code: 3 }]]),
  ], { h48: { icon: 0.75, gfs: 0.25 } }, { nowLocal: NOW, elev: 3600 })
  const h = out[0]
  assert.equal(h.temp, -1.5)
  assert.deepEqual([h.lo, h.hi], [-2, 0])
  assert.equal(h.feels, -7)
  assert.equal(h.windKmh, 45) // icon 40, gfs 60 at 3600 m
  assert.equal(h.freezingLevel, 3250)
  assert.equal(h.rainPct, 35)
  assert.equal(h.cape, 1100)
  assert.equal(h.storm, 'high')
  assert.equal(h.icon, weatherIcon(95)) // the heavier-weighted model's weather
  assert.equal(h.n, 2)
})

test('blendSummitHourly — skips the past; derives the freezing level; no CAPE → unknown storm risk', () => {
  const out = blendSummitHourly(
    [series('ecmwf', [['2026-10-01T09:00', { temp: 5 }], [NOW, { temp: -3.25, pop: 10 }]])],
    {}, { nowLocal: NOW, elev: 3000 },
  )
  assert.equal(out.length, 1)
  assert.equal(out[0].freezingLevel, 2500)
  assert.equal(out[0].storm, null)
  assert.equal(out[0].windKmh, null)
})

test('summitDays — per-day summit extremes, worst storm risk, partial today', () => {
  const hours = [
    { t: '2026-10-01T22:00', temp: -4, feels: -10, windKmh: 30, rainPct: 10, freezingLevel: 2800, storm: 'low', icon: 'a' },
    { t: '2026-10-01T23:00', temp: -5, feels: -12, windKmh: 35, rainPct: 5, freezingLevel: 2700, storm: 'low', icon: 'b' },
    ...Array.from({ length: 24 }, (_, i) => ({
      t: `2026-10-02T${String(i).padStart(2, '0')}:00`,
      temp: i === 14 ? 2 : -3, feels: -9, windKmh: i === 15 ? 55 : 20, rainPct: i === 16 ? 60 : 10,
      freezingLevel: 3000 + i * 10, storm: i === 16 ? 'moderate' : 'low', icon: i === 12 ? '☀️' : 'x',
    })),
  ]
  const [d1, d2] = summitDays(hours)
  assert.equal(d1.partial, true)
  assert.deepEqual([d1.tempMax, d1.tempMin, d1.storm], [-4, -5, 'low'])
  assert.equal(d2.partial, false)
  assert.deepEqual([d2.tempMax, d2.tempMin, d2.windMax, d2.rainPct, d2.storm], [2, -3, 55, 60, 'moderate'])
  assert.deepEqual([d2.freezingMin, d2.freezingMax], [3000, 3230])
  assert.equal(d2.feelsMin, -9)
  assert.equal(d2.icon, '☀️')
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find `./blend.js` in `lib/hike`.

- [ ] **Step 3: Implement** — `lib/hike/blend.js`

```js
// Blends the per-model summit series into one consensus per hour and per day
// (pure — unit tested). Weights are the region's learned outlook weights:
// summits have no observations of their own to learn from, so they borrow
// the valley's trust.
import { band, rainProb, weightFn, horizonForLeadHours } from '../outlook/blend.js'
import { weatherIcon } from '../weather.js'
import { summitWind, freezingLevel, stormRisk } from './physics.js'

const r1 = v => Math.round(v * 10) / 10
const RISK_RANK = { low: 0, moderate: 1, high: 2 }

function weighted(pts, ws, key) {
  let s = 0, sw = 0
  pts.forEach((p, i) => { if (typeof p[key] === 'number') { s += p[key] * ws[i]; sw += ws[i] } })
  return sw ? s / sw : null
}

// nowLocal: the peak-local hour to start from, 'YYYY-MM-DDTHH:MM'.
export function blendSummitHourly(series, weightsByHorizon, { nowLocal, elev, hours = 168 }) {
  const by = new Map()
  for (const s of series) for (const p of s.hourly) {
    if (p.t < nowLocal) continue
    let e = by.get(p.t)
    if (!e) by.set(p.t, (e = []))
    e.push({ id: s.id, ...p, wind: summitWind(elev, p), fzl: freezingLevel(p, elev), rp: rainProb(p.pop, p.precip, 0.1) })
  }
  const t0 = Date.parse(`${nowLocal}:00Z`)
  return [...by.keys()].sort().slice(0, hours).map(t => {
    const pts = by.get(t)
    const w = weightFn(weightsByHorizon?.[horizonForLeadHours((Date.parse(`${t}:00Z`) - t0) / 3600e3)])
    let ws = pts.map(p => Math.max(0, w(p.id)))
    if (!ws.some(v => v > 0)) ws = pts.map(() => 1)
    const rain = weighted(pts, ws, 'rp')
    const rainPct = rain == null ? null : Math.round(rain * 100)
    const cape = weighted(pts, ws, 'cape')
    const lpis = pts.map(p => p.lpi).filter(v => typeof v === 'number')
    const lpi = lpis.length ? Math.max(...lpis) : null
    const [lo, hi] = band(pts.map(p => p.temp))
    const [fzlLo, fzlHi] = band(pts.map(p => p.fzl))
    let top = null, topW = -1
    pts.forEach((p, i) => { if (typeof p.code === 'number' && ws[i] > topW) { topW = ws[i]; top = p } })
    const feels = weighted(pts, ws, 'feels'), wind = weighted(pts, ws, 'wind'), fzl = weighted(pts, ws, 'fzl')
    return {
      t, temp: r1(weighted(pts, ws, 'temp')), lo, hi,
      feels: feels == null ? null : r1(feels),
      rainPct,
      windKmh: wind == null ? null : Math.round(wind),
      freezingLevel: fzl == null ? null : Math.round(fzl / 10) * 10, fzlLo, fzlHi,
      cape: cape == null ? null : Math.round(cape),
      storm: stormRisk({ cape, pop: rainPct, lpi }),
      icon: top ? weatherIcon(top.code) : null,
      n: pts.length,
    }
  })
}

// One row per summit day from the blended hours. Today starts now and is
// flagged partial, as is a cut-off last day.
export function summitDays(hourly, days = 7) {
  const byDate = new Map()
  for (const h of hourly ?? []) {
    const d = h.t.slice(0, 10)
    if (!byDate.has(d)) byDate.set(d, [])
    byDate.get(d).push(h)
  }
  return [...byDate.entries()].slice(0, days).map(([date, hs]) => {
    const nums = k => hs.map(h => h[k]).filter(v => typeof v === 'number')
    const temps = nums('temp'), fz = nums('freezingLevel'), winds = nums('windKmh'), rain = nums('rainPct'), feels = nums('feels')
    const storms = hs.map(h => h.storm).filter(Boolean)
    const noon = hs.find(h => h.t.slice(11, 13) === '12') ?? hs[Math.floor(hs.length / 2)]
    return {
      date, partial: hs.length < 24,
      tempMax: Math.max(...temps), tempMin: Math.min(...temps),
      feelsMin: feels.length ? Math.min(...feels) : null,
      windMax: winds.length ? Math.max(...winds) : null,
      rainPct: rain.length ? Math.max(...rain) : null,
      freezingMin: fz.length ? Math.min(...fz) : null,
      freezingMax: fz.length ? Math.max(...fz) : null,
      storm: storms.length ? storms.reduce((a, b) => (RISK_RANK[b] > RISK_RANK[a] ? b : a)) : null,
      icon: noon?.icon ?? null,
    }
  })
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/hike/blend.js lib/hike/blend.test.js
git commit -m "Hike: blend summit hours and days with the region's learned weights"
git push origin main
```

---

### Task 5: The summit window

**Files:**
- Create: `lib/hike/window.js`
- Test: `lib/hike/window.test.js`

**Interfaces:**
- Consumes: `inDaylight` (Task 1); `addHours` (`lib/localtime.js`); blended hour shape from Task 4 (`t, storm, rainPct, windKmh, feels`).
- Produces: `LIMITS`; `blocker(hour) → 'storms'|'rain'|'wind'|'cold'|null`; `summitWindow(hours, sun) → { window: { from, to, hours } | null, next: { reason, at } | null } | null` (outer `null` = no daylight hours at all).

- [ ] **Step 1: Write the failing tests** — `lib/hike/window.test.js`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summitWindow, blocker } from './window.js'

const H = (hh, o = {}) => ({ t: `2026-10-02T${hh}:00`, storm: 'low', rainPct: 10, windKmh: 20, feels: -5, ...o })
const SUN = { sunrise: '06:50', sunset: '18:40' }
const HOURS = ['05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19']

test('summitWindow — the longest good daylight run and what ends it', () => {
  const hours = HOURS.map(hh => H(hh, hh === '09' ? { windKmh: 45 } : hh >= '14' && hh <= '16' ? { storm: 'high' } : {}))
  const r = summitWindow(hours, SUN)
  assert.deepEqual(r.window, { from: '2026-10-02T10:00', to: '2026-10-02T14:00', hours: 4 })
  assert.deepEqual(r.next, { reason: 'storms', at: '2026-10-02T14:00' })
})

test('summitWindow — no good hour: no window, and the first reason', () => {
  const r = summitWindow(['08', '09', '10'].map(hh => H(hh, { rainPct: 80 })), SUN)
  assert.equal(r.window, null)
  assert.deepEqual(r.next, { reason: 'rain', at: '2026-10-02T08:00' })
})

test('summitWindow — fine all day: nothing ends it; after dark: null', () => {
  assert.deepEqual(summitWindow(['08', '09', '10'].map(hh => H(hh)), SUN), {
    window: { from: '2026-10-02T08:00', to: '2026-10-02T11:00', hours: 3 }, next: null,
  })
  assert.equal(summitWindow([H('20'), H('21'), H('22')], SUN), null)
  assert.equal(summitWindow([], SUN), null)
})

test('blocker — storms beat rain beat wind beat cold; unknown storm risk does not block', () => {
  assert.equal(blocker(H('10', { storm: 'moderate', rainPct: 90 })), 'storms')
  assert.equal(blocker(H('10', { rainPct: 30, windKmh: 60 })), 'rain')
  assert.equal(blocker(H('10', { windKmh: 40, feels: -30 })), 'wind')
  assert.equal(blocker(H('10', { feels: -20 })), 'cold')
  assert.equal(blocker(H('10', { storm: null })), null)
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find `./window.js`.

- [ ] **Step 3: Implement** — `lib/hike/window.js`

```js
// The summit window (pure — unit tested): the longest run of daylight hours
// that are dry, without storm risk, not too windy and not brutally cold —
// plus what ends it, or with no window, what rules the day out.
import { inDaylight } from '../outlook/headlines.js'
import { addHours } from '../localtime.js'

export const LIMITS = { rainPct: 30, windKmh: 40, feels: -20 }

// Why an hour isn't summit weather, most serious first; null when it is.
// Unknown storm risk (no model reported CAPE) doesn't block on its own.
export function blocker(h) {
  if (h.storm === 'moderate' || h.storm === 'high') return 'storms'
  if (h.rainPct != null && h.rainPct >= LIMITS.rainPct) return 'rain'
  if (h.windKmh != null && h.windKmh >= LIMITS.windKmh) return 'wind'
  if (h.feels != null && h.feels <= LIMITS.feels) return 'cold'
  return null
}

// hours: one day's blended hours (daylight is one run per day).
export function summitWindow(hours, sun) {
  const day = (hours ?? []).filter(h => inDaylight(h.t.slice(11, 16), sun))
  if (!day.length) return null
  let best = null, start = -1
  for (let i = 0; i <= day.length; i++) {
    const ok = i < day.length && !blocker(day[i])
    if (ok && start < 0) start = i
    if (!ok && start >= 0) {
      if (!best || i - start > best.end - best.start) best = { start, end: i }
      start = -1
    }
  }
  const stop = (best ? day.slice(best.end) : day).find(h => blocker(h))
  return {
    window: best ? { from: day[best.start].t, to: addHours(day[best.end - 1].t, 1), hours: best.end - best.start } : null,
    next: stop ? { reason: blocker(stop), at: stop.t } : null,
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/hike/window.js lib/hike/window.test.js
git commit -m "Hike: summit window — longest safe daylight run and what ends it"
git push origin main
```

---

### Task 6: `/api/hike` — params, payload builder, fetchers, route

**Files:**
- Create: `lib/hike/params.js`, `lib/hike/build.js`, `lib/hike/sources.js`, `app/api/hike/route.js`
- Test: `lib/hike/params.test.js`, `lib/hike/build.test.js`

**Interfaces:**
- Consumes: Tasks 2–5; `todayHours` (`lib/outlook/headlines.js`); `addDays`, `localHourIso` (`lib/localtime.js`); `sourceName` (`lib/sources.js`); `getJson` (`lib/outlook/http.js`); `OM_MODELS`; `loadOutlookWeights` (`lib/outlook/weights.js`); `getRegion` (`lib/weather.js`); `withErrorLog` (`lib/log.js`); `clientIp` (`lib/auth.js`); `createRateLimiter` (`lib/ratelimit.js`, used as `limiter.limited(ip)`).
- Produces:
  - `parsePeakQuery(URLSearchParams) → { name, lat, lon, elev } | null`
  - `parseSearchQuery(URLSearchParams) → { q, bias: { lat, lon } | null } | null` (used in Task 8)
  - `buildHike({ peak, region, multi, weights, now }) → { peak, region, generatedAt, utcOffsetSec, nowLocal, sun, sources, notes, hourly, days, windows: { today, tomorrow } }` (`windows.*` are `summitWindow` results; they double as the headline data for phase 2)
  - `fetchSummitRaw(lat, lon, elev)`, `fetchPhotonRaw(q, { lat, lon })`, `fetchElevations(points) → number[] | null`, `fetchGeocodingRaw(q)` (all never throw)
  - `GET /api/hike?lat=&lon=&elev=&name=`

- [ ] **Step 1: Write the failing tests**

`lib/hike/params.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePeakQuery, parseSearchQuery } from './params.js'

const sp = s => new URLSearchParams(s)

test('parsePeakQuery — valid peak, rounded so equal peaks share a cache entry', () => {
  assert.deepEqual(parsePeakQuery(sp('lat=47.074512&lon=12.694534&elev=3798.4&name=%20Gro%C3%9Fglockner%20')), {
    name: 'Großglockner', lat: 47.075, lon: 12.695, elev: 3798,
  })
  assert.deepEqual(parsePeakQuery(sp('lat=10&lon=20&elev=0')), { name: null, lat: 10, lon: 20, elev: 0 })
})

test('parsePeakQuery — junk, missing or out-of-range values are rejected', () => {
  for (const q of ['lat=47,07&lon=12&elev=3000', 'lat=47&elev=3000', 'lat=47&lon=12&elev=abc', 'lat=47&lon=12&elev=-5', 'lat=95&lon=12&elev=100', 'lat=47&lon=12&elev=', 'lat=47&lon=200&elev=100']) {
    assert.equal(parsePeakQuery(sp(q)), null, q)
  }
})

test('parseSearchQuery — 2–80 characters, optional rounded location bias', () => {
  assert.deepEqual(parseSearchQuery(sp('q=%20Rax%20&lat=48.2082&lon=16.3738')), { q: 'Rax', bias: { lat: 48.2, lon: 16.4 } })
  assert.deepEqual(parseSearchQuery(sp('q=Eiger')), { q: 'Eiger', bias: null })
  assert.equal(parseSearchQuery(sp('q=a')), null)
  assert.equal(parseSearchQuery(sp(`q=${'x'.repeat(81)}`)), null)
  assert.deepEqual(parseSearchQuery(sp('q=Eiger&lat=abc&lon=5')), { q: 'Eiger', bias: null })
})
```

`lib/hike/build.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildHike } from './build.js'

const fx = name => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)))
const GLOCKNER = { name: 'Großglockner', lat: 47.0745, lon: 12.6945, elev: 3798 }

test('buildHike — the recorded Großglockner response becomes summit hours, days and windows', () => {
  const multi = fx('om-summit-glockner.json')
  const now = Date.parse(`${multi.hourly.time[30]}:00Z`) - multi.utc_offset_seconds * 1000 + 10 * 60e3 // day 2, 06:10 local
  const p = buildHike({ peak: GLOCKNER, region: 'europe', multi, now })
  assert.deepEqual(p.peak, GLOCKNER)
  assert.equal(p.hourly[0].t, multi.hourly.time[30])
  assert.ok(p.sources.length >= 5)
  assert.ok(p.hourly.every(h => typeof h.temp === 'number'))
  assert.ok(p.hourly.some(h => typeof h.windKmh === 'number'))
  assert.ok(p.hourly.some(h => typeof h.freezingLevel === 'number'))
  assert.ok(p.hourly.some(h => h.storm !== null))
  assert.ok(p.days.length >= 2)
  assert.ok('window' in p.windows.today)
  assert.ok('window' in p.windows.tomorrow)
})

test('buildHike — no upstream data: empty but well-formed, flagged', () => {
  const p = buildHike({ peak: GLOCKNER, region: 'europe', multi: null, now: Date.UTC(2026, 9, 1, 10) })
  assert.deepEqual([p.hourly.length, p.days.length], [0, 0])
  assert.deepEqual(p.windows, { today: null, tomorrow: null })
  assert.deepEqual(p.notes, ['fewer_sources'])
})

test('buildHike — no model reports storm energy: flagged, the window still works', () => {
  const time = Array.from({ length: 48 }, (_, i) => new Date(Date.UTC(2026, 9, 1) + i * 3600e3).toISOString().slice(0, 16))
  const multi = {
    utc_offset_seconds: 0, elevation: 2000,
    hourly: { time, temperature_2m_ecmwf_ifs025: time.map(() => 1), temperature_2m_gfs_seamless: time.map(() => 2) },
    daily: { sunrise: ['2026-10-01T06:00'], sunset: ['2026-10-01T18:00'] },
  }
  const p = buildHike({ peak: { name: 'X', lat: 47, lon: 11, elev: 2000 }, region: 'europe', multi, now: Date.UTC(2026, 9, 1, 8) })
  assert.deepEqual(p.notes, ['no_storm_data'])
  assert.equal(p.windows.today.window.from, '2026-10-01T08:00')
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find `./params.js` / `./build.js`.

- [ ] **Step 3: Implement `lib/hike/params.js`**

```js
// Query parsing for the hiking routes (pure — unit tested).

const numIn = (v, lo, hi) => {
  if (v == null || v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null
}

// { name, lat, lon, elev }, rounded (3 decimals ≈ 100 m) so equal peaks share
// one cache entry — or null when a coordinate or the height is missing, junk
// or out of range.
export function parsePeakQuery(sp) {
  const lat = numIn(sp.get('lat'), -90, 90), lon = numIn(sp.get('lon'), -180, 180), elev = numIn(sp.get('elev'), 0, 9000)
  if (lat == null || lon == null || elev == null) return null
  const name = (sp.get('name') ?? '').trim().slice(0, 80) || null
  return { name, lat: Math.round(lat * 1e3) / 1e3, lon: Math.round(lon * 1e3) / 1e3, elev: Math.round(elev) }
}

// Search text of 2–80 characters plus an optional location bias (0.1°).
export function parseSearchQuery(sp) {
  const q = (sp.get('q') ?? '').trim()
  if (q.length < 2 || q.length > 80) return null
  const lat = numIn(sp.get('lat'), -90, 90), lon = numIn(sp.get('lon'), -180, 180)
  return { q, bias: lat != null && lon != null ? { lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10 } : null }
}
```

- [ ] **Step 4: Implement `lib/hike/build.js`**

```js
// Assembles the /api/hike payload from the raw summit response (pure — the
// route fetches, this does the rest, so it's unit tested). windows.today /
// windows.tomorrow are the headline data the UI and push alerts phrase.
import { parseSummitMulti } from './parse.js'
import { blendSummitHourly, summitDays } from './blend.js'
import { summitWindow } from './window.js'
import { todayHours } from '../outlook/headlines.js'
import { addDays, localHourIso } from '../localtime.js'
import { sourceName } from '../sources.js'

export function buildHike({ peak, region, multi, weights = {}, now = Date.now() }) {
  const parsed = parseSummitMulti(multi)
  const utcOffsetSec = parsed?.utcOffsetSec ?? Math.round(peak.lon / 15) * 3600
  const series = parsed?.series ?? []
  const nowLocal = localHourIso(utcOffsetSec, now)
  const todayLocal = nowLocal.slice(0, 10)
  const tomorrow = addDays(todayLocal, 1)
  const sun = parsed?.sun ?? { sunrise: null, sunset: null }
  const hourly = blendSummitHourly(series, weights, { nowLocal, elev: peak.elev, hours: 168 })

  const notes = []
  if (series.length < 2) notes.push('fewer_sources')
  if (hourly.length && hourly.every(h => h.storm == null)) notes.push('no_storm_data')

  return {
    peak: { name: peak.name ?? null, lat: peak.lat, lon: peak.lon, elev: peak.elev },
    region, generatedAt: new Date(now).toISOString(), utcOffsetSec, nowLocal, sun,
    sources: series.map(s => ({ id: s.id, name: sourceName(s.id) })),
    notes,
    hourly,
    days: summitDays(hourly),
    windows: {
      today: summitWindow(todayHours(hourly, todayLocal).hours, sun),
      tomorrow: summitWindow(hourly.filter(h => h.t.startsWith(tomorrow)), sun),
    },
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Implement `lib/hike/sources.js`**

```js
// Upstream requests for the hiking engine (network; never throw — getJson
// returns null on timeout, non-2xx or bad JSON).
import { getJson } from '../outlook/http.js'
import { OM_MODELS } from '../outlook/models.js'
import { SUMMIT_HOURLY } from './parse.js'

// Every outlook model, downscaled to the summit's height, 8 days.
export function fetchSummitRaw(lat, lon, elev) {
  const models = OM_MODELS.map(m => m.model).join(',')
  return getJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&elevation=${elev}&hourly=${SUMMIT_HOURLY.join(',')}&daily=sunrise,sunset&models=${models}&forecast_days=8&timezone=auto`, { cache: 'no-store' })
}

const PEAK_TAGS = ['natural:peak', 'natural:volcano', 'tourism:alpine_hut']

// OpenStreetMap peaks, volcanoes and huts (Photon, fair use: results are
// CDN-cached per query for a day by /api/peaks).
export function fetchPhotonRaw(q, { lat, lon } = {}) {
  const tags = PEAK_TAGS.map(t => `&osm_tag=${t}`).join('')
  const bias = lat != null && lon != null ? `&lat=${lat}&lon=${lon}` : ''
  return getJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}${tags}&limit=15${bias}`, { cache: 'no-store', ms: 6000 })
}

// Heights for up to 100 points in one call (Copernicus 90 m DEM), aligned
// with `points`; null when the service fails.
export async function fetchElevations(points) {
  if (!points.length) return []
  const lat = points.map(p => p.lat.toFixed(5)).join(','), lon = points.map(p => p.lon.toFixed(5)).join(',')
  const j = await getJson(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`, { next: { revalidate: 86400 } })
  return Array.isArray(j?.elevation) ? j.elevation : null
}

// GeoNames via Open-Meteo — the fallback when Photon is down.
export function fetchGeocodingRaw(q) {
  return getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=20&language=en`, { cache: 'no-store' })
}
```

- [ ] **Step 7: Implement `app/api/hike/route.js`**

```js
import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { getRegion } from '@/lib/weather'
import { loadOutlookWeights } from '@/lib/outlook/weights'
import { parsePeakQuery } from '@/lib/hike/params'
import { fetchSummitRaw } from '@/lib/hike/sources'
import { buildHike } from '@/lib/hike/build'

// Summit forecast for one peak: the outlook's models downscaled to its
// height. Language-neutral and CDN-cached per peak for 30 minutes.
export const maxDuration = 30

const TTL = 1800
const limiter = createRateLimiter({ max: 40, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const GET = withErrorLog('hike', async (request) => {
  const peak = parsePeakQuery(new URL(request.url).searchParams)
  if (!peak) return noStore({ error: 'lat, lon and elev are required' }, 400)
  // only cache misses reach this point — CDN hits never invoke the function
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)

  const region = getRegion(peak.lat, peak.lon)
  const [multi, weights] = await Promise.all([
    fetchSummitRaw(peak.lat, peak.lon, peak.elev),
    loadOutlookWeights(region),
  ])
  const payload = buildHike({ peak, region, multi, weights })
  if (!payload.hourly.length) return noStore({ error: 'Summit forecast unavailable right now — please try again shortly.' }, 502)

  return Response.json(payload, {
    headers: { 'Cache-Control': `public, s-maxage=${TTL}, stale-while-revalidate=${TTL * 2}` },
  })
})
```

- [ ] **Step 8: Verify the route against the real API**

Run: `npm run build`, then in the background `npx next start -p 3000`, then:

```bash
node -e "fetch('http://localhost:3000/api/hike?lat=47.0745&lon=12.6945&elev=3798&name=Gro%C3%9Fglockner').then(async r => { const j = await r.json(); console.log(r.status, r.headers.get('cache-control'), j.sources.length, j.hourly.length, j.days.length, JSON.stringify(j.windows.tomorrow), j.notes) })"
node -e "fetch('http://localhost:3000/api/hike?lat=47&lon=12&elev=abc').then(r => console.log(r.status, r.headers.get('cache-control')))"
```

Expected: first line `200 public, s-maxage=1800, stale-while-revalidate=3600 <≥5> 168 7 {"window":…} []`; second line `400 no-store`. Stop the server afterwards.

- [ ] **Step 9: Commit**

```bash
git add lib/hike/params.js lib/hike/params.test.js lib/hike/build.js lib/hike/build.test.js lib/hike/sources.js app/api/hike/route.js
git commit -m "Hike: /api/hike summit forecast (params, payload builder, fetchers)"
git push origin main
```

---

### Task 7: Peak search logic and the featured list

**Files:**
- Create: `lib/hike/search.js`, `scripts/build-featured-peaks.mjs`
- Create (generated): `lib/hike/featured.json`
- Test: `lib/hike/search.test.js`

**Interfaces:**
- Consumes: `haversineKm(lat1, lon1, lat2, lon2)` (`lib/geo.js`); fixtures from Task 2.
- Produces: `normalize(s) → string`; `matchFeatured(q, featured) → Peak[]`; `parsePhoton(json) → Peak[] | null`; `parseGeocodingPeaks(json) → Peak[] | null`; `mergePeaks(featured, found, elevations, limit = 10) → Peak[]`, where `Peak = { id, name, aka?, lat, lon, elev, country, region, kind: 'peak'|'hut' }`; `lib/hike/featured.json` (array of `Peak`).

- [ ] **Step 1: Write the failing tests** — `lib/hike/search.test.js`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalize, matchFeatured, parsePhoton, parseGeocodingPeaks, mergePeaks } from './search.js'

const fx = name => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)))

test('normalize / matchFeatured — umlauts, ß, case and aliases', () => {
  assert.equal(normalize('Großglockner'), 'grossglockner')
  assert.equal(normalize('Ötscher'), 'otscher')
  const F = [
    { name: 'Großglockner', aka: ['Grossglockner'] },
    { name: 'Rax (Heukuppe)', aka: ['Rax', 'Raxalpe'] },
    { name: 'Ötscher', aka: ['Oetscher'] },
  ]
  assert.deepEqual(matchFeatured('glockner', F).map(p => p.name), ['Großglockner'])
  assert.deepEqual(matchFeatured('RAXALPE', F).map(p => p.name), ['Rax (Heukuppe)'])
  assert.deepEqual(matchFeatured('Oetscher', F).map(p => p.name), ['Ötscher'])
  assert.deepEqual(matchFeatured('zzz', F), [])
})

test('parsePhoton — the recorded Schneeberg search: peaks and huts, heights still missing', () => {
  const r = parsePhoton(fx('photon-schneeberg.json'))
  assert.ok(r.length > 0)
  assert.ok(r.every(p => p.id.startsWith('osm-') && typeof p.lat === 'number' && typeof p.lon === 'number' && p.elev === null))
  assert.ok(r.every(p => p.kind === 'peak' || p.kind === 'hut'))
  assert.equal(parsePhoton(null), null)
})

test('parseGeocodingPeaks — mountains with a height only; towns dropped', () => {
  const r = parseGeocodingPeaks(fx('geocoding-zugspitze.json'))
  assert.ok(r.some(p => p.name === 'Zugspitze' && p.elev > 2900))
  assert.deepEqual(parseGeocodingPeaks({ results: [{ id: 1, name: 'Schneeberg', feature_code: 'PPL', elevation: 400, latitude: 1, longitude: 1 }] }), [])
  assert.deepEqual(parseGeocodingPeaks({}), [])
  assert.equal(parseGeocodingPeaks(null), null)
})

test('mergePeaks — featured first, heights filled in, one summit once, no height no result', () => {
  const featured = [{ id: 'schneeberg', name: 'Schneeberg (Klosterwappen)', lat: 47.7675, lon: 15.8069, elev: 2076 }]
  const found = [
    { id: 'osm-N1', name: 'Klosterwappen', lat: 47.768, lon: 15.807, elev: null }, // the featured summit again
    { id: 'osm-N2', name: 'Schneeberg', lat: 50.052, lon: 11.853, elev: null },
    { id: 'osm-N3', name: 'Schneeberg', lat: 50.785, lon: 6.018, elev: null },
  ]
  assert.deepEqual(mergePeaks(featured, found, [2070, 1051, null]).map(p => [p.id, p.elev]), [['schneeberg', 2076], ['osm-N2', 1051]])
  // elevation service down: Photon hits can't be forecast, featured still come back
  assert.deepEqual(mergePeaks(featured, found, null).map(p => p.id), ['schneeberg'])
  const many = Array.from({ length: 14 }, (_, i) => ({ id: `osm-N${i}`, name: 'P', lat: i, lon: i, elev: 1000 }))
  assert.equal(mergePeaks([], many, []).length, 10)
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find `./search.js`.

- [ ] **Step 3: Implement** — `lib/hike/search.js`

```js
// Peak search (pure — unit tested): OpenStreetMap results via Photon and the
// Open-Meteo geocoding fallback → one list, featured peaks first.
import { haversineKm } from '../geo.js'

// Lower-case, ß → ss, accents dropped, punctuation → spaces.
export const normalize = s => String(s).toLowerCase().replaceAll('ß', 'ss')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim()

export function matchFeatured(q, featured) {
  const n = normalize(q)
  if (!n) return []
  return featured.filter(p => [p.name, ...(p.aka ?? [])].some(name => normalize(name).includes(n)))
}

const KIND = { peak: 'peak', volcano: 'peak', alpine_hut: 'hut' }

export function parsePhoton(json) {
  if (!Array.isArray(json?.features)) return null
  return json.features
    .filter(f => f?.properties?.name && Array.isArray(f.geometry?.coordinates))
    .map(f => {
      const p = f.properties
      const [lon, lat] = f.geometry.coordinates
      return {
        id: `osm-${p.osm_type}${p.osm_id}`, name: p.name, lat, lon, elev: null,
        country: p.countrycode ?? null, region: p.state ?? null, kind: KIND[p.osm_value] ?? 'peak',
      }
    })
}

// GeoNames feature codes for mountains, peaks, volcanoes and hills.
const MOUNTAIN_CODES = new Set(['MT', 'MTS', 'PK', 'PKS', 'VLC', 'HLL'])

export function parseGeocodingPeaks(json) {
  if (!json) return null
  return (json.results ?? [])
    .filter(r => MOUNTAIN_CODES.has(r.feature_code) && typeof r.elevation === 'number')
    .map(r => ({
      id: `gn-${r.id}`, name: r.name, lat: r.latitude, lon: r.longitude, elev: Math.round(r.elevation),
      country: r.country_code ?? null, region: r.admin1 ?? null, kind: 'peak',
    }))
}

// Featured matches first (exact published heights), then the rest with
// heights filled in from `elevations` (aligned with `found`; null = the
// elevation service failed). A hit within 1 km of a featured peak is the same
// summit; a hit still without a height can't get a summit forecast.
export function mergePeaks(featured, found, elevations, limit = 10) {
  const withElev = found.map((p, i) => (p.elev != null ? p
    : { ...p, elev: typeof elevations?.[i] === 'number' ? Math.round(elevations[i]) : null }))
  const rest = withElev.filter(p => p.elev != null && !featured.some(f => haversineKm(f.lat, f.lon, p.lat, p.lon) < 1))
  return [...featured, ...rest].slice(0, limit)
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write `scripts/build-featured-peaks.mjs` and build the list**

```js
// Builds lib/hike/featured.json: hand-picked Alps peaks and huts with their
// published heights. Exact coordinates come from OpenStreetMap via Photon —
// the match nearest the rough hint, within 3 km. Re-run after editing LIST:
//   node scripts/build-featured-peaks.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { haversineKm } from '../lib/geo.js'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'hike', 'featured.json')
const UA = { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' }

// [id, display name, OSM search text, hint lat, hint lon, height m, country, kind, aka]
const LIST = [
  ['grossglockner', 'Großglockner', 'Großglockner', 47.0745, 12.6945, 3798, 'AT', 'peak', ['Grossglockner']],
  ['wildspitze', 'Wildspitze', 'Wildspitze', 46.885, 10.867, 3768, 'AT', 'peak'],
  ['grossvenediger', 'Großvenediger', 'Großvenediger', 47.109, 12.346, 3657, 'AT', 'peak', ['Grossvenediger']],
  ['olperer', 'Olperer', 'Olperer', 47.052, 11.662, 3476, 'AT', 'peak'],
  ['kitzsteinhorn', 'Kitzsteinhorn', 'Kitzsteinhorn', 47.188, 12.687, 3203, 'AT', 'peak'],
  ['hoher-dachstein', 'Hoher Dachstein', 'Hoher Dachstein', 47.475, 13.606, 2995, 'AT', 'peak', ['Dachstein']],
  ['hochkoenig', 'Hochkönig', 'Hochkönig', 47.420, 13.062, 2941, 'AT', 'peak', ['Hochkoenig']],
  ['hafelekarspitze', 'Hafelekarspitze (Nordkette)', 'Hafelekarspitze', 47.312, 11.386, 2334, 'AT', 'peak', ['Nordkette']],
  ['hochschwab', 'Hochschwab', 'Hochschwab', 47.618, 15.142, 2277, 'AT', 'peak'],
  ['patscherkofel', 'Patscherkofel', 'Patscherkofel', 47.209, 11.461, 2246, 'AT', 'peak'],
  ['schneeberg', 'Schneeberg (Klosterwappen)', 'Klosterwappen', 47.767, 15.807, 2076, 'AT', 'peak', ['Schneeberg']],
  ['rax', 'Rax (Heukuppe)', 'Heukuppe', 47.689, 15.689, 2007, 'AT', 'peak', ['Rax', 'Raxalpe']],
  ['oetscher', 'Ötscher', 'Ötscher', 47.863, 15.201, 1893, 'AT', 'peak', ['Oetscher']],
  ['schafberg', 'Schafberg', 'Schafberg', 47.776, 13.434, 1783, 'AT', 'peak'],
  ['traunstein', 'Traunstein', 'Traunstein', 47.873, 13.834, 1691, 'AT', 'peak'],
  ['erzherzog-johann-huette', 'Erzherzog-Johann-Hütte', 'Erzherzog-Johann-Hütte', 47.069, 12.697, 3454, 'AT', 'hut', ['Adlersruhe', 'Erzherzog Johann Huette']],
  ['schiestlhaus', 'Schiestlhaus', 'Schiestlhaus', 47.622, 15.148, 2153, 'AT', 'hut'],
  ['zugspitze', 'Zugspitze', 'Zugspitze', 47.421, 10.985, 2962, 'DE', 'peak'],
  ['watzmann', 'Watzmann (Mittelspitze)', 'Watzmann', 47.555, 12.922, 2713, 'DE', 'peak', ['Watzmann']],
  ['alpspitze', 'Alpspitze', 'Alpspitze', 47.414, 11.052, 2628, 'DE', 'peak'],
  ['wendelstein', 'Wendelstein', 'Wendelstein', 47.703, 12.012, 1838, 'DE', 'peak'],
  ['herzogstand', 'Herzogstand', 'Herzogstand', 47.614, 11.308, 1731, 'DE', 'peak'],
  ['dufourspitze', 'Dufourspitze (Monte Rosa)', 'Dufourspitze', 45.937, 7.867, 4634, 'CH', 'peak', ['Monte Rosa']],
  ['matterhorn', 'Matterhorn', 'Matterhorn', 45.976, 7.658, 4478, 'CH', 'peak', ['Cervino']],
  ['jungfrau', 'Jungfrau', 'Jungfrau', 46.537, 7.962, 4158, 'CH', 'peak'],
  ['piz-bernina', 'Piz Bernina', 'Piz Bernina', 46.382, 9.908, 4049, 'CH', 'peak'],
  ['eiger', 'Eiger', 'Eiger', 46.577, 8.005, 3967, 'CH', 'peak'],
  ['titlis', 'Titlis', 'Titlis', 46.772, 8.437, 3238, 'CH', 'peak'],
  ['saentis', 'Säntis', 'Säntis', 47.249, 9.343, 2502, 'CH', 'peak', ['Saentis']],
  ['pilatus', 'Pilatus (Tomlishorn)', 'Tomlishorn', 46.974, 8.253, 2128, 'CH', 'peak', ['Pilatus']],
  ['rigi', 'Rigi Kulm', 'Rigi Kulm', 47.056, 8.485, 1798, 'CH', 'peak', ['Rigi']],
  ['hoernlihuette', 'Hörnlihütte', 'Hörnlihütte', 45.982, 7.674, 3260, 'CH', 'hut', ['Hornlihutte', 'Hoernlihuette']],
  ['gran-paradiso', 'Gran Paradiso', 'Gran Paradiso', 45.518, 7.266, 4061, 'IT', 'peak'],
  ['ortler', 'Ortler', 'Ortler', 46.509, 10.545, 3905, 'IT', 'peak', ['Ortles']],
  ['marmolada', 'Marmolada (Punta Penia)', 'Punta Penia', 46.434, 11.851, 3343, 'IT', 'peak', ['Marmolada']],
  ['tre-cime', 'Drei Zinnen (Große Zinne)', 'Große Zinne', 46.619, 12.305, 2999, 'IT', 'peak', ['Tre Cime', 'Cima Grande', 'Drei Zinnen']],
  ['rifugio-auronzo', 'Rifugio Auronzo', 'Rifugio Auronzo', 46.612, 12.296, 2320, 'IT', 'hut'],
  ['mont-blanc', 'Mont Blanc', 'Mont Blanc', 45.833, 6.865, 4806, 'FR', 'peak', ['Monte Bianco']],
  ['aiguille-du-midi', 'Aiguille du Midi', 'Aiguille du Midi', 45.879, 6.887, 3842, 'FR', 'peak'],
  ['refuge-du-gouter', 'Refuge du Goûter', 'Refuge du Goûter', 45.851, 6.832, 3835, 'FR', 'hut', ['Gouter']],
  ['triglav', 'Triglav', 'Triglav', 46.378, 13.837, 2864, 'SI', 'peak'],
]

const r5 = v => Math.round(v * 1e5) / 1e5
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function resolve([id, name, query, lat, lon, elev, country, kind, aka]) {
  const tag = kind === 'hut' ? 'tourism:alpine_hut' : 'natural:peak'
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&osm_tag=${tag}&limit=10&lat=${lat}&lon=${lon}`, { headers: UA })
  const features = res.ok ? (await res.json()).features ?? [] : []
  const best = features
    .map(f => ({ lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }))
    .map(p => ({ ...p, km: haversineKm(lat, lon, p.lat, p.lon) }))
    .sort((a, b) => a.km - b.km)[0]
  const ok = best && best.km <= 3
  if (!ok) console.warn(`! ${id}: no OpenStreetMap match within 3 km — keeping the hint`)
  return { id, name, ...(aka ? { aka } : {}), lat: r5(ok ? best.lat : lat), lon: r5(ok ? best.lon : lon), elev, country, kind }
}

const out = []
for (const row of LIST) {
  out.push(await resolve(row))
  await sleep(300) // be fair to the public Photon instance
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')
console.log(`${out.length} featured peaks → ${path.relative(process.cwd(), OUT)}`)
```

Run: `node scripts/build-featured-peaks.mjs`
Expected: `41 featured peaks → lib/hike/featured.json`, with at most a few `!` warnings. For any warned entry, look the summit up on openstreetmap.org, correct its hint coordinates in `LIST`, and re-run until there are no warnings.

- [ ] **Step 6: Sanity-check the generated list**

Run: `node -e "const f=JSON.parse(require('fs').readFileSync('lib/hike/featured.json','utf8')); console.log(f.length, new Set(f.map(p=>p.id)).size, f.every(p=>p.lat>44&&p.lat<48.5&&p.lon>5&&p.lon<17&&p.elev>1000))"`
Expected: `41 41 true` (all unique, all inside the Alps box, all above 1000 m).

- [ ] **Step 7: Commit**

```bash
git add lib/hike/search.js lib/hike/search.test.js scripts/build-featured-peaks.mjs lib/hike/featured.json
git commit -m "Hike: peak search logic + 41 featured Alps peaks and huts"
git push origin main
```

---

### Task 8: `/api/peaks`, docs

**Files:**
- Create: `app/api/peaks/route.js`
- Modify: `README.md` (outlook section area — add a "Hiking engine" subsection after "The outlook — today, tomorrow, the week"), `CHANGELOG.md` (new `## 2026-09-30` section at the top)

**Interfaces:**
- Consumes: `parseSearchQuery` (Task 6); `matchFeatured`, `parsePhoton`, `parseGeocodingPeaks`, `mergePeaks`, `featured.json` (Task 7); `fetchPhotonRaw`, `fetchElevations`, `fetchGeocodingRaw` (Task 6).
- Produces: `GET /api/peaks?q=&lat=&lon=` → `{ peaks: Peak[] }` (max 10).

- [ ] **Step 1: Implement `app/api/peaks/route.js`**

```js
import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import featured from '@/lib/hike/featured.json'
import { parseSearchQuery } from '@/lib/hike/params'
import { matchFeatured, parsePhoton, parseGeocodingPeaks, mergePeaks } from '@/lib/hike/search'
import { fetchPhotonRaw, fetchElevations, fetchGeocodingRaw } from '@/lib/hike/sources'

// Worldwide peak & hut search: featured Alps peaks first, then OpenStreetMap
// (Photon) with heights from the elevation service; Open-Meteo geocoding when
// Photon is down. Cached per query for a day — peaks don't move.
export const maxDuration = 15

const limiter = createRateLimiter({ max: 60, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const GET = withErrorLog('peaks', async (request) => {
  const query = parseSearchQuery(new URL(request.url).searchParams)
  if (!query) return noStore({ error: 'Search needs 2–80 characters.' }, 400)
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)

  const feat = matchFeatured(query.q, featured)
  let found = parsePhoton(await fetchPhotonRaw(query.q, query.bias ?? {}))
  let elevations = found?.length ? await fetchElevations(found) : []
  if (!found) {
    found = parseGeocodingPeaks(await fetchGeocodingRaw(query.q))
    elevations = []
  }
  if (!found && !feat.length) return noStore({ error: 'Search is unavailable right now — try a featured peak.' }, 502)

  return Response.json({ peaks: mergePeaks(feat, found ?? [], elevations) }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
  })
})
```

- [ ] **Step 2: Verify against the real APIs**

Run: `npm run build`, then in the background `npx next start -p 3000`, then:

```bash
node -e "for (const q of ['Schneeberg', 'glockner', 'Ben Nevis', 'Schiestlhaus', 'x']) fetch('http://localhost:3000/api/peaks?q=' + encodeURIComponent(q) + '&lat=47.8&lon=15.8').then(async r => { const j = await r.json(); console.log(q.padEnd(12), r.status, r.headers.get('cache-control'), (j.peaks ?? []).slice(0, 4).map(p => p.name + ' ' + p.elev + 'm ' + (p.country ?? '')).join(' | ') || j.error) })"
```

Expected: `Schneeberg` → 200 with "Schneeberg (Klosterwappen) 2076m AT" first; `glockner` → "Großglockner 3798m AT" first; `Ben Nevis` → includes a GB result with a height; `Schiestlhaus` → the featured hut; `x` → 400 `no-store`. Stop the server afterwards.

- [ ] **Step 3: Document**

In `README.md`, after the "### The outlook — today, tomorrow, the week" subsection (before "### Backups"), add:

```markdown
### Hiking engine (for the app)

The mountain weather that will be exclusive to the MetaBlend app (see
`docs/superpowers/specs/2026-09-30-hiking-app-design.md`). `/api/hike`
downscales the outlook's models to a summit's height and adds what matters
up there: wind at the summit's pressure level (10 m model wind understates
ridges), the freezing level, an hourly thunderstorm risk from storm energy
(CAPE) and rain chance, and the **summit window** — the longest stretch of
daylight that is dry, storm-free, below 40 km/h wind and not brutally cold,
plus what ends it. Summits have no observations to learn from, so the blend
borrows the region's learned outlook weights. `/api/peaks` searches peaks and
huts worldwide (OpenStreetMap via Photon, heights from Open-Meteo's
elevation service, GeoNames as fallback) with 41 hand-picked Alps peaks
first (`lib/hike/featured.json`, built by `scripts/build-featured-peaks.mjs`).
Both answer from Vercel's CDN (30 min per peak, a day per search).
```

In `CHANGELOG.md`, directly under the intro paragraph, add:

```markdown
## 2026-09-30

### Added — hiking engine (phase 1 of the app)
- **`/api/hike`** — summit forecasts: the outlook's ~10 models downscaled to
  the peak's height; summit wind interpolated from the 850 / 700 / 600 hPa
  levels; freezing level (GFS / ICON, else from the summit temperature);
  hourly thunderstorm risk (CAPE + rain chance, lightning potential in
  Europe); the summit window for today and tomorrow and what ends it
  ("storms from 14:00"); 7 summit days. Weights borrowed from the region's
  outlook learning. CDN-cached per peak for 30 min.
- **`/api/peaks`** — worldwide peak and hut search (OpenStreetMap via Photon
  + elevation service, GeoNames fallback), 41 featured Alps peaks first,
  umlaut- and alias-tolerant ("glockner", "Raxalpe", "Oetscher").
- The outlook's daylight rule is shared (`inDaylight`) so best-time-out and
  the summit window agree on what daylight is.
```

- [ ] **Step 4: Full check**

Run: `npm test` then `npx eslint app lib`
Expected: all tests PASS, no lint output.

- [ ] **Step 5: Commit**

```bash
git add app/api/peaks/route.js README.md CHANGELOG.md
git commit -m "Hike: /api/peaks worldwide search + docs for the hiking engine"
git push origin main
```

- [ ] **Step 6: Verify in production**

After Vercel reports the deployment READY:

```bash
node -e "fetch('https://metablend.app/api/hike?lat=47.0745&lon=12.6945&elev=3798&name=Gro%C3%9Fglockner').then(async r => { const j = await r.json(); console.log(r.status, r.headers.get('x-vercel-cache'), j.hourly?.length, JSON.stringify(j.windows?.tomorrow)) })"
node -e "fetch('https://metablend.app/api/peaks?q=Schneeberg').then(async r => { const j = await r.json(); console.log(r.status, j.peaks?.[0]?.name) })"
```

Expected: `200 MISS 168 {…}` (a second run shows `HIT`), and `200 Schneeberg (Klosterwappen)`.
