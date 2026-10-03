# Rain in the Next 2 Hours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A blended 15-minute rain forecast for the next 2 hours on the forecast page and the weather widget, and a minute-accurate "Rain soon" notification checked every 15 minutes.

**Architecture:** A pure module (`lib/nowcast.js`) blends Open-Meteo's 15-minute precipitation from every short-range model covering a place and turns it into a summary (dry / start / stop / all). `/api/nowcast` serves the blended steps (cached 5 min); the card, the widget payload and the push dispatcher each summarize them against their own "now". The dispatcher's rain rule uses the nowcast where fine models exist and keeps the hourly rule elsewhere.

**Tech Stack:** Next.js 16, React, `node:test`, Open-Meteo, Supabase pg_cron.

**Spec:** `docs/superpowers/specs/2026-10-03-rain-next-2-hours-design.md`

## Global Constraints

- Models: `best_match,icon_d2,meteofrance_arome_france_hd,knmi_harmonie_arome_europe,dmi_harmonie_arome_europe,metno_nordic,gfs_hrrr,ukmo_uk_deterministic_2km`; fine = every returned model except `best_match`; none → `best_match` alone, `precision: 'rough'`.
- Wet step: more than half of the models ≥ 0.1 mm; `mm` = median; intensity per 15 min: light < 0.6, moderate < 2, heavy ≥ 2.
- Alert: dry now, rain starts in 10–60 min, `precision === 'fine'`, first wet step `agree ≥ 0.66`; message kind `rain` (existing dedupe, cap, quiet hours).
- 15-minute job at :02, :17, :32, :47; storms, severe, heat, briefing unchanged.
- Widget: `now.text` swaps to the short text only for `start` / `stop`; no app rebuild.
- New texts in all 13 languages (parity test).
- Commit and push straight to `main`; CHANGELOG entry when it ships.

**Plan rulings (spec deviations):**
- `/api/nowcast` returns the blended steps without a `summary`: the response is CDN-cached for 5 minutes, so each consumer summarizes against its own current time (`summarize(nc, now)`). The request asks for `past_minutely_15=1` and 10 steps ahead so a 5-minute-old response still covers 2 hours.
- The hourly job also fetches the nowcast and uses the same rule (one rain rule, two schedules) — so "the hourly job no longer evaluates the hourly rule for fine places" holds without a second code path.
- Translations are generated into the language files; the parity test defines done (as in the more-languages plan).

## Review Focus

- A cached response 5+ minutes old: steps before "now" must be skipped, and fewer than 4 upcoming steps means "no data" (no card, hourly rule) — test in Task 1.
- Some models return `null` for some steps: dropped from that step's median and vote — test in Task 1.
- Rain already falling: never a "starts in" alert — test in Task 5.
- Open-Meteo down: the card is hidden, the widget keeps its condition text, the dispatcher falls back to the hourly rule — tests in Tasks 4 and 5.
- Place with only the global model (e.g. Sydney): card shows the rough note, no nowcast alert, hourly rule — tests in Tasks 1 and 5.

---

### Task 1: Blend and summary (`lib/nowcast.js`)

**Files:**
- Create: `lib/nowcast.js`, `lib/nowcast.test.js`, `scripts/record-nowcast-fixture.mjs`, `lib/__fixtures__/nowcast-vienna.json`

**Interfaces:**
- Produces: `NOWCAST_MODELS` (string), `parseNowcastQuery(searchParams) → { lat, lon } | null` (2 decimals), `nowcastUrl({ lat, lon }) → string`, `blendSteps(json) → { precision: 'fine'|'rough', models: number, utcOffsetSec, steps: [{ t, mm, wet, agree }] } | null`, `intensity(mm) → 'light'|'moderate'|'heavy'`, `upcoming(nc, now) → steps[]` (≤ 8), `summarize(nc, now) → { kind: 'dry' } | { kind: 'start', at, minutes, until, duration, intensity, agree } | { kind: 'stop', until, intensity } | { kind: 'all', intensity } | null`, `nowcastRain(nc, now) → undefined | null | { from, minutes, duration, intensity, nowcast: true }` (undefined = no usable nowcast → hourly rule).

- [ ] **Step 1: Record a real response** — create `scripts/record-nowcast-fixture.mjs`:

```js
// Records one real Open-Meteo 15-minute response (Vienna: three fine models)
// for lib/nowcast.test.js:  node scripts/record-nowcast-fixture.mjs
import fs from 'node:fs'
import { nowcastUrl } from '../lib/nowcast.js'

const res = await fetch(nowcastUrl({ lat: 48.21, lon: 16.37 }))
if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
fs.writeFileSync(new URL('../lib/__fixtures__/nowcast-vienna.json', import.meta.url), JSON.stringify(await res.json(), null, 1) + '\n')
console.log('recorded lib/__fixtures__/nowcast-vienna.json')
```
(run it after Step 4 creates `nowcastUrl`).

- [ ] **Step 2: Failing tests** — create `lib/nowcast.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parseNowcastQuery, nowcastUrl, blendSteps, intensity, upcoming, summarize, nowcastRain } from './nowcast.js'

// a fake Open-Meteo response: 10 quarters from 14:00 local (UTC+2), one series per model
const OFF = 7200
const times = Array.from({ length: 10 }, (_, i) => `2026-10-03T${String(14 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`)
const om = series => ({ utc_offset_seconds: OFF, minutely_15: { time: times, ...Object.fromEntries(Object.entries(series).map(([m, v]) => [`precipitation_${m}`, v])) } })
const at = hhmm => Date.parse(`2026-10-03T${hhmm}:00Z`) - OFF * 1000
const dry = Array(10).fill(0)

test('parseNowcastQuery / nowcastUrl — rounded coordinates, every model, 15-minute steps', () => {
  assert.deepEqual(parseNowcastQuery(new URLSearchParams('lat=48.2082&lon=16.3738')), { lat: 48.21, lon: 16.37 })
  assert.equal(parseNowcastQuery(new URLSearchParams('lat=95&lon=1')), null)
  assert.equal(parseNowcastQuery(new URLSearchParams('lat=x')), null)
  const u = nowcastUrl({ lat: 48.21, lon: 16.37 })
  assert.match(u, /minutely_15=precipitation/)
  assert.match(u, /models=best_match,icon_d2,/)
  assert.match(u, /timezone=auto/)
})

test('blendSteps — fine models win over best_match; median, majority vote, agreement; nulls dropped', () => {
  const nc = blendSteps(om({ best_match: Array(10).fill(9), icon_d2: [0, 0.2, 0.5, null, ...dry.slice(4)], knmi_harmonie_arome_europe: [0, 0.4, 0, 0.3, ...dry.slice(4)], dmi_harmonie_arome_europe: [0, 0.1, 0.7, 0.9, ...dry.slice(4)] }))
  assert.equal(nc.precision, 'fine')
  assert.equal(nc.models, 3)
  assert.deepEqual(nc.steps[1], { t: '2026-10-03T14:15', mm: 0.2, wet: true, agree: 1 })
  assert.deepEqual(nc.steps[2], { t: '2026-10-03T14:30', mm: 0.5, wet: true, agree: 0.67 })
  assert.deepEqual(nc.steps[3], { t: '2026-10-03T14:45', mm: 0.6, wet: true, agree: 1 }) // icon_d2 null: two models vote
  assert.equal(nc.steps[0].wet, false)
})

test('blendSteps — only the global model: rough; nothing usable: null', () => {
  const nc = blendSteps(om({ best_match: [0, 0, 1, 1, 0, 0, 0, 0, 0, 0] }))
  assert.equal(nc.precision, 'rough')
  assert.equal(nc.models, 1)
  assert.equal(blendSteps({}), null)
  assert.equal(blendSteps(om({ best_match: Array(10).fill(null) })), null)
})

test('blendSteps — the recorded Vienna response has fine models', () => {
  const nc = blendSteps(JSON.parse(fs.readFileSync(new URL('./__fixtures__/nowcast-vienna.json', import.meta.url))))
  assert.equal(nc.precision, 'fine')
  assert.ok(nc.models >= 2)
  assert.ok(nc.steps.length >= 9)
})

test('intensity — light / moderate / heavy per 15 minutes', () => {
  assert.deepEqual([0.1, 0.59, 0.6, 1.9, 2, 5].map(intensity), ['light', 'light', 'moderate', 'moderate', 'heavy', 'heavy'])
})

test('upcoming / summarize — skips past quarters; dry, start (with and without an end), stop, all; stale data is null', () => {
  const wetAt = (from, to, mm = 0.3) => Array.from({ length: 10 }, (_, i) => (i >= from && i < to ? mm : 0))
  const one = series => blendSteps(om({ icon_d2: series }))
  assert.deepEqual(summarize(one(dry), at('14:05')), { kind: 'dry' })
  // 14:05 now: the 14:00 quarter is current; rain 14:30–15:00
  assert.deepEqual(summarize(one(wetAt(2, 4)), at('14:05')), { kind: 'start', at: '2026-10-03T14:30', minutes: 25, until: '2026-10-03T15:00', duration: 30, intensity: 'light', agree: 1 })
  assert.equal(summarize(one(wetAt(5, 10, 3)), at('14:05')).until, null)
  assert.equal(summarize(one(wetAt(5, 10, 3)), at('14:05')).intensity, 'heavy')
  assert.deepEqual(summarize(one(wetAt(0, 3, 1)), at('14:05')), { kind: 'stop', until: '2026-10-03T14:45', intensity: 'moderate' })
  assert.deepEqual(summarize(one(Array(10).fill(0.2)), at('14:05')), { kind: 'all', intensity: 'light' })
  // 20 min later the 14:00 quarter is gone: the first upcoming step is 14:15
  assert.equal(upcoming(one(dry), at('14:20'))[0].t, '2026-10-03T14:15')
  assert.equal(summarize(one(dry), at('16:00')), null) // fewer than 4 quarters left
})

test('nowcastRain — dry now, start in 10–60 min, agreeing fine models; otherwise null; rough or stale: undefined', () => {
  const start = blendSteps(om({ icon_d2: [0, 0, 0.3, 0.3, 0, ...dry.slice(5)], knmi_harmonie_arome_europe: [0, 0, 0.4, 0, 0, ...dry.slice(5)], dmi_harmonie_arome_europe: [0, 0, 0.2, 0.2, 0, ...dry.slice(5)] }))
  assert.deepEqual(nowcastRain(start, at('14:05')), { from: '2026-10-03T14:30', minutes: 25, duration: 30, intensity: 'light', nowcast: true })
  assert.equal(nowcastRain(start, at('14:25')), null) // 5 min ahead: too close to be news
  const soon = blendSteps(om({ icon_d2: [0, 0, 0, 0, 0, 0, 0.3, 0.3, 0, 0] }))
  assert.equal(nowcastRain(soon, at('14:05')), null) // 85 min ahead: wait for a later run
  // agreement: 3 of 5 models wet is a wet step but only 0.6 agreement — no alert; 4 of 5 is 0.8
  const five = (a, b, c, d, e) => blendSteps(om({ icon_d2: a, knmi_harmonie_arome_europe: b, dmi_harmonie_arome_europe: c, metno_nordic: d, ukmo_uk_deterministic_2km: e }))
  const w = [0, 0, 0.3, 0, ...dry.slice(4)]
  assert.equal(nowcastRain(five(w, w, w, dry, dry), at('14:05')), null)
  assert.equal(nowcastRain(five(w, w, w, w, dry), at('14:05')).from, '2026-10-03T14:30')
  const raining = blendSteps(om({ icon_d2: [0.5, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 0] }))
  assert.equal(nowcastRain(raining, at('14:05')), null) // already raining: no "starts in"
  assert.equal(nowcastRain(blendSteps(om({ best_match: [0, 0, 1, 1, 0, 0, 0, 0, 0, 0] })), at('14:05')), undefined)
  assert.equal(nowcastRain(start, at('16:00')), undefined)
  assert.equal(nowcastRain(null, at('14:05')), undefined)
})
```

- [ ] **Step 3: Run** `node --test lib/nowcast.test.js` → FAIL (module missing).

- [ ] **Step 4: Implement** — create `lib/nowcast.js`:

```js
// Rain in the next 2 hours: Open-Meteo's 15-minute precipitation from every
// short-range model that covers a place, blended like the rest of MetaBlend
// (median amount, majority vote, agreement). Pure — fetching lives in
// /api/nowcast; every consumer summarizes against its own "now", since the
// response is cached for 5 minutes.

export const NOWCAST_MODELS = 'best_match,icon_d2,meteofrance_arome_france_hd,knmi_harmonie_arome_europe,dmi_harmonie_arome_europe,metno_nordic,gfs_hrrr,ukmo_uk_deterministic_2km'
const WET_MM = 0.1
const QUARTER = 15 * 60e3
const r2 = v => Math.round(v * 100) / 100

export function parseNowcastQuery(sp) {
  const lat = Number(sp.get('lat')), lon = Number(sp.get('lon'))
  if (!sp.get('lat') || !sp.get('lon') || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat: r2(lat), lon: r2(lon) }
}

export const nowcastUrl = ({ lat, lon }) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&minutely_15=precipitation&forecast_minutely_15=10&past_minutely_15=1&timezone=auto&models=${NOWCAST_MODELS}`

const median = xs => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function blendSteps(json) {
  const m = json?.minutely_15
  if (!Array.isArray(m?.time)) return null
  const series = Object.entries(m)
    .filter(([k, v]) => (k === 'precipitation' || k.startsWith('precipitation_')) && Array.isArray(v) && v.some(x => typeof x === 'number'))
    .map(([k, v]) => [k === 'precipitation' ? 'best_match' : k.slice('precipitation_'.length), v])
  const fine = series.filter(([name]) => name !== 'best_match')
  const use = fine.length ? fine : series
  if (!use.length) return null
  const steps = m.time.map((t, i) => {
    const vals = use.map(([, v]) => v[i]).filter(x => typeof x === 'number')
    if (!vals.length) return { t, mm: null, wet: false, agree: 0 }
    const wetN = vals.filter(x => x >= WET_MM).length
    return { t, mm: r2(median(vals)), wet: wetN * 2 > vals.length, agree: r2(Math.max(wetN, vals.length - wetN) / vals.length) }
  })
  return { precision: fine.length ? 'fine' : 'rough', models: use.length, utcOffsetSec: json.utc_offset_seconds ?? 0, steps }
}

export const intensity = mm => (mm < 0.6 ? 'light' : mm < 2 ? 'moderate' : 'heavy')

const epoch = (t, off) => Date.parse(`${t}:00Z`) - off * 1000

// the current quarter and the ones after it, at most 8 (2 hours)
export function upcoming(nc, now) {
  if (!nc?.steps) return []
  const off = nc.utcOffsetSec ?? 0
  const i = nc.steps.findIndex(s => epoch(s.t, off) + QUARTER > now)
  return i < 0 ? [] : nc.steps.slice(i, i + 8)
}

const peak = steps => intensity(Math.max(...steps.map(s => s.mm ?? 0)))

export function summarize(nc, now) {
  const steps = upcoming(nc, now)
  if (steps.length < 4) return null
  const first = steps.findIndex(s => s.wet)
  if (first < 0) return { kind: 'dry' }
  if (first === 0) {
    const dryAt = steps.findIndex(s => !s.wet)
    return dryAt < 0
      ? { kind: 'all', intensity: peak(steps) }
      : { kind: 'stop', until: steps[dryAt].t, intensity: peak(steps.slice(0, dryAt)) }
  }
  const end = steps.findIndex((s, i) => i > first && !s.wet)
  const run = steps.slice(first, end < 0 ? undefined : end)
  return {
    kind: 'start', at: steps[first].t,
    minutes: Math.max(0, Math.round((epoch(steps[first].t, nc.utcOffsetSec ?? 0) - now) / 60000)),
    until: end < 0 ? null : steps[end].t, duration: end < 0 ? null : (end - first) * 15,
    intensity: peak(run), agree: steps[first].agree,
  }
}

// The rain alert from the nowcast: undefined when there is no usable
// nowcast here (rough or stale — the hourly rule decides), null when the
// nowcast says no alert, else the event.
export function nowcastRain(nc, now) {
  if (nc?.precision !== 'fine') return undefined
  const s = summarize(nc, now)
  if (!s) return undefined
  if (s.kind !== 'start' || s.minutes < 10 || s.minutes > 60 || s.agree < 0.66) return null
  return { from: s.at, minutes: s.minutes, duration: s.duration, intensity: s.intensity, nowcast: true }
}
```

- [ ] **Step 5: Record and run** — `node scripts/record-nowcast-fixture.mjs`; `node --test lib/nowcast.test.js` → PASS; `npm test` → all pass.

- [ ] **Step 6: Commit** — `git add lib/nowcast.js lib/nowcast.test.js lib/__fixtures__/nowcast-vienna.json scripts/record-nowcast-fixture.mjs && git commit -m "Nowcast: blend 15-minute rain from the short-range models; summary and alert rule"`

### Task 2: Texts (`lib/nowcast-text.js`, 13 languages)

**Files:**
- Create: `lib/nowcast-text.js`, `lib/nowcast-text.test.js`
- Modify: `lib/i18n/*.js` (13)

**Interfaces:**
- Consumes: `summarize` output (Task 1).
- Produces: `nowcastSentence(lang, summary) → string | null`, `nowcastShort(lang, summary) → string | null` (only `start` / `stop`), `nowcastPushBody(lang, rain) → string` (rain = `nowcastRain` event), `NOWCAST_KEYS`.

- [ ] **Step 1: Failing tests** — create `lib/nowcast-text.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nowcastSentence, nowcastShort, nowcastPushBody, NOWCAST_KEYS } from './nowcast-text.js'
import { t } from './i18n.js'

const start = { kind: 'start', at: '2026-10-03T14:30', minutes: 25, until: '2026-10-03T15:00', duration: 30, intensity: 'light', agree: 1 }

test('nowcastSentence — every summary kind in English', () => {
  assert.equal(nowcastSentence('en', { kind: 'dry' }), 'Dry for the next 2 hours')
  assert.equal(nowcastSentence('en', start), 'Rain from ~14:30 for about 30 min · light')
  assert.equal(nowcastSentence('en', { ...start, until: null, duration: null, intensity: 'heavy' }), 'Rain from ~14:30 · heavy')
  assert.equal(nowcastSentence('en', { kind: 'stop', until: '2026-10-03T14:45', intensity: 'moderate' }), 'Rain now, stops ~14:45')
  assert.equal(nowcastSentence('en', { kind: 'all', intensity: 'light' }), 'Rain for the next 2 hours · light')
  assert.equal(nowcastSentence('en', null), null)
})

test('nowcastShort — only when rain starts or stops within 2 hours', () => {
  assert.equal(nowcastShort('en', start), 'Rain ~14:30')
  assert.equal(nowcastShort('en', { kind: 'stop', until: '2026-10-03T14:45', intensity: 'light' }), 'Rain until ~14:45')
  assert.equal(nowcastShort('en', { kind: 'dry' }), null)
  assert.equal(nowcastShort('en', { kind: 'all', intensity: 'light' }), null)
})

test('nowcastPushBody — minutes, intensity, duration when known', () => {
  assert.equal(nowcastPushBody('en', { minutes: 25, duration: 30, intensity: 'light' }), 'In ~25 min · light, about 30 min')
  assert.equal(nowcastPushBody('en', { minutes: 25, duration: null, intensity: 'heavy' }), 'In ~25 min · heavy')
})

test('every nowcast text exists (English; parity.test.js covers the rest)', () => {
  for (const k of NOWCAST_KEYS) assert.notEqual(t('en', k), k, k)
})
```
Run `node --test lib/nowcast-text.test.js` → FAIL.

- [ ] **Step 2: Implement** — create `lib/nowcast-text.js`:

```js
// The nowcast in words: the forecast card's sentence, the widget's short
// line and the "Rain soon" notification body.
import { t } from './i18n.js'
import { fill } from './outlook/text.js'

export const NOWCAST_KEYS = ['ncTitle', 'ncDry', 'ncStart', 'ncStartFor', 'ncStop', 'ncAll', 'ncLight', 'ncModerate', 'ncHeavy',
  'ncShortStart', 'ncShortStop', 'ncRough', 'ncMinutes', 'ncAgreeHint', 'pushNowcastBody', 'pushNowcastBodyOpen']
const LEVEL = { light: 'ncLight', moderate: 'ncModerate', heavy: 'ncHeavy' }
const hh = iso => iso.slice(11, 16)
const tr = (lang, key, vars) => fill(t(lang, key), vars)
const level = (lang, i) => t(lang, LEVEL[i] ?? 'ncLight')
const minutes = (lang, n) => tr(lang, 'ncMinutes', { n })

export function nowcastSentence(lang, s) {
  if (!s) return null
  if (s.kind === 'dry') return t(lang, 'ncDry')
  if (s.kind === 'stop') return tr(lang, 'ncStop', { until: hh(s.until) })
  if (s.kind === 'all') return tr(lang, 'ncAll', { intensity: level(lang, s.intensity) })
  return s.duration
    ? tr(lang, 'ncStartFor', { at: hh(s.at), duration: minutes(lang, s.duration), intensity: level(lang, s.intensity) })
    : tr(lang, 'ncStart', { at: hh(s.at), intensity: level(lang, s.intensity) })
}

export function nowcastShort(lang, s) {
  if (s?.kind === 'start') return tr(lang, 'ncShortStart', { at: hh(s.at) })
  if (s?.kind === 'stop') return tr(lang, 'ncShortStop', { until: hh(s.until) })
  return null
}

export function nowcastPushBody(lang, r) {
  return r.duration
    ? tr(lang, 'pushNowcastBody', { minutes: r.minutes, intensity: level(lang, r.intensity), duration: minutes(lang, r.duration) })
    : tr(lang, 'pushNowcastBodyOpen', { minutes: r.minutes, intensity: level(lang, r.intensity) })
}
```

- [ ] **Step 3: Texts** — add to every `lib/i18n/<code>.js` (before the closing `}`, keeping the file's line endings) a `// rain in the next 2 hours` block with these keys; English:

```
ncTitle: 'Next 2 hours'
ncDry: 'Dry for the next 2 hours'
ncStart: 'Rain from ~{at} · {intensity}'
ncStartFor: 'Rain from ~{at} for about {duration} · {intensity}'
ncStop: 'Rain now, stops ~{until}'
ncAll: 'Rain for the next 2 hours · {intensity}'
ncLight: 'light'
ncModerate: 'moderate'
ncHeavy: 'heavy'
ncShortStart: 'Rain ~{at}'
ncShortStop: 'Rain until ~{until}'
ncRough: 'Rough estimate — no short-range model covers this place'
ncMinutes: '{n} min'
ncAgreeHint: 'Faint bars: the models disagree'
pushNowcastBody: 'In ~{minutes} min · {intensity}, about {duration}'
pushNowcastBodyOpen: 'In ~{minutes} min · {intensity}'
```
The other 12 languages translated with the same `{placeholders}`, typographic apostrophes (’) only; `ncMinutes` in the language's own unit form (ja `{n}分`, zh `{n} 分钟`, ko `{n}분`). Run `node --test lib/nowcast-text.test.js lib/i18n/parity.test.js` → PASS.

- [ ] **Step 4: Commit** — `git add lib/nowcast-text.js lib/nowcast-text.test.js lib/i18n && git commit -m "Nowcast texts in 13 languages"`

### Task 3: `/api/nowcast`

**Files:**
- Create: `app/api/nowcast/route.js`

**Interfaces:**
- Consumes: `parseNowcastQuery`, `nowcastUrl`, `blendSteps` (Task 1); `getJson`, `lastUpstreamFailure` (`lib/outlook/http.js`).
- Produces: `GET /api/nowcast?lat&lon → 200 blendSteps result | 400 | 429 | 502 { error, upstream }`.

- [ ] **Step 1: Implement** — create `app/api/nowcast/route.js`:

```js
import { withErrorLog, logError } from '@/lib/log'
import { clientIp, isInternal } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { getJson, lastUpstreamFailure } from '@/lib/outlook/http'
import { parseNowcastQuery, nowcastUrl, blendSteps } from '@/lib/nowcast'

// Rain in the next 2 hours for a place: the blended 15-minute steps
// (lib/nowcast.js). Consumers summarize against their own clock, so the
// CDN may keep a response for 5 minutes.
const TTL = 300
const CACHE = new Map()
const limiter = createRateLimiter({ max: 60, windowMs: 60 * 1000 }) // cache misses per minute, per IP
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const cdn = ttl => ({ 'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${TTL}` })

export const GET = withErrorLog('nowcast', async (request) => {
  const q = parseNowcastQuery(new URL(request.url).searchParams)
  if (!q) return noStore({ error: 'lat and lon are required' }, 400)
  const key = `${q.lat},${q.lon}`
  const hit = CACHE.get(key)
  const age = hit ? Date.now() - hit.ts : Infinity
  if (age < TTL * 1000) return Response.json(hit.nc, { headers: cdn(Math.max(1, Math.round(TTL - age / 1000))) })
  if (!isInternal(request) && limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)
  const nc = blendSteps(await getJson(nowcastUrl(q), { ms: 8000, retries: 1 }))
  if (!nc) {
    await logError('nowcast.upstream', new Error('nowcast unavailable'), { upstream: lastUpstreamFailure() })
    return noStore({ error: 'Rain for the next 2 hours is unavailable right now', upstream: lastUpstreamFailure() }, 502)
  }
  CACHE.set(key, { ts: Date.now(), nc })
  return Response.json(nc, { headers: cdn(TTL) })
})
```

- [ ] **Step 2: Verify** — `npx eslint app lib --max-warnings 0`; `npx next build`; with `npx next start -p 3123`: `curl -s "http://localhost:3123/api/nowcast?lat=48.21&lon=16.37"` → JSON with `precision: "fine"`, `models ≥ 2`, ≥ 9 steps; `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3123/api/nowcast?lat=x"` → `400`. Stop the server.

- [ ] **Step 3: Commit** — `git add app/api/nowcast && git commit -m "/api/nowcast: blended 15-minute rain, cached 5 minutes"`

### Task 4: Forecast card and widget text

**Files:**
- Create: `app/components/outlook/NowcastCard.jsx`
- Modify: `app/components/outlook/TabToday.jsx`, `lib/app-widget.js` (`weatherPayload`), `app/api/app-widget/route.js`, `lib/app-widget.test.js`

**Interfaces:**
- Consumes: `summarize`, `upcoming`, `intensity` (Task 1); `nowcastSentence`, `nowcastShort` (Task 2); `/api/nowcast` (Task 3).
- Produces: `<NowcastCard lat lon lang />`; `weatherPayload({ …, nowcast = null })`.

- [ ] **Step 1: Failing widget test** — append to `lib/app-widget.test.js` (reuse that file's existing forecast/outlook fixtures for `weatherPayload`; `NOW` = a time inside the fixture's hours):

```js
test('weatherPayload — rain within 2 hours replaces the condition line; dry or no nowcast keeps it', () => {
  const base = weatherPayload({ forecast: FORECAST, outlook: OUTLOOK, lang: 'en', unit: 'C', now: NOW })
  const off = OUTLOOK.utcOffsetSec ?? 0
  const q = i => new Date(NOW + off * 1000 + i * 15 * 60e3).toISOString().slice(0, 16)
  const nc = wet => ({ precision: 'fine', models: 2, utcOffsetSec: off, steps: Array.from({ length: 10 }, (_, i) => ({ t: q(i), mm: wet(i) ? 0.3 : 0, wet: wet(i), agree: 1 })) })
  const soon = weatherPayload({ forecast: FORECAST, outlook: OUTLOOK, lang: 'en', unit: 'C', now: NOW, nowcast: nc(i => i === 2 || i === 3) })
  assert.match(soon.now.text, /^Rain ~\d\d:\d\d$/)
  assert.equal(weatherPayload({ forecast: FORECAST, outlook: OUTLOOK, lang: 'en', unit: 'C', now: NOW, nowcast: nc(() => false) }).now.text, base.now.text)
  assert.equal(weatherPayload({ forecast: FORECAST, outlook: OUTLOOK, lang: 'en', unit: 'C', now: NOW, nowcast: null }).now.text, base.now.text)
})
```
(If the fixtures in that file have other names, use those names; `q(i)` builds quarter-hour local times starting at `NOW`.) Run → FAIL.

- [ ] **Step 2: Widget payload** — in `lib/app-widget.js`: import `summarize` from `./nowcast.js` and `nowcastShort` from `./nowcast-text.js`; `weatherPayload({ forecast, outlook, lang, unit, now = Date.now(), nowcast = null })`; in `now:` use `text: nowcastShort(lang, summarize(nowcast, now)) ?? translateCondition(lang, condition ?? '')`. In `app/api/app-widget/route.js` after the forecast/outlook fetch: `const nc = await getJson(`${base}/api/nowcast?lat=${forecast.json.lat}&lon=${forecast.json.lon}`)` and pass `nowcast: nc.json` (a failed fetch gives `json: null` → unchanged text). Run the test → PASS.

- [ ] **Step 3: The card** — create `app/components/outlook/NowcastCard.jsx`:

```jsx
'use client'

import { useEffect, useState } from 'react'
import { CloudRain } from 'lucide-react'
import { t } from '@/lib/i18n'
import { summarize, upcoming, intensity } from '@/lib/nowcast'
import { nowcastSentence } from '@/lib/nowcast-text'
import { SectionTitle } from '../ui'

const OPACITY = { light: 0.45, moderate: 0.75, heavy: 1 }

// Rain in the next 2 hours: one sentence and eight quarter-hour bars. Fetches
// /api/nowcast for the city and again every 5 minutes; hidden when it fails.
export default function NowcastCard({ lat, lon, lang }) {
  const [state, setState] = useState({ nc: null, now: 0 })
  useEffect(() => {
    let off = false
    const load = () => fetch(`/api/nowcast?lat=${lat}&lon=${lon}`)
      .then(r => (r.ok ? r.json() : null), () => null)
      .then(nc => { if (!off) setState({ nc, now: Date.now() }) })
    load()
    const id = setInterval(load, 5 * 60e3)
    return () => { off = true; clearInterval(id) }
  }, [lat, lon])

  const s = state.nc ? summarize(state.nc, state.now) : null
  if (!s) return null
  const steps = upcoming(state.nc, state.now)
  const max = Math.max(1, ...steps.map(x => x.mm ?? 0))
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3" aria-label={t(lang, 'ncTitle')}>
      <SectionTitle icon={CloudRain}>{t(lang, 'ncTitle')}</SectionTitle>
      <p className="text-base font-semibold">{nowcastSentence(lang, s)}</p>
      <div className="flex items-end gap-1.5 h-12" aria-hidden>
        {steps.map(x => (
          <div key={x.t} className="flex-1 rounded-sm" style={{
            height: `${x.wet ? Math.max(12, ((x.mm ?? 0) / max) * 100) : 6}%`,
            background: x.wet ? 'var(--info)' : 'var(--muted)',
            opacity: x.wet ? OPACITY[intensity(x.mm ?? 0)] * (x.agree < 0.66 ? 0.5 : 1) : 0.25,
          }} />
        ))}
      </div>
      <div className="flex text-[11px] text-zinc-500 tabular-nums" aria-hidden>
        {steps.map((x, i) => <span key={x.t} className="flex-1">{i % 2 === 0 ? x.t.slice(11, 16) : ''}</span>)}
      </div>
      {state.nc.precision === 'rough'
        ? <p className="text-xs text-zinc-500">{t(lang, 'ncRough')}</p>
        : steps.some(x => x.wet && x.agree < 0.66) && <p className="text-xs text-zinc-500">{t(lang, 'ncAgreeHint')}</p>}
    </section>
  )
}
```
In `TabToday.jsx` import it and render right after `<Headline … />`: `{now?.lat != null && now?.lon != null && <NowcastCard lat={now.lat} lon={now.lon} lang={lang} />}`.

- [ ] **Step 4: Verify** — `npx eslint app lib --max-warnings 0`, `npm test`, `npx next build`; local server; headless Edge 390 px on `/?city=Vienna` (en) and `/?city=Sydney`: the card shows the sentence and 8 bars, Sydney shows the rough note, no horizontal scroll; screenshot read. Stop the server.

- [ ] **Step 5: Commit** — `git add app/components/outlook lib/app-widget.js lib/app-widget.test.js app/api/app-widget/route.js && git commit -m "Next 2 hours card on the forecast; widget shows when rain starts or stops"`

### Task 5: The 15-minute rain alert

**Files:**
- Modify: `lib/push/rules.js` (`cityEvents`), `lib/push/dispatch.js` (`runDispatch`), `lib/push/text.js` (`rain` case), `app/api/push/dispatch/route.js`, `supabase/cron.sql`, `lib/push/rules.test.js`, `lib/push/dispatch.test.js`, `lib/push/text.test.js`

**Interfaces:**
- Consumes: `nowcastRain` (Task 1), `nowcastPushBody` (Task 2), `/api/nowcast` (Task 3).
- Produces: `cityEvents(outlook, now, nowcast = null)`; `runDispatch({ …, only = null })` (`'rain'` = rain alerts only); `GET /api/push/dispatch?only=rain`; pg_cron job `push-dispatch-nowcast`.

- [ ] **Step 1: Failing tests.** In `lib/push/rules.test.js` (use the file's existing outlook fixture builders; `OUT` = an outlook whose hourly has rainPct ≥ 60 an hour ahead after dry hours, so the hourly rule alone would fire):

```js
test('cityEvents — a fine nowcast decides rain; rough or none falls back to the hourly rule', () => {
  const off = OUT.utcOffsetSec ?? 0
  const q = i => new Date(NOW + off * 1000 + i * 15 * 60e3).toISOString().slice(0, 16)
  const nc = (precision, wet) => ({ precision, models: 2, utcOffsetSec: off, steps: Array.from({ length: 10 }, (_, i) => ({ t: q(i), mm: wet(i) ? 0.3 : 0, wet: wet(i), agree: 1 })) })
  const hourly = cityEvents(OUT, NOW).rain
  assert.ok(hourly) // the fixture's hourly rule fires on its own
  assert.equal(cityEvents(OUT, NOW, nc('fine', () => false)).rain, null) // fine and dry: no rain alert
  const r = cityEvents(OUT, NOW, nc('fine', i => i === 2 || i === 3)).rain
  assert.equal(r.nowcast, true)
  assert.ok(r.minutes >= 10 && r.minutes <= 60)
  assert.deepEqual(cityEvents(OUT, NOW, nc('rough', () => false)).rain, hourly)
})
```
In `lib/push/text.test.js`:
```js
test('pushText — a nowcast rain alert says when and how long', () => {
  const m = pushText('en', 'C', { kind: 'rain', vars: { city: 'Vienna', from: '2026-10-03T14:30', minutes: 25, duration: 30, intensity: 'light', nowcast: true } })
  assert.equal(m.title, '🌧 Rain in Vienna')
  assert.equal(m.body, 'In ~25 min · light, about 30 min')
})
```
In `lib/push/dispatch.test.js` (use its `fakeStore`, `dev`, `at` helpers; the outlook fixture `rainy` gets `lat: 48.21, lon: 16.37`):
```js
test('dispatch only=rain — nowcast per home city, rain alerts only, no hike work; nowcast down → hourly rule', async () => {
  const off = 7200
  const q = (base, i) => new Date(base + off * 1000 + i * 15 * 60e3).toISOString().slice(0, 16)
  const now = at('13:05')
  const nc = { precision: 'fine', models: 3, utcOffsetSec: off, steps: Array.from({ length: 10 }, (_, i) => ({ t: q(now, i), mm: i === 2 ? 0.4 : 0, wet: i === 2, agree: 1 })) }
  const urls = []
  const getJson = async url => { urls.push(url); return url.includes('/api/nowcast') ? nc : { ...rainy, lat: 48.21, lon: 16.37 } }
  const sent = []
  const store = fakeStore({ devices: [dev('a', { lang: 'en' })], plans: [{ id: 'p1', device_id: 'a', name: 'X', lat: 1, lon: 1, elev: 1, date: '2026-10-01' }] })
  await runDispatch({ store, getJson, only: 'rain', sender: { send: async (d, m) => { sent.push(m); return { ok: true } } }, now })
  assert.ok(urls.some(u => u.includes('/api/nowcast?lat=48.21&lon=16.37')))
  assert.ok(!urls.some(u => u.includes('/api/hike')))
  assert.equal(sent.length, 1)
  assert.match(sent[0].body, /^In ~\d+ min/)
  const down = fakeStore({ devices: [dev('b', { lang: 'en' })] })
  const sent2 = []
  await runDispatch({ store: down, getJson: async url => (url.includes('/api/nowcast') ? null : { ...rainy, lat: 48.21, lon: 16.37 }), only: 'rain', sender: { send: async (d, m) => { sent2.push(m); return { ok: true } } }, now })
  assert.equal(sent2.length, 1) // the hourly rule's message
  assert.doesNotMatch(sent2[0].body, /^In ~/)
})
```
Run `node --test lib/push` → the new tests FAIL.

- [ ] **Step 2: Rules** — in `lib/push/rules.js` import `nowcastRain` from `'../nowcast.js'`; `export function cityEvents(outlook, now, nowcast = null)`; replace the hourly rain block with:

```js
  // rain: the 15-minute nowcast where short-range models cover the city;
  // the hourly rule only where they don't (or the nowcast is missing)
  const nr = nowcastRain(nowcast, now)
  if (nr !== undefined) ev.rain = nr
  else {
    const ri = hours.findIndex(h => typeof h.rainPct === 'number' && h.rainPct >= RULES.rainPct)
    if (ri >= 0 && within(lead(hours[ri]), RULES.rainLead)) {
      const before = hours.slice(Math.max(0, ri - RULES.dryHours), ri)
      if (before.length && before.every(h => typeof h.rainPct === 'number' && h.rainPct < RULES.dryPct)) {
        ev.rain = { from: hours[ri].t, pct: hours[ri].rainPct }
      }
    }
  }
```

- [ ] **Step 3: Text** — in `lib/push/text.js` import `nowcastPushBody` from `'../nowcast-text.js'`; the `rain` case body becomes `v.nowcast ? nowcastPushBody(lang, v) : tr('pushRainBody', { from: hh(v.from), pct: v.pct })`.

- [ ] **Step 4: Dispatcher** — in `lib/push/dispatch.js`: `runDispatch({ …, only = null })`; `const plans = only ? [] : await store.openPlans(now)`; in the group filter use `const on = only === 'rain' ? d.alert_rain : (d.alert_rain || d.alert_storm || d.alert_severe || d.alert_heat || d.briefing)`; in the city loop after the outlook:

```js
    const wantsRain = ds.some(d => d.alert_rain)
    const nowcast = wantsRain && outlook.lat != null && outlook.lon != null
      ? await getJson(`${base}/api/nowcast?lat=${outlook.lat}&lon=${outlook.lon}`)
      : null
    const ev = cityEvents(outlook, now, nowcast)
    const url = `/?city=${encodeURIComponent(outlook.city)}`
    for (const d of ds) for (const msg of decide(d, ev, logOf(d.id))) {
      if (!only || msg.kind === only) outbox.push({ device: d, msg, url })
    }
```
(replacing the existing `const ev …` / `for (const d of ds)` lines; with `plans = []` the peak and route loops do nothing in `only` mode).

- [ ] **Step 5: Route and schedule** — in `app/api/push/dispatch/route.js`: `const sp = new URL(request.url).searchParams`, `const dry = sp.get('dry') === '1'`, `const only = sp.get('only') === 'rain' ? 'rain' : null`, pass `only` into `runDispatch`; update the header comment ("Hourly … plus every 15 minutes with ?only=rain"). Append to `supabase/cron.sql`:

```sql
-- Rain in the next 2 hours: the "Rain soon" alert from the 15-minute
-- nowcast, every quarter hour (the hourly job above covers everything else).
select cron.schedule(
  'push-dispatch-nowcast',
  '2,17,32,47 * * * *',
  $job$
  select net.http_get(
    url := 'https://metablend.app/api/push/dispatch?only=rain',
    headers := jsonb_build_object(
      'x-calibrate-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'calibrate_secret')
    ),
    timeout_milliseconds := 120000
  );
  $job$
);
```

- [ ] **Step 6: Run** `node --test lib/push` → PASS; `npm test` → all pass; `npx eslint app lib --max-warnings 0`.

- [ ] **Step 7: Commit** — `git add lib/push app/api/push/dispatch supabase/cron.sql && git commit -m "Rain soon alert from the 15-minute nowcast, checked every quarter hour"`

### Task 6: Ship

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: CHANGELOG** — under the top date:

```markdown
### Added — rain in the next 2 hours
- **Next 2 hours** on the forecast: when rain starts or stops, how long and
  how heavy, from a blend of the short-range models that cover the place
  (ICON-D2, AROME, HARMONIE, MET Nordic, UKMO, HRRR) in 15-minute steps;
  "rough estimate" where none does.
- The weather widget shows "Rain ~14:20" / "Rain until ~14:40" when rain is
  due within 2 hours.
- **Rain soon** alerts come from the nowcast, checked every 15 minutes: "Rain
  in Vienna — in ~20 min · light, about 25 min". The hourly rule stays where no
  short-range model covers the home city.
```

- [ ] **Step 2: Push** — `npm test`, `npx next build`, commit `"Changelog: rain in the next 2 hours"`, `git push origin main`; after the deploy: `curl -s "https://metablend.app/api/nowcast?lat=48.21&lon=16.37"` → `"precision":"fine"`; `curl -s -H "x-calibrate-key: …"` is not possible from here (secret stays in Vault) — check instead with the Supabase MCP that the job exists after applying it: run the `push-dispatch-nowcast` `cron.schedule` statement via `execute_sql`, then `select jobname, schedule from cron.job where jobname = 'push-dispatch-nowcast'` → one row, and after the next quarter hour `select status from cron.job_run_details … order by start_time desc limit 3` shows `succeeded`.
