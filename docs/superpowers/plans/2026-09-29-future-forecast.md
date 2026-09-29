# Future-focused forecast (Outlook) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn MetaBlend's page from "right now" into a 48 h / 7 days / 14 days outlook with a learning loop that scores every source by forecast range, served from a CDN cache so 1 or 1,000 viewers of a city cost the same upstream calls.

**Architecture:** A new language-neutral `/api/outlook` route fetches ~10 Open-Meteo models in one request plus regional national services and the ECMWF/GEFS ensembles, and hands everything to a pure `buildOutlook()` that blends, bands and headlines it. Predictions are snapshotted per source and verified daily against METAR history inside the existing cleanup cron; the verified deltas feed `outlook_weights` per region × range. The page gets a compact now line, three tabs, and folded sections; `/api/forecast` sheds everything the outlook now owns.

**Tech Stack:** Next.js 16 App Router (plain JS), React 19, Tailwind 4, Supabase Postgres (service role, RLS deny-all), `node --test`, Open-Meteo (forecast, ensemble, archive), NOAA AWC METAR, NWS, SMHI, Bright Sky (DWD MOSMIX), MET Norway (fallback).

**Spec:** `docs/superpowers/specs/2026-09-29-future-forecast-design.md`

## Global Constraints

- Plain JavaScript, no TypeScript. Files under `lib/` are ESM (`lib/package.json` has `"type": "module"`): relative imports inside `lib/` carry the `.js` extension; app code imports via `@/lib/...` without extension.
- Pure modules must not import `lib/supabase.js`, `lib/airports.json` or anything that reads env — `node --test` runs them without env vars or a bundler.
- Every user-visible string exists in all 5 languages (en, de, fr, es, it) in `lib/i18n.js`.
- Rain probability is `null` when no source said anything about rain — never a fabricated 0.
- City-local times are strings (`'YYYY-MM-DDTHH:MM'`, `'YYYY-MM-DD'`) exactly as delivered; never re-interpreted in the viewer's or server's timezone. Calendar dates are formatted with `formatCalendarDate` (UTC).
- Success responses of `/api/outlook`: `Cache-Control: public, s-maxage=1800, stale-while-revalidate=3600`; of `/api/forecast`: `s-maxage=900, stale-while-revalidate=1800`. Every error response: `Cache-Control: no-store`.
- Snapshot checkpoints are marked verified **before** their deltas are applied.
- Comment style: terse "why" comments, like the surrounding code. Changelog entry for user-visible changes.
- Commits go to `main` (owner's standing preference), ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Half-hour UTC offsets (India +5:30, Newfoundland −3:30)** — hourly checkpoints must line up with the city's `…:30` timestamps rather than silently finding none → test in Task 7 (`hourlyCheckpoints — half-hour offsets`).
2. **Cities with no airport within 60 km / no climate archive** — the outlook must still render (no 14-day headline, no records) and verification must expire their checkpoints instead of retrying forever → tests in Task 6 (`buildOutlook — no climate`) and Task 9 (`nearestStations — nothing in range`, `dueItems — stale`).
3. **Open-Meteo down** — fall back to MET Norway + national services with a visible note; nothing at all → 502 `no-store`, not a cached empty page → tests in Task 6 (`no Open-Meteo`, `MET Norway steps in`) and the Task 8 route check.
4. **°F users** — headlines, charts and spans must convert (spans/deltas scale-only, no +32) → test in Task 5 (`7 days, with °F`).
5. **No rain information at all** — every rain field null, headline says "no rain data", not "dry" → tests in Task 3 (`silence stays null`) and Task 5 (`no_rain_data`).

## File Structure

New (pure, tested): `lib/geo.js`, `lib/ratelimit.js`, `lib/sources.js`, `lib/outlook/models.js`, `lib/outlook/parse.js`, `lib/outlook/national.js` (parsers pure; fetchers network), `lib/outlook/blend.js`, `lib/outlook/ensemble.js`, `lib/outlook/climate.js`, `lib/outlook/headlines.js`, `lib/outlook/text.js`, `lib/outlook/checkpoints.js`, `lib/outlook/verify.js`, `lib/outlook/build.js`, fixtures in `lib/outlook/__fixtures__/`.
New (network/DB): `lib/outlook/http.js`, `lib/outlook/sources.js`, `lib/outlook/weights.js`, `lib/outlook/snapshots.js`, `lib/outlook/job.js`, `app/api/outlook/route.js`, `scripts/record-outlook-fixtures.mjs`.
New (UI): `app/components/ui.jsx`, `app/components/outlook/{icons.js,useWidth.js,Headline.jsx,HourlyChart.jsx,HourStrip.jsx,TrendChart.jsx,Notes.jsx,Status.jsx,RangeTabs.jsx,NowLine.jsx,Tab48h.jsx,Tab7d.jsx,Tab14d.jsx,Records.jsx,SourcesPanel.jsx,FeedbackPanel.jsx}`.
Modified: `lib/localtime.js`, `lib/scoring.js`, `lib/log.js`, `lib/weather.js`, `lib/i18n.js`, `app/api/forecast/route.js`, `app/api/station-calibrate/route.js`, `app/api/cleanup/route.js`, `app/api/backup/route.js`, `app/api/leaderboard/route.js`, `app/page.js`, `app/components/RainRadar.jsx`, `app/weather/[city]/page.js`, `app/leaderboard/page.js`, `app/privacy/content.jsx`, `supabase/setup_all.sql`, `supabase/enable_rls.sql`, `README.md`, `CHANGELOG.md`.

Code blocks whose info string carries `path=…` are complete file contents.

---

### Task 1: Shared foundations

**Files:**
- Modify: `lib/localtime.js`, `lib/localtime.test.js`, `lib/scoring.js`, `lib/scoring.test.js`, `lib/log.js`, `app/api/station-calibrate/route.js`, `app/api/forecast/route.js`
- Create: `lib/geo.js`, `lib/geo.test.js`, `lib/sources.js`, `lib/sources.test.js`, `lib/ratelimit.js`, `lib/ratelimit.test.js`

**Interfaces:**
- Produces: `addDays(dateStr, n) → 'YYYY-MM-DD'`, `addHours(localIso, n) → 'YYYY-MM-DDTHH:MM'`, `localHourIso(utcOffsetSec, now) → 'YYYY-MM-DDTHH:00'` (lib/localtime.js); scoring schemes `'lead_h48' | 'lead_d7' | 'lead_d14' | 'rain'` for `deltaFromDiff`; `haversineKm(lat1, lon1, lat2, lon2) → km`; `SOURCE_NAMES`, `sourceName(id)`; `createRateLimiter({ max, windowMs }) → { limited(key, now?) → boolean }`.

- [ ] **Step 1: Write the failing tests**

Append to `lib/localtime.test.js` (and add `addDays, addHours, localHourIso` to its import):

```js
test('addDays — crosses month and year ends in plain calendar terms', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  assert.equal(addDays('2028-02-28', 1), '2028-02-29')
})

test('addHours — local wall-clock strings, no timezone leaks', () => {
  assert.equal(addHours('2026-09-29T23:00', 2), '2026-09-30T01:00')
  assert.equal(addHours('2026-09-29T19:30', 1), '2026-09-29T20:30')
})

test('localHourIso — city-local hour from a real UTC offset', () => {
  const t = Date.parse('2026-09-29T13:45:00Z')
  assert.equal(localHourIso(7200, t), '2026-09-29T15:00')
  assert.equal(localHourIso(-36000, t), '2026-09-29T03:00')
  assert.equal(localHourIso(19800, t), '2026-09-29T19:00') // +5:30 → 19:15, floored to the hour
})
```

Append to `lib/scoring.test.js`:

```js
test('deltaFromDiff — lead-time schemes widen with range', () => {
  assert.equal(deltaFromDiff(1.5, 'lead_h48'), 2)
  assert.equal(deltaFromDiff(3, 'lead_h48'), 1)
  assert.equal(deltaFromDiff(5, 'lead_h48'), 0)
  assert.equal(deltaFromDiff(7.5, 'lead_h48'), -2)
  assert.equal(deltaFromDiff(3.5, 'lead_d7'), 1)
  assert.equal(deltaFromDiff(3, 'lead_d14'), 2)
  assert.equal(deltaFromDiff(9, 'lead_d14'), -1)
})

test('deltaFromDiff — rain scheme scores Brier values (lower is better)', () => {
  assert.equal(deltaFromDiff(0.01, 'rain'), 2)
  assert.equal(deltaFromDiff(0.1, 'rain'), 1)
  assert.equal(deltaFromDiff(0.3, 'rain'), 0)
  assert.equal(deltaFromDiff(0.5, 'rain'), -1)
  assert.equal(deltaFromDiff(0.81, 'rain'), -2)
})
```

```js path=lib/geo.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { haversineKm } from './geo.js'

test('haversineKm — Vienna to Munich is about 355 km', () => {
  const km = haversineKm(48.21, 16.37, 48.14, 11.58)
  assert.ok(km > 350 && km < 360, String(km))
  assert.equal(haversineKm(10, 10, 10, 10), 0)
})
```

```js path=lib/sources.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sourceName } from './sources.js'

test('sourceName — known ids get display names, unknown ids pass through', () => {
  assert.equal(sourceName('ecmwf'), 'ECMWF IFS')
  assert.equal(sourceName('metno-nordic'), 'MET Nordic')
  assert.equal(sourceName('open-meteo'), 'Open-Meteo')
  assert.equal(sourceName('mystery'), 'mystery')
})
```

```js path=lib/ratelimit.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRateLimiter } from './ratelimit.js'

test('createRateLimiter — allows max hits per window per key, then limits', () => {
  const rl = createRateLimiter({ max: 2, windowMs: 1000 })
  assert.equal(rl.limited('a', 0), false)
  assert.equal(rl.limited('a', 10), false)
  assert.equal(rl.limited('a', 20), true)
  assert.equal(rl.limited('b', 20), false)
  assert.equal(rl.limited('a', 1001), false) // window over → fresh count
})
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test lib/localtime.test.js lib/scoring.test.js lib/geo.test.js lib/sources.test.js lib/ratelimit.test.js`
Expected: FAIL — `addDays` not exported, schemes fall back to `instant` (wrong deltas), modules not found.

- [ ] **Step 3: Implement**

Append to `lib/localtime.js`:

```js
// Calendar arithmetic on city-local date / hour strings, done in UTC so the
// server's and the viewer's timezones never leak in.
export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function addHours(localIso, n) {
  return new Date(Date.parse(`${localIso}:00Z`) + n * 3600e3).toISOString().slice(0, 16)
}

// The city's wall-clock hour right now, from its real UTC offset (the one
// Open-Meteo reports) rather than the solar estimate above.
export function localHourIso(utcOffsetSec, now = Date.now()) {
  return new Date(now + utcOffsetSec * 1000).toISOString().slice(0, 13) + ':00'
}
```

In `lib/scoring.js` extend `SCHEMES` and its comment:

```js
//  • 'lead_h48' / 'lead_d7' / 'lead_d14' — outlook checkpoints verified once
//    their time has come; tolerances widen with range (2 ° off is decent for
//    tomorrow, excellent for 10 days out).
//  • 'rain' — Brier score (p − outcome)² of a rain call, lower is better.
const SCHEMES = {
  instant:  [1, 2, 4, 6],
  daily:    [2, 4, 6, 8],
  wind:     [3, 8, 15, 25],
  lead_h48: [1.5, 3, 5, 7],
  lead_d7:  [2, 3.5, 5.5, 8],
  lead_d14: [3, 5, 7, 10],
  rain:     [0.05, 0.15, 0.35, 0.6],
}
```

```js path=lib/geo.js
// Great-circle distance in km (mean Earth radius).
export function haversineKm(lat1, lon1, lat2, lon2) {
  const rad = d => (d * Math.PI) / 180
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(a))
}
```

```js path=lib/sources.js
// Display names for every source id — the live ("right now") sources and the
// outlook's models alike. One list, so the forecast route, the outlook and the
// leaderboard can't drift apart again.
export const SOURCE_NAMES = {
  'open-meteo': 'Open-Meteo',
  owm: 'OpenWeatherMap',
  weatherapi: 'WeatherAPI',
  tomorrow: 'Tomorrow.io',
  'met-norway': 'MET Norway',
  'visual-crossing': 'Visual Crossing',
  'world-weather-online': 'World Weather Online',
  weatherstack: 'Weatherstack',
  'nasa-power': 'NASA POWER',
  geosphere: 'GeoSphere Austria',
  ecmwf: 'ECMWF IFS',
  gfs: 'NOAA GFS',
  icon: 'DWD ICON',
  nws: 'NWS (US)',
  brightsky: 'DWD Bright Sky',
  smhi: 'SMHI (Nordics)',
  metablend: 'MetaBlend Local',
  ukmo: 'UK Met Office',
  gem: 'Canada GEM',
  jma: 'JMA (Japan)',
  meteofrance: 'Météo-France',
  knmi: 'KNMI HARMONIE',
  dmi: 'DMI HARMONIE',
  'metno-nordic': 'MET Nordic',
}

export const sourceName = id => SOURCE_NAMES[id] ?? id
```

```js path=lib/ratelimit.js
// In-memory, per-instance request throttle — best-effort (resets on cold
// start). CDN cache hits never reach a function, so it only ever counts the
// expensive cache misses.
export function createRateLimiter({ max, windowMs, sweepAt = 1000 }) {
  const hits = new Map()
  return {
    limited(key, now = Date.now()) {
      const e = hits.get(key)
      if (!e || now > e.resetAt) {
        // occasionally sweep expired keys so the map doesn't grow unbounded
        if (hits.size > sweepAt) {
          for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k)
        }
        hits.set(key, { count: 1, resetAt: now + windowMs })
        return false
      }
      e.count += 1
      return e.count > max
    },
  }
}
```

In `lib/log.js`, the `withErrorLog` 500 response gets `headers: { 'Cache-Control': 'no-store' }` (an outage must never be cached by the CDN).

In `app/api/station-calibrate/route.js` delete the local `haversineKm` and `import { haversineKm } from '@/lib/geo'`.

In `app/api/forecast/route.js` replace the local `RATE`/`forecastRateLimited` block with:

```js
import { createRateLimiter } from '@/lib/ratelimit'
// Per-IP throttle on the expensive (cache-miss) path so nobody can drain the
// metered upstream weather APIs by spamming distinct cities.
const limiter = createRateLimiter({ max: 40, windowMs: 60 * 1000 })
```
and call `limiter.limited(clientIp(request))`; replace its `DISPLAY_NAMES` map with `sourceName` from `@/lib/sources`.

- [ ] **Step 4: Run the full suite**

Run: `npm test` then `npx eslint .`
Expected: all pass, lint clean.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "Outlook groundwork: local date/hour arithmetic, lead-time + rain scoring schemes, shared geo/source names/rate limiter, errors never cached"`

---

### Task 2: Parsing the outlook sources

**Files:**
- Create: `scripts/record-outlook-fixtures.mjs`, `lib/outlook/__fixtures__/*.json` (recorded), `lib/outlook/models.js`, `lib/outlook/parse.js`, `lib/outlook/parse.test.js`, `lib/outlook/http.js`, `lib/outlook/national.js`, `lib/outlook/national.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - Series shape used by every later task: `{ id, hourly: [{ t, temp, pop, precip, wind, code }], daily: [{ date, max, min, pop, precip, wind, code }] }` — `t` city-local `'YYYY-MM-DDTHH:MM'`, `pop` 0–100 or null, `precip` mm or null, `wind` km/h or null, `code` WMO or null.
  - `OM_MODELS: [{ id, model }]`, `BOXES`, `inBox(box, lat, lon)` (models.js)
  - `parseOpenMeteoMulti(json, models?) → { utcOffsetSec, series, sun: { sunrise, sunset } } | null`, `dailyFromHourly(hourly, minSamples = 20)` (parse.js)
  - `parseNws(json)`, `parseSmhi(json, utcOffsetSec)`, `parseBrightSky(json, utcOffsetSec)`, `parseMetNorway(json, utcOffsetSec)` → series | null; `parseNational(raw, utcOffsetSec) → series[]`; `fetchNationalRaw(lat, lon) → { nws?, smhi?, brightsky? }`; `fetchMetNorwayRaw(lat, lon)` (national.js)
  - `getJson(url, { headers, ms, ...init }) → json | null` (http.js)

- [ ] **Step 1: Record real fixtures**

```js path=scripts/record-outlook-fixtures.mjs
// Records trimmed real API responses into lib/outlook/__fixtures__/ for the
// outlook parser tests. Re-run when an upstream format changes:
//   node scripts/record-outlook-fixtures.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'outlook', '__fixtures__')
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

const MODELS = 'ecmwf_ifs025,gfs_seamless,icon_seamless,ukmo_global_deterministic_10km,gem_seamless,jma_seamless,meteofrance_seamless,knmi_harmonie_arome_europe,dmi_harmonie_arome_europe,metno_nordic'
const HOURLY = 'temperature_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code'
const DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code,sunrise,sunset'
save('om-multi-vienna.json', await get(`https://api.open-meteo.com/v1/forecast?latitude=48.21&longitude=16.37&hourly=${HOURLY}&daily=${DAILY}&models=${MODELS}&forecast_days=3&timezone=auto`))

const pts = await get('https://api.weather.gov/points/41.8800,-87.6300')
const nws = await get(pts.properties.forecastHourly)
save('nws-chicago.json', { properties: { periods: nws.properties.periods.slice(0, 72) } })

const smhi = await get('https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/18.0700/lat/59.3300/data.json')
save('smhi-stockholm.json', { timeSeries: smhi.timeSeries.slice(0, 80) })

const today = new Date().toISOString().slice(0, 10)
const last = new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10)
const bs = await get(`https://api.brightsky.dev/weather?lat=52.52&lon=13.40&date=${today}&last_date=${last}`)
save('brightsky-berlin.json', { weather: bs.weather.slice(0, 96), sources: bs.sources })

const met = await get('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=59.9100&lon=10.7500')
save('metno-oslo.json', { properties: { timeseries: met.properties.timeseries.slice(0, 90) } })
```

Run: `node scripts/record-outlook-fixtures.mjs` — expect five files, each well under 100 kB. Inspect one SMHI entry (`timeSeries[0].data`) and one Bright Sky record to confirm the field names used below (`air_temperature`, `probability_of_precipitation`, `precipitation_amount_mean`, `wind_speed`; `temperature`, `precipitation`, `precipitation_probability`, `wind_speed`, `source_id`); adjust the parser field names if the recorded data differs.

- [ ] **Step 2: Write the failing tests**

```js path=lib/outlook/parse.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseOpenMeteoMulti, dailyFromHourly } from './parse.js'
import { OM_MODELS, BOXES, inBox } from './models.js'

const hoursOf = (date, n) =>
  Array.from({ length: n }, (_, i) => new Date(Date.parse(`${date}T00:00:00Z`) + i * 3600e3).toISOString().slice(0, 16))

const MODELS = [{ id: 'a', model: 'aaa' }, { id: 'b', model: 'bbb' }]
function synthetic() {
  const time = hoursOf('2026-09-29', 48)
  return {
    utc_offset_seconds: 7200,
    hourly: {
      time,
      temperature_2m_aaa: time.map((_, i) => 10 + i / 10),
      precipitation_probability_aaa: time.map(() => 30),
      precipitation_aaa: time.map(() => 0.2),
      wind_speed_10m_aaa: time.map(() => 12),
      weather_code_aaa: time.map(() => 61),
      temperature_2m_bbb: time.map((_, i) => (i < 30 ? 11 : null)), // model ends 6 h into day 2
    },
    daily: {
      time: ['2026-09-29', '2026-09-30'],
      temperature_2m_max_aaa: [20, 22], temperature_2m_min_aaa: [10, 11],
      precipitation_sum_aaa: [1.2, 0], precipitation_probability_max_aaa: [60, 10],
      wind_speed_10m_max_aaa: [25, 18], weather_code_aaa: [61, 1],
      temperature_2m_max_bbb: [19, 21], temperature_2m_min_bbb: [9, 12],
      sunrise: ['2026-09-29T07:01', '2026-09-30T07:03'],
      sunset: ['2026-09-29T18:40', '2026-09-30T18:38'],
    },
  }
}

test('parseOpenMeteoMulti — one series per model with hourly and daily points', () => {
  const r = parseOpenMeteoMulti(synthetic(), MODELS)
  assert.equal(r.utcOffsetSec, 7200)
  const a = r.series.find(s => s.id === 'a')
  assert.equal(a.hourly.length, 48)
  assert.deepEqual(a.hourly[0], { t: '2026-09-29T00:00', temp: 10, pop: 30, precip: 0.2, wind: 12, code: 61 })
  assert.deepEqual(a.daily[0], { date: '2026-09-29', max: 20, min: 10, pop: 60, precip: 1.2, wind: 25, code: 61 })
  assert.equal(a.daily.length, 2)
})

test('parseOpenMeteoMulti — a day the model only partly covers gets no daily value', () => {
  const b = parseOpenMeteoMulti(synthetic(), MODELS).series.find(s => s.id === 'b')
  assert.equal(b.hourly.length, 30)
  assert.deepEqual(b.daily.map(d => d.date), ['2026-09-29'])
  assert.equal(b.hourly[0].pop, null) // no probability column → null, never 0
})

test('parseOpenMeteoMulti — sunrise/sunset with or without a model suffix', () => {
  assert.deepEqual(parseOpenMeteoMulti(synthetic(), MODELS).sun, { sunrise: '07:01', sunset: '18:40' })
  const j = synthetic()
  j.daily.sunrise_aaa = j.daily.sunrise
  j.daily.sunset_aaa = j.daily.sunset
  delete j.daily.sunrise
  delete j.daily.sunset
  assert.deepEqual(parseOpenMeteoMulti(j, MODELS).sun, { sunrise: '07:01', sunset: '18:40' })
})

test('parseOpenMeteoMulti — missing models are skipped; garbage returns null', () => {
  assert.equal(parseOpenMeteoMulti(synthetic(), [{ id: 'x', model: 'nope' }]).series.length, 0)
  assert.equal(parseOpenMeteoMulti(null), null)
  assert.equal(parseOpenMeteoMulti({ hourly: {} }), null)
})

test('parseOpenMeteoMulti — real recorded response (Vienna) parses into sane series', () => {
  const fx = JSON.parse(readFileSync(new URL('./__fixtures__/om-multi-vienna.json', import.meta.url)))
  const ids = parseOpenMeteoMulti(fx, OM_MODELS).series.map(s => s.id)
  for (const id of ['ecmwf', 'gfs', 'icon', 'knmi']) assert.ok(ids.includes(id), id)
  assert.ok(!ids.includes('metno-nordic'), 'MET Nordic does not cover Vienna')
  for (const s of parseOpenMeteoMulti(fx, OM_MODELS).series) {
    for (const p of s.hourly) {
      assert.match(p.t, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
      assert.ok(p.temp > -60 && p.temp < 60)
    }
  }
})

test('dailyFromHourly — needs enough samples per day', () => {
  const hourly = hoursOf('2026-09-29', 30).map((t, i) => ({ t, temp: i, pop: i === 3 ? 70 : null, precip: 0.5, wind: i, code: null }))
  assert.deepEqual(dailyFromHourly(hourly), [{ date: '2026-09-29', max: 23, min: 0, pop: 70, precip: 12, wind: 23, code: null }])
  assert.equal(dailyFromHourly(hourly, 6).length, 2)
})

test('inBox — coverage boxes of the national services', () => {
  assert.equal(inBox(BOXES.germany, 52.52, 13.4), true)
  assert.equal(inBox(BOXES.germany, 48.21, 16.37), false) // Vienna is outside DWD MOSMIX via Bright Sky
  assert.equal(inBox(BOXES.nordic, 59.33, 18.07), true)
  assert.equal(inBox(BOXES.conus, 41.88, -87.63), true)
})
```

```js path=lib/outlook/national.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseNws, parseSmhi, parseBrightSky, parseMetNorway, parseNational } from './national.js'

const fx = name => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)))

function assertSeries(s, id) {
  assert.equal(s.id, id)
  assert.ok(s.hourly.length > 20, `${id}: ${s.hourly.length} hourly points`)
  for (const p of s.hourly) {
    assert.match(p.t, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    assert.ok(p.temp > -60 && p.temp < 60, `${id} temp ${p.temp}`)
    assert.ok(p.pop == null || (p.pop >= 0 && p.pop <= 100), `${id} pop ${p.pop}`)
  }
  assert.equal(new Set(s.hourly.map(p => p.t)).size, s.hourly.length, `${id}: duplicate hours`)
  assert.equal(new Set(s.daily.map(d => d.date)).size, s.daily.length)
  for (const d of s.daily) assert.ok(d.max >= d.min)
}

test('parseNws — hourly periods in the gridpoint’s own local time', () => {
  const s = parseNws(fx('nws-chicago.json'))
  assertSeries(s, 'nws')
  assert.ok(s.hourly.some(p => p.pop != null))
})

test('parseSmhi — UTC steps shifted into city-local time', () => {
  assertSeries(parseSmhi(fx('smhi-stockholm.json'), 7200), 'smhi')
})

test('parseBrightSky — MOSMIX forecast records only', () => {
  assertSeries(parseBrightSky(fx('brightsky-berlin.json'), 7200), 'brightsky')
})

test('parseMetNorway — fallback series keeps coarse days (≥ 4 samples)', () => {
  const s = parseMetNorway(fx('metno-oslo.json'), 7200)
  assertSeries(s, 'met-norway')
  assert.ok(s.daily.length >= 2)
})

test('national parsers return null on garbage', () => {
  for (const f of [parseNws, parseSmhi, parseBrightSky, parseMetNorway]) assert.equal(f(null, 0), null)
})

test('parseNational — only the services that answered', () => {
  assert.deepEqual(parseNational({}, 0), [])
  assert.deepEqual(parseNational({ nws: fx('nws-chicago.json'), smhi: null }, 0).map(s => s.id), ['nws'])
})
```

- [ ] **Step 3: Run to see them fail**

Run: `node --test lib/outlook/`
Expected: FAIL — `Cannot find module './parse.js'` / `'./national.js'`.

- [ ] **Step 4: Implement**

```js path=lib/outlook/models.js
// The outlook's source registry. Ranges and domains measured 2026-09-29 (see
// the spec): the *pure* regional models are used on purpose — their
// *_seamless variants quietly continue as ECMWF-derived copies of each other
// after ~2 days, which would fake agreement. Pure models simply stop.
export const OM_MODELS = [
  { id: 'ecmwf', model: 'ecmwf_ifs025' },
  { id: 'gfs', model: 'gfs_seamless' },
  { id: 'icon', model: 'icon_seamless' },
  { id: 'ukmo', model: 'ukmo_global_deterministic_10km' },
  { id: 'gem', model: 'gem_seamless' },
  { id: 'jma', model: 'jma_seamless' },
  { id: 'meteofrance', model: 'meteofrance_seamless' },
  { id: 'knmi', model: 'knmi_harmonie_arome_europe' },
  { id: 'dmi', model: 'dmi_harmonie_arome_europe' },
  { id: 'metno-nordic', model: 'metno_nordic' },
]

// Coverage of the national services (same boxes as the live fetchers).
export const BOXES = {
  conus: { latMin: 24.5, latMax: 49.5, lonMin: -125, lonMax: -66.5 }, // NWS
  nordic: { latMin: 52.5, latMax: 70.7, lonMin: 2.5, lonMax: 33 }, // SMHI
  germany: { latMin: 47, latMax: 55.2, lonMin: 5.5, lonMax: 15.5 }, // DWD MOSMIX via Bright Sky
}

export const inBox = (b, lat, lon) => lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax
```

```js path=lib/outlook/parse.js
// Pure parsers for the outlook's Open-Meteo multi-model response, plus the
// hourly → daily aggregation the national services need. Every series has
// the same shape:
//   { id, hourly: [{ t, temp, pop, precip, wind, code }],
//         daily:  [{ date, max, min, pop, precip, wind, code }] }
// t is the CITY-local hour 'YYYY-MM-DDTHH:MM', date the city-local day.

import { OM_MODELS } from './models.js'

export const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const r1 = v => Math.round(v * 10) / 10

// Daily values from hourly points — only for days with enough of them: a day
// seen for 6 hours at the edge of a range must not report its "maximum".
export function dailyFromHourly(hourly, minSamples = 20) {
  const byDate = new Map()
  for (const p of hourly) {
    const date = p.t.slice(0, 10)
    let e = byDate.get(date)
    if (!e) byDate.set(date, (e = { date, temps: [], pops: [], precip: 0, precipN: 0, winds: [] }))
    e.temps.push(p.temp)
    if (p.pop != null) e.pops.push(p.pop)
    if (p.precip != null) { e.precip += p.precip; e.precipN++ }
    if (p.wind != null) e.winds.push(p.wind)
  }
  return [...byDate.values()]
    .filter(e => e.temps.length >= minSamples)
    .map(e => ({
      date: e.date,
      max: Math.max(...e.temps),
      min: Math.min(...e.temps),
      pop: e.pops.length ? Math.max(...e.pops) : null,
      precip: e.precipN ? r1(e.precip) : null,
      wind: e.winds.length ? Math.max(...e.winds) : null,
      code: null,
    }))
}

export function parseOpenMeteoMulti(json, models = OM_MODELS) {
  const h = json?.hourly, d = json?.daily
  if (!Array.isArray(h?.time) || !Array.isArray(d?.time)) return null
  const series = []
  for (const { id, model } of models) {
    const hv = name => h[`${name}_${model}`]
    const dv = name => d[`${name}_${model}`]
    const temps = hv('temperature_2m')
    if (!Array.isArray(temps)) continue
    const hourly = []
    h.time.forEach((t, i) => {
      const temp = num(temps[i])
      if (temp == null) return
      hourly.push({
        t, temp,
        pop: num(hv('precipitation_probability')?.[i]),
        precip: num(hv('precipitation')?.[i]),
        wind: num(hv('wind_speed_10m')?.[i]),
        code: num(hv('weather_code')?.[i]),
      })
    })
    // the API's daily block also fills edge days from a few hours — only
    // trust it where the model covered (nearly) the whole local day
    const covered = new Map()
    for (const p of hourly) covered.set(p.t.slice(0, 10), (covered.get(p.t.slice(0, 10)) ?? 0) + 1)
    const daily = []
    d.time.forEach((date, i) => {
      const max = num(dv('temperature_2m_max')?.[i]), min = num(dv('temperature_2m_min')?.[i])
      if (max == null || min == null || (covered.get(date) ?? 0) < 20) return
      daily.push({
        date, max, min,
        pop: num(dv('precipitation_probability_max')?.[i]),
        precip: num(dv('precipitation_sum')?.[i]),
        wind: num(dv('wind_speed_10m_max')?.[i]),
        code: num(dv('weather_code')?.[i]),
      })
    })
    if (hourly.length) series.push({ id, hourly, daily })
  }
  // sunrise/sunset come back unsuffixed or once per model, depending on version
  const sunCol = k => d[k] ?? Object.entries(d).find(([key]) => key.startsWith(`${k}_`))?.[1]
  const hm = v => (typeof v === 'string' ? v.slice(11, 16) : null)
  return {
    utcOffsetSec: num(json.utc_offset_seconds) ?? 0,
    series,
    sun: { sunrise: hm(sunCol('sunrise')?.[0]), sunset: hm(sunCol('sunset')?.[0]) },
  }
}
```

```js path=lib/outlook/http.js
const UA = { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' }

// JSON GET that never throws: null on timeout, non-2xx or bad JSON — a
// missing source drops out of the blend instead of taking the outlook down.
export async function getJson(url, { headers, ms = 10000, ...init } = {}) {
  try {
    const res = await fetch(url, { ...init, headers: { ...UA, ...headers }, signal: AbortSignal.timeout(ms) })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}
```

```js path=lib/outlook/national.js
// National forecast services for the outlook. Independence was measured
// against the Open-Meteo models (spec §3): NWS, SMHI and DWD MOSMIX (Bright
// Sky) add real information; MET Norway's locationforecast duplicates MET
// Nordic / ECMWF and is only the fallback when Open-Meteo is down.
// Parsers are pure (fixture-tested); fetchers never throw.

import { getJson } from './http.js'
import { BOXES, inBox } from './models.js'
import { dailyFromHourly, num } from './parse.js'

// UTC instant → the city's wall-clock hour string
export const toLocalHour = (utcMs, utcOffsetSec) =>
  new Date(utcMs + utcOffsetSec * 1000).toISOString().slice(0, 13) + ':00'
const kmh = ms => (typeof ms === 'number' ? Math.round(ms * 3.6) : null)

// Keep the first point per hour (national feeds occasionally repeat a step).
function uniqueHours(points) {
  const seen = new Set()
  return points.filter(p => (seen.has(p.t) ? false : seen.add(p.t)))
}

export function parseNws(json) {
  const periods = json?.properties?.periods
  if (!Array.isArray(periods)) return null
  const hourly = uniqueHours(periods
    .filter(p => typeof p.temperature === 'number' && typeof p.startTime === 'string')
    .map(p => {
      const c = p.temperatureUnit === 'F' ? (p.temperature - 32) * 5 / 9 : p.temperature
      return {
        // startTime carries the gridpoint's own local offset → already city-local
        t: p.startTime.slice(0, 13) + ':00',
        temp: Math.round(c * 10) / 10,
        pop: num(p.probabilityOfPrecipitation?.value),
        precip: null,
        wind: Math.round((parseFloat(p.windSpeed) || 0) * 1.60934), // "12 mph" / "10 to 15 mph"
        code: null,
      }
    }))
  return hourly.length ? { id: 'nws', hourly, daily: dailyFromHourly(hourly) } : null
}

export function parseSmhi(json, utcOffsetSec) {
  const ts = json?.timeSeries
  if (!Array.isArray(ts)) return null
  const hourly = uniqueHours(ts
    .map(e => ({ ms: Date.parse(e.time ?? e.validTime), d: e.data ?? {} }))
    .filter(({ ms, d }) => Number.isFinite(ms) && typeof d.air_temperature === 'number')
    .map(({ ms, d }) => ({
      t: toLocalHour(ms, utcOffsetSec),
      temp: d.air_temperature,
      pop: num(d.probability_of_precipitation),
      precip: num(d.precipitation_amount_mean),
      wind: kmh(d.wind_speed),
      code: null,
    })))
  return hourly.length ? { id: 'smhi', hourly, daily: dailyFromHourly(hourly) } : null
}

export function parseBrightSky(json, utcOffsetSec) {
  if (!Array.isArray(json?.weather)) return null
  const type = new Map((json.sources ?? []).map(s => [s.id, s.observation_type]))
  const hourly = uniqueHours(json.weather
    .filter(w => type.get(w.source_id) === 'forecast' && typeof w.temperature === 'number')
    .map(w => ({
      t: toLocalHour(Date.parse(w.timestamp), utcOffsetSec),
      temp: w.temperature,
      pop: num(w.precipitation_probability),
      precip: num(w.precipitation),
      wind: typeof w.wind_speed === 'number' ? Math.round(w.wind_speed) : null, // already km/h
      code: null,
    })))
  return hourly.length ? { id: 'brightsky', hourly, daily: dailyFromHourly(hourly) } : null
}

export function parseMetNorway(json, utcOffsetSec) {
  const ts = json?.properties?.timeseries
  if (!Array.isArray(ts)) return null
  const hourly = uniqueHours(ts
    .filter(e => typeof e.data?.instant?.details?.air_temperature === 'number')
    .map(e => ({
      t: toLocalHour(Date.parse(e.time), utcOffsetSec),
      temp: e.data.instant.details.air_temperature,
      pop: num(e.data.next_1_hours?.details?.probability_of_precipitation),
      precip: num(e.data.next_1_hours?.details?.precipitation_amount),
      wind: kmh(e.data.instant.details.wind_speed),
      code: null,
    })))
  // fallback only: its 6-hourly tail still yields coarse days (≥ 4 samples)
  return hourly.length ? { id: 'met-norway', hourly, daily: dailyFromHourly(hourly, 4) } : null
}

export function parseNational(raw, utcOffsetSec) {
  return [
    raw?.nws && parseNws(raw.nws),
    raw?.smhi && parseSmhi(raw.smhi, utcOffsetSec),
    raw?.brightsky && parseBrightSky(raw.brightsky, utcOffsetSec),
  ].filter(Boolean)
}

// Raw JSON of every national service that covers the point (parsed later,
// once the city's UTC offset is known from the Open-Meteo response).
export async function fetchNationalRaw(lat, lon) {
  const jobs = {}
  if (inBox(BOXES.conus, lat, lon)) {
    jobs.nws = getJson(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`)
      .then(p => (p?.properties?.forecastHourly ? getJson(p.properties.forecastHourly) : null))
  }
  if (inBox(BOXES.nordic, lat, lon)) {
    jobs.smhi = getJson(`https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${lon.toFixed(4)}/lat/${lat.toFixed(4)}/data.json`)
  }
  if (inBox(BOXES.germany, lat, lon)) {
    const today = new Date().toISOString().slice(0, 10)
    const last = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10)
    jobs.brightsky = getJson(`https://api.brightsky.dev/weather?lat=${lat}&lon=${lon}&date=${today}&last_date=${last}`)
  }
  const entries = await Promise.all(Object.entries(jobs).map(async ([k, p]) => [k, await p]))
  return Object.fromEntries(entries)
}

export function fetchMetNorwayRaw(lat, lon) {
  return getJson(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`)
}
```

- [ ] **Step 5: Run the tests** — `node --test lib/outlook/` → PASS; `npm test` → all pass.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "Outlook parsers: Open-Meteo multi-model (pure regional models), NWS, SMHI, DWD MOSMIX, MET Norway fallback; recorded fixtures"`

---

### Task 3: Blending

**Files:**
- Modify: `lib/weather.js` (export `weatherIcon`)
- Create: `lib/outlook/blend.js`, `lib/outlook/blend.test.js`

**Interfaces:**
- Consumes: series shape (Task 2); `weatherIcon(code)`, `decodeWeatherCode(code)` from `lib/weather.js`.
- Produces:
  - `horizonForLeadHours(h)`, `horizonForLeadDays(d)` → `'h48' | 'd7' | 'd14'`
  - `percentile(sortedAsc, p)`, `band(values) → [lo, hi]`, `rainProb(pop, precip, wetMm) → 0..1 | null`
  - `blendHourly(series, weightsByHorizon, { nowLocal, hours = 168 }) → [{ t, temp, lo, hi, rainPct, rainVotes, rainCallers, windKmh, icon, n }]`
  - `blendDaily(series, weightsByHorizon, { todayLocal, days = 14 }) → [{ date, lead, tempMax, tempMin, maxLo, maxHi, minLo, minHi, rainPct, windKmh, icon, condition, spread, agree, n, confident }]`
  - `weightsByHorizon` = `{ h48?: { [id]: weight }, d7?: {...}, d14?: {...} }`

- [ ] **Step 1: Write the failing tests**

```js path=lib/outlook/blend.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blendHourly, blendDaily, band, percentile, rainProb, horizonForLeadHours, horizonForLeadDays } from './blend.js'

const hourly = (id, pts) => ({
  id, daily: [],
  hourly: pts.map(([t, temp, extra = {}]) => ({ t, temp, pop: null, precip: null, wind: 10, code: null, ...extra })),
})
const daily = (id, pts) => ({
  id, hourly: [],
  daily: pts.map(([date, max, min, extra = {}]) => ({ date, max, min, pop: null, precip: null, wind: 20, code: null, ...extra })),
})
const NOW = '2026-09-29T10:00'

test('horizon buckets follow the tabs', () => {
  assert.deepEqual([0, 47, 48, 167, 168].map(horizonForLeadHours), ['h48', 'h48', 'd7', 'd7', 'd14'])
  assert.deepEqual([1, 2, 7, 8, 14].map(horizonForLeadDays), ['h48', 'd7', 'd7', 'd14', 'd14'])
})

test('percentile / band — p10–p90 from 6 sources, min–max below that', () => {
  assert.equal(percentile([0, 10, 11, 12, 13, 30], 0.1), 5)
  assert.deepEqual(band([30, 0, 10, 11, 12, 13]), [5, 21.5])
  assert.deepEqual(band([30, 0, 10, 11, 12]), [0, 30])
  assert.deepEqual(band([]), [null, null])
})

test('rainProb — real probability, else an amount vote, else null', () => {
  assert.equal(rainProb(80, 0, 0.1), 0.8)
  assert.equal(rainProb(null, 0.5, 0.1), 1)
  assert.equal(rainProb(null, 0.5, 1), 0)
  assert.equal(rainProb(null, null, 1), null)
})

test('blendHourly — weighted mean per hour, starting at the current local hour', () => {
  const out = blendHourly(
    [hourly('a', [['2026-09-29T09:00', 10], ['2026-09-29T10:00', 12]]), hourly('b', [['2026-09-29T10:00', 16]])],
    { h48: { a: 0.75, b: 0.25 } }, { nowLocal: NOW },
  )
  assert.equal(out.length, 1)
  assert.equal(out[0].t, '2026-09-29T10:00')
  assert.equal(out[0].temp, 13)
  assert.deepEqual([out[0].lo, out[0].hi], [12, 16])
  assert.equal(out[0].n, 2)
})

test('blendHourly — a source without a learned weight counts like the average', () => {
  const out = blendHourly([hourly('a', [[NOW, 10]]), hourly('b', [[NOW, 20]])], { h48: { a: 0.6 } }, { nowLocal: NOW })
  assert.equal(out[0].temp, 15)
})

test('blendHourly — weights switch with lead time (48 h vs 7 days)', () => {
  const series = [
    hourly('a', [['2026-09-29T11:00', 10], ['2026-10-01T12:00', 10]]),
    hourly('b', [['2026-09-29T11:00', 20], ['2026-10-01T12:00', 20]]),
  ]
  const out = blendHourly(series, { h48: { a: 0.9, b: 0.1 }, d7: { a: 0.1, b: 0.9 } }, { nowLocal: NOW })
  assert.deepEqual(out.map(h => h.temp), [11, 19])
})

test('blendHourly — rain: probabilities as-is, amounts as votes, silence stays null', () => {
  const series = [
    hourly('a', [[NOW, 10, { pop: 80 }], ['2026-09-29T11:00', 10]]),
    hourly('b', [[NOW, 10, { precip: 0.5 }], ['2026-09-29T11:00', 10]]),
    hourly('c', [[NOW, 10, { precip: 0 }], ['2026-09-29T11:00', 10]]),
  ]
  const [h0, h1] = blendHourly(series, {}, { nowLocal: NOW })
  assert.equal(h0.rainPct, 60)
  assert.equal(h0.rainVotes, 2)
  assert.equal(h0.rainCallers, 3)
  assert.equal(h1.rainPct, null)
  assert.equal(h1.rainCallers, 0)
})

test('blendHourly — icon comes from the highest-weighted source with a weather code', () => {
  const out = blendHourly([hourly('a', [[NOW, 10, { code: 61 }]]), hourly('b', [[NOW, 10, { code: 0 }]])], { h48: { a: 0.3, b: 0.7 } }, { nowLocal: NOW })
  assert.equal(out[0].icon, '☀️')
})

test('blendHourly — caps the number of hours', () => {
  const pts = Array.from({ length: 10 }, (_, i) => [`2026-09-29T${String(10 + i).padStart(2, '0')}:00`, i])
  assert.equal(blendHourly([hourly('a', pts)], {}, { nowLocal: NOW, hours: 4 }).length, 4)
})

test('blendDaily — agreement follows the spread of the sources’ highs', () => {
  const out = blendDaily([
    daily('a', [['2026-09-29', 20, 10], ['2026-09-30', 20, 10], ['2026-10-01', 20, 10]]),
    daily('b', [['2026-09-29', 21, 11], ['2026-09-30', 23.5, 11], ['2026-10-01', 25, 11]]),
  ], {}, { todayLocal: '2026-09-29' })
  assert.deepEqual(out.map(d => [d.spread, d.agree]), [[1, 3], [3.5, 2], [5, 1]])
  assert.deepEqual(out.map(d => d.lead), [0, 1, 2])
  assert.equal(out[1].tempMax, 21.8)
  assert.deepEqual([out[2].maxLo, out[2].maxHi], [20, 25])
})

test('blendDaily — daily rain votes need ≥ 1 mm; a lone source has no spread', () => {
  const out = blendDaily([daily('a', [['2026-09-29', 20, 10, { precip: 0.5 }], ['2026-09-30', 20, 10, { precip: 2 }]])], {}, { todayLocal: '2026-09-29' })
  assert.deepEqual(out.map(d => d.rainPct), [0, 100])
  assert.equal(out[0].spread, null)
  assert.equal(out[0].agree, null)
})

test('blendDaily — skips the past, caps days, flags week 2 as not confident', () => {
  const dates = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2026, 8, 28 + i)).toISOString().slice(0, 10))
  const out = blendDaily([daily('a', dates.map(d => [d, 20, 10]))], {}, { todayLocal: '2026-09-29', days: 10 })
  assert.equal(out[0].date, '2026-09-29')
  assert.equal(out.length, 10)
  assert.equal(out[7].confident, true)
  assert.equal(out[8].confident, false)
})
```

- [ ] **Step 2: Run to see them fail** — `node --test lib/outlook/blend.test.js` → FAIL (module missing).

- [ ] **Step 3: Implement**

In `lib/weather.js` change `function weatherIcon(code)` to `export function weatherIcon(code)`.

```js path=lib/outlook/blend.js
// Outlook blending (pure — unit tested): many sources' hourly and daily
// series → one consensus per hour and per day, with an honest spread band and
// a rain chance that stays null when no source said anything about rain.

import { weatherIcon, decodeWeatherCode } from '../weather.js'

const r1 = v => Math.round(v * 10) / 10

// Which learned-weight bucket a lead time belongs to (matches the tabs).
export const horizonForLeadHours = h => (h < 48 ? 'h48' : h < 168 ? 'd7' : 'd14')
export const horizonForLeadDays = d => (d <= 1 ? 'h48' : d <= 7 ? 'd7' : 'd14')

// Linear-interpolated percentile of an ascending array.
export function percentile(sorted, p) {
  if (!sorted.length) return null
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

// [low, high] of the contributing values: min–max for a handful of sources,
// p10–p90 once there are enough that one outlier shouldn't define the band.
export function band(values) {
  const s = values.filter(v => typeof v === 'number').sort((a, b) => a - b)
  if (!s.length) return [null, null]
  if (s.length >= 6) return [r1(percentile(s, 0.1)), r1(percentile(s, 0.9))]
  return [s[0], s[s.length - 1]]
}

// One source's rain call as a probability 0..1: its real probability when it
// publishes one, otherwise a yes/no vote from the amount, null when silent.
export function rainProb(pop, precip, wetMm) {
  if (typeof pop === 'number') return Math.round(pop) / 100
  if (typeof precip === 'number') return precip >= wetMm ? 1 : 0
  return null
}

// Sources without a learned weight yet stand on equal footing with the
// average of those that have one.
function weightFn(weights) {
  const vals = Object.values(weights ?? {}).filter(v => typeof v === 'number')
  const fallback = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 1
  return id => (typeof weights?.[id] === 'number' ? weights[id] : fallback)
}

function combine(pts, w, wetMm) {
  let ws = pts.map(p => Math.max(0, w(p.id)))
  if (!ws.some(v => v > 0)) ws = pts.map(() => 1)
  const mean = key => {
    let s = 0, sw = 0
    pts.forEach((p, i) => { if (typeof p[key] === 'number') { s += p[key] * ws[i]; sw += ws[i] } })
    return sw ? s / sw : null
  }
  let rain = 0, rainW = 0, votes = 0, callers = 0, top = null, topW = -1
  pts.forEach((p, i) => {
    const pr = rainProb(p.pop, p.precip, wetMm)
    if (pr != null) { rain += pr * ws[i]; rainW += ws[i]; callers++; if (pr >= 0.5) votes++ }
    if (typeof p.code === 'number' && ws[i] > topW) { topW = ws[i]; top = p }
  })
  return { mean, rainPct: rainW ? Math.round((rain / rainW) * 100) : null, votes, callers, topCode: top?.code ?? null }
}

function group(series, pick, from) {
  const by = new Map()
  for (const s of series) for (const p of pick(s) ?? []) {
    const k = p.t ?? p.date
    if (k < from) continue
    let e = by.get(k)
    if (!e) by.set(k, (e = []))
    e.push({ id: s.id, ...p })
  }
  return by
}

// nowLocal: the city-local hour to start from, 'YYYY-MM-DDTHH:MM'.
export function blendHourly(series, weightsByHorizon, { nowLocal, hours = 168 }) {
  const by = group(series, s => s.hourly, nowLocal)
  const t0 = Date.parse(`${nowLocal}:00Z`)
  return [...by.keys()].sort().slice(0, hours).map(t => {
    const pts = by.get(t)
    const lead = (Date.parse(`${t}:00Z`) - t0) / 3600e3
    const c = combine(pts, weightFn(weightsByHorizon?.[horizonForLeadHours(lead)]), 0.1)
    const [lo, hi] = band(pts.map(p => p.temp))
    const wind = c.mean('wind')
    return {
      t, temp: r1(c.mean('temp')), lo, hi,
      rainPct: c.rainPct, rainVotes: c.votes, rainCallers: c.callers,
      windKmh: wind == null ? null : Math.round(wind),
      icon: c.topCode == null ? null : weatherIcon(c.topCode),
      n: pts.length,
    }
  })
}

// todayLocal: the city-local date, 'YYYY-MM-DD'. Day lead 0 is today.
export function blendDaily(series, weightsByHorizon, { todayLocal, days = 14 }) {
  const by = group(series, s => s.daily, todayLocal)
  const d0 = Date.parse(`${todayLocal}T00:00:00Z`)
  return [...by.keys()].sort().slice(0, days).map(date => {
    const pts = by.get(date)
    const lead = Math.round((Date.parse(`${date}T00:00:00Z`) - d0) / 864e5)
    const c = combine(pts, weightFn(weightsByHorizon?.[horizonForLeadDays(Math.max(1, lead))]), 1)
    const maxes = pts.map(p => p.max)
    const [maxLo, maxHi] = band(maxes)
    const [minLo, minHi] = band(pts.map(p => p.min))
    const spread = pts.length >= 2 ? r1(Math.max(...maxes) - Math.min(...maxes)) : null
    const wind = c.mean('wind')
    return {
      date, lead,
      tempMax: r1(c.mean('max')), tempMin: r1(c.mean('min')),
      maxLo, maxHi, minLo, minHi,
      rainPct: c.rainPct,
      windKmh: wind == null ? null : Math.round(wind),
      icon: c.topCode == null ? null : weatherIcon(c.topCode),
      condition: c.topCode == null ? null : decodeWeatherCode(c.topCode),
      spread, agree: spread == null ? null : spread <= 2 ? 3 : spread <= 4 ? 2 : 1,
      n: pts.length, confident: lead <= 7,
    }
  })
}
```

- [ ] **Step 4: Run** — `npm test` → all pass.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Outlook blend: weighted hourly/daily consensus per range, spread bands, honest rain chance"`

---

### Task 4: Ensemble bands and climate reference

**Files:**
- Create: `lib/outlook/ensemble.js`, `lib/outlook/ensemble.test.js`, `lib/outlook/climate.js`, `lib/outlook/climate.test.js`

**Interfaces:**
- Consumes: `percentile` (Task 3).
- Produces:
  - `parseEnsemble(json) → { dates, max: number[][], min: number[][], precip: number[][] } | null`
  - `ensembleDay(ens, date, minMembers = 10) → { maxLo, maxHi, minLo, minHi, wetShare, members } | null`
  - `applyEnsemble(days, ens, fromLead = 8) → days` (bands + rainPct from members for lead ≥ 8; central values unchanged)
  - `dayOfYear('MM-DD')`, `indexArchive(json) → rows | null`, `normalsFor(rows, dates, window = 7) → [{ date, max, min }]`, `rainyDaysNormal(rows, dates) → number | null`, `monthRecords(rows, month) → { hottest, coldest, wettest } | null`, `anomalies(days, normals) → { week1, week2 }`

- [ ] **Step 1: Write the failing tests**

```js path=lib/outlook/ensemble.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseEnsemble, ensembleDay, applyEnsemble } from './ensemble.js'

function ens(nMembers) {
  const daily = { time: ['2026-10-07', '2026-10-08'] }
  for (let m = 0; m < nMembers; m++) {
    const sfx = m === 0 ? 'ecmwf_ifs025_ensemble' : `member${String(m).padStart(2, '0')}_ecmwf_ifs025_ensemble`
    daily[`temperature_2m_max_${sfx}`] = [10 + m, 20]
    daily[`temperature_2m_min_${sfx}`] = [m, 5]
    daily[`precipitation_sum_${sfx}`] = [m < 5 ? 3 : 0, 0]
  }
  return { daily }
}

test('parseEnsemble — collects the control run and every member per date', () => {
  const e = parseEnsemble(ens(20))
  assert.deepEqual(e.dates, ['2026-10-07', '2026-10-08'])
  assert.equal(e.max[0].length, 20)
  assert.equal(e.min[1].length, 20)
  assert.equal(parseEnsemble(null), null)
})

test('ensembleDay — p10–p90 bands and the share of wet members', () => {
  const d = ensembleDay(parseEnsemble(ens(20)), '2026-10-07')
  assert.deepEqual(d, { maxLo: 11.9, maxHi: 27.1, minLo: 1.9, minHi: 17.1, wetShare: 25, members: 20 })
  assert.equal(ensembleDay(parseEnsemble(ens(20)), '2026-12-24'), null)
  assert.equal(ensembleDay(parseEnsemble(ens(6)), '2026-10-07'), null) // too few members to mean anything
})

test('applyEnsemble — only week 2 changes, central values stay deterministic', () => {
  const days = [
    { date: '2026-10-06', lead: 7, tempMax: 15, maxLo: 14, maxHi: 16, minLo: 4, minHi: 6, rainPct: 40 },
    { date: '2026-10-07', lead: 8, tempMax: 15, maxLo: 14, maxHi: 16, minLo: 4, minHi: 6, rainPct: 40 },
  ]
  const out = applyEnsemble(days, parseEnsemble(ens(20)))
  assert.deepEqual(out[0], days[0])
  assert.equal(out[1].tempMax, 15)
  assert.deepEqual([out[1].maxLo, out[1].maxHi, out[1].rainPct, out[1].members], [11.9, 27.1, 25, 20])
})
```

```js path=lib/outlook/climate.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayOfYear, indexArchive, normalsFor, rainyDaysNormal, monthRecords, anomalies } from './climate.js'

const row = (date, max, min, precip = 0) => ({ date, year: date.slice(0, 4), doy: dayOfYear(date.slice(5)), max, min, precip })

test('dayOfYear — non-leap calendar, Feb 29 shares Feb 28', () => {
  assert.equal(dayOfYear('01-01'), 1)
  assert.equal(dayOfYear('03-01'), 60)
  assert.equal(dayOfYear('12-31'), 365)
  assert.equal(dayOfYear('02-29'), 59)
})

test('normalsFor — ±7-day window wraps over New Year', () => {
  const rows = [row('2020-12-28', 2, -2), row('2021-01-03', 4, 0), row('2021-06-01', 25, 15)]
  assert.deepEqual(normalsFor(rows, ['2026-01-01']), [{ date: '2026-01-01', max: 3, min: -1 }])
  assert.deepEqual(normalsFor(rows, ['2026-03-15']), [{ date: '2026-03-15', max: null, min: null }])
})

test('rainyDaysNormal — wet days per average year on the same calendar days', () => {
  const rows = [
    row('2020-10-01', 15, 8, 3), row('2020-10-02', 15, 8, 5),
    row('2021-10-01', 15, 8, 0.2), row('2021-10-02', 15, 8, 1), row('2021-10-03', 15, 8, 9),
  ]
  assert.equal(rainyDaysNormal(rows, ['2026-10-01', '2026-10-02']), 2) // (2 + 1) / 2 → 2
})

test('monthRecords — only this month counts', () => {
  const rows = [row('2020-10-05', 28, 9, 40), row('2021-10-20', 12, -3, 2), row('2021-11-02', 30, -8, 90)]
  assert.deepEqual(monthRecords(rows, 10), {
    hottest: { temp: 28, date: '2020-10-05' },
    coldest: { temp: -3, date: '2021-10-20' },
    wettest: { mm: 40, date: '2020-10-05' },
  })
  assert.equal(monthRecords(rows, 3), null)
})

test('anomalies — week 1 and week 2 vs normal', () => {
  const dates = Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10))
  const normals = dates.map(date => ({ date, max: 15, min: 5 }))
  const days = dates.map((date, i) => ({ date, tempMax: i < 7 ? 17 : 14 }))
  assert.deepEqual(anomalies(days, normals), { week1: 2, week2: -1 })
  assert.deepEqual(anomalies(days.slice(0, 5), normals), { week1: 2, week2: null })
})

test('indexArchive — skips days without temperatures; garbage → null', () => {
  const rows = indexArchive({ daily: { time: ['2020-01-01', '2020-01-02'], temperature_2m_max: [3, null], temperature_2m_min: [-1, 0], precipitation_sum: [0.4, 2] } })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].doy, 1)
  assert.equal(indexArchive(null), null)
})
```

- [ ] **Step 2: Run to see them fail** — `node --test lib/outlook/ensemble.test.js lib/outlook/climate.test.js` → FAIL (modules missing).

- [ ] **Step 3: Implement**

```js path=lib/outlook/ensemble.js
// Week-2 uncertainty from the ECMWF (51 members) and NOAA GEFS (31 members)
// ensembles (pure — unit tested). Beyond ~10 days only two deterministic
// models remain, so their disagreement alone would understate the spread;
// the members' p10–p90 is the honest band.

import { percentile } from './blend.js'

const r1 = v => Math.round(v * 10) / 10

export function parseEnsemble(json) {
  const d = json?.daily
  if (!Array.isArray(d?.time)) return null
  const keys = Object.keys(d)
  const gather = prefix => {
    const cols = keys.filter(k => k.startsWith(`${prefix}_`))
    return d.time.map((_, i) => cols.map(k => d[k]?.[i]).filter(v => typeof v === 'number' && Number.isFinite(v)))
  }
  return { dates: d.time, max: gather('temperature_2m_max'), min: gather('temperature_2m_min'), precip: gather('precipitation_sum') }
}

export function ensembleDay(ens, date, minMembers = 10) {
  const i = ens?.dates?.indexOf(date) ?? -1
  if (i < 0) return null
  const mx = [...ens.max[i]].sort((a, b) => a - b)
  const mn = [...ens.min[i]].sort((a, b) => a - b)
  if (mx.length < minMembers || mn.length < minMembers) return null
  const pr = ens.precip[i]
  return {
    maxLo: r1(percentile(mx, 0.1)), maxHi: r1(percentile(mx, 0.9)),
    minLo: r1(percentile(mn, 0.1)), minHi: r1(percentile(mn, 0.9)),
    wetShare: pr.length ? Math.round((pr.filter(v => v >= 1).length / pr.length) * 100) : null,
    members: mx.length,
  }
}

// Week-2 days take their bands (and rain chance) from the members; the
// central high/low stay the learned-weight blend of the deterministic models.
export function applyEnsemble(days, ens, fromLead = 8) {
  return days.map(d => {
    if (d.lead < fromLead) return d
    const e = ensembleDay(ens, d.date)
    if (!e) return d
    return { ...d, maxLo: e.maxLo, maxHi: e.maxHi, minLo: e.minLo, minHi: e.minHi, rainPct: e.wetShare ?? d.rainPct, members: e.members }
  })
}
```

```js path=lib/outlook/climate.js
// Climate reference from 10 years of daily history (pure — unit tested):
// per-date normals, rainy-day counts and this month's records.

const r1 = v => Math.round(v * 10) / 10
const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

// 'MM-DD' → 1..365 on a non-leap calendar (Feb 29 shares Feb 28's slot).
export function dayOfYear(mmdd) {
  const [m, d] = mmdd.split('-').map(Number)
  return CUM[m - 1] + (m === 2 ? Math.min(d, 28) : d)
}
const doyDist = (a, b) => { const x = Math.abs(a - b); return Math.min(x, 365 - x) }

export function indexArchive(json) {
  const d = json?.daily
  if (!Array.isArray(d?.time)) return null
  const rows = []
  d.time.forEach((date, i) => {
    const max = d.temperature_2m_max?.[i], min = d.temperature_2m_min?.[i]
    if (typeof max !== 'number' || typeof min !== 'number') return
    const p = d.precipitation_sum?.[i]
    rows.push({ date, year: date.slice(0, 4), doy: dayOfYear(date.slice(5)), max, min, precip: typeof p === 'number' ? p : null })
  })
  return rows.length ? rows : null
}

// Normal high/low per target date: the mean over every archive day within
// ±window days of the same calendar date (wrapping over New Year).
export function normalsFor(rows, dates, window = 7) {
  return dates.map(date => {
    const t = dayOfYear(date.slice(5))
    let mx = 0, mn = 0, n = 0
    for (const r of rows) if (doyDist(r.doy, t) <= window) { mx += r.max; mn += r.min; n++ }
    return n ? { date, max: r1(mx / n), min: r1(mn / n) } : { date, max: null, min: null }
  })
}

// How many of these calendar days were rainy (≥ 1 mm) in an average year.
export function rainyDaysNormal(rows, dates) {
  const want = new Set(dates.map(d => dayOfYear(d.slice(5))))
  const years = new Set()
  let wet = 0
  for (const r of rows) {
    if (!want.has(r.doy)) continue
    years.add(r.year)
    if (r.precip != null && r.precip >= 1) wet++
  }
  return years.size ? Math.round(wet / years.size) : null
}

// Hottest day, coldest night and wettest day of this calendar month.
export function monthRecords(rows, month) {
  let hottest = null, coldest = null, wettest = null
  for (const r of rows) {
    if (Number(r.date.slice(5, 7)) !== month) continue
    if (!hottest || r.max > hottest.temp) hottest = { temp: r.max, date: r.date }
    if (!coldest || r.min < coldest.temp) coldest = { temp: r.min, date: r.date }
    if (r.precip != null && (!wettest || r.precip > wettest.mm)) wettest = { mm: Math.round(r.precip), date: r.date }
  }
  return hottest ? { hottest, coldest, wettest } : null
}

// Mean anomaly of the daily high vs normal: week 1 (days 0–6), week 2 (7–13).
export function anomalies(days, normals) {
  const normal = new Map((normals ?? []).map(n => [n.date, n.max]))
  const week = (from, to) => {
    const diffs = (days ?? []).slice(from, to)
      .map(d => (normal.get(d.date) == null || d.tempMax == null ? null : d.tempMax - normal.get(d.date)))
      .filter(v => v != null)
    return diffs.length ? r1(diffs.reduce((a, b) => a + b, 0) / diffs.length) : null
  }
  return { week1: week(0, 7), week2: week(7, 14) }
}
```

- [ ] **Step 4: Run** — `npm test` → all pass.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Outlook week-2 ensemble bands and 10-year climate normals/records"`

---

### Task 5: Headlines, their text, and headline translations

**Files:**
- Create: `lib/outlook/headlines.js`, `lib/outlook/headlines.test.js`, `lib/outlook/text.js`, `lib/outlook/text.test.js`
- Modify: `lib/i18n.js` (headline keys, all 5 languages)

**Interfaces:**
- Consumes: `addDays`, `addHours`, `formatCalendarDate` (lib/localtime.js), `anomalies` (Task 4), `t` (lib/i18n.js).
- Produces:
  - `headline48(hourly, { todayLocal }) → { code: 'rain_now'|'rain_window'|'dry'|'no_rain_data', from?, to?, until?, agree?, total?, peak: { temp, at } | null } | null`
  - `bestTimeOutside(hourly, hours = 48) → { t, temp, rainPct, windKmh, icon } | null`
  - `headline7(days) → { code: 'best_day', date, tempMax, rainPct, splits } | { code: 'no_good_day', splits } | null`
  - `headline14(days, normals) → { code: 'trend', week1, week2, dir: 'warmer'|'cooler'|'normal', shift: 'cooling'|'warming'|null } | null`
  - `fill(str, vars)`, `tempFormatter(unit)`, `deltaFormatter(unit)`, `spanFormatter(unit)`, `dayWord(lang, date, todayLocal)`, `headlineText(lang, which, h, { todayLocal, fmtTemp?, fmtDelta?, fmtSpan? }) → { title, sub } | null`, `headlineTone(which, h) → 'rain'|'ok'|'warn'|'neutral'`

- [ ] **Step 1: Write the failing tests**

```js path=lib/outlook/headlines.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { headline48, headline7, headline14, bestTimeOutside } from './headlines.js'
import { addHours } from '../localtime.js'

const TODAY = '2026-09-29'
const hours = (n, fn = () => ({}), start = '2026-09-29T10:00') =>
  Array.from({ length: n }, (_, i) => ({ t: addHours(start, i), temp: 15, rainPct: 10, rainVotes: 0, rainCallers: 3, windKmh: 10, icon: '⛅', ...fn(i) }))

test('headline48 — the next rain window with how many sources call it', () => {
  const h = hours(48, i => (i >= 5 && i <= 7 ? { rainPct: [60, 70, 55][i - 5], rainVotes: [2, 3, 2][i - 5] } : {}))
  const r = headline48(h, { todayLocal: TODAY })
  assert.equal(r.code, 'rain_window')
  assert.equal(r.from, '2026-09-29T15:00')
  assert.equal(r.to, '2026-09-29T18:00')
  assert.deepEqual([r.agree, r.total], [3, 3])
})

test('headline48 — raining now, until it stops (or all 48 h)', () => {
  assert.deepEqual(
    (({ code, until }) => ({ code, until }))(headline48(hours(48, i => (i < 3 ? { rainPct: 80, rainVotes: 3 } : {})), { todayLocal: TODAY })),
    { code: 'rain_now', until: '2026-09-29T13:00' },
  )
  assert.equal(headline48(hours(48, () => ({ rainPct: 90 })), { todayLocal: TODAY }).until, null)
})

test('headline48 — dry vs no rain data at all', () => {
  assert.equal(headline48(hours(48), { todayLocal: TODAY }).code, 'dry')
  assert.equal(headline48(hours(48, () => ({ rainPct: null, rainCallers: 0 })), { todayLocal: TODAY }).code, 'no_rain_data')
  assert.equal(headline48([], { todayLocal: TODAY }), null)
})

test('headline48 — peak is tomorrow’s warmest hour', () => {
  const h = hours(48, i => (i === 30 ? { temp: 20 } : {}))
  assert.deepEqual(headline48(h, { todayLocal: TODAY }).peak, { temp: 20, at: '2026-09-30T16:00' })
})

test('bestTimeOutside — daytime only, rain weighs most', () => {
  const h = hours(24, i => ({ temp: 20, rainPct: i === 3 ? 0 : 40 }), '2026-09-29T00:00')
  assert.equal(bestTimeOutside(h).t, '2026-09-29T07:00') // 03:00 is dry but at night
  const h2 = hours(24, i => ({ temp: 20, rainPct: i === 14 ? 0 : 40 }), '2026-09-29T00:00')
  assert.equal(bestTimeOutside(h2).t, '2026-09-29T14:00')
  assert.equal(bestTimeOutside([]), null)
})

test('headline7 — best day by rain, wind and comfort; splits over 4°', () => {
  const days = [
    { date: '2026-09-29', tempMax: 18, rainPct: 70, windKmh: 10, spread: 1 },
    { date: '2026-09-30', tempMax: 22, rainPct: 5, windKmh: 10, spread: 2 },
    { date: '2026-10-01', tempMax: 12, rainPct: 5, windKmh: 30, spread: 6 },
  ]
  assert.deepEqual(headline7(days), { code: 'best_day', date: '2026-09-30', tempMax: 22, rainPct: 5, splits: [{ date: '2026-10-01', spread: 6 }] })
  assert.equal(headline7(days.map(d => ({ ...d, rainPct: 80 }))).code, 'no_good_day')
  assert.equal(headline7([]), null)
})

test('headline14 — direction from week 2 vs normal, shift when the weeks differ', () => {
  const dates = Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10))
  const normals = dates.map(date => ({ date, max: 15, min: 5 }))
  const cooling = dates.map((date, i) => ({ date, tempMax: i < 7 ? 17 : 14 }))
  assert.deepEqual(headline14(cooling, normals), { code: 'trend', week1: 2, week2: -1, dir: 'cooler', shift: 'cooling' })
  assert.equal(headline14(dates.map(date => ({ date, tempMax: 15.5 })), normals).dir, 'normal')
  assert.equal(headline14(cooling, []), null)
})
```

```js path=lib/outlook/text.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { headlineText, headlineTone, tempFormatter, deltaFormatter, spanFormatter, dayWord, fill } from './text.js'

const today = '2026-09-29'

test('headlineText — 48 h rain window in English', () => {
  const h = { code: 'rain_window', from: '2026-09-29T15:00', to: '2026-09-29T18:00', agree: 7, total: 9, peak: { temp: 20.4, at: '2026-09-30T16:00' } }
  assert.deepEqual(headlineText('en', 'h48', h, { todayLocal: today }), {
    title: 'Rain likely 15:00–18:00 today',
    sub: '7 of 9 sources · tomorrow up to 20° at 16:00',
  })
})

test('headlineText — the translation decides the word order', () => {
  const h = { code: 'rain_window', from: '2026-09-30T06:00', to: '2026-09-30T09:00', agree: 2, total: 5, peak: null }
  assert.equal(headlineText('de', 'h48', h, { todayLocal: today }).title, 'Regen wahrscheinlich morgen 06:00–09:00')
})

test('headlineText — rain now / dry / no data', () => {
  const o = { todayLocal: today }
  assert.equal(headlineText('en', 'h48', { code: 'rain_now', until: '2026-09-29T13:00', agree: 3, total: 3, peak: null }, o).title, 'Rain now, easing around 13:00')
  assert.equal(headlineText('en', 'h48', { code: 'rain_now', until: null, agree: 3, total: 3, peak: null }, o).title, 'Rain for most of the next 48 hours')
  assert.deepEqual(headlineText('en', 'h48', { code: 'dry', peak: null }, o), { title: 'Dry for the next 48 hours', sub: null })
  assert.equal(headlineText('en', 'h48', { code: 'no_rain_data', peak: null }, o).title, 'No rain data for the next 48 hours')
})

test('headlineText — 7 days, with °F and a split warning', () => {
  const h = { code: 'best_day', date: '2026-09-30', tempMax: 22, rainPct: 5, splits: [{ date: '2026-10-03', spread: 6 }] }
  const r = headlineText('en', 'd7', h, { todayLocal: today, fmtTemp: tempFormatter('F'), fmtSpan: spanFormatter('F') })
  assert.equal(r.title, 'Best day outside: tomorrow')
  assert.equal(r.sub, '72°, 5% rain · models split by 11° on Saturday')
})

test('headlineText — 14-day trend: the shift wins over the direction', () => {
  assert.deepEqual(
    headlineText('en', 'd14', { code: 'trend', week1: 2, week2: -1, dir: 'cooler', shift: 'cooling' }, { todayLocal: today }),
    { title: 'Cooling off next week', sub: 'this week +2.0° vs normal · week 2 is a trend only' },
  )
  assert.equal(headlineText('en', 'd14', { code: 'trend', week1: 0.4, week2: 0.2, dir: 'normal', shift: null }, { todayLocal: today }).title, 'Close to normal for the season')
})

test('headlineText — null in, null out', () => {
  assert.equal(headlineText('en', 'h48', null, { todayLocal: today }), null)
})

test('formatters — °C/°F temperatures, signed deltas, unsigned spans', () => {
  assert.equal(tempFormatter('C')(20.4), '20°')
  assert.equal(tempFormatter('F')(20), '68°')
  assert.equal(tempFormatter('C')(null), '–')
  assert.equal(deltaFormatter('C')(2), '+2.0°')
  assert.equal(deltaFormatter('C')(-1.26), '−1.3°')
  assert.equal(deltaFormatter('F')(1), '+1.8°')
  assert.equal(deltaFormatter('C')(0), '±0.0°')
  assert.equal(spanFormatter('C')(5.6), '6°')
})

test('headlineTone — colours match the answer', () => {
  assert.equal(headlineTone('h48', { code: 'rain_window' }), 'rain')
  assert.equal(headlineTone('h48', { code: 'dry' }), 'ok')
  assert.equal(headlineTone('d7', { code: 'best_day' }), 'ok')
  assert.equal(headlineTone('d14', { shift: 'cooling', dir: 'cooler' }), 'rain')
  assert.equal(headlineTone('d14', { shift: null, dir: 'warmer' }), 'warn')
  assert.equal(headlineTone('d14', null), 'neutral')
})

test('dayWord / fill — today, tomorrow, weekday; placeholders', () => {
  assert.equal(dayWord('en', '2026-09-29', today), 'today')
  assert.equal(dayWord('en', '2026-09-30', today), 'tomorrow')
  assert.equal(dayWord('en', '2026-10-01', today), 'Thursday')
  assert.equal(fill('{a} of {b} ({c})', { a: 1, b: 2 }), '1 of 2 ({c})')
})
```

- [ ] **Step 2: Run to see them fail** — `node --test lib/outlook/headlines.test.js lib/outlook/text.test.js` → FAIL.

- [ ] **Step 3: Implement**

```js path=lib/outlook/headlines.js
// Headline answers for the three tabs (pure — unit tested): language-neutral
// codes + numbers; lib/outlook/text.js turns them into sentences.

import { addDays, addHours } from '../localtime.js'
import { anomalies } from './climate.js'

const WET = 50
const isWet = h => h.rainPct != null && h.rainPct >= WET
const comfortMiss = t => (t < 15 ? 15 - t : t > 25 ? t - 25 : 0)

function tomorrowPeak(hourly, todayLocal) {
  const day = addDays(todayLocal, 1)
  const tmr = hourly.filter(h => h.t.startsWith(day))
  if (!tmr.length) return null
  const p = tmr.reduce((a, b) => (b.temp > a.temp ? b : a))
  return { temp: p.temp, at: p.t }
}

export function headline48(hourly, { todayLocal }) {
  const h = (hourly ?? []).slice(0, 48)
  if (!h.length) return null
  const peak = tomorrowPeak(hourly, todayLocal)
  const start = h.findIndex(isWet)
  if (start === -1) return { code: h.some(x => x.rainPct != null) ? 'dry' : 'no_rain_data', peak }
  let end = start
  while (end + 1 < h.length && isWet(h[end + 1])) end++
  const run = h.slice(start, end + 1)
  const agree = Math.max(...run.map(x => x.rainVotes ?? 0))
  const total = Math.max(...run.map(x => x.rainCallers ?? 0))
  const until = end + 1 < h.length ? addHours(h[end].t, 1) : null
  if (start === 0) return { code: 'rain_now', until, agree, total, peak }
  return { code: 'rain_window', from: h[start].t, to: addHours(h[end].t, 1), agree, total, peak }
}

// The nicest daytime hour (07–21 local) in the next 48 h: rain hurts most,
// then wind, then leaving the 15–25 °C comfort band.
export function bestTimeOutside(hourly, hours = 48) {
  const pool = (hourly ?? []).slice(0, hours).filter(h => {
    const hr = Number(h.t.slice(11, 13))
    return hr >= 7 && hr <= 21
  })
  if (!pool.length) return null
  const score = h => (h.rainPct ?? 0) + (h.windKmh ?? 0) * 0.5 + comfortMiss(h.temp) * 2
  const best = pool.reduce((a, b) => (score(b) < score(a) ? b : a))
  return { t: best.t, temp: best.temp, rainPct: best.rainPct, windKmh: best.windKmh, icon: best.icon }
}

export function headline7(days) {
  const week = (days ?? []).slice(0, 7)
  if (!week.length) return null
  const splits = week.filter(d => d.spread != null && d.spread > 4).map(d => ({ date: d.date, spread: d.spread }))
  const score = d => (d.rainPct ?? 50) + (d.windKmh ?? 0) * 0.5 + comfortMiss(d.tempMax) * 2
  const best = week.reduce((a, b) => (score(b) < score(a) ? b : a))
  if (best.rainPct != null && best.rainPct >= 60) return { code: 'no_good_day', splits }
  return { code: 'best_day', date: best.date, tempMax: best.tempMax, rainPct: best.rainPct, splits }
}

export function headline14(days, normals) {
  if (!normals?.some(n => n.max != null)) return null
  const { week1, week2 } = anomalies(days, normals)
  const ref = week2 ?? week1
  if (ref == null) return null
  const dir = ref >= 1 ? 'warmer' : ref <= -1 ? 'cooler' : 'normal'
  const change = week1 != null && week2 != null ? week2 - week1 : 0
  return { code: 'trend', week1, week2, dir, shift: change <= -2 ? 'cooling' : change >= 2 ? 'warming' : null }
}
```

```js path=lib/outlook/text.js
// Headline codes → sentences, plus the unit formatters the outlook views
// share (pure — used by the page and by the server-rendered city pages).

import { t } from '../i18n.js'
import { addDays, formatCalendarDate } from '../localtime.js'

export const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m))

export const tempFormatter = unit => c => (c == null ? '–' : `${Math.round(unit === 'F' ? c * 9 / 5 + 32 : c)}°`)
// differences scale with the unit but never get the +32 offset
export const deltaFormatter = unit => d => {
  if (d == null) return '–'
  const v = unit === 'F' ? d * 9 / 5 : d
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(1)}°`
}
export const spanFormatter = unit => d => (d == null ? '–' : `${Math.round(unit === 'F' ? d * 9 / 5 : d)}°`)

const hour = iso => iso.slice(11, 16)

export function dayWord(lang, date, todayLocal) {
  if (date === todayLocal) return t(lang, 'todayWord')
  if (date === addDays(todayLocal, 1)) return t(lang, 'tomorrowWord')
  return formatCalendarDate(date, lang, { weekday: 'long' })
}

export function headlineText(lang, which, h, {
  todayLocal, fmtTemp = tempFormatter('C'), fmtDelta = deltaFormatter('C'), fmtSpan = spanFormatter('C'),
} = {}) {
  if (!h) return null
  const tr = (key, vars = {}) => fill(t(lang, key), vars)
  const join = (...parts) => parts.filter(Boolean).join(' · ') || null
  const peak = h.peak ? tr('hlPeak', { day: dayWord(lang, h.peak.at.slice(0, 10), todayLocal), temp: fmtTemp(h.peak.temp), at: hour(h.peak.at) }) : null

  if (which === 'h48') {
    const agree = h.total ? tr('hlSourcesAgree', { agree: h.agree, total: h.total }) : null
    if (h.code === 'rain_now') return { title: h.until ? tr('hlRainNow', { until: hour(h.until) }) : tr('hlRainNow48'), sub: join(agree, peak) }
    if (h.code === 'rain_window') {
      return { title: tr('hlRainWindow', { from: hour(h.from), to: hour(h.to), day: dayWord(lang, h.from.slice(0, 10), todayLocal) }), sub: join(agree, peak) }
    }
    return { title: tr(h.code === 'dry' ? 'hlDry' : 'hlNoRainData'), sub: peak }
  }
  if (which === 'd7') {
    const s = h.splits?.[0]
    const split = s ? tr('hlSplit', { spread: fmtSpan(s.spread), day: dayWord(lang, s.date, todayLocal) }) : null
    if (h.code === 'best_day') {
      return { title: tr('hlBestDay', { day: dayWord(lang, h.date, todayLocal) }), sub: join(tr('hlBestDaySub', { temp: fmtTemp(h.tempMax), rain: h.rainPct ?? '–' }), split) }
    }
    return { title: tr('hlNoGoodDay'), sub: split }
  }
  if (which === 'd14') {
    const key = h.shift === 'cooling' ? 'hlCooling' : h.shift === 'warming' ? 'hlWarming'
      : h.dir === 'warmer' ? 'hlWarmer' : h.dir === 'cooler' ? 'hlCooler' : 'hlNormal'
    return { title: tr(key), sub: h.week1 != null ? tr('hlTrendSub', { w1: fmtDelta(h.week1) }) : null }
  }
  return null
}

export function headlineTone(which, h) {
  if (!h) return 'neutral'
  if (which === 'h48') return h.code === 'rain_now' || h.code === 'rain_window' ? 'rain' : h.code === 'dry' ? 'ok' : 'neutral'
  if (which === 'd7') return h.code === 'best_day' ? 'ok' : 'rain'
  if (h.shift === 'cooling' || (!h.shift && h.dir === 'cooler')) return 'rain'
  if (h.shift === 'warming' || (!h.shift && h.dir === 'warmer')) return 'warn'
  return 'neutral'
}
```

Add to `lib/i18n.js`, directly after each language's `tagline:` line (same keys in every language):

```js
    // outlook headlines
    todayWord: 'today', tomorrowWord: 'tomorrow',
    hlRainNow: 'Rain now, easing around {until}',
    hlRainNow48: 'Rain for most of the next 48 hours',
    hlRainWindow: 'Rain likely {from}–{to} {day}',
    hlSourcesAgree: '{agree} of {total} sources',
    hlDry: 'Dry for the next 48 hours',
    hlNoRainData: 'No rain data for the next 48 hours',
    hlPeak: '{day} up to {temp} at {at}',
    hlBestDay: 'Best day outside: {day}',
    hlBestDaySub: '{temp}, {rain}% rain',
    hlNoGoodDay: 'No properly dry day this week',
    hlSplit: 'models split by {spread} on {day}',
    hlWarmer: 'Warmer than normal ahead', hlCooler: 'Cooler than normal ahead',
    hlNormal: 'Close to normal for the season',
    hlCooling: 'Cooling off next week', hlWarming: 'Warming up next week',
    hlTrendSub: 'this week {w1} vs normal · week 2 is a trend only',
```

de:
```js
    todayWord: 'heute', tomorrowWord: 'morgen',
    hlRainNow: 'Regen jetzt, lässt gegen {until} nach',
    hlRainNow48: 'Regen fast durchgehend in den nächsten 48 Stunden',
    hlRainWindow: 'Regen wahrscheinlich {day} {from}–{to}',
    hlSourcesAgree: '{agree} von {total} Quellen',
    hlDry: 'Trocken in den nächsten 48 Stunden',
    hlNoRainData: 'Keine Regendaten für die nächsten 48 Stunden',
    hlPeak: '{day} bis {temp} um {at}',
    hlBestDay: 'Bester Tag für draußen: {day}',
    hlBestDaySub: '{temp}, {rain} % Regen',
    hlNoGoodDay: 'Diese Woche kein richtig trockener Tag',
    hlSplit: 'Modelle liegen {day} {spread} auseinander',
    hlWarmer: 'Wärmer als normal', hlCooler: 'Kühler als normal',
    hlNormal: 'Im Rahmen der Jahreszeit',
    hlCooling: 'Nächste Woche kühlt es ab', hlWarming: 'Nächste Woche wird es wärmer',
    hlTrendSub: 'diese Woche {w1} zum Normalwert · Woche 2 ist nur ein Trend',
```

fr:
```js
    todayWord: 'aujourd’hui', tomorrowWord: 'demain',
    hlRainNow: 'Pluie en ce moment, accalmie vers {until}',
    hlRainNow48: 'Pluie presque continue ces 48 prochaines heures',
    hlRainWindow: 'Pluie probable {day} {from}–{to}',
    hlSourcesAgree: '{agree} sources sur {total}',
    hlDry: 'Sec ces 48 prochaines heures',
    hlNoRainData: 'Pas de données de pluie pour les 48 prochaines heures',
    hlPeak: '{day} jusqu’à {temp} à {at}',
    hlBestDay: 'Meilleur jour pour sortir : {day}',
    hlBestDaySub: '{temp}, {rain} % de pluie',
    hlNoGoodDay: 'Pas de journée vraiment sèche cette semaine',
    hlSplit: 'les modèles divergent de {spread} {day}',
    hlWarmer: 'Plus chaud que la normale', hlCooler: 'Plus frais que la normale',
    hlNormal: 'Proche des normales de saison',
    hlCooling: 'Rafraîchissement la semaine prochaine', hlWarming: 'Réchauffement la semaine prochaine',
    hlTrendSub: 'cette semaine {w1} par rapport à la normale · semaine 2 : tendance seulement',
```

es:
```js
    todayWord: 'hoy', tomorrowWord: 'mañana',
    hlRainNow: 'Lloviendo ahora, amaina hacia las {until}',
    hlRainNow48: 'Lluvia casi continua en las próximas 48 horas',
    hlRainWindow: 'Lluvia probable {day} {from}–{to}',
    hlSourcesAgree: '{agree} de {total} fuentes',
    hlDry: 'Seco en las próximas 48 horas',
    hlNoRainData: 'Sin datos de lluvia para las próximas 48 horas',
    hlPeak: '{day} hasta {temp} a las {at}',
    hlBestDay: 'Mejor día para salir: {day}',
    hlBestDaySub: '{temp}, {rain} % de lluvia',
    hlNoGoodDay: 'Esta semana no hay un día realmente seco',
    hlSplit: 'los modelos difieren {spread} el {day}',
    hlWarmer: 'Más cálido de lo normal', hlCooler: 'Más fresco de lo normal',
    hlNormal: 'Normal para la época',
    hlCooling: 'Refresca la próxima semana', hlWarming: 'Sube la temperatura la próxima semana',
    hlTrendSub: 'esta semana {w1} respecto a lo normal · la semana 2 es solo tendencia',
```

it:
```js
    todayWord: 'oggi', tomorrowWord: 'domani',
    hlRainNow: 'Piove ora, in attenuazione verso le {until}',
    hlRainNow48: 'Pioggia quasi continua nelle prossime 48 ore',
    hlRainWindow: 'Pioggia probabile {day} {from}–{to}',
    hlSourcesAgree: '{agree} fonti su {total}',
    hlDry: 'Asciutto nelle prossime 48 ore',
    hlNoRainData: 'Nessun dato sulla pioggia per le prossime 48 ore',
    hlPeak: '{day} fino a {temp} alle {at}',
    hlBestDay: 'Giorno migliore per uscire: {day}',
    hlBestDaySub: '{temp}, {rain}% di pioggia',
    hlNoGoodDay: 'Nessun giorno davvero asciutto questa settimana',
    hlSplit: 'i modelli differiscono di {spread} {day}',
    hlWarmer: 'Più caldo del normale', hlCooler: 'Più fresco del normale',
    hlNormal: 'Nella norma stagionale',
    hlCooling: 'Si rinfresca la prossima settimana', hlWarming: 'Si scalda la prossima settimana',
    hlTrendSub: 'questa settimana {w1} rispetto alla norma · la settimana 2 è solo una tendenza',
```

- [ ] **Step 4: Run** — `npm test` → all pass.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Outlook headlines (rain window, best day, 14-day trend) with text in 5 languages"`

---

### Task 6: Fetchers and the payload builder

**Files:**
- Create: `lib/outlook/sources.js`, `lib/outlook/build.js`, `lib/outlook/build.test.js`

**Interfaces:**
- Consumes: everything from Tasks 1–5; `sourceName`; `localHourIso`.
- Produces:
  - `fetchOpenMeteoMultiRaw(lat, lon)`, `fetchEnsembleRaw(lat, lon)`, `fetchClimateRaw(lat, lon, now?)` → raw JSON | null
  - `buildOutlook({ geo, region, multi, ensemble?, climate?, national?, met?, weights?, now? }) → { payload, series, utcOffsetSec, todayLocal }` — `payload` is the `/api/outlook` response body (spec §3 shape, plus `nowLocal`).

- [ ] **Step 1: Write the failing tests**

```js path=lib/outlook/build.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildOutlook } from './build.js'

const fx = name => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)))
const VIENNA = { name: 'Vienna', country: 'Austria', lat: 48.21, lon: 16.37 }

// One synthetic model (ECMWF's column names) over `days` days from Oct 1.
function synthMulti(days = 10, offset = 3600) {
  const start = Date.UTC(2026, 9, 1)
  const time = Array.from({ length: days * 24 }, (_, i) => new Date(start + i * 3600e3).toISOString().slice(0, 16))
  const dates = Array.from({ length: days }, (_, i) => new Date(start + i * 864e5).toISOString().slice(0, 10))
  return {
    utc_offset_seconds: offset,
    hourly: { time, temperature_2m_ecmwf_ifs025: time.map(() => 12), precipitation_probability_ecmwf_ifs025: time.map(() => 20) },
    daily: { time: dates, temperature_2m_max_ecmwf_ifs025: dates.map(() => 16), temperature_2m_min_ecmwf_ifs025: dates.map(() => 8) },
  }
}
const SYNTH_NOW = Date.UTC(2026, 9, 1, 4, 30) // 05:30 local at UTC+1

test('buildOutlook — the recorded Vienna response becomes hours, days and headlines', () => {
  const multi = fx('om-multi-vienna.json')
  const now = Date.parse(`${multi.hourly.time[6]}:00Z`) - multi.utc_offset_seconds * 1000 + 20 * 60e3 // 06:20 local, day 1
  const { payload, series } = buildOutlook({ geo: VIENNA, region: 'europe', multi, now })
  assert.ok(series.length >= 5)
  assert.equal(payload.hourly[0].t, multi.hourly.time[6])
  assert.ok(payload.hourly.length >= 48)
  assert.equal(payload.days[0].date, multi.daily.time[0])
  assert.ok(payload.headlines.h48)
  assert.ok(payload.headlines.d7)
  assert.deepEqual(payload.notes, [])
  assert.ok(payload.sources.every(s => typeof s.name === 'string' && s.name.length))
})

test('buildOutlook — no climate: no normals, no 14-day headline, no records', () => {
  const { payload } = buildOutlook({ geo: VIENNA, region: 'europe', multi: synthMulti(), now: SYNTH_NOW })
  assert.deepEqual(payload.normals, [])
  assert.equal(payload.headlines.d14, null)
  assert.equal(payload.records, null)
  assert.equal(payload.nowLocal, '2026-10-01T05:00')
})

test('buildOutlook — week 2 without an ensemble is flagged; with one it gets member bands', () => {
  const without = buildOutlook({ geo: VIENNA, region: 'europe', multi: synthMulti(), now: SYNTH_NOW }).payload
  assert.deepEqual(without.notes, ['ensemble_unavailable'])
  const daily = { time: ['2026-10-09', '2026-10-10'] }
  for (let m = 0; m < 20; m++) {
    daily[`temperature_2m_max_member${String(m + 1).padStart(2, '0')}_ncep_gefs025`] = [10 + m, 10 + m]
    daily[`temperature_2m_min_member${String(m + 1).padStart(2, '0')}_ncep_gefs025`] = [m, m]
    daily[`precipitation_sum_member${String(m + 1).padStart(2, '0')}_ncep_gefs025`] = [0, 0]
  }
  const withEns = buildOutlook({ geo: VIENNA, region: 'europe', multi: synthMulti(), ensemble: { daily }, now: SYNTH_NOW }).payload
  assert.deepEqual(withEns.notes, [])
  assert.equal(withEns.days[8].members, 20)
  assert.equal(withEns.days[8].rainPct, 0)
})

test('buildOutlook — climate gives normals, a trend headline and records', () => {
  const time = [], mx = [], mn = [], pr = []
  for (const y of [2023, 2024]) for (let d = 1; d <= 20; d++) {
    time.push(`${y}-10-${String(d).padStart(2, '0')}`); mx.push(15); mn.push(5); pr.push(d % 4 === 0 ? 3 : 0)
  }
  const climate = { daily: { time, temperature_2m_max: mx, temperature_2m_min: mn, precipitation_sum: pr } }
  const { payload } = buildOutlook({ geo: VIENNA, region: 'europe', multi: synthMulti(), climate, now: SYNTH_NOW })
  assert.equal(payload.normals[0].max, 15)
  // highs of 16 vs a normal of 15: +1.0 in both weeks → warmer, no shift
  assert.deepEqual((({ dir, shift }) => ({ dir, shift }))(payload.headlines.d14), { dir: 'warmer', shift: null })
  assert.equal(payload.records.hottest.temp, 15)
})

test('buildOutlook — no Open-Meteo and no fallback: empty, flagged fewer_sources', () => {
  const { payload } = buildOutlook({ geo: VIENNA, region: 'europe', multi: null, now: SYNTH_NOW })
  assert.equal(payload.hourly.length, 0)
  assert.equal(payload.days.length, 0)
  assert.deepEqual(payload.notes, ['fewer_sources'])
})

test('buildOutlook — MET Norway steps in when Open-Meteo fails', () => {
  const met = fx('metno-oslo.json')
  const now = Date.parse(met.properties.timeseries[2].time)
  const { payload, series } = buildOutlook({ geo: { name: 'Oslo', country: 'Norway', lat: 59.91, lon: 10.75 }, region: 'europe', multi: null, met, now })
  assert.deepEqual(series.map(s => s.id), ['met-norway'])
  assert.ok(payload.hourly.length > 0)
  assert.deepEqual(payload.notes, ['fewer_sources'])
})
```

- [ ] **Step 2: Run to see them fail** — `node --test lib/outlook/build.test.js` → FAIL (module missing).

- [ ] **Step 3: Implement**

```js path=lib/outlook/sources.js
// Open-Meteo requests for the outlook (network; never throws — see http.js).

import { getJson } from './http.js'
import { OM_MODELS } from './models.js'

const HOURLY = 'temperature_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code'
const DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code,sunrise,sunset'

// One request, every model: hourly + daily for 16 days in city-local time.
export function fetchOpenMeteoMultiRaw(lat, lon) {
  const models = OM_MODELS.map(m => m.model).join(',')
  return getJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${HOURLY}&daily=${DAILY}&models=${models}&forecast_days=16&timezone=auto`, { cache: 'no-store' })
}

// ECMWF ENS (51 members) + NOAA GEFS (31): the honest week-2 spread.
export function fetchEnsembleRaw(lat, lon) {
  return getJson(`https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&models=ecmwf_ifs025,gfs025&forecast_days=16&timezone=auto`, { cache: 'no-store' })
}

// 10 years of daily history for normals and records. Climate doesn't change
// within a day: cached 24 h by Next's fetch cache, coordinates rounded so
// nearby lookups share an entry.
export function fetchClimateRaw(lat, lon, now = new Date()) {
  const end = now.getUTCFullYear() - 1, start = end - 9
  return getJson(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&start_date=${start}-01-01&end_date=${end}-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`, { next: { revalidate: 86400 }, ms: 15000 })
}
```

```js path=lib/outlook/build.js
// Assembles the /api/outlook payload from raw upstream responses. Pure: the
// route does the fetching, this does everything else — so it's unit tested.

import { parseOpenMeteoMulti } from './parse.js'
import { parseNational, parseMetNorway } from './national.js'
import { blendHourly, blendDaily } from './blend.js'
import { parseEnsemble, applyEnsemble } from './ensemble.js'
import { indexArchive, normalsFor, rainyDaysNormal, monthRecords, anomalies } from './climate.js'
import { headline48, headline7, headline14, bestTimeOutside } from './headlines.js'
import { localHourIso } from '../localtime.js'
import { sourceName } from '../sources.js'

export function buildOutlook({ geo, region, multi, ensemble = null, climate = null, national = {}, met = null, weights = {}, now = Date.now() }) {
  const parsed = parseOpenMeteoMulti(multi)
  const notes = []
  // Open-Meteo reports the city's real offset; the solar estimate only
  // covers the case where it didn't answer at all
  const utcOffsetSec = parsed?.utcOffsetSec ?? Math.round(geo.lon / 15) * 3600
  const series = [...(parsed?.series ?? []), ...parseNational(national ?? {}, utcOffsetSec)]
  if (!parsed?.series.length) {
    const fallback = met ? parseMetNorway(met, utcOffsetSec) : null
    if (fallback) series.push(fallback)
    notes.push('fewer_sources')
  }

  const nowLocal = localHourIso(utcOffsetSec, now)
  const todayLocal = nowLocal.slice(0, 10)
  const hourly = blendHourly(series, weights, { nowLocal, hours: 168 })
  let days = blendDaily(series, weights, { todayLocal, days: 14 })
  const ens = parseEnsemble(ensemble)
  if (ens) days = applyEnsemble(days, ens)
  else if (days.some(d => d.lead >= 8)) notes.push('ensemble_unavailable')

  const rows = indexArchive(climate)
  const dates = days.map(d => d.date)
  const normals = rows ? normalsFor(rows, dates) : []

  const payload = {
    city: geo.name, country: geo.country ?? null, lat: geo.lat, lon: geo.lon, region,
    generatedAt: new Date(now).toISOString(), utcOffsetSec, nowLocal,
    sources: series.map(s => ({ id: s.id, name: sourceName(s.id), reachHours: s.hourly.length })),
    notes,
    sun: parsed?.sun ?? { sunrise: null, sunset: null },
    hourly,
    bestTime: bestTimeOutside(hourly),
    days,
    normals,
    vsNormal: anomalies(days, normals),
    rainyDays: {
      forecast: days.filter(d => d.rainPct != null && d.rainPct >= 50).length,
      of: days.length,
      normal: rows ? rainyDaysNormal(rows, dates) : null,
    },
    records: rows ? monthRecords(rows, Number(todayLocal.slice(5, 7))) : null,
    headlines: { h48: headline48(hourly, { todayLocal }), d7: headline7(days), d14: headline14(days, normals) },
  }
  return { payload, series, utcOffsetSec, todayLocal }
}
```

- [ ] **Step 4: Run** — `npm test` → all pass.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Outlook fetchers and pure payload builder"`

---

### Task 7: Checkpoints and the database

**Files:**
- Create: `lib/outlook/checkpoints.js`, `lib/outlook/checkpoints.test.js`, `lib/outlook/weights.js`, `lib/outlook/snapshots.js`
- Modify: `supabase/setup_all.sql`, `supabase/enable_rls.sql`
- DB: apply migration `outlook_learning` via the Supabase MCP (`apply_migration`, project `loxstrespghksbnprovp`)

**Interfaces:**
- Consumes: `rainProb` (Task 3), `addDays` (Task 1), `buildWeightUpdates` (lib/weights.js), `sourceName`.
- Produces:
  - `HOURLY_LEADS`, `DAILY_LEADS`, `hourlySlot(ms)`, `dailySlot(date)`, `hourlyCheckpoints(series, { issuedAtMs, utcOffsetSec }) → [{ key, t, lead, temp, rain }]`, `dailyCheckpoints(series, { todayLocal }) → [{ key, date, lead, max, min, rain }]`
  - `HORIZONS = ['h48','d7','d14']`, `loadOutlookWeights(region) → weightsByHorizon`, `applyOutlookDeltas(region, horizon, deltaMap) → number` (count of touched sources)
  - `saveSnapshots({ city, lat, lon, region, series, utcOffsetSec, todayLocal, now? }) → number` (rows written)
  - SQL: tables `outlook_snapshots`, `outlook_weights`, RPC `mark_outlook_verified(rows jsonb)`

- [ ] **Step 1: Write the failing tests**

```js path=lib/outlook/checkpoints.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hourlyCheckpoints, dailyCheckpoints, hourlySlot, dailySlot } from './checkpoints.js'

const pt = (t, extra = {}) => ({ t, temp: 10, pop: 30, precip: null, wind: 5, code: null, ...extra })

test('hourlyCheckpoints — +6/12/24/48 h in UTC, looked up in city-local time', () => {
  // UTC+2; issued 13:20Z → next full hour 14:00Z → +6 h = 20:00Z = 22:00 local
  const s = { id: 'x', daily: [], hourly: [pt('2026-09-29T22:00'), pt('2026-09-30T04:00'), pt('2026-09-30T16:00', { pop: null, precip: 0.2 }), pt('2026-10-01T16:00', { pop: null })] }
  assert.deepEqual(hourlyCheckpoints(s, { issuedAtMs: Date.parse('2026-09-29T13:20:00Z'), utcOffsetSec: 7200 }), [
    { key: 'h6', t: '2026-09-29T20:00:00.000Z', lead: 6, temp: 10, rain: 0.3 },
    { key: 'h12', t: '2026-09-30T02:00:00.000Z', lead: 12, temp: 10, rain: 0.3 },
    { key: 'h24', t: '2026-09-30T14:00:00.000Z', lead: 24, temp: 10, rain: 1 },
    { key: 'h48', t: '2026-10-01T14:00:00.000Z', lead: 48, temp: 10, rain: null },
  ])
})

test('hourlyCheckpoints — half-hour offsets (India) line up too', () => {
  const s = { id: 'x', daily: [], hourly: [pt('2026-09-29T19:30')] }
  // issued 07:10Z → 08:00Z + 6 h = 14:00Z = 19:30 IST
  assert.deepEqual(hourlyCheckpoints(s, { issuedAtMs: Date.parse('2026-09-29T07:10:00Z'), utcOffsetSec: 19800 }).map(c => c.key), ['h6'])
})

test('dailyCheckpoints — leads 1..14 from the city-local date', () => {
  const d = (date, max) => ({ date, max, min: max - 8, pop: null, precip: 2, wind: 10, code: null })
  const s = { id: 'x', hourly: [], daily: [d('2026-09-29', 20), d('2026-09-30', 21), d('2026-10-13', 15), d('2026-10-14', 14)] }
  assert.deepEqual(dailyCheckpoints(s, { todayLocal: '2026-09-29' }).map(c => [c.key, c.date, c.max, c.rain]), [
    ['d1', '2026-09-30', 21, 1],
    ['d14', '2026-10-13', 15, 1],
  ])
})

test('slots — 6-hour UTC slots and yyyymmdd days', () => {
  assert.equal(hourlySlot(Date.parse('2026-09-29T05:59:00Z')), hourlySlot(Date.parse('2026-09-29T00:00:00Z')))
  assert.notEqual(hourlySlot(Date.parse('2026-09-29T06:00:00Z')), hourlySlot(Date.parse('2026-09-29T05:59:00Z')))
  assert.equal(dailySlot('2026-09-29'), 20260929)
})
```

- [ ] **Step 2: Run to see them fail** — `node --test lib/outlook/checkpoints.test.js` → FAIL.

- [ ] **Step 3: Implement the pure part**

```js path=lib/outlook/checkpoints.js
// Which predictions of a source get saved for later checking (pure — unit
// tested). Hourly checkpoints are stored as UTC instants so verification never
// has to think about timezones; daily ones as the city-local date.

import { rainProb } from './blend.js'
import { addDays } from '../localtime.js'

export const HOURLY_LEADS = [6, 12, 24, 48]
export const DAILY_LEADS = 14
const SLOT_MS = 6 * 3600e3

// Snapshot slots: one h-snapshot per 6 h (models refresh ~6-hourly), one
// d-snapshot per city-local day (daily predictions move slowly).
export const hourlySlot = ms => Math.floor(ms / SLOT_MS)
export const dailySlot = date => Number(date.replaceAll('-', ''))

export function hourlyCheckpoints(series, { issuedAtMs, utcOffsetSec }) {
  const base = Math.ceil(issuedAtMs / 3600e3) * 3600e3
  const byT = new Map((series.hourly ?? []).map(p => [p.t, p]))
  const out = []
  for (const lead of HOURLY_LEADS) {
    const targetMs = base + lead * 3600e3
    const p = byT.get(new Date(targetMs + utcOffsetSec * 1000).toISOString().slice(0, 16))
    if (p) out.push({ key: `h${lead}`, t: new Date(targetMs).toISOString(), lead, temp: p.temp, rain: rainProb(p.pop, p.precip, 0.1) })
  }
  return out
}

export function dailyCheckpoints(series, { todayLocal }) {
  const byDate = new Map((series.daily ?? []).map(d => [d.date, d]))
  const out = []
  for (let lead = 1; lead <= DAILY_LEADS; lead++) {
    const date = addDays(todayLocal, lead)
    const d = byDate.get(date)
    if (d) out.push({ key: `d${lead}`, date, lead, max: d.max, min: d.min, rain: rainProb(d.pop, d.precip, 1) })
  }
  return out
}
```

- [ ] **Step 4: Run** — `node --test lib/outlook/checkpoints.test.js` → PASS.

- [ ] **Step 5: Schema**

Add to `supabase/setup_all.sql` before the `── Server-side error log` section:

```sql
-- ── Outlook (future forecast) learning ──────────────────────────────────────
--    Saved predictions per source — kind 'h' (+6/12/24/48 h, one per city per
--    6 h) and 'd' (days 1–14, one per city per local day) — checked daily
--    against METAR history by /api/cleanup; weights per region × range.
create table if not exists outlook_snapshots (
  id             bigserial primary key,
  city           text not null,
  lat            double precision,
  lon            double precision,
  region         text not null default 'global',
  source         text not null,
  kind           text not null check (kind in ('h', 'd')),
  slot           integer not null,
  issued_at      timestamptz not null default now(),
  utc_offset_sec integer not null default 0,
  checkpoints    jsonb not null default '[]'::jsonb,
  verified       jsonb not null default '{}'::jsonb,
  next_due_at    timestamptz
);
create unique index if not exists outlook_snapshots_slot on outlook_snapshots (city, source, kind, slot);
create index if not exists outlook_snapshots_due  on outlook_snapshots (next_due_at);
create index if not exists outlook_snapshots_city on outlook_snapshots (city, issued_at desc);

create table if not exists outlook_weights (
  id            text    not null,
  region        text    not null default 'global',
  horizon       text    not null check (horizon in ('h48', 'd7', 'd14')),
  name          text,
  weight        double precision default 0.25,
  score         integer default 0,
  reports       integer default 0,
  delta_history jsonb   default '[]'::jsonb,
  updated_at    timestamptz default now(),
  primary key (id, region, horizon)
);

-- Marks checkpoints done and moves next_due_at, many rows in one call.
-- rows: [{ "id": 1, "verified": {...}, "next_due_at": "…" | null }, ...]
create or replace function mark_outlook_verified(rows jsonb)
returns void
language sql
as $$
  update outlook_snapshots s
     set verified    = r->'verified',
         next_due_at = (r->>'next_due_at')::timestamptz
    from jsonb_array_elements(rows) r
   where s.id = (r->>'id')::bigint;
$$;
revoke execute on function mark_outlook_verified(jsonb) from public, anon, authenticated;
grant  execute on function mark_outlook_verified(jsonb) to service_role;
```

In `supabase/enable_rls.sql` add `'outlook_snapshots','outlook_weights'` to the policy-drop list and:

```sql
alter table outlook_snapshots enable row level security;
alter table outlook_weights   enable row level security;
```

Apply the same SQL (tables, indexes, function, revoke/grant) plus the two `enable row level security` lines to the live project with the Supabase MCP `apply_migration` (name `outlook_learning`), then verify with `list_tables` that both tables exist with RLS on.

- [ ] **Step 6: DB modules**

```js path=lib/outlook/weights.js
// Learned outlook weights per region × range (h48 / d7 / d14). Same scoring
// and normalization as the live weights (buildWeightUpdates), separate table
// so the "right now" learning stays untouched.

import { supabase } from '../supabase.js'
import { buildWeightUpdates } from '../weights.js'
import { sourceName } from '../sources.js'

export const HORIZONS = ['h48', 'd7', 'd14']

// { h48: { id: weight }, … } for the region, per range falling back to the
// global ranking while the region has no rows yet.
export async function loadOutlookWeights(region) {
  const { data, error } = await supabase
    .from('outlook_weights')
    .select('id, region, horizon, weight')
    .in('region', [...new Set([region, 'global'])])
  if (error || !data) return {}
  const out = {}
  for (const h of HORIZONS) {
    const own = data.filter(r => r.horizon === h && r.region === region)
    const rows = own.length ? own : data.filter(r => r.horizon === h && r.region === 'global')
    if (rows.length) out[h] = Object.fromEntries(rows.map(r => [r.id, r.weight]))
  }
  return out
}

// Apply score deltas to one region × range and persist the re-normalized set
// as one batch upsert. Sources seen for the first time get a fresh row.
export async function applyOutlookDeltas(region, horizon, deltaMap) {
  const { data, error } = await supabase
    .from('outlook_weights')
    .select('id, score, reports, delta_history')
    .eq('region', region)
    .eq('horizon', horizon)
  if (error) throw error
  const rows = [...(data ?? [])]
  for (const id of Object.keys(deltaMap)) {
    if (!rows.some(r => r.id === id)) rows.push({ id, score: 0, reports: 0, delta_history: [] })
  }
  const built = buildWeightUpdates(rows, deltaMap, true)
  if (!built) return 0
  const history = Object.fromEntries(rows.map(r => [r.id, Array.isArray(r.delta_history) ? r.delta_history : []]))
  const now = new Date().toISOString()
  const batch = built.updates.map(u => ({
    id: u.id, region, horizon, name: sourceName(u.id),
    score: u.score, reports: u.reports, weight: u.rawFactor / built.total,
    delta_history: u.history ?? history[u.id], updated_at: now,
  }))
  const { error: upErr } = await supabase.from('outlook_weights').upsert(batch, { onConflict: 'id,region,horizon' })
  if (upErr) throw upErr
  return built.updates.filter(u => u.deltas).length
}
```

```js path=lib/outlook/snapshots.js
// Saves each source's outlook predictions for later verification: at most one
// 'h' snapshot per city per 6 h and one 'd' snapshot per city-local day. The
// unique (city, source, kind, slot) index settles races between instances.

import { supabase } from '../supabase.js'
import { hourlyCheckpoints, dailyCheckpoints, hourlySlot, dailySlot } from './checkpoints.js'
import { nextDueAt } from './verify.js'

export async function saveSnapshots({ city, lat, lon, region, series, utcOffsetSec, todayLocal, now = Date.now() }) {
  const hSlot = hourlySlot(now), dSlot = dailySlot(todayLocal)
  const { data: recent, error } = await supabase
    .from('outlook_snapshots')
    .select('kind, slot')
    .eq('city', city)
    .gte('issued_at', new Date(now - 1.5 * 864e5).toISOString())
  if (error) throw error
  const have = new Set((recent ?? []).map(r => `${r.kind}${r.slot}`))
  const issued_at = new Date(now).toISOString()
  const rows = []
  for (const s of series) {
    const kinds = [
      ['h', hSlot, have.has(`h${hSlot}`) ? [] : hourlyCheckpoints(s, { issuedAtMs: now, utcOffsetSec })],
      ['d', dSlot, have.has(`d${dSlot}`) ? [] : dailyCheckpoints(s, { todayLocal })],
    ]
    for (const [kind, slot, checkpoints] of kinds) {
      if (!checkpoints.length) continue
      const row = { city, lat, lon, region, source: s.id, kind, slot, issued_at, utc_offset_sec: utcOffsetSec, checkpoints, verified: {} }
      row.next_due_at = nextDueAt(row, {})
      rows.push(row)
    }
  }
  if (!rows.length) return 0
  const { error: insErr } = await supabase
    .from('outlook_snapshots')
    .upsert(rows, { onConflict: 'city,source,kind,slot', ignoreDuplicates: true })
  if (insErr) throw insErr
  return rows.length
}
```

(`snapshots.js` imports `nextDueAt` from `verify.js`, created in Task 9; implement Task 9's pure `verify.js` before running a build.)

- [ ] **Step 7: Commit** — `git add -A && git commit -m "Outlook learning storage: checkpoints, snapshots, per-range weights (schema + migration)"`

---

### Task 8: `/api/outlook`

**Files:**
- Create: `app/api/outlook/route.js`

**Interfaces:**
- Consumes: `geocodeCity`, `getRegion` (lib/weather.js); fetchers (Tasks 2, 6); `buildOutlook`; `loadOutlookWeights`; `saveSnapshots`; `createRateLimiter`; `withErrorLog`, `logError`; `clientIp`.
- Produces: `GET /api/outlook?city=<name>` → spec §3 payload (200, CDN-cached) or `{ error }` (400/404/429/502, `no-store`).

- [ ] **Step 1: Implement**

```js path=app/api/outlook/route.js
import { withErrorLog, logError } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { geocodeCity, getRegion } from '@/lib/weather'
import { fetchOpenMeteoMultiRaw, fetchEnsembleRaw, fetchClimateRaw } from '@/lib/outlook/sources'
import { fetchNationalRaw, fetchMetNorwayRaw } from '@/lib/outlook/national'
import { buildOutlook } from '@/lib/outlook/build'
import { loadOutlookWeights } from '@/lib/outlook/weights'
import { saveSnapshots } from '@/lib/outlook/snapshots'

// The future forecast: 48 h / 7 days / 14 days consensus + headlines.
// Language-neutral on purpose — every visitor of a city shares one CDN copy
// for 30 minutes, so 1 or 1,000 viewers cost the same upstream calls.
export const maxDuration = 30

const TTL = 1800
const limiter = createRateLimiter({ max: 40, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const GET = withErrorLog('outlook', async (request) => {
  const q = new URL(request.url).searchParams.get('city')?.trim()
  if (!q) return noStore({ error: 'No city specified' }, 400)
  // only cache misses reach this point — CDN hits never invoke the function
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)

  const geo = await geocodeCity(q, 'en')
  if (!geo) return noStore({ error: `"${q}" was not found.` }, 404)
  const region = getRegion(geo.lat, geo.lon)

  const [multi, ensemble, climate, national, weights] = await Promise.all([
    fetchOpenMeteoMultiRaw(geo.lat, geo.lon),
    fetchEnsembleRaw(geo.lat, geo.lon),
    fetchClimateRaw(geo.lat, geo.lon),
    fetchNationalRaw(geo.lat, geo.lon),
    loadOutlookWeights(region),
  ])
  // MET Norway only as the fallback when the model request failed
  const met = multi ? null : await fetchMetNorwayRaw(geo.lat, geo.lon)

  const { payload, series, utcOffsetSec, todayLocal } = buildOutlook({ geo, region, multi, ensemble, climate, national, met, weights })
  if (!payload.hourly.length && !payload.days.length) {
    return noStore({ error: 'Forecast unavailable right now — please try again shortly.' }, 502)
  }

  // Learning must never break the forecast itself
  try {
    await saveSnapshots({ city: geo.name, lat: geo.lat, lon: geo.lon, region, series, utcOffsetSec, todayLocal })
  } catch (e) {
    await logError('outlook.snapshot', e, { city: geo.name })
  }

  return Response.json(payload, {
    headers: { 'Cache-Control': `public, s-maxage=${TTL}, stale-while-revalidate=${TTL * 2}` },
  })
})
```

- [ ] **Step 2: Verify locally** — `npm run build`, then `npx next start -p 3100` in the background and:

```bash
for c in vienna london oslo "new york" tokyo; do
  curl -s "http://localhost:3100/api/outlook?city=$(printf %s "$c" | sed 's/ /%20/g')" -o /tmp/o.json -w "$c %{http_code} %{time_total}s\n"
  node -e "const d=require('/tmp/o.json');console.log(' sources:',d.sources.map(s=>s.id).join(','),'| hours',d.hourly.length,'| days',d.days.length,'| notes',d.notes,'| h48',d.headlines.h48?.code,'| d7',d.headlines.d7?.code,'| d14',d.headlines.d14?.dir)"
done
curl -s -o /dev/null -w "missing city %{http_code}\n" "http://localhost:3100/api/outlook"
curl -sI "http://localhost:3100/api/outlook?city=vienna" | grep -i cache-control
```
Expected: 200 for all five with ≥ 5 sources in Europe (≥ 4 elsewhere), `hours` 168, `days` 14, headlines present; 400 for the missing city; `cache-control: public, s-maxage=1800, stale-while-revalidate=3600`. Check with the Supabase MCP (`execute_sql`: `select kind, count(*) from outlook_snapshots group by kind`) that snapshots were written. Stop the server.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "/api/outlook: multi-model future forecast, CDN-cached 30 min, snapshots for learning"`

---

### Task 9: Daily verification

**Files:**
- Create: `lib/outlook/verify.js`, `lib/outlook/verify.test.js`, `lib/outlook/job.js`
- Modify: `app/api/cleanup/route.js`, `app/api/backup/route.js`

**Interfaces:**
- Consumes: `deltaFromDiff` + schemes (Task 1), `haversineKm`, `horizonForLeadDays` (Task 3), `applyOutlookDeltas` (Task 7), `lib/airports.json` (job only).
- Produces:
  - `METAR_WINDOW_H`, `GRACE_MS`, `isWet(wx)`, `nearestStations(lat, lon, airports, { maxKm, limit }) → icao[]`, `indexMetars(reports) → Map<icao, [{ tMs, temp, wet }]>`, `pickObs(index, stations)`, `observationAt(obs, targetMs, tolMs?) → { temp, wet } | null`, `observedDay(obs, startMs, minReports?) → { max, min, wet, n } | null`, `brier(p, wet)`, `scoreHourly(cp, ob, horizon) → delta[] | null`, `scoreDaily(cp, day, horizon) → delta[] | null`, `checkpointTimes(kind, cp, utcOffsetSec)`, `dueItems(row, nowMs)`, `nextDueAt(row, verified?) → iso | null`
  - `runOutlookVerification({ now? }) → stats`

- [ ] **Step 1: Write the failing tests**

```js path=lib/outlook/verify.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isWet, nearestStations, indexMetars, pickObs, observationAt, observedDay, scoreHourly, scoreDaily, dueItems, nextDueAt } from './verify.js'

test('isWet — precipitation at the station, not vicinity / obscuration / blowing snow', () => {
  for (const wx of ['RA', '-SHRA BR', '+TSRA', 'FZDZ', 'SN', '-RASN']) assert.equal(isWet(wx), true, wx)
  for (const wx of ['VCSH', 'BR', 'FG HZ', 'BLSN', 'TS', '', null]) assert.equal(isWet(wx), false, String(wx))
})

const AIRPORTS = {
  LOWW: { la: 48.11, lo: 16.57, t: 'l' },
  XXXX: { la: 48.30, lo: 16.40, t: 'm' },
  LOAN: { la: 47.84, lo: 16.22, t: 's' },
  LZIB: { la: 48.17, lo: 17.21, t: 'l' }, // ~62 km — just outside
  LOWL: { la: 48.23, lo: 14.19, t: 'm' },
}

test('nearestStations — large/medium airports within 60 km, nearest first; nothing in range → []', () => {
  assert.deepEqual(nearestStations(48.21, 16.37, AIRPORTS), ['XXXX', 'LOWW'])
  assert.deepEqual(nearestStations(0, 0, AIRPORTS), [])
})

test('indexMetars — per station, oldest first, reports without a temperature skipped', () => {
  const idx = indexMetars([
    { icaoId: 'LOWW', obsTime: 1790690400, temp: 12, wxString: '-RA' },
    { icaoId: 'LOWW', obsTime: 1790688600, temp: 11, wxString: null },
    { icaoId: 'LOWW', obsTime: 1790692200, temp: null },
    { icaoId: 'EDDM', reportTime: '2026-09-29T12:20:00Z', temp: 9 },
  ])
  assert.deepEqual(idx.get('LOWW').map(o => [o.temp, o.wet]), [[11, false], [12, true]])
  assert.equal(idx.get('EDDM')[0].tMs, Date.parse('2026-09-29T12:20:00Z'))
  assert.deepEqual(pickObs(idx, ['NONE', 'EDDM']), idx.get('EDDM'))
  assert.equal(pickObs(idx, ['NONE']), null)
})

const series = (startIso, n, stepMin, fn) =>
  Array.from({ length: n }, (_, i) => ({ tMs: Date.parse(startIso) + i * stepMin * 60e3, ...fn(i) }))

test('observationAt — nearest report within ±30 min', () => {
  const obs = series('2026-09-29T00:20:00Z', 5, 60, i => ({ temp: 10 + i, wet: i === 2 }))
  assert.deepEqual(observationAt(obs, Date.parse('2026-09-29T02:00:00Z')), { temp: 12, wet: true })
  assert.equal(observationAt(obs, Date.parse('2026-09-29T08:00:00Z')), null)
})

test('observedDay — max/min/wet over the local day, needs ≥ 18 reports', () => {
  const start = Date.parse('2026-09-28T22:00:00Z') // local midnight at UTC+2
  const obs = series('2026-09-28T22:20:00Z', 24, 60, i => ({ temp: i === 13 ? 21 : i === 4 ? 6 : 12, wet: i === 20 }))
  assert.deepEqual(observedDay(obs, start), { max: 21, min: 6, wet: true, n: 24 })
  assert.equal(observedDay(obs.slice(0, 10), start), null)
})

test('scoreHourly / scoreDaily — temperature deltas by range, rain from the Brier score', () => {
  assert.deepEqual(scoreHourly({ temp: 11, rain: 0.9 }, { temp: 12, wet: true }, 'h48'), [2, 2])
  assert.deepEqual(scoreHourly({ temp: 18, rain: null }, { temp: 12, wet: false }, 'h48'), [-1])
  assert.equal(scoreHourly({ temp: 18 }, null, 'h48'), null)
  assert.deepEqual(scoreDaily({ max: 20, min: 9, rain: 0 }, { max: 23, min: 9.5, wet: true }, 'd7'), [1, 2, -2])
  assert.deepEqual(scoreDaily({ max: 20, min: 9, rain: 0 }, { max: 23, min: 9.5, wet: true }, 'd14'), [2, 2, -2])
})

test('dueItems — only checkpoints whose time has come; beyond the METAR window they are stale', () => {
  const row = {
    kind: 'h', utc_offset_sec: 7200, verified: { h6: 'scored' },
    checkpoints: [{ key: 'h6', t: '2026-09-29T20:00:00.000Z' }, { key: 'h12', t: '2026-09-30T02:00:00.000Z' }, { key: 'h24', t: '2026-09-30T14:00:00.000Z' }],
  }
  assert.deepEqual(dueItems(row, Date.parse('2026-09-30T05:00:00Z')).map(i => [i.cp.key, i.stale]), [['h12', false]])
  assert.deepEqual(dueItems(row, Date.parse('2026-10-03T13:00:00Z')).map(i => [i.cp.key, i.stale]), [['h12', true], ['h24', true]])
})

test('dueItems — a daily checkpoint waits for the local day (+ grace) to end', () => {
  const row = { kind: 'd', utc_offset_sec: 7200, verified: {}, checkpoints: [{ key: 'd1', date: '2026-09-30' }] }
  // local day = 2026-09-29T22:00Z … 2026-09-30T22:00Z, + 2 h grace
  assert.equal(dueItems(row, Date.parse('2026-09-30T23:30:00Z')).length, 0)
  assert.equal(dueItems(row, Date.parse('2026-10-01T00:30:00Z')).length, 1)
})

test('nextDueAt — earliest unverified checkpoint, null when all are done', () => {
  const row = { kind: 'h', utc_offset_sec: 0, verified: {}, checkpoints: [{ key: 'h6', t: '2026-09-29T20:00:00.000Z' }, { key: 'h12', t: '2026-09-30T02:00:00.000Z' }] }
  assert.equal(nextDueAt(row), '2026-09-29T22:00:00.000Z')
  assert.equal(nextDueAt(row, { h6: 'scored' }), '2026-09-30T04:00:00.000Z')
  assert.equal(nextDueAt(row, { h6: 'scored', h12: 'expired' }), null)
})
```

- [ ] **Step 2: Run to see them fail** — `node --test lib/outlook/verify.test.js` → FAIL.

- [ ] **Step 3: Implement**

```js path=lib/outlook/verify.js
// Matching saved outlook predictions against airport observations (pure —
// unit tested). Ground truth is NOAA AWC METAR history, which serves ~75 h
// per station (measured), so one daily job can check everything that came
// due since the last run.

import { deltaFromDiff } from '../scoring.js'
import { haversineKm } from '../geo.js'

export const METAR_WINDOW_H = 70
export const GRACE_MS = 2 * 3600e3 // reports can take a while to show up
const SCHEME = { h48: 'lead_h48', d7: 'lead_d7', d14: 'lead_d14' }

// Precipitation AT the station: vicinity (VC…), blowing/drifting snow and
// obscurations don't count; thunder without precipitation doesn't either.
const PRECIP = /RA|DZ|SN|SG|PL|GR|GS|UP/
export function isWet(wx) {
  if (typeof wx !== 'string') return false
  return wx.split(/\s+/).some(tok => {
    const t = tok.replace(/^[+-]/, '')
    return t && !t.startsWith('VC') && !t.startsWith('BL') && !t.startsWith('DR') && PRECIP.test(t)
  })
}

// Up to `limit` large/medium airports within maxKm (small fields rarely
// report METAR), nearest first. `airports` is lib/airports.json's shape.
export function nearestStations(lat, lon, airports, { maxKm = 60, limit = 3 } = {}) {
  const found = []
  for (const [icao, a] of Object.entries(airports)) {
    if (a.t !== 'l' && a.t !== 'm') continue
    if (Math.abs(a.la - lat) > 1 || Math.abs(a.lo - lon) > 1.5) continue // cheap prefilter
    const km = haversineKm(lat, lon, a.la, a.lo)
    if (km <= maxKm) found.push({ icao, km })
  }
  return found.sort((x, y) => x.km - y.km).slice(0, limit).map(f => f.icao)
}

export function indexMetars(reports) {
  const by = new Map()
  for (const m of reports ?? []) {
    if (typeof m?.temp !== 'number' || !m.icaoId) continue
    const tMs = typeof m.obsTime === 'number' ? m.obsTime * 1000 : Date.parse(m.reportTime)
    if (!Number.isFinite(tMs)) continue
    let a = by.get(m.icaoId)
    if (!a) by.set(m.icaoId, (a = []))
    a.push({ tMs, temp: m.temp, wet: isWet(m.wxString) })
  }
  for (const a of by.values()) a.sort((x, y) => x.tMs - y.tMs)
  return by
}

// The first candidate station that actually reported anything.
export function pickObs(index, stations) {
  for (const s of stations ?? []) {
    const o = index.get(s)
    if (o?.length) return o
  }
  return null
}

export function observationAt(obs, targetMs, tolMs = 30 * 60e3) {
  let best = null
  for (const o of obs ?? []) {
    const d = Math.abs(o.tMs - targetMs)
    if (d <= tolMs && (!best || d < Math.abs(best.tMs - targetMs))) best = o
  }
  return best ? { temp: best.temp, wet: best.wet } : null
}

export function observedDay(obs, startMs, minReports = 18) {
  const inDay = (obs ?? []).filter(o => o.tMs >= startMs && o.tMs < startMs + 864e5)
  if (inDay.length < minReports) return null
  const temps = inDay.map(o => o.temp)
  return { max: Math.max(...temps), min: Math.min(...temps), wet: inDay.some(o => o.wet), n: inDay.length }
}

export const brier = (p, wet) => (p - (wet ? 1 : 0)) ** 2

export function scoreHourly(cp, ob, horizon = 'h48') {
  if (!ob || typeof cp?.temp !== 'number') return null
  const out = [deltaFromDiff(Math.abs(cp.temp - ob.temp), SCHEME[horizon])]
  if (typeof cp.rain === 'number') out.push(deltaFromDiff(brier(cp.rain, ob.wet), 'rain'))
  return out
}

export function scoreDaily(cp, day, horizon) {
  if (!day || typeof cp?.max !== 'number' || typeof cp?.min !== 'number') return null
  const s = SCHEME[horizon]
  const out = [deltaFromDiff(Math.abs(cp.max - day.max), s), deltaFromDiff(Math.abs(cp.min - day.min), s)]
  if (typeof cp.rain === 'number') out.push(deltaFromDiff(brier(cp.rain, day.wet), 'rain'))
  return out
}

// When a checkpoint can be checked (dueMs) and where its truth starts (dataMs).
export function checkpointTimes(kind, cp, utcOffsetSec) {
  if (kind === 'h') {
    const targetMs = Date.parse(cp.t)
    return { dueMs: targetMs + GRACE_MS, dataMs: targetMs, targetMs }
  }
  const startMs = Date.parse(`${cp.date}T00:00:00Z`) - utcOffsetSec * 1000
  return { dueMs: startMs + 864e5 + GRACE_MS, dataMs: startMs, startMs }
}

export function dueItems(row, nowMs) {
  const done = row.verified ?? {}
  const out = []
  for (const cp of row.checkpoints ?? []) {
    if (done[cp.key]) continue
    const times = checkpointTimes(row.kind, cp, row.utc_offset_sec ?? 0)
    if (times.dueMs > nowMs) continue
    out.push({ cp, ...times, stale: nowMs - times.dataMs > METAR_WINDOW_H * 3600e3 })
  }
  return out
}

export function nextDueAt(row, verified = row.verified ?? {}) {
  let min = null
  for (const cp of row.checkpoints ?? []) {
    if (verified[cp.key]) continue
    const { dueMs } = checkpointTimes(row.kind, cp, row.utc_offset_sec ?? 0)
    if (min == null || dueMs < min) min = dueMs
  }
  return min == null ? null : new Date(min).toISOString()
}
```

```js path=lib/outlook/job.js
// Daily verification of the outlook's saved predictions against METAR
// history — run from the nightly /api/cleanup cron. Checkpoints are marked
// done BEFORE their deltas are applied: a crash loses a signal instead of
// counting it twice (same policy as station calibration).

import airports from '../airports.json'
import { supabase } from '../supabase.js'
import { horizonForLeadDays } from './blend.js'
import { applyOutlookDeltas } from './weights.js'
import {
  METAR_WINDOW_H, nearestStations, indexMetars, pickObs, observationAt, observedDay,
  scoreHourly, scoreDaily, dueItems, nextDueAt,
} from './verify.js'

const AWC = 'https://aviationweather.gov/api/data/metar'
const UA = { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' }
const PAGE = 1000

async function fetchMetarHistory(ids) {
  const out = []
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40)
    try {
      const res = await fetch(`${AWC}?ids=${chunk.join(',')}&format=json&hours=${METAR_WINDOW_H + 2}`, {
        headers: UA, signal: AbortSignal.timeout(20000), cache: 'no-store',
      })
      if (res.ok) {
        const arr = await res.json()
        if (Array.isArray(arr)) out.push(...arr)
      }
    } catch { /* a failed chunk just leaves those cities waiting for the next run */ }
  }
  return out
}

async function loadDue(nowIso) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('outlook_snapshots')
      .select('id, city, lat, lon, region, source, kind, utc_offset_sec, checkpoints, verified')
      .lte('next_due_at', nowIso)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

export async function runOutlookVerification({ now = Date.now() } = {}) {
  const rows = await loadDue(new Date(now).toISOString())
  const stats = { snapshots: rows.length, scored: 0, expired: 0, waiting: 0, stations: 0, updated: 0, deleted: 0, weights: {} }

  if (rows.length) {
    const stationsByCity = new Map()
    for (const r of rows) {
      if (!stationsByCity.has(r.city) && r.lat != null && r.lon != null) stationsByCity.set(r.city, nearestStations(r.lat, r.lon, airports))
    }
    const ids = [...new Set([...stationsByCity.values()].flat())]
    stats.stations = ids.length
    const index = indexMetars(await fetchMetarHistory(ids))

    const deltas = {} // `${region}|${horizon}` → { source: [delta, …] }
    const add = (region, horizon, source, ds) => {
      for (const reg of region === 'global' ? ['global'] : [region, 'global']) {
        ((deltas[`${reg}|${horizon}`] ??= {})[source] ??= []).push(...ds)
      }
    }
    const marks = [], done = []

    for (const r of rows) {
      const stations = stationsByCity.get(r.city) ?? []
      const obs = pickObs(index, stations)
      const verified = { ...(r.verified ?? {}) }
      for (const item of dueItems(r, now)) {
        const horizon = r.kind === 'h' ? 'h48' : horizonForLeadDays(item.cp.lead)
        const ds = !obs ? null
          : r.kind === 'h' ? scoreHourly(item.cp, observationAt(obs, item.targetMs), horizon)
            : scoreDaily(item.cp, observedDay(obs, item.startMs), horizon)
        if (ds) { verified[item.cp.key] = 'scored'; stats.scored++; add(r.region, horizon, r.source, ds) }
        else if (item.stale || !stations.length) { verified[item.cp.key] = 'expired'; stats.expired++ }
        else stats.waiting++
      }
      const next = nextDueAt(r, verified)
      if (next == null) done.push(r.id)
      else if (JSON.stringify(verified) !== JSON.stringify(r.verified ?? {})) marks.push({ id: r.id, verified, next_due_at: next })
    }

    // 1) persist the marks and drop finished snapshots — before any weight moves
    for (let i = 0; i < marks.length; i += 500) {
      const { error } = await supabase.rpc('mark_outlook_verified', { rows: marks.slice(i, i + 500) })
      if (error) throw error
    }
    stats.updated = marks.length
    for (let i = 0; i < done.length; i += 500) {
      const { error } = await supabase.from('outlook_snapshots').delete().in('id', done.slice(i, i + 500))
      if (error) throw error
    }
    stats.deleted = done.length

    // 2) apply the collected deltas per region × range
    for (const [key, deltaMap] of Object.entries(deltas)) {
      const [region, horizon] = key.split('|')
      stats.weights[key] = await applyOutlookDeltas(region, horizon, deltaMap)
    }
  }

  // 3) safety net: nothing older than 16 days survives, checked or not
  await supabase.from('outlook_snapshots').delete().lt('issued_at', new Date(now - 16 * 864e5).toISOString())
  return stats
}
```

In `app/api/cleanup/route.js`: `export const maxDuration = 300`; import `runOutlookVerification` from `@/lib/outlook/job` and `logError` from `@/lib/log`; after `runMeteostatValidation()`:

```js
  // Outlook learning: check the predictions whose time has come
  let outlook
  try {
    outlook = await runOutlookVerification()
  } catch (e) {
    await logError('outlook.verify', e)
    outlook = { error: e.message }
  }
```
and include `outlook` in both JSON responses. In `app/api/backup/route.js` add `{ name: 'outlook_weights', order: 'id' }` to `TABLES` (learned state, can't be re-derived).

- [ ] **Step 4: Run** — `npm test`, `npx eslint .`, `npm run build` → all green.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Outlook verification: daily METAR check of saved predictions, per-range weights, inside the cleanup cron"`

---

### Task 10: Leaderboard API horizons

**Files:**
- Modify: `app/api/leaderboard/route.js`

**Interfaces:**
- Produces: response gains `horizons: { h48: regions, d7: regions, d14: regions }` (same `{ region, apis, leader }` shape as `regions`); `regions` and `apis` unchanged.

- [ ] **Step 1: Implement** — extract the region grouping into `groupByRegion(rows, stats)` (existing sort + `REGION_ORDER` filter) used for `regions`; then:

```js
  // Outlook rankings per range. api_stats timings belong to the live
  // endpoints, so they're deliberately not attached here.
  const { data: ow } = await supabase
    .from('outlook_weights')
    .select('id, name, weight, score, reports, updated_at, region, horizon, delta_history')
  const horizons = Object.fromEntries(['h48', 'd7', 'd14'].map(h => [h, groupByRegion((ow ?? []).filter(r => r.horizon === h), {})]))

  return Response.json({ regions, apis, horizons })
```

- [ ] **Step 2: Verify** — local server: `curl -s localhost:3100/api/leaderboard | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s);console.log(Object.keys(d), Object.fromEntries(Object.entries(d.horizons).map(([k,v])=>[k,v.length])))})"` → keys include `horizons`.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "Leaderboard API: outlook rankings per range"`

---

### Task 11: Ship the backend (learning starts)

- [ ] **Step 1:** `npm test && npx eslint . && npm run build` → green.
- [ ] **Step 2:** `git push origin main`; wait for the Vercel check on the commit (`gh api repos/NeverFirstTry/metablend/commits/<sha>/status`) → `success`.
- [ ] **Step 3: CDN behaviour on production**

```bash
U="https://metablend.app/api/outlook?city=vienna"
curl -s -o /dev/null -D - "$U" | grep -iE 'x-vercel-cache|cache-control|age'
sleep 2
curl -s -o /dev/null -D - "$U" | grep -iE 'x-vercel-cache|age'   # expect HIT
curl -s -o /dev/null -D - "https://metablend.app/api/outlook?city=" | grep -iE 'x-vercel-cache|cache-control' # expect no-store, not HIT
```
If the second request is not `HIT`, inspect `vary`/`set-cookie` and adjust (e.g. add `CDN-Cache-Control` with the same value) before continuing.
- [ ] **Step 4:** Supabase MCP: `select kind, count(*) from outlook_snapshots group by kind` → rows for vienna.

---

### Task 12: UI building blocks

**Files:**
- Create: `app/components/ui.jsx`, `app/components/outlook/{icons.js,useWidth.js,Headline.jsx,HourlyChart.jsx,HourStrip.jsx,TrendChart.jsx,Notes.jsx,Status.jsx,RangeTabs.jsx}`
- Modify: `app/components/RainRadar.jsx` (`bare` prop), `lib/i18n.js` (UI keys)

**Interfaces:**
- Produces: `MetricCard`, `SectionTitle`, `Fold({ icon, title, children, defaultOpen })` (ui.jsx); `conditionIcon(condition, lon)`, `heroCondition(forecastData)` (icons.js); `useWidth(initial) → [ref, width]`; `<Headline text tone />`; `<HourlyChart hours unit lang height? />`; `<HourStrip hours fmtTemp />`; `<TrendChart days normals unit lang />`; `<Notes notes lang />`; `<OutlookSkeleton />`, `<OutlookError lang onRetry />`; `RANGES`, `<RangeTabs value onChange lang />`; `<RainRadar lat lon bare />`.

- [ ] **Step 1: Components**

```jsx path=app/components/ui.jsx
'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

// Small shared building blocks for the forecast page and its tab views.

export function MetricCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-zinc-800/60 border border-zinc-800 rounded-xl px-4 py-3 flex-1 min-w-[90px] transition-colors duration-200 hover:border-zinc-700">
      <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5 min-w-0">
        {Icon && <Icon size={13} className="shrink-0" aria-hidden />}
        {/* break-words: long unbroken labels (Luftgüte was Luftqualität…) must wrap, not escape the card */}
        <span className="min-w-0 break-words">{label}</span>
      </div>
      <div className="text-2xl font-bold leading-none tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color }}>{sub}</div>}
    </div>
  )
}

// Section heading shared by every results card — icon + uppercase label, so
// the typographic hierarchy is identical everywhere.
export function SectionTitle({ icon: Icon, children, className = '' }) {
  return (
    <div className={`text-emerald-400 text-xs tracking-widest uppercase flex items-center gap-2 ${className}`}>
      {Icon && <Icon size={14} className="shrink-0" aria-hidden />}
      <span>{children}</span>
    </div>
  )
}

// A titled card whose body only mounts when opened — keeps heavy children
// (the radar map, the source cards) out of the first paint.
export function Fold({ icon: Icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left text-sm text-zinc-300 hover:text-emerald-400 transition-colors"
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          {Icon && <Icon size={15} className="shrink-0" aria-hidden />}
          <span className="min-w-0">{title}</span>
        </span>
        <ChevronDown size={16} className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && <div className="px-4 sm:px-5 pb-5 animate-fade-in">{children}</div>}
    </div>
  )
}
```

```js path=app/components/outlook/icons.js
import { isNightAt } from '@/lib/localtime'

// Consensus condition → icon. Sources report English condition strings;
// night only swaps the clear-sky icon, judged by the city's clock.
export function conditionIcon(condition, lon) {
  const c = (condition ?? '').toLowerCase()
  if (/thunder|storm/.test(c)) return '⛈'
  if (/snow|sleet|ice|freez/.test(c)) return '🌨'
  if (/drizzle/.test(c)) return '🌦'
  if (/rain|shower/.test(c)) return '🌧'
  if (/fog|mist|haze/.test(c)) return '🌫'
  if (/overcast/.test(c)) return '☁️'
  if (/partly|broken|scattered|few/.test(c)) return '⛅'
  if (/cloud/.test(c)) return '☁️'
  if (/clear|sunny|fair/.test(c)) return isNightAt(lon) ? '🌙' : '☀️'
  return '🌤'
}

// Open-Meteo's wording when it's up, otherwise the first healthy source.
export function heroCondition(data) {
  return data?.sources?.find(s => s.apiId === 'open-meteo' && !s.down)?.condition
    ?? data?.sources?.find(s => !s.down && s.condition)?.condition
    ?? null
}
```

```js path=app/components/outlook/useWidth.js
'use client'

import { useEffect, useRef, useState } from 'react'

// Tracks an element's rendered width so charts can draw at real pixel size
// (a stretched viewBox would squash the labels on phones).
export default function useWidth(initial = 600) {
  const ref = useRef(null)
  const [width, setWidth] = useState(initial)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}
```

```jsx path=app/components/outlook/Headline.jsx
const TONES = {
  rain: { box: 'bg-blue-500/10 border-blue-500/40', color: 'var(--info)' },
  ok: { box: 'bg-emerald-400/10 border-emerald-400/40', color: 'var(--ok)' },
  warn: { box: 'bg-amber-400/10 border-amber-400/40', color: 'var(--warn)' },
  neutral: { box: 'bg-zinc-800/60 border-zinc-700', color: 'inherit' },
}

// The one-sentence answer that opens every tab.
export default function Headline({ text, tone = 'neutral' }) {
  if (!text) return null
  const t = TONES[tone] ?? TONES.neutral
  return (
    <div className={`rounded-2xl border px-5 py-4 ${t.box}`}>
      <div className="text-lg sm:text-xl font-bold leading-snug" style={{ color: t.color }}>{text.title}</div>
      {text.sub && <div className="text-zinc-400 text-sm mt-1">{text.sub}</div>}
    </div>
  )
}
```

```jsx path=app/components/outlook/HourlyChart.jsx
'use client'

import { formatCalendarDate } from '@/lib/localtime'
import useWidth from './useWidth'

// Consensus temperature over the hours shown, the sources' spread as a band
// behind it, and rain chance as bars along the bottom. Colours via CSS
// variables (style, not SVG attributes) so both themes work.
export default function HourlyChart({ hours, unit = 'C', lang = 'en', height = 170 }) {
  const [ref, W] = useWidth()
  if (!hours?.length) return null
  const H = height, top = 18, axis = 18, rainH = 28
  const bottom = H - axis, tempBottom = bottom - rainH - 8
  const conv = c => (unit === 'F' ? c * 9 / 5 + 32 : c)
  const mid = hours.map(h => conv(h.temp))
  const lo = hours.map(h => conv(h.lo ?? h.temp)), hi = hours.map(h => conv(h.hi ?? h.temp))
  const min = Math.min(...lo), max = Math.max(...hi), range = max - min || 1
  const x = i => 10 + (i / Math.max(1, hours.length - 1)) * (W - 20)
  const y = v => top + (1 - (v - min) / range) * (tempBottom - top)
  const pt = (v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`
  const band = [...hi.map(pt), ...lo.map(pt).reverse()].join(' ')
  const barW = Math.max(2, (W - 20) / hours.length - 1.5)
  const iMax = mid.indexOf(Math.max(...mid)), iMin = mid.indexOf(Math.min(...mid))
  const every = hours.length > 30 ? 6 : 3
  const ticks = hours
    .map((h, i) => ({ h, i, hr: Number(h.t.slice(11, 13)) }))
    .filter(({ h, hr }) => h.t.slice(14, 16) === '00' && hr % every === 0)
  const clampX = v => Math.min(Math.max(v, 16), W - 16)
  return (
    <div ref={ref} className="w-full">
      <svg width={W} height={H} role="img" aria-label={`${Math.round(Math.min(...mid))}–${Math.round(Math.max(...mid))}°${unit}`}>
        <polygon points={band} style={{ fill: 'var(--accent)', fillOpacity: 0.14 }} />
        {ticks.filter(tk => tk.hr === 0).map(tk => (
          <line key={`d${tk.h.t}`} x1={x(tk.i)} x2={x(tk.i)} y1={top - 8} y2={bottom} strokeDasharray="2 3" style={{ stroke: 'var(--muted)', strokeOpacity: 0.35 }} />
        ))}
        <polyline points={mid.map(pt).join(' ')} fill="none" strokeWidth="2" strokeLinejoin="round" style={{ stroke: 'var(--accent)' }} />
        {hours.map((h, i) => h.rainPct > 0 && (
          <rect key={h.t} x={x(i) - barW / 2} y={bottom - (h.rainPct / 100) * rainH} width={barW} height={(h.rainPct / 100) * rainH}
            style={{ fill: 'var(--info)', fillOpacity: 0.25 + h.rainPct / 250 }} />
        ))}
        <text x={clampX(x(iMax))} y={y(mid[iMax]) - 6} textAnchor="middle" fontSize="12" fontWeight="700" style={{ fill: 'var(--hot)' }}>{Math.round(mid[iMax])}°</text>
        <text x={clampX(x(iMin))} y={y(mid[iMin]) + 15} textAnchor="middle" fontSize="12" fontWeight="700" style={{ fill: 'var(--info)' }}>{Math.round(mid[iMin])}°</text>
        {ticks.map(({ h, i, hr }) => (
          <text key={`t${h.t}`} x={clampX(x(i))} y={H - 4} textAnchor="middle" fontSize="11" style={{ fill: 'var(--muted)' }}>
            {hr === 0 ? formatCalendarDate(h.t.slice(0, 10), lang, { weekday: 'short' }) : h.t.slice(11, 13)}
          </text>
        ))}
      </svg>
    </div>
  )
}
```

```jsx path=app/components/outlook/HourStrip.jsx
// Scrollable hour-by-hour row: time, icon, temperature, rain chance.
export default function HourStrip({ hours, fmtTemp }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex gap-1.5 min-w-max pb-1">
        {hours.map(h => (
          <div key={h.t} className="w-14 shrink-0 bg-zinc-800/50 border border-zinc-800 rounded-xl py-2 text-center text-xs leading-relaxed">
            <div className="text-zinc-500 tabular-nums">{h.t.slice(11, 16)}</div>
            <div className="text-lg leading-tight" aria-hidden>{h.icon ?? '·'}</div>
            <div className="font-bold tabular-nums">{fmtTemp(h.temp)}</div>
            <div className="tabular-nums" style={{ color: 'var(--info)' }}>{h.rainPct != null ? `${h.rainPct}%` : '–'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

```jsx path=app/components/outlook/TrendChart.jsx
'use client'

import { t } from '@/lib/i18n'
import { formatCalendarDate } from '@/lib/localtime'
import useWidth from './useWidth'

// 14-day highs and lows against the 10-year normal. The bands are the spread
// (sources in week 1, ensemble members in week 2), so uncertainty visibly
// grows with range; the divider marks where forecast turns into trend.
export default function TrendChart({ days, normals, unit = 'C', lang = 'en' }) {
  const [ref, W] = useWidth()
  if (!days?.length) return null
  const H = 200, top = 16, bottom = H - 40
  const conv = c => (c == null ? null : unit === 'F' ? c * 9 / 5 + 32 : c)
  const normal = new Map((normals ?? []).map(n => [n.date, n]))
  const all = days
    .flatMap(d => [d.maxHi ?? d.tempMax, d.minLo ?? d.tempMin, normal.get(d.date)?.max, normal.get(d.date)?.min])
    .map(conv).filter(v => v != null)
  const min = Math.min(...all), max = Math.max(...all), range = max - min || 1
  const x = i => 14 + (i / Math.max(1, days.length - 1)) * (W - 28)
  const y = v => top + (1 - (v - min) / range) * (bottom - top)
  const xy = (i, v) => `${x(i).toFixed(1)},${y(conv(v)).toFixed(1)}`
  const line = key => days.map((d, i) => (d[key] == null ? null : xy(i, d[key]))).filter(Boolean).join(' ')
  const band = (hiKey, loKey, fb) => [
    ...days.map((d, i) => xy(i, d[hiKey] ?? d[fb])),
    ...days.map((d, i) => xy(i, d[loKey] ?? d[fb])).reverse(),
  ].join(' ')
  const normalLine = days.map((d, i) => (normal.get(d.date)?.max == null ? null : xy(i, normal.get(d.date).max))).filter(Boolean).join(' ')
  const split = days.findIndex(d => d.lead >= 8)
  const splitX = split > 0 ? (x(split - 1) + x(split)) / 2 : null
  const last = days.at(-1)
  return (
    <div ref={ref} className="w-full">
      <svg width={W} height={H} role="img" aria-label={t(lang, 'tab14d')}>
        <polygon points={band('maxHi', 'maxLo', 'tempMax')} style={{ fill: 'var(--hot)', fillOpacity: 0.13 }} />
        <polygon points={band('minHi', 'minLo', 'tempMin')} style={{ fill: 'var(--info)', fillOpacity: 0.13 }} />
        {normalLine && <polyline points={normalLine} fill="none" strokeDasharray="4 4" strokeWidth="1.5" style={{ stroke: 'var(--muted)' }} />}
        <polyline points={line('tempMax')} fill="none" strokeWidth="2" strokeLinejoin="round" style={{ stroke: 'var(--hot)' }} />
        <polyline points={line('tempMin')} fill="none" strokeWidth="2" strokeLinejoin="round" style={{ stroke: 'var(--info)' }} />
        {splitX != null && <line x1={splitX} x2={splitX} y1={top - 6} y2={bottom} style={{ stroke: 'var(--muted)', strokeOpacity: 0.5 }} />}
        {days.map((d, i) => i % 2 === 0 && (
          <text key={d.date} x={x(i)} y={bottom + 14} textAnchor="middle" fontSize="10" style={{ fill: 'var(--muted)' }}>
            {formatCalendarDate(d.date, lang, { weekday: 'short' })}
          </text>
        ))}
        <text x={14} y={H - 6} fontSize="10" style={{ fill: 'var(--muted)' }}>{t(lang, 'thisWeekConfident')}</text>
        {splitX != null && <text x={splitX + 6} y={H - 6} fontSize="10" style={{ fill: 'var(--muted)' }}>{t(lang, 'nextWeekTrend')}</text>}
        {normalLine && normal.get(last.date)?.max != null && (
          <text x={W - 14} y={y(conv(normal.get(last.date).max)) - 5} textAnchor="end" fontSize="10" style={{ fill: 'var(--muted)' }}>{t(lang, 'normalLine')}</text>
        )}
      </svg>
    </div>
  )
}
```

```jsx path=app/components/outlook/Notes.jsx
import { t } from '@/lib/i18n'

const KEYS = { fewer_sources: 'noteFewerSources', ensemble_unavailable: 'noteEnsembleUnavailable' }

// Honest footnotes when the outlook runs on fewer sources than usual.
export default function Notes({ notes, lang }) {
  const shown = (notes ?? []).filter(n => KEYS[n])
  if (!shown.length) return null
  return (
    <div className="text-xs rounded-lg border border-amber-500/30 bg-amber-900/20 px-3 py-2" style={{ color: 'var(--warn)' }}>
      {shown.map(n => t(lang, KEYS[n])).join(' · ')}
    </div>
  )
}
```

```jsx path=app/components/outlook/Status.jsx
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { t } from '@/lib/i18n'

export function OutlookSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="skeleton h-20 rounded-2xl" />
      <div className="skeleton h-56 rounded-2xl" />
    </div>
  )
}

export function OutlookError({ lang, onRetry }) {
  return (
    <div className="bg-red-900/30 border border-red-500/30 rounded-2xl p-4 text-red-300 text-sm flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2"><AlertTriangle size={16} className="shrink-0" aria-hidden /> {t(lang, 'outlookError')}</span>
      <button onClick={onRetry} className="press inline-flex items-center gap-1.5 border border-red-500/40 rounded-lg px-3 py-1.5 text-xs hover:bg-red-500/10 shrink-0">
        <RefreshCw size={13} aria-hidden /> {t(lang, 'retry')}
      </button>
    </div>
  )
}
```

```jsx path=app/components/outlook/RangeTabs.jsx
import { t } from '@/lib/i18n'

export const RANGES = [['h48', 'tab48h'], ['d7', 'tab7d'], ['d14', 'tab14d']]

// 48 h · 7 days · 14 days — one range on screen at a time.
export default function RangeTabs({ value, onChange, lang }) {
  return (
    <div role="tablist" aria-label={t(lang, 'rangeLabel')} className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
      {RANGES.map(([id, key]) => (
        <button
          key={id}
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={`press flex-1 text-xs sm:text-sm py-2 rounded-lg transition-colors ${value === id ? 'bg-emerald-400 text-black font-bold' : 'text-zinc-400 hover:text-emerald-400'}`}
        >
          {t(lang, key)}
        </button>
      ))}
    </div>
  )
}
```

In `app/components/RainRadar.jsx` add a `bare = false` prop: extract the map `<div ref={containerRef} …/>` into a `map` const; when `bare`, return `<div>{map}<div className="text-zinc-500 text-xs mt-3">Radar: RainViewer · Map: OpenStreetMap</div></div>`; otherwise the existing card around `map`.

- [ ] **Step 2: UI strings** — add to each language in `lib/i18n.js` (after the headline block from Task 5):

en:
```js
    nowWord: 'Now', agreeShort: 'agree', rangeLabel: 'Forecast range',
    tab48h: '48 h', tab7d: '7 days', tab14d: '14 days',
    hourByHour: 'Hour by hour', bestTimeOut: 'Best time out',
    bandHint: 'Shaded band = how far the sources spread',
    agreeHint: '●●● = sources agree · tap a day for its hours',
    agree3: 'Sources agree', agree2: 'Sources mostly agree', agree1: 'Sources disagree',
    trendBandHint: 'The band widens where the models disagree more',
    thisWeekConfident: 'this week · confident', nextWeekTrend: 'next week · trend only',
    vsNormal10: 'vs normal (10 yrs)', thisWeek: 'this week', rainyDaysLabel: 'Rainy days',
    rainyDaysValue: '{n} of {total}', normalValue: 'normal {n}', normalLine: 'normal',
    recordsFold: 'Records for this month', radarFold: 'Rain radar',
    sourcesFold: 'Sources & who’s right now', feedbackFold: 'How’s the weather where you are?',
    updatedAgo: 'updated {n} min ago',
    noteFewerSources: 'Fewer sources than usual right now',
    noteEnsembleUnavailable: 'Week-2 band from fewer models right now',
    outlookError: 'The forecast could not be loaded.', retry: 'Retry',
```
de:
```js
    nowWord: 'Jetzt', agreeShort: 'Einigkeit', rangeLabel: 'Vorhersagezeitraum',
    tab48h: '48 h', tab7d: '7 Tage', tab14d: '14 Tage',
    hourByHour: 'Stunde für Stunde', bestTimeOut: 'Beste Zeit draußen',
    bandHint: 'Schattierter Bereich = wie weit die Quellen auseinanderliegen',
    agreeHint: '●●● = Quellen einig · Tag antippen für Stunden',
    agree3: 'Quellen einig', agree2: 'Quellen weitgehend einig', agree1: 'Quellen uneinig',
    trendBandHint: 'Der Bereich wird breiter, wo die Modelle stärker abweichen',
    thisWeekConfident: 'diese Woche · verlässlich', nextWeekTrend: 'nächste Woche · nur Trend',
    vsNormal10: 'vs. Normal (10 J.)', thisWeek: 'diese Woche', rainyDaysLabel: 'Regentage',
    rainyDaysValue: '{n} von {total}', normalValue: 'normal {n}', normalLine: 'normal',
    recordsFold: 'Rekorde für diesen Monat', radarFold: 'Regenradar',
    sourcesFold: 'Quellen & wer gerade richtig liegt', feedbackFold: 'Wie ist das Wetter bei dir?',
    updatedAgo: 'vor {n} Min. aktualisiert',
    noteFewerSources: 'Gerade weniger Quellen als sonst',
    noteEnsembleUnavailable: 'Bereich für Woche 2 gerade aus weniger Modellen',
    outlookError: 'Die Vorhersage konnte nicht geladen werden.', retry: 'Erneut versuchen',
```
fr:
```js
    nowWord: 'Maintenant', agreeShort: 'd’accord', rangeLabel: 'Période de prévision',
    tab48h: '48 h', tab7d: '7 jours', tab14d: '14 jours',
    hourByHour: 'Heure par heure', bestTimeOut: 'Meilleur moment dehors',
    bandHint: 'Zone ombrée = écart entre les sources',
    agreeHint: '●●● = sources d’accord · touchez un jour pour ses heures',
    agree3: 'Sources d’accord', agree2: 'Sources plutôt d’accord', agree1: 'Sources en désaccord',
    trendBandHint: 'La zone s’élargit là où les modèles divergent davantage',
    thisWeekConfident: 'cette semaine · fiable', nextWeekTrend: 'semaine prochaine · tendance',
    vsNormal10: 'vs normale (10 ans)', thisWeek: 'cette semaine', rainyDaysLabel: 'Jours de pluie',
    rainyDaysValue: '{n} sur {total}', normalValue: 'normale {n}', normalLine: 'normale',
    recordsFold: 'Records de ce mois', radarFold: 'Radar de pluie',
    sourcesFold: 'Sources et qui a raison en ce moment', feedbackFold: 'Quel temps fait-il chez vous ?',
    updatedAgo: 'mis à jour il y a {n} min',
    noteFewerSources: 'Moins de sources que d’habitude en ce moment',
    noteEnsembleUnavailable: 'Zone de la semaine 2 issue de moins de modèles',
    outlookError: 'La prévision n’a pas pu être chargée.', retry: 'Réessayer',
```
es:
```js
    nowWord: 'Ahora', agreeShort: 'acuerdo', rangeLabel: 'Periodo de previsión',
    tab48h: '48 h', tab7d: '7 días', tab14d: '14 días',
    hourByHour: 'Hora a hora', bestTimeOut: 'Mejor momento fuera',
    bandHint: 'Banda sombreada = cuánto difieren las fuentes',
    agreeHint: '●●● = fuentes de acuerdo · toca un día para ver sus horas',
    agree3: 'Fuentes de acuerdo', agree2: 'Fuentes casi de acuerdo', agree1: 'Fuentes en desacuerdo',
    trendBandHint: 'La banda se ensancha donde los modelos discrepan más',
    thisWeekConfident: 'esta semana · fiable', nextWeekTrend: 'próxima semana · solo tendencia',
    vsNormal10: 'vs normal (10 años)', thisWeek: 'esta semana', rainyDaysLabel: 'Días de lluvia',
    rainyDaysValue: '{n} de {total}', normalValue: 'normal {n}', normalLine: 'normal',
    recordsFold: 'Récords de este mes', radarFold: 'Radar de lluvia',
    sourcesFold: 'Fuentes y quién acierta ahora', feedbackFold: '¿Qué tiempo hace donde estás?',
    updatedAgo: 'actualizado hace {n} min',
    noteFewerSources: 'Ahora mismo hay menos fuentes de lo habitual',
    noteEnsembleUnavailable: 'Banda de la semana 2 con menos modelos ahora',
    outlookError: 'No se pudo cargar la previsión.', retry: 'Reintentar',
```
it:
```js
    nowWord: 'Ora', agreeShort: 'accordo', rangeLabel: 'Periodo di previsione',
    tab48h: '48 h', tab7d: '7 giorni', tab14d: '14 giorni',
    hourByHour: 'Ora per ora', bestTimeOut: 'Momento migliore fuori',
    bandHint: 'Banda ombreggiata = quanto divergono le fonti',
    agreeHint: '●●● = fonti d’accordo · tocca un giorno per le ore',
    agree3: 'Fonti d’accordo', agree2: 'Fonti quasi d’accordo', agree1: 'Fonti in disaccordo',
    trendBandHint: 'La banda si allarga dove i modelli divergono di più',
    thisWeekConfident: 'questa settimana · affidabile', nextWeekTrend: 'prossima settimana · solo tendenza',
    vsNormal10: 'vs norma (10 anni)', thisWeek: 'questa settimana', rainyDaysLabel: 'Giorni di pioggia',
    rainyDaysValue: '{n} su {total}', normalValue: 'norma {n}', normalLine: 'norma',
    recordsFold: 'Record di questo mese', radarFold: 'Radar pioggia',
    sourcesFold: 'Fonti e chi ha ragione ora', feedbackFold: 'Che tempo fa da te?',
    updatedAgo: 'aggiornato {n} min fa',
    noteFewerSources: 'Al momento meno fonti del solito',
    noteEnsembleUnavailable: 'Banda della settimana 2 da meno modelli al momento',
    outlookError: 'Impossibile caricare la previsione.', retry: 'Riprova',
```

- [ ] **Step 3: Verify** — `npx eslint .` and `npm run build` → green.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "Outlook UI building blocks: tabs, headline, hourly + trend charts, folds (5 langs)"`

---

### Task 13: Tab views and moved sections

**Files:**
- Create: `app/components/outlook/{NowLine.jsx,Tab48h.jsx,Tab7d.jsx,Tab14d.jsx,Records.jsx,SourcesPanel.jsx,FeedbackPanel.jsx}`

**Interfaces:**
- Consumes: Task 12 components, `headlineText`, `headlineTone`, `dayWord`, `fill`, formatters (Task 5).
- Produces: `<NowLine data unit lang showT showDelta />`; `<Tab48h outlook now unit lang fmt />`, `<Tab7d … />`, `<Tab14d … />` where `fmt = { fmtTemp, fmtDelta, fmtSpan }`; `<SourcesPanel data unit lang showT showDelta />`; `<FeedbackPanel data unit lang onWeights(city, weights) />`; `<Records records nowTemp lang fmt />`.

- [ ] **Step 1: Components**

```jsx path=app/components/outlook/NowLine.jsx
'use client'

import { useState } from 'react'
import { ChevronDown, Wind, Droplets, Eye, CloudFog, Snowflake, Thermometer } from 'lucide-react'
import { t, translateCondition } from '@/lib/i18n'
import { MetricCard } from '../ui'
import { conditionIcon, heroCondition } from './icons'

const MUTED = 'var(--muted)', GREEN = 'var(--ok)', YELLOW = 'var(--warn)', RED = 'var(--bad)'
const cloudColor = v => (v == null ? MUTED : v < 30 ? GREEN : v < 70 ? YELLOW : RED)
const visColor = v => (v == null ? MUTED : v >= 10 ? GREEN : v >= 4 ? YELLOW : RED)

// "Right now", reduced to one line — the future tabs below are the main
// event. Tapping it opens everything the old hero showed.
export default function NowLine({ data, unit, lang, showT, showDelta }) {
  const [open, setOpen] = useState(false)
  const c = data.consensus
  const condition = heroCondition(data)
  const agreeColor = c.confidencePct >= 70 ? 'var(--ok)' : c.confidencePct >= 45 ? 'var(--warn)' : 'var(--bad)'
  const d = data.details
  const yd = data.yesterdayTemp != null ? Math.round((c.temp - data.yesterdayTemp) * 10) / 10 : null
  const rainingHint = data.rainingNow?.count > 0
    ? t(lang, 'rainNowHint').replace('{n}', data.rainingNow.count).replace('{total}', data.rainingNow.total)
    : null
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3 text-left">
        <span className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="text-zinc-500 text-[11px] uppercase tracking-wider shrink-0">{t(lang, 'nowWord')}</span>
          <span className="text-2xl font-bold tabular-nums shrink-0">{showT(c.temp)}°{unit}</span>
          {condition && <span className="text-xl shrink-0" aria-hidden>{conditionIcon(condition, data.lon)}</span>}
          {condition && <span className="text-zinc-400 text-sm truncate hidden sm:inline">{translateCondition(lang, condition)}</span>}
        </span>
        <span className="flex items-center gap-3 shrink-0 text-xs">
          {rainingHint
            ? <span className="hidden sm:inline" style={{ color: 'var(--info)' }}>{rainingHint}</span>
            : c.rainPct != null && <span className="text-zinc-400 tabular-nums">🌧 {c.rainPct}%</span>}
          <span className="tabular-nums" style={{ color: agreeColor }}>{c.confidencePct}% {t(lang, 'agreeShort')}</span>
          <ChevronDown size={16} className={`text-zinc-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden />
        </span>
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-5 pt-4 border-t border-zinc-800 animate-fade-in space-y-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-400">
            {c.feelsLike != null && <span>{t(lang, 'feelsLike')} {showT(c.feelsLike)}°{unit}</span>}
            <span className="inline-flex items-center gap-1"><Wind size={13} aria-hidden /> {c.windKmh} km/h</span>
            {rainingHint && <span style={{ color: 'var(--info)' }}>{rainingHint}</span>}
            {yd != null && (Math.abs(yd) < 0.5
              ? <span>= {t(lang, 'vsYesterdaySame')}</span>
              : (
                <span style={{ color: yd > 0 ? 'var(--ok)' : 'var(--info)' }}>
                  {yd > 0 ? '↑' : '↓'} {Math.abs(showDelta(yd)).toFixed(1)}°{unit} {t(lang, yd > 0 ? 'vsYesterdayWarmer' : 'vsYesterdayColder')}
                </span>
              ))}
          </div>
          {d && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MetricCard icon={CloudFog} label={t(lang, 'cloudLabel')} value={d.cloudCover != null ? `${d.cloudCover}%` : '–'} color={cloudColor(d.cloudCover)} />
              <MetricCard icon={Eye} label={t(lang, 'visibilityLabel')} value={d.visibilityKm != null ? `${d.visibilityKm} km` : '–'} color={visColor(d.visibilityKm)} />
              <MetricCard icon={Droplets} label={t(lang, 'precipLabel')} value={d.precipMm != null ? `${d.precipMm} mm` : '–'} color={d.precipMm > 0 ? 'var(--info)' : 'var(--ok)'} />
              <MetricCard icon={Snowflake} label={t(lang, 'snowfallLabel')} value={d.snowfallMm != null ? `${d.snowfallMm} mm` : '–'} color={d.snowfallMm > 0 ? 'var(--info)' : 'var(--muted)'} />
              <MetricCard icon={Thermometer} label={t(lang, 'groundTempLabel')} value={d.groundTemp != null ? `${showT(d.groundTemp)}°${unit}` : '–'} color="var(--neutral)" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

```jsx path=app/components/outlook/Tab48h.jsx
'use client'

import { Clock, Sun, Wind, Flower2, CloudRain } from 'lucide-react'
import { t, uvText, aqiText, pollenText } from '@/lib/i18n'
import { headlineText, headlineTone, dayWord } from '@/lib/outlook/text'
import { MetricCard, SectionTitle, Fold } from '../ui'
import RainRadar from '../RainRadar'
import Headline from './Headline'
import HourlyChart from './HourlyChart'
import HourStrip from './HourStrip'
import Notes from './Notes'

const MUTED = 'var(--muted)', GREEN = 'var(--ok)', YELLOW = 'var(--warn)', RED = 'var(--bad)'
const uvColor = v => (v == null ? MUTED : v < 3 ? GREEN : v < 6 ? YELLOW : RED)
const aqiColor = v => (v == null ? MUTED : v <= 40 ? GREEN : v <= 80 ? YELLOW : RED)
const pollenColor = v => (v == null ? MUTED : v < 20 ? GREEN : v < 50 ? YELLOW : RED)

export default function Tab48h({ outlook, now, unit, lang, fmt }) {
  const hours = outlook.hourly.slice(0, 48)
  const todayLocal = outlook.nowLocal.slice(0, 10)
  const h = outlook.headlines?.h48
  const best = outlook.bestTime
  const x = now?.extras
  return (
    <div className="space-y-4 animate-fade-in">
      <Headline text={headlineText(lang, 'h48', h, { todayLocal, ...fmt })} tone={headlineTone('h48', h)} />
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6">
        <HourlyChart hours={hours} unit={unit} lang={lang} />
        <p className="text-zinc-500 text-xs mt-2">{t(lang, 'bandHint')}</p>
        <SectionTitle icon={Clock} className="mt-6 mb-3">{t(lang, 'hourByHour')}</SectionTitle>
        <HourStrip hours={hours} fmtTemp={fmt.fmtTemp} />
      </div>
      <div className="flex flex-wrap gap-3">
        {best && (
          <MetricCard
            icon={Sun}
            label={t(lang, 'bestTimeOut')}
            value={`${best.icon ?? ''} ${best.t.slice(11, 16)}`}
            sub={`${dayWord(lang, best.t.slice(0, 10), todayLocal)} · ${fmt.fmtTemp(best.temp)} · ${best.rainPct ?? '–'}%`}
            color="var(--ok)"
          />
        )}
        {x?.uvIndex != null && <MetricCard icon={Sun} label={t(lang, 'uvLabel')} value={x.uvIndex} sub={uvText(lang, x.uvIndex)} color={uvColor(x.uvIndex)} />}
        {x?.aqi != null && <MetricCard icon={Wind} label={t(lang, 'aqiLabel')} value={x.aqi} sub={aqiText(lang, x.aqi)} color={aqiColor(x.aqi)} />}
        {x?.pollen != null && <MetricCard icon={Flower2} label={t(lang, 'pollenLabel')} value={x.pollen} sub={pollenText(lang, x.pollen)} color={pollenColor(x.pollen)} />}
      </div>
      <Notes notes={outlook.notes} lang={lang} />
      {outlook.lat != null && outlook.lon != null && (
        <Fold icon={CloudRain} title={t(lang, 'radarFold')}>
          <RainRadar lat={outlook.lat} lon={outlook.lon} bare />
        </Fold>
      )}
    </div>
  )
}
```

```jsx path=app/components/outlook/Tab7d.jsx
'use client'

import { useState } from 'react'
import { t } from '@/lib/i18n'
import { formatCalendarDate } from '@/lib/localtime'
import { headlineText, headlineTone, dayWord, fill } from '@/lib/outlook/text'
import Headline from './Headline'
import HourlyChart from './HourlyChart'
import Notes from './Notes'

function Agree({ level, lang }) {
  if (level == null) return <span className="w-8 shrink-0" />
  const color = level >= 2 ? 'var(--ok)' : 'var(--warn)'
  return (
    <span className="w-8 shrink-0 text-xs tracking-tighter" title={t(lang, `agree${level}`)} aria-label={t(lang, `agree${level}`)}>
      <span style={{ color }}>{'●'.repeat(level)}</span>
      <span className="text-zinc-600">{'○'.repeat(3 - level)}</span>
    </span>
  )
}

export default function Tab7d({ outlook, unit, lang, fmt }) {
  const [openDay, setOpenDay] = useState(null)
  const todayLocal = outlook.nowLocal.slice(0, 10)
  const h = outlook.headlines?.d7
  const days = outlook.days.slice(0, 7)
  const lo = Math.min(...days.map(d => d.tempMin)), hi = Math.max(...days.map(d => d.tempMax)), span = hi - lo || 1
  return (
    <div className="space-y-4 animate-fade-in">
      <Headline text={headlineText(lang, 'd7', h, { todayLocal, ...fmt })} tone={headlineTone('d7', h)} />
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-2 sm:p-4">
        {days.map(d => {
          const open = openDay === d.date
          const dayHours = outlook.hourly.filter(x => x.t.startsWith(d.date))
          return (
            <div key={d.date} className="border-t border-zinc-800 first:border-0">
              <button
                onClick={() => setOpenDay(open ? null : d.date)}
                aria-expanded={open}
                disabled={!dayHours.length}
                className="w-full flex items-center gap-2 sm:gap-3 px-2 py-3 text-sm text-left rounded-xl hover:bg-zinc-800/40 disabled:cursor-default"
              >
                <span className="w-12 sm:w-16 shrink-0">{d.date === todayLocal ? t(lang, 'todayLabel') : formatCalendarDate(d.date, lang, { weekday: 'short' })}</span>
                <span className="w-6 shrink-0 text-center text-lg" aria-hidden>{d.icon ?? '·'}</span>
                <span className="w-9 shrink-0 text-right text-zinc-500 tabular-nums">{fmt.fmtTemp(d.tempMin)}</span>
                <span className="relative flex-1 h-1.5 bg-zinc-800 rounded-full">
                  <span
                    className="absolute h-1.5 rounded-full"
                    style={{
                      left: `${((d.tempMin - lo) / span) * 100}%`,
                      width: `${Math.max(4, ((d.tempMax - d.tempMin) / span) * 100)}%`,
                      background: 'linear-gradient(90deg, var(--info), var(--hot))',
                    }}
                  />
                </span>
                <span className="w-9 shrink-0 tabular-nums">{fmt.fmtTemp(d.tempMax)}</span>
                <span className="w-10 shrink-0 text-right tabular-nums" style={{ color: 'var(--info)' }}>{d.rainPct != null ? `${d.rainPct}%` : '–'}</span>
                <Agree level={d.agree} lang={lang} />
              </button>
              {d.spread > 4 && (
                <div className="px-2 pb-2 -mt-1 text-xs" style={{ color: 'var(--warn)' }}>
                  ⚠ {fill(t(lang, 'hlSplit'), { spread: fmt.fmtSpan(d.spread), day: dayWord(lang, d.date, todayLocal) })}
                </div>
              )}
              {open && <div className="px-2 pb-4"><HourlyChart hours={dayHours} unit={unit} lang={lang} height={140} /></div>}
            </div>
          )
        })}
      </div>
      <p className="text-zinc-500 text-xs">{t(lang, 'agreeHint')}</p>
      <Notes notes={outlook.notes} lang={lang} />
    </div>
  )
}
```

```jsx path=app/components/outlook/Records.jsx
import { Thermometer, Snowflake, CloudRain, AlertTriangle } from 'lucide-react'
import { t } from '@/lib/i18n'
import { formatCalendarDate } from '@/lib/localtime'

// Hottest day, coldest night and wettest day of this month over 10 years.
export default function Records({ records: r, nowTemp, lang, fmt }) {
  if (!r || !(r.hottest || r.coldest || r.wettest)) return null
  const near = nowTemp != null && (
    (r.hottest && Math.abs(nowTemp - r.hottest.temp) <= 2) ||
    (r.coldest && Math.abs(nowTemp - r.coldest.temp) <= 2)
  )
  const date = d => (d ? formatCalendarDate(d, lang, { day: '2-digit', month: 'short', year: '2-digit' }) : '')
  const Card = ({ icon: Icon, cls, label, value, when }) => (
    <div className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4">
      <div className={`${cls} text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5`}><Icon size={13} aria-hidden /> {label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-zinc-500 text-xs mt-1">{date(when)}</div>
    </div>
  )
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {r.hottest && <Card icon={Thermometer} cls="text-orange-400" label={t(lang, 'recordHottest')} value={fmt.fmtTemp(r.hottest.temp)} when={r.hottest.date} />}
        {r.coldest && <Card icon={Snowflake} cls="text-blue-400" label={t(lang, 'recordColdest')} value={fmt.fmtTemp(r.coldest.temp)} when={r.coldest.date} />}
        {r.wettest && <Card icon={CloudRain} cls="text-cyan-400" label={t(lang, 'recordWettest')} value={`${r.wettest.mm} mm`} when={r.wettest.date} />}
      </div>
      {near && <div className="mt-4 text-sm text-orange-300 flex items-center gap-1.5"><AlertTriangle size={14} aria-hidden /> {t(lang, 'recordNear')}</div>}
    </>
  )
}
```

```jsx path=app/components/outlook/Tab14d.jsx
'use client'

import { Thermometer, CloudRain, Trophy } from 'lucide-react'
import { t } from '@/lib/i18n'
import { headlineText, headlineTone, fill } from '@/lib/outlook/text'
import { MetricCard, Fold } from '../ui'
import Headline from './Headline'
import TrendChart from './TrendChart'
import Notes from './Notes'
import Records from './Records'

export default function Tab14d({ outlook, now, unit, lang, fmt }) {
  const todayLocal = outlook.nowLocal.slice(0, 10)
  const h = outlook.headlines?.d14
  const w1 = outlook.vsNormal?.week1
  const rd = outlook.rainyDays
  return (
    <div className="space-y-4 animate-fade-in">
      <Headline text={headlineText(lang, 'd14', h, { todayLocal, ...fmt })} tone={headlineTone('d14', h)} />
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6">
        <TrendChart days={outlook.days} normals={outlook.normals} unit={unit} lang={lang} />
        <p className="text-zinc-500 text-xs mt-2">{t(lang, 'trendBandHint')}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {w1 != null && (
          <MetricCard icon={Thermometer} label={t(lang, 'vsNormal10')} value={fmt.fmtDelta(w1)} sub={t(lang, 'thisWeek')} color={w1 > 0 ? 'var(--hot)' : 'var(--info)'} />
        )}
        {rd?.of > 0 && (
          <MetricCard
            icon={CloudRain}
            label={t(lang, 'rainyDaysLabel')}
            value={fill(t(lang, 'rainyDaysValue'), { n: rd.forecast, total: rd.of })}
            sub={rd.normal != null ? fill(t(lang, 'normalValue'), { n: rd.normal }) : null}
            color="var(--info)"
          />
        )}
      </div>
      <Notes notes={outlook.notes} lang={lang} />
      {outlook.records && (
        <Fold icon={Trophy} title={t(lang, 'recordsFold')}>
          <Records records={outlook.records} nowTemp={now?.consensus?.temp} lang={lang} fmt={fmt} />
        </Fold>
      )}
    </div>
  )
}
```

`SourcesPanel.jsx`: move the source-card grid from `app/page.js` (the block under `{/* Source Cards */}` — house model sorted first, down sources, diff colours, weight bar) verbatim into a component `SourcesPanel({ data, unit, lang, showT, showDelta })`, preceded by the `SourceSpread` strip (`title={t(lang, 'spreadTitle')} hint={t(lang, 'spreadHint')}`) and followed by a link to `/leaderboard` (`t(lang, 'leaderboard')`).

`FeedbackPanel.jsx`: move the feedback form from `app/page.js` (the block under `{/* Feedback */}`, without its SectionTitle — the Fold provides the title) and `submitFeedback` into `FeedbackPanel({ data, unit, lang, onWeights })`. It owns the `feedback`/`fbStatus`/`fbLoading` state; `isNight` is `isNightAt(data?.lon)`; on success it calls `onWeights(data.city, json.weights)` when `json.weights` is present.

- [ ] **Step 2: Verify** — `npx eslint .` and `npm run build` → green (components aren't mounted yet).
- [ ] **Step 3: Commit** — `git add -A && git commit -m "Outlook tab views, now line, sources and feedback panels"`

---

### Task 14: Page integration and `/api/forecast` slimming

**Files:**
- Modify: `app/page.js`, `app/api/forecast/route.js`, `lib/weather.js`, `lib/weather.test.js`

**Interfaces:**
- Consumes: Tasks 12–13 components; `/api/outlook`.
- Produces: `/api/forecast` payload without `forecast7, sunrise, sunset, climate, records, bestTime, willRain, historyToday`, with `generatedAt`; CDN headers on success, `no-store` on errors.

- [ ] **Step 1: Slim `/api/forecast`**
  - Remove the `fetchDailyBundle`, `fetchOpenMeteoHourly`, `fetchMonthHistory` fetches and `blendDailyForecasts`; keep `fetchOpenMeteoExtras`, `fetchOpenMeteoDetails`, `fetchYesterdayTemp`.
  - Delete `todayStormy`, `willRain`, `bestTime`, `climate`, `records`, `historyToday` (keep the `consensus_history` insert — RSS and the webhook read it), `forecast7`, `sunrise`, `sunset` from the route and payload; add `generatedAt: new Date().toISOString()`.
  - Errors (400/404/429/500) → `Cache-Control: no-store`; the fresh response → `Cache-Control: public, s-maxage=900, stale-while-revalidate=1800`; an in-memory hit → `s-maxage` = remaining TTL in seconds.
  - In `lib/weather.js` delete the now-unused `fetchOpenMeteoForecast`, `fetchDailyBundle`, `blendDailyForecasts`, `fetchMETForecast`, `metIcon`, `fetchOpenMeteoHourly`, `fetchMonthHistory` (confirm with `grep -rn` that nothing else imports them); remove the `blendDailyForecasts` tests from `lib/weather.test.js`.

- [ ] **Step 2: Rewire `app/page.js`**
  - State: add `outlook`, `outlookError`, `tab` (default `'h48'`; read `localStorage.mb_tab` in the mount effect, write it in `changeTab`).
  - `loadForecast(targetCity, { silent })`: normalize `key = q.trim().toLowerCase()`; fetch `/api/forecast?city=${encodeURIComponent(key)}&lang=${lang}` and `/api/outlook?city=${encodeURIComponent(key)}` with `Promise.allSettled`. The forecast result keeps today's error/offline handling. The outlook result sets `outlook` + clears `outlookError`, or sets `outlookError` (keeping the previous outlook on a silent refresh). Add `retryOutlook()` that re-fetches only the outlook.
  - Offline cache: `cacheForecast(city, json, outlook)` stores `{ ts, json, outlook }`; `readCachedForecast` returns `{ json, outlook }` (older entries have no `outlook`); the offline branch restores both.
  - Results section, in order: the severe-weather banner (unchanged); a toolbar row with `SectionTitle` `{city}, {country}`, the refresh button + countdown, "updated N min ago" computed from `data.generatedAt` and `nowTick`, and the Share / Embed buttons (embed box unchanged); `<NowLine …/>`; `<RangeTabs value={tab} onChange={changeTab} lang={lang} />`; then `outlook ? (tab === 'h48' ? <Tab48h …/> : tab === 'd7' ? <Tab7d …/> : <Tab14d …/>) : outlookError ? <OutlookError lang={lang} onRetry={retryOutlook} /> : <OutlookSkeleton />`; then `<Fold icon={Layers} title={t(lang, 'sourcesFold')}><SourcesPanel …/></Fold>` and `<Fold icon={Send} title={t(lang, 'feedbackFold')}><FeedbackPanel … onWeights={mergeWeights} /></Fold>`.
  - `fmt = { fmtTemp: tempFormatter(unit), fmtDelta: deltaFormatter(unit), fmtSpan: spanFormatter(unit) }` (memo on `unit`); `mergeWeights = (city, w) => setData(d => (d?.city === city ? { ...d, weights: { ...d.weights, ...w } } : d))`.
  - Delete what moved or died: the rain-answer card, the consensus hero, the intraday Sparkline, Details, the 7-day grid, Climate Context, Records, Best time, the Radar card, the Source Cards and Feedback blocks, `Sparkline`, `MetricCard`, `SectionTitle`, `conditionIcon`, the colour helpers, `heading`, the feedback state and `submitFeedback`, `isNight`, `heroCondition`; import `MetricCard`/`SectionTitle` from `./components/ui` only where still used. Update `ForecastSkeleton` to: now-line bar, tabs bar, headline block, chart block.
- [ ] **Step 3: Verify** — `npm test`, `npx eslint .`, `npm run build` → green. Local server: load `/` and `/?city=vienna` (HTTP 200), then check the page source for the tab list and absence of runtime errors in the server log; `curl` `/api/forecast?city=vienna&lang=en` → no `forecast7`, has `generatedAt`, `cache-control: public, s-maxage=900…`.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "Page: now line + 48 h / 7 days / 14 days tabs + folded sources and feedback; /api/forecast slimmed and CDN-cached"`

---

### Task 15: City pages and leaderboard tabs

**Files:**
- Modify: `app/weather/[city]/page.js`, `app/leaderboard/page.js`, `lib/i18n.js`

- [ ] **Step 1: City pages** — fetch `/api/outlook?city=<slug query>` alongside the forecast (same base URL logic, `next: { revalidate: 900 }`; an outlook failure renders the page without the outlook sections instead of failing). The 7-day table uses `outlook.days.slice(0, 7)` (`icon`, `condition`, `tempMax`/`tempMin`, `rainPct`, `windKmh`); the rain sentence becomes `headlineText('en', 'h48', outlook.headlines.h48, { todayLocal: outlook.nowLocal.slice(0, 10) })` (title + sub); the sun row uses `outlook.sun`; the climate sentence uses `outlook.vsNormal.week1` and `outlook.rainyDays` (e.g. "This week runs +1.8° vs the 10-year normal; 5 of the next 14 days look rainy (normal: 4).").
- [ ] **Step 2: Leaderboard page** — replace its `DISPLAY_NAMES` with `sourceName`; add a horizon row above the region tabs: `[['now', 'lbRightNow'], ['h48', 'tab48h'], ['d7', 'tab7d'], ['d14', 'tab14d']]`; the region list comes from `horizon === 'now' ? regions : horizons?.[horizon] ?? []`, and switching horizon keeps the active region if present, else the first; for outlook horizons show `fill(t(lang, 'lbLearning'), { n })` (n = summed `reports` in the region) when n < 200 and `t(lang, 'lbHorizonHint')` under the tabs; the Recalibrate button only shows for `now`; the uptime/latency block only renders when present (it is absent for outlook rows).
- [ ] **Step 3: Strings** — add to all 5 languages:

```js
// en
    lbRightNow: 'Right now',
    lbLearning: 'Still learning · {n} checks so far',
    lbHorizonHint: 'Scored against airport observations once the forecast time has come.',
// de
    lbRightNow: 'Jetzt',
    lbLearning: 'Lernt noch · bisher {n} Prüfungen',
    lbHorizonHint: 'Bewertet anhand von Flughafen-Messungen, sobald der Vorhersagezeitpunkt da ist.',
// fr
    lbRightNow: 'Maintenant',
    lbLearning: 'Apprentissage en cours · {n} vérifications',
    lbHorizonHint: 'Évalué avec les observations d’aéroport une fois l’échéance atteinte.',
// es
    lbRightNow: 'Ahora',
    lbLearning: 'Aún aprendiendo · {n} comprobaciones',
    lbHorizonHint: 'Puntuado con observaciones de aeropuertos cuando llega la hora prevista.',
// it
    lbRightNow: 'Adesso',
    lbLearning: 'Sta ancora imparando · {n} verifiche',
    lbHorizonHint: 'Valutato con le osservazioni aeroportuali quando arriva l’ora prevista.',
```

- [ ] **Step 4: Verify** — lint, build, local `curl` of `/weather/vienna` (200, contains the 7-day table) and `/leaderboard` (200).
- [ ] **Step 5: Commit** — `git add -A && git commit -m "City pages from the outlook; leaderboard tabs per forecast range (5 langs)"`

---

### Task 16: Docs, final verification, ship

**Files:**
- Modify: `README.md`, `CHANGELOG.md`, `app/privacy/content.jsx`, `lib/i18n.js` (`howP2`, 5 languages)

- [ ] **Step 1: Copy**
  - `howP2` (all 5 languages): replace "every hour, yesterday's predictions are checked…" with the new truth — live readings are checked hourly against airport reports, and the 48-hour, 7-day and 14-day predictions are checked once their time has come, so each source earns trust per range.
  - Privacy notice, "What stays on your device" (5 languages): add the selected forecast range to the list of stored preferences. No new personal data is collected (snapshots are per city and source).
  - README: "How it works" gains the outlook (multi-model consensus per range, ensembles for week 2, per-range learning), the data-sources table gains UKMO, GEM, JMA, Météo-France, KNMI, DMI, MET Nordic and the ensembles, Backups mentions `outlook_weights`.
  - CHANGELOG: new `## 2026-09-29` entries for the outlook (tabs, headlines, learning per range, CDN caching, `/api/forecast` slimming).
- [ ] **Step 2: Full verification** — `npm test`, `npx eslint .`, `npm run build` → green; local run: `/`, `/?city=vienna`, `/weather/tokyo`, `/leaderboard`, `/api/outlook?city=oslo`, `/api/forecast?city=oslo&lang=de` → 200.
- [ ] **Step 3: Ship** — commit, `git push origin main`, wait for the Vercel status → `success`, repeat the Task 11 CDN checks for `/api/outlook` and `/api/forecast`, and load the production page for three cities.
- [ ] **Step 4: Learning check (next day)** — after the next 05:00 UTC cleanup run: `select horizon, region, count(*), sum(reports) from outlook_weights group by 1, 2` shows `h48` rows; the cleanup response's `outlook` stats show `scored > 0`.
