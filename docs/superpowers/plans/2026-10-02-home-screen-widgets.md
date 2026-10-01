# Home-screen widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Weather and hike widgets for the MetaBlend app's home screen on Android and iOS, fed by a compact `/api/app-widget` endpoint and configured from settings the app syncs.

**Architecture:** The server boils the existing forecast / outlook / summit forecast (read through the CDN) down to display-ready text (`lib/app-widget.js`). The website, running inside the app, hands the widgets their settings through a tiny native `WidgetBridge` plugin (`lib/app-widget-client.js`). Native widgets (Java `RemoteViews` on Android, SwiftUI WidgetKit on iOS) fetch, cache and render; a `metablend://open?path=…` link brings taps back into the app.

**Tech Stack:** Next.js 16 App Router (plain JS, `node --test`), Capacitor 8.5, Android (Java, AGP 9.4.1, SDK 36, min 24), iOS (Swift, WidgetKit + AppIntents, iOS 17 for the extension).

**Spec:** `docs/superpowers/specs/2026-10-01-home-screen-widgets-design.md`

## Global Constraints

- Endpoint: `GET /api/app-widget` (weather: `city, lang, unit`; hike: `kind=hike, name, lat, lon, elev, date, lang, unit`); `Cache-Control: public, s-maxage=900, stale-while-revalidate=1800`; errors `no-store`.
- Self-fetches go to `https://metablend.app` on Vercel (`VERCEL_ENV` set), else the request origin, with header `x-calibrate-key: $CALIBRATE_SECRET` when set.
- Shared settings JSON: `{ v: 1, lang, unit, base: "https://metablend.app", home, recent (≤ 8, home first), hikes (≤ 5, date ≥ today, soonest first, {name, lat, lon, elev, date}) }`.
- Storage: iOS App Group `group.app.metablend`, key `widget_settings`; Android SharedPreferences `widget`, key `settings`.
- Deep link: `metablend://open?path=<encoded same-site path>`.
- Languages: en, de, fr, es, it. Units: C, F.
- Refresh: ~30 min (iOS `.after(now + 30 min)`, Android `updatePeriodMillis=1800000`); stale data shows its time, dimmed after 3 h.
- Android: Java only, no new Gradle dependencies. iOS: widget extension target `MetaBlendWidgets`, deployment target 17.0; App target stays 15.0.
- lib/ files are ESM with relative `.js` imports (tests run with plain `node --test`); app code may use `@/`.
- Commit and push straight to `main`.

## Review Focus

1. City names with spaces, umlauts or apostrophes ("Sankt Pölten", "L'Aquila") — must survive JS → Java/Swift → URL → server → deep link back. Pinned in Task 2 (query parsing) and Task 4 (deep link with an encoded city).
2. °F users — every temperature (now, today, hours, days, summit) converted. Pinned in Task 2.
3. Night hours — moon instead of sun, night sky. Pinned in Task 2.
4. A hike planned for today, looked at in the evening (`windows.today` is `null`) — "No daylight left today", not a crash or a green window. Pinned in Task 2.
5. All weather sources down (`heroCondition` null) — empty text, neutral icon, no exception. Pinned in Task 2.

---

## Stage 1 — Web side

### Task 1: Shared condition helpers + internal fetches skip the limiter

**Files:**
- Create: `lib/conditions.js`, `lib/conditions.test.js`, `lib/auth.test.js`
- Modify: `app/components/outlook/icons.js` (becomes a re-export), `lib/auth.js` (add `isInternal`), `app/api/forecast/route.js:63`, `app/api/outlook/route.js:28`, `app/api/hike/route.js:22`

**Interfaces:**
- Produces: `conditionIcon(condition, lon, dark = null) → emoji`, `heroCondition(forecast) → string | null` (from `lib/conditions.js`); `isInternal(request) → boolean` (from `lib/auth.js`).

- [ ] **Step 1: Write the failing tests**

**File (create): `lib/conditions.test.js`**
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { conditionIcon, heroCondition } from './conditions.js'

test('conditionIcon — words to emoji, the moon only for a clear night', () => {
  assert.equal(conditionIcon('Light rain', 12), '🌧')
  assert.equal(conditionIcon('Partly cloudy', 12, true), '⛅')
  assert.equal(conditionIcon('Clear', 12, true), '🌙')
  assert.equal(conditionIcon('Clear', 12, false), '☀️')
  assert.equal(conditionIcon(null, 12), '🌤')
})

test('heroCondition — Open-Meteo first, then the first healthy source', () => {
  assert.equal(heroCondition({ sources: [{ apiId: 'x', condition: 'Rain' }, { apiId: 'open-meteo', condition: 'Clear' }] }), 'Clear')
  assert.equal(heroCondition({ sources: [{ apiId: 'open-meteo', down: true, condition: 'Clear' }, { apiId: 'y', condition: 'Fog' }] }), 'Fog')
  assert.equal(heroCondition({ sources: [{ apiId: 'z', down: true, condition: 'Snow' }] }), null)
  assert.equal(heroCondition(null), null)
})
```

**File (create): `lib/auth.test.js`**
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isInternal } from './auth.js'

const req = headers => new Request('https://metablend.app/api/forecast', { headers })

test('isInternal — only with the calibrate secret configured and matching', () => {
  const before = process.env.CALIBRATE_SECRET
  try {
    delete process.env.CALIBRATE_SECRET
    assert.equal(isInternal(req({ 'x-calibrate-key': '' })), false)
    process.env.CALIBRATE_SECRET = 's3cret'
    assert.equal(isInternal(req({ 'x-calibrate-key': 's3cret' })), true)
    assert.equal(isInternal(req({ 'x-calibrate-key': 'nope' })), false)
    assert.equal(isInternal(req({})), false)
  } finally {
    if (before === undefined) delete process.env.CALIBRATE_SECRET
    else process.env.CALIBRATE_SECRET = before
  }
})
```

- [ ] **Step 2: Run them — expect failures** (`Cannot find module './conditions.js'`, `isInternal is not a function`)

Run: `node --test lib/conditions.test.js lib/auth.test.js`

- [ ] **Step 3: Implement**

**File (create): `lib/conditions.js`**
```js
// Consensus condition → icon (pure — unit tested). Sources report English
// condition strings; night only swaps the clear-sky icon: `dark` from the
// city's sun times when known, else a rough guess from its longitude.
import { isNightAt } from './localtime.js'

export function conditionIcon(condition, lon, dark = null) {
  const c = (condition ?? '').toLowerCase()
  if (/thunder|storm/.test(c)) return '⛈'
  if (/snow|sleet|ice|freez/.test(c)) return '🌨'
  if (/drizzle/.test(c)) return '🌦'
  if (/rain|shower/.test(c)) return '🌧'
  if (/fog|mist|haze/.test(c)) return '🌫'
  if (/overcast/.test(c)) return '☁️'
  if (/partly|broken|scattered|few/.test(c)) return '⛅'
  if (/cloud/.test(c)) return '☁️'
  if (/clear|sunny|fair/.test(c)) return (dark ?? isNightAt(lon)) ? '🌙' : '☀️'
  return '🌤'
}

// Open-Meteo's wording when it's up, otherwise the first healthy source.
export function heroCondition(data) {
  return data?.sources?.find(s => s.apiId === 'open-meteo' && !s.down)?.condition
    ?? data?.sources?.find(s => !s.down && s.condition)?.condition
    ?? null
}
```

Replace the whole of `app/components/outlook/icons.js` with:
```js
// Moved to lib/conditions.js (the app widget's server code needs them too).
export { conditionIcon, heroCondition } from '@/lib/conditions'
```

Append to `lib/auth.js`:
```js

// The site's own server-to-server reads (the app widget fetching forecast,
// outlook and summit forecast through the CDN). They all leave from Vercel's
// few egress IPs, so the per-IP limiters would count every city as one
// visitor; they carry the calibrate secret instead.
export function isInternal(request) {
  const key = process.env.CALIBRATE_SECRET
  return !!key && request.headers.get('x-calibrate-key') === key
}
```

In `app/api/forecast/route.js`: import `isInternal` alongside `clientIp` (`import { clientIp, isInternal } from '@/lib/auth'`) and change `if (limiter.limited(clientIp(request))) {` to `if (!isInternal(request) && limiter.limited(clientIp(request))) {`. Same two edits in `app/api/outlook/route.js` and `app/api/hike/route.js` (their line is `if (limiter.limited(clientIp(request))) return noStore(...)`).

- [ ] **Step 4: Run all tests** — `npm test` → all pass.
- [ ] **Step 5: Commit** — `git add lib/conditions.js lib/conditions.test.js lib/auth.js lib/auth.test.js app/components/outlook/icons.js app/api/forecast/route.js app/api/outlook/route.js app/api/hike/route.js && git commit -m "Conditions helpers move to lib; the site's own fetches skip the per-IP limiter"`

### Task 2: Widget payloads (`lib/app-widget.js`)

**Files:**
- Create: `lib/app-widget.js`, `lib/app-widget.test.js`
- Modify: `lib/i18n.js` (key `widgetNoWindow` in all five languages, next to `swNoDaylight`)

**Interfaces:**
- Consumes: `conditionIcon`, `heroCondition` (Task 1).
- Produces:
  - `parseAppWidgetQuery(URLSearchParams) → { kind:'weather', city, lang, unit } | { kind:'hike', peak:{name,lat,lon,elev}, date, lang, unit } | null`
  - `weatherPayload({ forecast, outlook, lang, unit }) → { kind, city, path, now:{temp,icon,text,sky}, today:{hi,lo}, hours:[{t,ts,icon,temp,rain,sky}], days:[{day,icon,hi,lo}], skies:{[sky]:[c1,c2,c3]} }`
  - `hikePayload({ hike, peak, date, lang, unit }) → { kind, peak, day, path, line:string|null, good:boolean|null, icon, hi, lo, wind, rain, storm:string|null, sky, skies } | null`
  - `skyForIcon(emoji) → sky key`

- [ ] **Step 1: i18n key** — after the `swNoDaylight` line of each language block add: en `widgetNoWindow: 'No safe window',` · de `widgetNoWindow: 'Kein sicheres Fenster',` · fr `widgetNoWindow: 'Pas de créneau sûr',` · es `widgetNoWindow: 'Sin ventana segura',` · it `widgetNoWindow: 'Nessuna finestra sicura',`

- [ ] **Step 2: Write the failing tests**

**File (create): `lib/app-widget.test.js`**
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAppWidgetQuery, weatherPayload, hikePayload, skyForIcon } from './app-widget.js'
import { t } from './i18n.js'

const sp = q => new URLSearchParams(q)
const weekday = (date, lang) => new Date(date).toLocaleDateString(lang, { weekday: 'short', timeZone: 'UTC' })

test('parseAppWidgetQuery — weather: city (any script), language and unit', () => {
  assert.deepEqual(parseAppWidgetQuery(sp('city=Sankt%20P%C3%B6lten&lang=de&unit=F')), { kind: 'weather', city: 'Sankt Pölten', lang: 'de', unit: 'F' })
  assert.deepEqual(parseAppWidgetQuery(sp("city=L'Aquila")), { kind: 'weather', city: "L'Aquila", lang: 'en', unit: 'C' })
  assert.deepEqual(parseAppWidgetQuery(sp('city=Lienz&lang=xx&unit=K')), { kind: 'weather', city: 'Lienz', lang: 'en', unit: 'C' })
  assert.equal(parseAppWidgetQuery(sp('city=%20%20')), null)
  assert.equal(parseAppWidgetQuery(sp(`city=${'x'.repeat(101)}`)), null)
  assert.equal(parseAppWidgetQuery(sp('')), null)
})

test('parseAppWidgetQuery — hike: a peak and a calendar date', () => {
  assert.deepEqual(parseAppWidgetQuery(sp('kind=hike&name=Hochstadel&lat=46.7891&lon=12.8612&elev=2681&date=2026-10-02&lang=de')),
    { kind: 'hike', peak: { name: 'Hochstadel', lat: 46.789, lon: 12.861, elev: 2681 }, date: '2026-10-02', lang: 'de', unit: 'C' })
  assert.equal(parseAppWidgetQuery(sp('kind=hike&lat=46.7&lon=12.8&elev=2681&date=tomorrow')), null)
  assert.equal(parseAppWidgetQuery(sp('kind=hike&lat=46.7&elev=2681&date=2026-10-02')), null)
})

const forecast = { city: 'Lienz', lon: 12.77, consensus: { temp: 13.4 }, sources: [{ apiId: 'open-meteo', down: false, condition: 'Partly cloudy' }] }
const hour = (t, temp, rainPct, icon, code) => ({ t, temp, rainPct, icon, code })
const outlook = {
  nowLocal: '2026-10-01T19:40', utcOffsetSec: 7200, sun: { sunrise: '07:10', sunset: '18:50' },
  hourly: [
    hour('2026-10-01T19:00', 14, 0, '⛅', 2), hour('2026-10-01T20:00', 13, 10, '☀️', 0), hour('2026-10-01T21:00', 12.4, 60, '🌧', 61),
    hour('2026-10-01T22:00', 12, 0, '☁️', 3), hour('2026-10-01T23:00', 11, 0, '☁️', 3), hour('2026-10-02T00:00', 10, 0, '☀️', 0),
    hour('2026-10-02T01:00', 9.6, 0, '☀️', 0), hour('2026-10-02T02:00', 9, 0, '☀️', 0),
  ],
  days: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07']
    .map((date, i) => ({ date, tempMax: 21.3 - i, tempMin: 10.5 - i, icon: i % 2 ? '🌤' : '⛅' })),
}

test('weatherPayload — the blend now, the next 6 hours, the next 5 days, as text', () => {
  const p = weatherPayload({ forecast, outlook, lang: 'de', unit: 'C' })
  assert.equal(p.kind, 'weather')
  assert.equal(p.city, 'Lienz')
  assert.equal(p.path, '/?city=Lienz')
  assert.deepEqual(p.now, { temp: '13°', icon: '⛅', text: t('de', 'cPartlyCloudy'), sky: 'night' })
  assert.deepEqual(p.today, { hi: '21°', lo: '11°' })
  assert.equal(p.hours.length, 6)
  assert.deepEqual(p.hours[0], { t: '20:00', ts: Date.parse('2026-10-01T20:00:00Z') / 1000 - 7200, icon: '🌙', temp: '13°', rain: '10%', sky: 'night' })
  assert.deepEqual(p.hours[1], { t: '21:00', ts: Date.parse('2026-10-01T21:00:00Z') / 1000 - 7200, icon: '🌧', temp: '12°', rain: '60%', sky: 'rain' })
  assert.equal(p.days.length, 5)
  assert.deepEqual(p.days[0], { day: weekday('2026-10-02', 'de'), icon: '🌤', hi: '20°', lo: '10°' })
  assert.deepEqual(Object.keys(p.skies).sort(), ['night', 'rain'])
  assert.equal(p.skies.night.length, 3)
})

test('weatherPayload — °F everywhere', () => {
  const p = weatherPayload({ forecast, outlook, lang: 'en', unit: 'F' })
  assert.equal(p.now.temp, '56°')
  assert.equal(p.today.hi, '70°')
  assert.equal(p.hours[0].temp, '55°')
  assert.equal(p.days[0].lo, '49°')
})

test('weatherPayload — all sources down: no text, neutral icon', () => {
  const p = weatherPayload({ forecast: { ...forecast, sources: [{ apiId: 'open-meteo', down: true }] }, outlook, lang: 'en', unit: 'C' })
  assert.equal(p.now.text, '')
  assert.equal(p.now.icon, '🌤')
})

const peak = { name: 'Hochstadel', lat: 46.789, lon: 12.861, elev: 2681 }
const cap = w => w.charAt(0).toLocaleUpperCase('de') + w.slice(1)
const hike = {
  nowLocal: '2026-10-01T19:40', notes: [],
  days: [
    { date: '2026-10-01', tempMax: 8, tempMin: 1, windMax: 30, rainPct: 70, storm: 'high', icon: '⛈' },
    { date: '2026-10-02', tempMax: 11.7, tempMin: 3.6, windMax: 7, rainPct: 0, storm: 'low', icon: '⛅' },
    { date: '2026-10-04', tempMax: 6, tempMin: -2, windMax: 45.4, rainPct: 20, storm: 'moderate', icon: '🌨' },
  ],
  windows: { today: null, tomorrow: { window: { from: '2026-10-02T08:00', to: '2026-10-02T18:47', hours: 11 }, next: null } },
}

test('hikePayload — tomorrow: the summit window, green', () => {
  const p = hikePayload({ hike, peak, date: '2026-10-02', lang: 'de', unit: 'C' })
  assert.deepEqual(p, {
    kind: 'hike', peak: 'Hochstadel', day: cap(t('de', 'tomorrowWord')), path: '/hike?lat=46.789&lon=12.861&elev=2681&name=Hochstadel',
    line: '08:00–18:47', good: true, icon: '⛅', hi: '12°', lo: '4°', wind: '7 km/h', rain: '0%',
    storm: `${t('de', 'stormRisk')}: ${t('de', 'stormLow')}`, sky: 'day', skies: { day: p.skies.day },
  })
  assert.equal(p.skies.day.length, 3)
})

test('hikePayload — today in the evening: no daylight left, not green', () => {
  const p = hikePayload({ hike, peak, date: '2026-10-01', lang: 'en', unit: 'C' })
  assert.equal(p.line, t('en', 'swNoDaylight'))
  assert.equal(p.good, false)
  assert.equal(p.sky, 'storm')
})

test('hikePayload — later days: no verdict yet; unknown storm risk never green; °F; missing day', () => {
  const later = hikePayload({ hike, peak, date: '2026-10-04', lang: 'en', unit: 'F' })
  assert.equal(later.line, null)
  assert.equal(later.good, null)
  assert.equal(later.hi, '43°')
  assert.equal(later.wind, '45 km/h')
  const noStorm = hikePayload({ hike: { ...hike, notes: ['no_storm_data'] }, peak, date: '2026-10-02', lang: 'en', unit: 'C' })
  assert.equal(noStorm.good, false)
  const shut = hikePayload({ hike: { ...hike, windows: { today: null, tomorrow: { window: null, next: null } } }, peak, date: '2026-10-02', lang: 'en', unit: 'C' })
  assert.equal(shut.line, t('en', 'widgetNoWindow'))
  assert.equal(hikePayload({ hike, peak, date: '2026-10-09', lang: 'en', unit: 'C' }), null)
})

test('skyForIcon — the day icon picks the background', () => {
  assert.equal(skyForIcon('⛈'), 'storm')
  assert.equal(skyForIcon('🌦'), 'rain')
  assert.equal(skyForIcon('🌨'), 'snow')
  assert.equal(skyForIcon('☁️'), 'cloudy')
  assert.equal(skyForIcon('⛅'), 'day')
  assert.equal(skyForIcon(undefined), 'day')
})
```

- [ ] **Step 3: Run — expect failure** (`Cannot find module './app-widget.js'`): `node --test lib/app-widget.test.js`

- [ ] **Step 4: Implement**

**File (create): `lib/app-widget.js`**
```js
// The home-screen widgets' data (pure — unit tested): the app's forecast,
// outlook and summit forecast boiled down to display-ready text in the
// phone's language and unit, so the Swift and Java widgets only lay it out.
import { t, translateCondition } from './i18n.js'
import { tempFormatter, dayWord } from './outlook/text.js'
import { addDays, formatCalendarDate } from './localtime.js'
import { skyFor, SKIES, isDark, nightIcon } from './sky.js'
import { conditionIcon, heroCondition } from './conditions.js'
import { parsePeakQuery } from './hike/params.js'
import { pickLang, pickUnit } from './share.js'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const hhmm = iso => iso.slice(11, 16)
const pct = v => (v == null ? '–' : `${Math.round(v)}%`)
const palettes = keys => Object.fromEntries([...new Set(keys)].map(k => [k, SKIES[k] ?? SKIES.night]))
const STORM_KEY = { low: 'stormLow', moderate: 'stormModerate', high: 'stormHigh' }

export function parseAppWidgetQuery(sp) {
  const lang = pickLang(sp.get('lang')), unit = pickUnit(sp.get('unit'))
  if (sp.get('kind') === 'hike') {
    const peak = parsePeakQuery(sp), date = sp.get('date') ?? ''
    return peak && DATE.test(date) ? { kind: 'hike', peak, date, lang, unit } : null
  }
  const city = (sp.get('city') ?? '').trim()
  return city && city.length <= 100 ? { kind: 'weather', city, lang, unit } : null
}

export function weatherPayload({ forecast, outlook, lang, unit }) {
  const fmt = tempFormatter(unit)
  const sun = outlook.sun ?? null, nowLocal = outlook.nowLocal, todayLocal = nowLocal.slice(0, 10)
  const condition = heroCondition(forecast)
  const nowSky = skyFor({ code: outlook.hourly?.[0]?.code ?? null, nowLocal, sun })
  const epoch = local => Date.parse(`${local}:00Z`) / 1000 - (outlook.utcOffsetSec ?? 0)
  const hours = (outlook.hourly ?? []).slice(1, 7).map(h => ({
    t: hhmm(h.t), ts: epoch(h.t),
    icon: isDark(hhmm(h.t), sun) ? nightIcon(h.icon) : h.icon,
    temp: fmt(h.temp), rain: pct(h.rainPct),
    sky: skyFor({ code: h.code ?? null, nowLocal: h.t, sun }),
  }))
  const today = (outlook.days ?? []).find(d => d.date === todayLocal)
  const days = (outlook.days ?? []).filter(d => d.date > todayLocal).slice(0, 5).map(d => ({
    day: formatCalendarDate(d.date, lang, { weekday: 'short' }), icon: d.icon, hi: fmt(d.tempMax), lo: fmt(d.tempMin),
  }))
  return {
    kind: 'weather', city: forecast.city, path: `/?city=${encodeURIComponent(forecast.city)}`,
    now: {
      temp: fmt(forecast.consensus?.temp),
      icon: conditionIcon(condition, forecast.lon, isDark(hhmm(nowLocal), sun)),
      text: translateCondition(lang, condition ?? ''),
      sky: nowSky,
    },
    today: { hi: fmt(today?.tempMax), lo: fmt(today?.tempMin) },
    hours, days,
    skies: palettes([nowSky, ...hours.map(h => h.sky)]),
  }
}

export function skyForIcon(icon) {
  if (icon === '⛈') return 'storm'
  if (icon === '🌧' || icon === '🌦') return 'rain'
  if (icon === '🌨') return 'snow'
  if (icon === '☁️' || icon === '🌫') return 'cloudy'
  return 'day'
}

const hikePath = p => `/hike?lat=${p.lat}&lon=${p.lon}&elev=${Math.round(p.elev)}&name=${encodeURIComponent(p.name ?? '')}`

// The window only exists for today and tomorrow at the peak; later days get
// the day summary and no verdict (line/good null). A window whose storm risk
// is unknown is never green — same rule as the hike page.
export function hikePayload({ hike, peak, date, lang, unit }) {
  const day = (hike.days ?? []).find(d => d.date === date)
  if (!day) return null
  const fmt = tempFormatter(unit)
  const todayLocal = hike.nowLocal.slice(0, 10)
  const slot = date === todayLocal ? hike.windows?.today : date === addDays(todayLocal, 1) ? hike.windows?.tomorrow : undefined
  const stormUnknown = !!hike.notes?.includes('no_storm_data')
  const word = dayWord(lang, date, todayLocal)
  const sky = skyForIcon(day.icon)
  return {
    kind: 'hike', peak: peak.name ?? '', day: word.charAt(0).toLocaleUpperCase(lang) + word.slice(1), path: hikePath(peak),
    line: slot === undefined ? null : !slot ? t(lang, 'swNoDaylight') : slot.window ? `${hhmm(slot.window.from)}–${hhmm(slot.window.to)}` : t(lang, 'widgetNoWindow'),
    good: slot === undefined ? null : !!slot?.window && !stormUnknown,
    icon: day.icon, hi: fmt(day.tempMax), lo: fmt(day.tempMin),
    wind: day.windMax == null ? '–' : `${Math.round(day.windMax)} km/h`, rain: pct(day.rainPct),
    storm: day.storm ? `${t(lang, 'stormRisk')}: ${t(lang, STORM_KEY[day.storm] ?? 'stormLow')}` : null,
    sky, skies: palettes([sky]),
  }
}
```

- [ ] **Step 5: Run** — `npm test` → all pass (incl. the i18n key-parity test).
- [ ] **Step 6: Commit** — `git add lib/app-widget.js lib/app-widget.test.js lib/i18n.js && git commit -m "App widget payloads: weather and hike as display-ready text"`

### Task 3: `/api/app-widget` route

**Files:**
- Create: `app/api/app-widget/route.js`

**Interfaces:**
- Consumes: `parseAppWidgetQuery`, `weatherPayload`, `hikePayload` (Task 2); `hikeApiPath` (`lib/hike/params.js`); `isInternal` limiter bypass on the routes it reads (Task 1).
- Produces: `GET /api/app-widget?…` → 200 payload | 400 `{error}` | 404 `{error}` (unknown city / day outside the summit forecast) | 429 | 502.

- [ ] **Step 1: Implement**

**File (create): `app/api/app-widget/route.js`**
```js
import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { hikeApiPath } from '@/lib/hike/params'
import { parseAppWidgetQuery, weatherPayload, hikePayload } from '@/lib/app-widget'

// The home-screen widgets' feed: the forecast, outlook and summit forecast
// the app shows, read through the public domain (the CDN copies — 1 or
// 10,000 widgets cost the same) and boiled down to ~1 KB of display text.
// GET /api/app-widget?city=Lienz&lang=de&unit=C
// GET /api/app-widget?kind=hike&name=…&lat=…&lon=…&elev=…&date=YYYY-MM-DD&lang=de&unit=C
export const maxDuration = 30

const TTL = 900
const limiter = createRateLimiter({ max: 60, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
// the public domain, not the deployment URL (deployment protection 401s
// server-to-server fetches) — same rule as /api/og/city
const baseFor = req => (process.env.VERCEL_ENV ? 'https://metablend.app' : new URL(req.url).origin)

async function getJson(url) {
  const key = process.env.CALIBRATE_SECRET
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000), headers: key ? { 'x-calibrate-key': key } : {} })
    const json = r.ok ? await r.json() : null
    return { status: r.status, json: json?.error ? null : json }
  } catch {
    return { status: 504, json: null }
  }
}

export const GET = withErrorLog('app-widget', async (request) => {
  const q = parseAppWidgetQuery(new URL(request.url).searchParams)
  if (!q) return noStore({ error: 'Invalid query' }, 400)
  // only cache misses reach this point — CDN hits never invoke the function
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests' }, 429)
  const base = baseFor(request)

  let body
  if (q.kind === 'hike') {
    const hike = await getJson(`${base}${hikeApiPath(q.peak)}`)
    if (!hike.json) return noStore({ error: 'Summit forecast unavailable' }, 502)
    body = hikePayload({ hike: hike.json, peak: q.peak, date: q.date, lang: q.lang, unit: q.unit })
    if (!body) return noStore({ error: 'No summit forecast for that day' }, 404)
  } else {
    const key = encodeURIComponent(q.city.toLowerCase())
    const [forecast, outlook] = await Promise.all([
      getJson(`${base}/api/forecast?city=${key}&lang=${q.lang}`),
      getJson(`${base}/api/outlook?city=${key}&lang=${q.lang}`),
    ])
    if (forecast.status === 404 || outlook.status === 404) return noStore({ error: 'City not found' }, 404)
    if (!forecast.json || !outlook.json?.nowLocal) return noStore({ error: 'Forecast unavailable' }, 502)
    body = weatherPayload({ forecast: forecast.json, outlook: outlook.json, lang: q.lang, unit: q.unit })
  }
  return Response.json(body, { headers: { 'Cache-Control': `public, s-maxage=${TTL}, stale-while-revalidate=${TTL * 2}` } })
})
```

- [ ] **Step 2: Lint + tests** — `npx eslint app/api/app-widget lib/app-widget.js lib/conditions.js` and `npm test` → clean.
- [ ] **Step 3: Commit + push**, wait for the Vercel deployment (READY).
- [ ] **Step 4: Smoke on production**
  - `curl -s "https://metablend.app/api/app-widget?city=Lienz&lang=de&unit=C"` → `kind: weather`, 6 hours, 5 days, `now.temp` like "13°".
  - `curl -s "https://metablend.app/api/app-widget?city=Sankt%20P%C3%B6lten&lang=de"` → `city: "Sankt Pölten"`.
  - `curl -s -o /dev/null -w "%{http_code}" "https://metablend.app/api/app-widget?city=xqzzyv"` → `404`.
  - Hike for tomorrow (date = tomorrow in Europe/Vienna): `…?kind=hike&name=Hochstadel&lat=46.789&lon=12.861&elev=2681&date=<tomorrow>&lang=de` → `line` is a window or "Kein sicheres Fenster".
  - `curl -s "…?kind=hike&lat=1&lon=1&elev=1&date=x"` → 400.

### Task 4: Sync payload + deep links (pure)

**Files:**
- Create: `lib/app-widget-sync.js`, `lib/app-widget-sync.test.js`, `lib/deep-link.js`, `lib/deep-link.test.js`

**Interfaces:**
- Produces: `widgetSettings({ lang, unit, home, views, plans, today }) → settings JSON (Global Constraints)`; `localToday(date = new Date()) → 'YYYY-MM-DD'` (phone-local); `WIDGET_BASE`; `pathFromAppUrl(url) → '/…' | null`.

- [ ] **Step 1: Write the failing tests**

**File (create): `lib/app-widget-sync.test.js`**
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { widgetSettings, localToday } from './app-widget-sync.js'

const plan = (name, date) => ({ id: `id-${name}`, name, lat: 46.7, lon: 12.8, elev: 2000, date, created_at: 'x' })

test('widgetSettings — home from notifications first, recent by views, upcoming hikes only', () => {
  const s = widgetSettings({
    lang: 'de', unit: 'C', home: 'Wien', views: { Lienz: 7, Wien: 2, Innsbruck: 2, Graz: 0 },
    plans: [plan('B', '2026-10-03'), plan('A', '2026-10-01'), plan('Old', '2026-09-30')], today: '2026-10-01',
  })
  assert.deepEqual(s, {
    v: 1, lang: 'de', unit: 'C', base: 'https://metablend.app', home: 'Wien', recent: ['Wien', 'Lienz', 'Innsbruck'],
    hikes: [
      { name: 'A', lat: 46.7, lon: 12.8, elev: 2000, date: '2026-10-01' },
      { name: 'B', lat: 46.7, lon: 12.8, elev: 2000, date: '2026-10-03' },
    ],
  })
})

test('widgetSettings — no notification home: the most-viewed city; nothing at all: null', () => {
  assert.equal(widgetSettings({ lang: 'en', unit: 'F', views: { Graz: 1, Linz: 3 }, today: '2026-10-01' }).home, 'Linz')
  const empty = widgetSettings({ lang: 'en', unit: 'C', today: '2026-10-01' })
  assert.equal(empty.home, null)
  assert.deepEqual(empty.recent, [])
  assert.deepEqual(empty.hikes, [])
})

test('widgetSettings — at most 8 cities and 5 hikes', () => {
  const views = Object.fromEntries('ABCDEFGHIJ'.split('').map((c, i) => [c, 20 - i]))
  const plans = ['01', '02', '03', '04', '05', '06', '07'].map(d => plan(`P${d}`, `2026-10-${d}`))
  const s = widgetSettings({ lang: 'en', unit: 'C', views, plans, today: '2026-10-01' })
  assert.deepEqual(s.recent, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
  assert.deepEqual(s.hikes.map(h => h.name), ['P01', 'P02', 'P03', 'P04', 'P05'])
})

test('localToday — the phone’s own calendar day', () => {
  assert.equal(localToday(new Date(2026, 0, 5, 23, 30)), '2026-01-05')
})
```

**File (create): `lib/deep-link.test.js`**
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathFromAppUrl } from './deep-link.js'

test('pathFromAppUrl — the app’s own links, decoded once', () => {
  assert.equal(pathFromAppUrl('metablend://open?path=%2F%3Fcity%3DLienz'), '/?city=Lienz')
  assert.equal(pathFromAppUrl('metablend://open?path=%2F%3Fcity%3DSankt%2520P%25C3%25B6lten'), '/?city=Sankt%20P%C3%B6lten')
  assert.equal(pathFromAppUrl('metablend://open?path=%2Fhike%3Flat%3D46.789%26lon%3D12.861%26elev%3D2681%26name%3DHochstadel'), '/hike?lat=46.789&lon=12.861&elev=2681&name=Hochstadel')
  assert.equal(pathFromAppUrl('metablend://open?path=/more'), '/more')
})

test('pathFromAppUrl — anything else is ignored', () => {
  for (const bad of ['https://evil.example/?path=/x', 'metablend://other?path=/x', 'metablend://open?path=//evil.example',
    'metablend://open?path=https://evil.example', 'metablend://open', 'metablend://open?path=/%5Cevil', 'not a url', '', null]) {
    assert.equal(pathFromAppUrl(bad), null, String(bad))
  }
})
```

- [ ] **Step 2: Run — expect failures**: `node --test lib/app-widget-sync.test.js lib/deep-link.test.js`

- [ ] **Step 3: Implement**

**File (create): `lib/app-widget-sync.js`**
```js
// What the app hands its home-screen widgets (pure — unit tested): language
// and unit, the home city, the cities looked at most, and the upcoming
// planned hikes. Names and coordinates only — no keys, no ids.
export const WIDGET_BASE = 'https://metablend.app'

export function widgetSettings({ lang, unit, home = null, views = {}, plans = [], today }) {
  const byViews = Object.entries(views ?? {})
    .filter(([city, n]) => city && n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([city]) => city)
  const homeCity = home || byViews[0] || null
  const recent = [...new Set([homeCity, ...byViews].filter(Boolean))].slice(0, 8)
  const hikes = (plans ?? [])
    .filter(p => typeof p?.date === 'string' && p.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)
    .map(({ name, lat, lon, elev, date }) => ({ name, lat, lon, elev, date }))
  return { v: 1, lang, unit, base: WIDGET_BASE, home: homeCity, recent, hikes }
}

// The phone's calendar day (plans are days at the peak, which is the phone's
// region in practice).
export function localToday(d = new Date()) {
  const two = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
}
```

**File (create): `lib/deep-link.js`**
```js
// metablend://open?path=/… → the in-app path (pure — unit tested). Only the
// app's own scheme and host, and only same-site paths: a widget tap can't be
// turned into a jump to another site.
export function pathFromAppUrl(raw) {
  let u
  try { u = new URL(raw) } catch { return null }
  if (u.protocol !== 'metablend:' || u.hostname !== 'open') return null
  const path = u.searchParams.get('path') ?? ''
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') ? path : null
}
```

- [ ] **Step 4: Run** — `npm test` → all pass.
- [ ] **Step 5: Commit** — `git add lib/app-widget-sync.js lib/app-widget-sync.test.js lib/deep-link.js lib/deep-link.test.js && git commit -m "Widget sync payload and metablend:// deep links (pure)"`

### Task 5: Wire the app: sync calls and deep-link routing

**Files:**
- Create: `lib/app-widget-client.js`
- Modify: `lib/push-client.js` (export `cityViews`), `lib/native.js` (add `onAppHidden`, `onAppUrl`), `app/components/AppChrome.jsx`, `app/page.js:375`, `app/components/push/NotificationSettings.jsx`, `app/components/hike/PlanHike.jsx`, `app/components/push/PushPrompt.jsx`

**Interfaces:**
- Consumes: `widgetSettings`, `localToday` (Task 4), `pathFromAppUrl` (Task 4), `pushApi` (`lib/push-client.js`), `loadPlugin` pattern rule (never return a Capacitor proxy from an async function).
- Produces: `syncWidgets({ refresh = false } = {}) → Promise<void>` (no-op on the web); `cityViews() → Promise<{[city]: number}>`; `onAppHidden(fn) → Promise<unsubscribe>`; `onAppUrl(fn) → Promise<unsubscribe>`.

- [ ] **Step 1: `cityViews` in `lib/push-client.js`** — add after `bumpCityView`:
```js
// How often each city was opened in the app ({ "Lienz": 7 }).
export async function cityViews() {
  if (!isNative()) return {}
  try {
    const { plugin: P } = await prefs()
    return JSON.parse((await P.get({ key: VIEWS })).value ?? '{}')
  } catch {
    return {}
  }
}
```

- [ ] **Step 2: Create the client**

**File (create): `lib/app-widget-client.js`**
```js
// Hands the home-screen widgets their settings through the app's native
// WidgetBridge (app only — a no-op on the website and in app builds without
// the bridge). The server part (home city + hike plans) is read at start and
// again when a screen changed it; views, language and unit are read fresh.
import { isNative } from './native'
import { pushApi, cityViews } from './push-client'
import { getCookie } from './prefs'
import { preferredLang } from './i18n'
import { widgetSettings, localToday } from './app-widget-sync'

let bridge = null // Capacitor plugin proxy: kept in a variable, never resolved from a promise
let lastSent = null
let server = null

async function send(json) {
  const { registerPlugin } = await import('@capacitor/core')
  bridge ??= registerPlugin('WidgetBridge')
  await bridge.sync({ json })
}

async function serverPart() {
  try {
    const r = await pushApi('settings')
    if (r.status === 200) return { home: r.json.settings?.home_name ?? null, plans: r.json.plans ?? [] }
    if (r.status === 404) return { home: null, plans: [] } // notifications never turned on
  } catch { /* offline */ }
  return null
}

export async function syncWidgets({ refresh = false } = {}) {
  if (!isNative()) return
  try {
    if (refresh || !server) server = (await serverPart()) ?? server
    const payload = widgetSettings({
      lang: preferredLang(getCookie('metablend_lang'), navigator.language),
      unit: getCookie('metablend_unit') === 'F' ? 'F' : 'C',
      home: server?.home ?? null,
      views: await cityViews(),
      plans: server?.plans ?? [],
      today: localToday(),
    })
    const json = JSON.stringify(payload)
    if (json === lastSent) return
    await send(json)
    lastSent = json
  } catch { /* an app build without the bridge — the widgets keep what they had */ }
}
```

- [ ] **Step 3: `lib/native.js`** — append:
```js
// The app went to the background (home screen, app switcher): the moment
// the widgets should be up to date. Returns an unsubscribe function.
export async function onAppHidden(handler) {
  if (!isNative()) return () => {}
  try {
    const { App } = await import('@capacitor/app')
    const sub = await App.addListener('appStateChange', ({ isActive }) => { if (!isActive) handler() })
    return () => sub.remove()
  } catch {
    return () => {}
  }
}

// metablend:// links (widget taps): the one the app was launched with —
// once per launch, the page may reload on the way — and any later one.
const LAUNCH_SEEN = 'mb_launch_url'
export async function onAppUrl(handler) {
  if (!isNative()) return () => {}
  try {
    const { App } = await import('@capacitor/app')
    const launch = (await App.getLaunchUrl())?.url
    let seen = null
    try { seen = sessionStorage.getItem(LAUNCH_SEEN) } catch { /* storage blocked */ }
    if (launch && launch !== seen) {
      try { sessionStorage.setItem(LAUNCH_SEEN, launch) } catch { /* storage blocked */ }
      handler(launch)
    }
    const sub = await App.addListener('appUrlOpen', ({ url }) => handler(url))
    return () => sub.remove()
  } catch {
    return () => {}
  }
}
```

- [ ] **Step 4: `app/components/AppChrome.jsx`**
  - Imports: `import { onBackButton, tapHaptic, setStatusBarStyle, onAppHidden, onAppUrl } from '@/lib/native'`, `import { syncWidgets } from '@/lib/app-widget-client'`, `import { pathFromAppUrl } from '@/lib/deep-link'`.
  - Replace the push block (from `// push: a fresh token…` through the `return () => { … }` cleanup) with:
```js
    // a tapped notification or widget opens its screen
    const open = url => (opensByReload(url) ? window.location.assign(url) : router.push(url))
    let offPush = () => {}, offUrl = () => {}, offHidden = () => {}
    initPush({ lang: preferredLang(getCookie('metablend_lang'), navigator.language), unit: getCookie('metablend_unit') === 'F' ? 'F' : 'C', onOpen: open })
      .then(fn => { if (gone) fn(); else offPush = fn })
    onAppUrl(raw => { const path = pathFromAppUrl(raw); if (path) open(path) })
      .then(fn => { if (gone) fn(); else offUrl = fn })
    // widgets: settings at start, and fresh again whenever the app is left
    syncWidgets({ refresh: true })
    onAppHidden(() => syncWidgets()).then(fn => { if (gone) fn(); else offHidden = fn })
    return () => { gone = true; off(); offPush(); offUrl(); offHidden(); themeWatch.disconnect() }
```

- [ ] **Step 5: Call sites**
  - `app/page.js:375`: `if (!silent) bumpCityView(json.city ?? q).then(() => syncWidgets())` + `import { syncWidgets } from '@/lib/app-widget-client'`.
  - `app/components/push/NotificationSettings.jsx`: `import { syncWidgets } from '@/lib/app-widget-client'`; call `syncWidgets({ refresh: true })` after the settings `PUT` in `save` succeeds, after the `PUT` when turning on, and after the plan `DELETE`.
  - `app/components/hike/PlanHike.jsx`: same import; `syncWidgets({ refresh: true })` after the plan `POST` returns 200.
  - `app/components/push/PushPrompt.jsx`: same import; `syncWidgets({ refresh: true })` after its settings `PUT`.

- [ ] **Step 6: Verify** — `npm test`, `npx eslint app lib`, `npx next build` → clean.
- [ ] **Step 7: Commit + push** — `git add -A lib app && git commit -m "App: sync widget settings, route metablend:// links"`; deployment READY; the website behaves as before (all new calls are app-only).

## Stage 2 — Android

All Java under `mobile/android/app/src/main/java/app/metablend/` (package `app.metablend.widget` in `widget/`). Resources under `mobile/android/app/src/main/res/`.

### Task 6: Bridge, deep link, storage, API, texts

**Files:**
- Create: `WidgetBridgePlugin.java`, `widget/WidgetStore.java`, `widget/WidgetApi.java`, `widget/WidgetText.java`
- Modify: `MainActivity.java`, `AndroidManifest.xml` (deep-link intent filter)

**Interfaces:**
- Produces: `WidgetStore.saveSettings/settings/get/put/cache/cached/cachedAt/dropCache/forget`; `WidgetApi.get(base, query) → Result{status, json}`, `WidgetApi.weatherQuery(city, lang, unit)`, `WidgetApi.hikeQuery(plan, lang, unit)`; `new WidgetText(lang).get(key)`; JS plugin `WidgetBridge.sync({ json })`.

- [ ] **Step 1: Write the files**

**File (create): `mobile/android/app/src/main/java/app/metablend/WidgetBridgePlugin.java`**
```java
package app.metablend;

import app.metablend.widget.WidgetStore;
import app.metablend.widget.WidgetUpdater;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// The website (in the WebView) hands the home-screen widgets their settings —
// language, unit, home city, recent cities, planned hikes — as one JSON string.
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
    @PluginMethod
    public void sync(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("json missing");
            return;
        }
        WidgetStore.saveSettings(getContext(), json);
        WidgetUpdater.refreshAll(getContext());
        call.resolve();
    }
}
```

Replace `MainActivity.java` with:
```java
package app.metablend;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class); // before super: the bridge is built there
        super.onCreate(savedInstanceState);
    }
}
```

**File (create): `mobile/android/app/src/main/java/app/metablend/widget/WidgetStore.java`**
```java
package app.metablend.widget;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONException;
import org.json.JSONObject;

// What the widgets keep: the app's synced settings, each widget's choices
// (city, show, style) and its last good payload with the time it arrived.
public final class WidgetStore {
    private WidgetStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("widget", Context.MODE_PRIVATE);
    }

    private static JSONObject parse(String s) {
        if (s == null) return null;
        try {
            return new JSONObject(s);
        } catch (JSONException e) {
            return null;
        }
    }

    public static void saveSettings(Context c, String json) {
        prefs(c).edit().putString("settings", json).apply();
    }

    public static JSONObject settings(Context c) {
        return parse(prefs(c).getString("settings", null));
    }

    public static String get(Context c, int id, String key, String fallback) {
        return prefs(c).getString(id + "." + key, fallback);
    }

    public static void put(Context c, int id, String key, String value) {
        prefs(c).edit().putString(id + "." + key, value).apply();
    }

    public static void cache(Context c, int id, JSONObject payload) {
        prefs(c).edit().putString(id + ".payload", payload.toString()).putLong(id + ".at", System.currentTimeMillis()).apply();
    }

    public static JSONObject cached(Context c, int id) {
        return parse(prefs(c).getString(id + ".payload", null));
    }

    public static long cachedAt(Context c, int id) {
        return prefs(c).getLong(id + ".at", 0L);
    }

    public static void dropCache(Context c, int id) {
        prefs(c).edit().remove(id + ".payload").remove(id + ".at").apply();
    }

    public static void forget(Context c, int id) {
        SharedPreferences.Editor e = prefs(c).edit();
        for (String k : new String[] { "city", "show", "style", "payload", "at" }) e.remove(id + "." + k);
        e.apply();
    }
}
```

**File (create): `mobile/android/app/src/main/java/app/metablend/widget/WidgetApi.java`**
```java
package app.metablend.widget;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import org.json.JSONObject;

// GET /api/app-widget — the server already turned the forecast into text.
public final class WidgetApi {
    private WidgetApi() {}

    public static final class Result {
        public final int status;
        public final JSONObject json;

        Result(int status, JSONObject json) {
            this.status = status;
            this.json = json;
        }
    }

    static String enc(String s) {
        try {
            return URLEncoder.encode(s, "UTF-8").replace("+", "%20");
        } catch (Exception e) {
            return "";
        }
    }

    public static String weatherQuery(String city, String lang, String unit) {
        return "city=" + enc(city) + "&lang=" + enc(lang) + "&unit=" + enc(unit);
    }

    public static String hikeQuery(JSONObject plan, String lang, String unit) {
        return "kind=hike&name=" + enc(plan.optString("name")) + "&lat=" + plan.optDouble("lat") + "&lon=" + plan.optDouble("lon")
            + "&elev=" + Math.round(plan.optDouble("elev")) + "&date=" + enc(plan.optString("date"))
            + "&lang=" + enc(lang) + "&unit=" + enc(unit);
    }

    public static Result get(String base, String query) {
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(base + "/api/app-widget?" + query).openConnection();
            con.setConnectTimeout(8000);
            con.setReadTimeout(8000);
            int status = con.getResponseCode();
            if (status != 200) return new Result(status, null);
            try (InputStream in = con.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
                return new Result(200, new JSONObject(out.toString("UTF-8")));
            }
        } catch (Exception e) {
            return new Result(0, null);
        } finally {
            if (con != null) con.disconnect();
        }
    }
}
```

**File (create): `mobile/android/app/src/main/java/app/metablend/widget/WidgetText.java`**
```java
package app.metablend.widget;

import java.util.HashMap;
import java.util.Map;

// The few texts the widgets and their settings screen show, in the app's
// five languages (the language arrives with the app's sync).
public final class WidgetText {
    private static final String[] KEYS = {
        "settings", "city", "home", "show", "hours", "days", "style", "sky", "system", "save",
        "openOnce", "pickCity", "planHike", "offline",
    };
    private static final Map<String, String[]> T = new HashMap<>();

    static {
        T.put("en", new String[] {
            "Widget settings", "City", "Home city", "Show", "Next hours", "Next days", "Style", "Living sky", "System", "Save",
            "Open MetaBlend once to pick a city", "Pick a city in MetaBlend", "Plan a hike in the app", "No connection — tap to open MetaBlend",
        });
        T.put("de", new String[] {
            "Widget-Einstellungen", "Ort", "Heimatstadt", "Anzeigen", "Nächste Stunden", "Nächste Tage", "Stil", "Lebendiger Himmel", "System", "Speichern",
            "Öffne MetaBlend einmal, um einen Ort zu wählen", "Wähle einen Ort in MetaBlend", "Plane eine Tour in der App", "Keine Verbindung – tippen, um MetaBlend zu öffnen",
        });
        T.put("fr", new String[] {
            "Réglages du widget", "Ville", "Ville principale", "Afficher", "Prochaines heures", "Prochains jours", "Style", "Ciel vivant", "Système", "Enregistrer",
            "Ouvrez MetaBlend une fois pour choisir une ville", "Choisissez une ville dans MetaBlend", "Planifiez une randonnée dans l’app", "Pas de connexion — touchez pour ouvrir MetaBlend",
        });
        T.put("es", new String[] {
            "Ajustes del widget", "Ciudad", "Ciudad principal", "Mostrar", "Próximas horas", "Próximos días", "Estilo", "Cielo vivo", "Sistema", "Guardar",
            "Abre MetaBlend una vez para elegir una ciudad", "Elige una ciudad en MetaBlend", "Planifica una excursión en la app", "Sin conexión: toca para abrir MetaBlend",
        });
        T.put("it", new String[] {
            "Impostazioni widget", "Città", "Città principale", "Mostra", "Prossime ore", "Prossimi giorni", "Stile", "Cielo vivo", "Sistema", "Salva",
            "Apri MetaBlend una volta per scegliere una città", "Scegli una città in MetaBlend", "Pianifica un’escursione nell’app", "Nessuna connessione: tocca per aprire MetaBlend",
        });
    }

    private final String[] row;

    public WidgetText(String lang) {
        String[] r = T.get(lang);
        row = r != null ? r : T.get("en");
    }

    public String get(String key) {
        for (int i = 0; i < KEYS.length; i++) if (KEYS[i].equals(key)) return row[i];
        return key;
    }
}
```

`AndroidManifest.xml`, inside `<activity android:name=".MainActivity" …>` after the launcher `<intent-filter>`:
```xml
            <!-- metablend://open?path=… — taps on the home-screen widgets -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="metablend" android:host="open" />
            </intent-filter>
```

- [ ] **Step 2:** (compiles together with Task 7/8 — `WidgetUpdater` is referenced) — no separate build here; commit after Task 8.

### Task 7: Layouts and renderer

**Files:**
- Create: `res/layout/widget_weather_small.xml`, `widget_weather_medium.xml`, `widget_hike_small.xml`, `widget_hike_medium.xml`, `widget_cell.xml`, `widget_message.xml`; `res/drawable/widget_bg.xml`; `res/values/widget_styles.xml`; `res/values-night/colors.xml`; `widget/WidgetRenderer.java`
- Modify: `res/values/colors.xml` (widget colours)

**Interfaces:**
- Produces: `WidgetRenderer.weather(c, id, payload, look)`, `WidgetRenderer.hike(c, id, payload, look)`, `WidgetRenderer.message(c, id, text) → RemoteViews`; `new WidgetRenderer.Look(boolean sky, boolean stale, long fetchedAt, String show)`.

- [ ] **Step 1: Resources**

Add to `res/values/colors.xml` inside `<resources>`:
```xml
    <!-- Home-screen widgets, system style (night variants in values-night) -->
    <color name="widget_bg">#F4F6F9</color>
    <color name="widget_text">#1B1F24</color>
    <color name="widget_text_dim">#5B6470</color>
```

**File (create): `mobile/android/app/src/main/res/values-night/colors.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="widget_bg">#1E2228</color>
    <color name="widget_text">#EEF1F5</color>
    <color name="widget_text_dim">#A9B1BC</color>
</resources>
```

**File (create): `mobile/android/app/src/main/res/drawable/widget_bg.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="@color/widget_bg" />
    <corners android:radius="20dp" />
</shape>
```

**File (create): `mobile/android/app/src/main/res/values/widget_styles.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="WidgetText">
        <item name="android:layout_width">wrap_content</item>
        <item name="android:layout_height">wrap_content</item>
        <item name="android:textColor">@color/widget_text</item>
        <item name="android:maxLines">1</item>
        <item name="android:ellipsize">end</item>
        <item name="android:includeFontPadding">false</item>
    </style>
    <style name="WidgetCaption" parent="WidgetText">
        <item name="android:textSize">13sp</item>
        <item name="android:textStyle">bold</item>
    </style>
    <style name="WidgetTemp" parent="WidgetText">
        <item name="android:textSize">34sp</item>
        <item name="android:fontFamily">sans-serif-light</item>
    </style>
    <style name="WidgetIcon" parent="WidgetText">
        <item name="android:textSize">24sp</item>
        <item name="android:layout_marginStart">6dp</item>
    </style>
    <style name="WidgetBody" parent="WidgetText">
        <item name="android:textSize">12sp</item>
        <item name="android:textColor">@color/widget_text_dim</item>
    </style>
    <style name="WidgetSmall" parent="WidgetText">
        <item name="android:textSize">10sp</item>
        <item name="android:textColor">@color/widget_text_dim</item>
    </style>
</resources>
```

**File (create): `mobile/android/app/src/main/res/layout/widget_weather_small.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@android:id/background"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_bg"
    android:clipToOutline="true">

    <ImageView
        android:id="@+id/sky"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:importantForAccessibility="no"
        android:scaleType="fitXY"
        android:visibility="gone" />

    <LinearLayout
        android:id="@+id/content"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:orientation="vertical"
        android:padding="14dp">

        <TextView android:id="@+id/city" style="@style/WidgetCaption" />

        <LinearLayout
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="2dp"
            android:gravity="center_vertical"
            android:orientation="horizontal">

            <TextView android:id="@+id/temp" style="@style/WidgetTemp" />
            <TextView android:id="@+id/icon" style="@style/WidgetIcon" />
        </LinearLayout>

        <FrameLayout
            android:layout_width="match_parent"
            android:layout_height="0dp"
            android:layout_weight="1" />

        <TextView android:id="@+id/text" style="@style/WidgetBody" />
        <TextView android:id="@+id/hilo" style="@style/WidgetBody" android:layout_marginTop="2dp" />
        <TextView android:id="@+id/updated" style="@style/WidgetSmall" android:layout_marginTop="2dp" android:visibility="gone" />
    </LinearLayout>
</FrameLayout>
```

**File (create): `mobile/android/app/src/main/res/layout/widget_weather_medium.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@android:id/background"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_bg"
    android:clipToOutline="true">

    <ImageView
        android:id="@+id/sky"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:importantForAccessibility="no"
        android:scaleType="fitXY"
        android:visibility="gone" />

    <LinearLayout
        android:id="@+id/content"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:orientation="horizontal"
        android:padding="14dp">

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="0.9"
            android:orientation="vertical">

            <TextView android:id="@+id/city" style="@style/WidgetCaption" />

            <LinearLayout
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="2dp"
                android:gravity="center_vertical"
                android:orientation="horizontal">

                <TextView android:id="@+id/temp" style="@style/WidgetTemp" />
                <TextView android:id="@+id/icon" style="@style/WidgetIcon" />
            </LinearLayout>

            <FrameLayout
                android:layout_width="match_parent"
                android:layout_height="0dp"
                android:layout_weight="1" />

            <TextView android:id="@+id/text" style="@style/WidgetBody" />
            <TextView android:id="@+id/hilo" style="@style/WidgetBody" android:layout_marginTop="2dp" />
            <TextView android:id="@+id/updated" style="@style/WidgetSmall" android:layout_marginTop="2dp" android:visibility="gone" />
        </LinearLayout>

        <LinearLayout
            android:id="@+id/strip"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1.6"
            android:gravity="center_vertical"
            android:orientation="horizontal" />
    </LinearLayout>
</FrameLayout>
```

**File (create): `mobile/android/app/src/main/res/layout/widget_cell.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="0dp"
    android:layout_height="wrap_content"
    android:layout_weight="1"
    android:gravity="center_horizontal"
    android:orientation="vertical">

    <TextView android:id="@+id/cell_top" style="@style/WidgetSmall" />
    <TextView android:id="@+id/cell_icon" style="@style/WidgetText" android:layout_marginTop="4dp" android:textSize="18sp" />
    <TextView android:id="@+id/cell_main" style="@style/WidgetText" android:layout_marginTop="4dp" android:textSize="13sp" />
    <TextView android:id="@+id/cell_sub" style="@style/WidgetSmall" android:layout_marginTop="2dp" />
</LinearLayout>
```

**File (create): `mobile/android/app/src/main/res/layout/widget_hike_small.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@android:id/background"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_bg"
    android:clipToOutline="true">

    <ImageView
        android:id="@+id/sky"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:importantForAccessibility="no"
        android:scaleType="fitXY"
        android:visibility="gone" />

    <LinearLayout
        android:id="@+id/content"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:orientation="vertical"
        android:padding="14dp">

        <TextView android:id="@+id/peak" style="@style/WidgetCaption" />
        <TextView android:id="@+id/day" style="@style/WidgetBody" android:layout_marginTop="2dp" />

        <FrameLayout
            android:layout_width="match_parent"
            android:layout_height="0dp"
            android:layout_weight="1" />

        <LinearLayout
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:gravity="center_vertical"
            android:orientation="horizontal">

            <TextView android:id="@+id/icon" style="@style/WidgetText" android:textSize="20sp" />
            <TextView android:id="@+id/hilo" style="@style/WidgetBody" android:layout_marginStart="6dp" />
        </LinearLayout>

        <TextView android:id="@+id/line" style="@style/WidgetText" android:layout_marginTop="4dp" android:maxLines="2" android:textSize="15sp" android:textStyle="bold" />
        <TextView android:id="@+id/updated" style="@style/WidgetSmall" android:layout_marginTop="2dp" android:visibility="gone" />
    </LinearLayout>
</FrameLayout>
```

**File (create): `mobile/android/app/src/main/res/layout/widget_hike_medium.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@android:id/background"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_bg"
    android:clipToOutline="true">

    <ImageView
        android:id="@+id/sky"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:importantForAccessibility="no"
        android:scaleType="fitXY"
        android:visibility="gone" />

    <LinearLayout
        android:id="@+id/content"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:orientation="horizontal"
        android:padding="14dp">

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:orientation="vertical">

            <TextView android:id="@+id/peak" style="@style/WidgetCaption" />
            <TextView android:id="@+id/day" style="@style/WidgetBody" android:layout_marginTop="2dp" />

            <FrameLayout
                android:layout_width="match_parent"
                android:layout_height="0dp"
                android:layout_weight="1" />

            <LinearLayout
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:gravity="center_vertical"
                android:orientation="horizontal">

                <TextView android:id="@+id/icon" style="@style/WidgetText" android:textSize="20sp" />
                <TextView android:id="@+id/hilo" style="@style/WidgetBody" android:layout_marginStart="6dp" />
            </LinearLayout>

            <TextView android:id="@+id/line" style="@style/WidgetText" android:layout_marginTop="4dp" android:maxLines="2" android:textSize="15sp" android:textStyle="bold" />
            <TextView android:id="@+id/updated" style="@style/WidgetSmall" android:layout_marginTop="2dp" android:visibility="gone" />
        </LinearLayout>

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_marginStart="12dp"
            android:layout_weight="1"
            android:gravity="center_vertical"
            android:orientation="vertical">

            <TextView android:id="@+id/wind" style="@style/WidgetText" android:textSize="13sp" />
            <TextView android:id="@+id/rain" style="@style/WidgetText" android:layout_marginTop="6dp" android:textSize="13sp" />
            <TextView android:id="@+id/storm" style="@style/WidgetText" android:layout_marginTop="6dp" android:maxLines="2" android:textSize="13sp" />
        </LinearLayout>
    </LinearLayout>
</FrameLayout>
```

**File (create): `mobile/android/app/src/main/res/layout/widget_message.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@android:id/background"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_bg"
    android:padding="14dp">

    <TextView
        android:id="@+id/message"
        style="@style/WidgetBody"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:gravity="center"
        android:maxLines="4"
        android:text="MetaBlend"
        android:textSize="13sp" />
</FrameLayout>
```

- [ ] **Step 2: Renderer**

**File (create): `mobile/android/app/src/main/java/app/metablend/widget/WidgetRenderer.java`**
```java
package app.metablend.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Shader;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;
import app.metablend.R;
import java.text.DateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

// Payload → RemoteViews. A small and a medium layout per widget: Android 12+
// picks between them by size itself, older launchers by the reported width.
public final class WidgetRenderer {
    private WidgetRenderer() {}

    private static final int WHITE = 0xFFFFFFFF, WHITE_DIM = 0xD9FFFFFF, GOOD_ON_SKY = 0xFFA7F3D0, GOOD = 0xFF059669;
    private static final long DIM_AFTER_MS = 3L * 60 * 60 * 1000;

    public static final class Look {
        final boolean sky, stale;
        final long at;
        final String show;

        public Look(boolean sky, boolean stale, long at, String show) {
            this.sky = sky;
            this.stale = stale;
            this.at = at;
            this.show = show;
        }
    }

    interface Maker {
        RemoteViews make(boolean medium);
    }

    static RemoteViews sized(Context c, int id, Maker maker) {
        if (Build.VERSION.SDK_INT >= 31) {
            Map<SizeF, RemoteViews> map = new HashMap<>();
            map.put(new SizeF(100f, 100f), maker.make(false));
            map.put(new SizeF(250f, 100f), maker.make(true));
            return new RemoteViews(map);
        }
        Bundle o = AppWidgetManager.getInstance(c).getAppWidgetOptions(id);
        return maker.make(o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110) >= 250);
    }

    public static RemoteViews weather(Context c, int id, JSONObject p, Look look) {
        return sized(c, id, medium -> weatherViews(c, id, p, look, medium));
    }

    public static RemoteViews hike(Context c, int id, JSONObject p, Look look) {
        return sized(c, id, medium -> hikeViews(c, id, p, look, medium));
    }

    public static RemoteViews message(Context c, int id, String text) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_message);
        v.setTextViewText(R.id.message, text);
        v.setOnClickPendingIntent(android.R.id.background, open(c, id, "/"));
        return v;
    }

    private static RemoteViews weatherViews(Context c, int id, JSONObject p, Look look, boolean medium) {
        RemoteViews v = new RemoteViews(c.getPackageName(), medium ? R.layout.widget_weather_medium : R.layout.widget_weather_small);
        JSONObject now = obj(p, "now"), today = obj(p, "today");
        v.setTextViewText(R.id.city, p.optString("city"));
        v.setTextViewText(R.id.temp, now.optString("temp"));
        v.setTextViewText(R.id.icon, now.optString("icon"));
        v.setTextViewText(R.id.text, now.optString("text"));
        v.setTextViewText(R.id.hilo, "↑ " + today.optString("hi") + "   ↓ " + today.optString("lo"));
        if (medium) {
            v.removeAllViews(R.id.strip);
            boolean days = "days".equals(look.show);
            JSONArray list = p.optJSONArray(days ? "days" : "hours");
            int n = list == null ? 0 : Math.min(list.length(), days ? 5 : 6);
            for (int i = 0; i < n; i++) {
                JSONObject it = list.optJSONObject(i);
                if (it == null) continue;
                RemoteViews cell = new RemoteViews(c.getPackageName(), R.layout.widget_cell);
                cell.setTextViewText(R.id.cell_top, it.optString(days ? "day" : "t"));
                cell.setTextViewText(R.id.cell_icon, it.optString("icon"));
                cell.setTextViewText(R.id.cell_main, it.optString(days ? "hi" : "temp"));
                cell.setTextViewText(R.id.cell_sub, it.optString(days ? "lo" : "rain"));
                if (look.sky) {
                    tint(cell, WHITE, R.id.cell_main);
                    tint(cell, WHITE_DIM, R.id.cell_top, R.id.cell_sub);
                }
                v.addView(R.id.strip, cell);
            }
        }
        finish(c, v, id, p, look, now.optString("sky"), new int[] { R.id.city, R.id.temp }, new int[] { R.id.text, R.id.hilo, R.id.updated });
        return v;
    }

    private static RemoteViews hikeViews(Context c, int id, JSONObject p, Look look, boolean medium) {
        RemoteViews v = new RemoteViews(c.getPackageName(), medium ? R.layout.widget_hike_medium : R.layout.widget_hike_small);
        v.setTextViewText(R.id.peak, "⛰ " + p.optString("peak"));
        v.setTextViewText(R.id.day, p.optString("day"));
        v.setTextViewText(R.id.line, p.isNull("line") ? "💨 " + p.optString("wind") : p.optString("line"));
        v.setTextViewText(R.id.icon, p.optString("icon"));
        v.setTextViewText(R.id.hilo, "↑ " + p.optString("hi") + "   ↓ " + p.optString("lo"));
        int[] dim;
        if (medium) {
            v.setTextViewText(R.id.wind, "💨 " + p.optString("wind"));
            v.setTextViewText(R.id.rain, "💧 " + p.optString("rain"));
            v.setTextViewText(R.id.storm, p.isNull("storm") ? "" : "⚡ " + p.optString("storm"));
            dim = new int[] { R.id.day, R.id.hilo, R.id.updated, R.id.wind, R.id.rain, R.id.storm };
        } else {
            dim = new int[] { R.id.day, R.id.hilo, R.id.updated };
        }
        finish(c, v, id, p, look, p.optString("sky"), new int[] { R.id.peak, R.id.line }, dim);
        if (!p.isNull("good") && p.optBoolean("good")) v.setTextColor(R.id.line, look.sky ? GOOD_ON_SKY : GOOD);
        return v;
    }

    // sky or system background, the stale marker, and the tap
    private static void finish(Context c, RemoteViews v, int id, JSONObject p, Look look, String sky, int[] strong, int[] dim) {
        JSONObject skies = p.optJSONObject("skies");
        JSONArray colors = skies == null ? null : skies.optJSONArray(sky);
        if (look.sky && colors != null) {
            v.setImageViewBitmap(R.id.sky, gradient(colors));
            v.setViewVisibility(R.id.sky, View.VISIBLE);
            tint(v, WHITE, strong);
            tint(v, WHITE_DIM, dim);
        } else {
            v.setViewVisibility(R.id.sky, View.GONE);
        }
        if (look.stale && look.at > 0) {
            v.setTextViewText(R.id.updated, DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date(look.at)));
            v.setViewVisibility(R.id.updated, View.VISIBLE);
        } else {
            v.setViewVisibility(R.id.updated, View.GONE);
        }
        boolean old = look.stale && System.currentTimeMillis() - look.at > DIM_AFTER_MS;
        v.setFloat(R.id.content, "setAlpha", old ? 0.55f : 1f);
        v.setOnClickPendingIntent(android.R.id.background, open(c, id, p.optString("path", "/")));
    }

    // a 1-pixel-wide vertical gradient, stretched over the widget
    private static Bitmap gradient(JSONArray colors) {
        int n = Math.max(colors.length(), 2);
        int[] cs = new int[n];
        for (int i = 0; i < n; i++) {
            try {
                cs[i] = Color.parseColor(colors.optString(Math.min(i, colors.length() - 1), "#101d45"));
            } catch (IllegalArgumentException e) {
                cs[i] = 0xFF101D45;
            }
        }
        Bitmap b = Bitmap.createBitmap(1, 96, Bitmap.Config.ARGB_8888);
        Paint paint = new Paint();
        paint.setShader(new LinearGradient(0, 0, 0, 96, cs, null, Shader.TileMode.CLAMP));
        new Canvas(b).drawRect(0, 0, 1, 96, paint);
        return b;
    }

    static PendingIntent open(Context c, int id, String path) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("metablend://open?path=" + Uri.encode(path)));
        i.setPackage(c.getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void tint(RemoteViews v, int color, int... ids) {
        for (int id : ids) v.setTextColor(id, color);
    }

    private static JSONObject obj(JSONObject p, String key) {
        JSONObject o = p.optJSONObject(key);
        return o != null ? o : new JSONObject();
    }
}
```

### Task 8: Providers, updater, settings screen, registration — build and run

**Files:**
- Create: `widget/WidgetUpdater.java`, `widget/WeatherWidgetProvider.java`, `widget/HikeWidgetProvider.java`, `widget/WidgetConfigActivity.java`, `res/xml/widget_weather_info.xml`, `res/xml/widget_hike_info.xml`, `res/values-de/strings.xml`, `res/values-fr/strings.xml`, `res/values-es/strings.xml`, `res/values-it/strings.xml`
- Modify: `res/values/strings.xml`, `AndroidManifest.xml`

**Interfaces:**
- Consumes: everything from Tasks 6–7.
- Produces: `WidgetUpdater.refreshAll(c)`, `WidgetUpdater.update(c, ids, kind, pendingResult)`, `WidgetUpdater.showCached(c, id, kind)`, kinds `WEATHER`/`HIKE`.

- [ ] **Step 1: Write the files**

**File (create): `mobile/android/app/src/main/java/app/metablend/widget/WidgetUpdater.java`**
```java
package app.metablend.widget;

import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

// Fetch → cache → render for each widget, off the main thread. A failed
// fetch keeps the last good payload on screen with its time.
public final class WidgetUpdater {
    private WidgetUpdater() {}

    public static final String WEATHER = "weather", HIKE = "hike";

    public static void refreshAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        update(c, m.getAppWidgetIds(new ComponentName(c, WeatherWidgetProvider.class)), WEATHER, null);
        update(c, m.getAppWidgetIds(new ComponentName(c, HikeWidgetProvider.class)), HIKE, null);
    }

    public static void update(Context context, int[] ids, String kind, BroadcastReceiver.PendingResult pending) {
        Context c = context.getApplicationContext();
        if (ids == null || ids.length == 0) {
            if (pending != null) pending.finish();
            return;
        }
        for (int id : ids) showCached(c, id, kind);
        new Thread(() -> {
            CountDownLatch done = new CountDownLatch(ids.length);
            for (int id : ids) {
                new Thread(() -> {
                    try {
                        refresh(c, id, kind);
                    } catch (RuntimeException ignored) {
                        // one broken widget must not stop the others
                    } finally {
                        done.countDown();
                    }
                }).start();
            }
            try {
                done.await(9, TimeUnit.SECONDS);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
            if (pending != null) pending.finish();
        }).start();
    }

    // the cached payload as it is, e.g. after a resize on Android 11 and older
    public static void showCached(Context c, int id, String kind) {
        JSONObject p = WidgetStore.cached(c, id);
        if (p != null) show(c, id, kind, p, false);
    }

    static void refresh(Context c, int id, String kind) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        JSONObject s = WidgetStore.settings(c);
        WidgetText tx = new WidgetText(s == null ? Locale.getDefault().getLanguage() : s.optString("lang", "en"));
        if (s == null) {
            m.updateAppWidget(id, WidgetRenderer.message(c, id, tx.get("openOnce")));
            return;
        }
        String lang = s.optString("lang", "en"), unit = s.optString("unit", "C"), base = s.optString("base", "https://metablend.app");
        WidgetApi.Result r;
        if (HIKE.equals(kind)) {
            JSONObject plan = nextPlan(s.optJSONArray("hikes"));
            if (plan == null) {
                m.updateAppWidget(id, WidgetRenderer.message(c, id, tx.get("planHike")));
                return;
            }
            r = WidgetApi.get(base, WidgetApi.hikeQuery(plan, lang, unit));
        } else {
            String home = s.isNull("home") ? "" : s.optString("home", "");
            String city = WidgetStore.get(c, id, "city", "");
            if (city.isEmpty()) city = home;
            if (city.isEmpty()) {
                m.updateAppWidget(id, WidgetRenderer.message(c, id, tx.get("pickCity")));
                return;
            }
            r = WidgetApi.get(base, WidgetApi.weatherQuery(city, lang, unit));
            if (r.status == 404 && !home.isEmpty() && !home.equals(city)) r = WidgetApi.get(base, WidgetApi.weatherQuery(home, lang, unit));
        }
        if (r.json != null) {
            WidgetStore.cache(c, id, r.json);
            show(c, id, kind, r.json, false);
            return;
        }
        JSONObject old = WidgetStore.cached(c, id);
        if (old != null) show(c, id, kind, old, true);
        else m.updateAppWidget(id, WidgetRenderer.message(c, id, tx.get("offline")));
    }

    private static void show(Context c, int id, String kind, JSONObject p, boolean stale) {
        WidgetRenderer.Look look = new WidgetRenderer.Look(
            !"system".equals(WidgetStore.get(c, id, "style", "sky")), stale, WidgetStore.cachedAt(c, id), WidgetStore.get(c, id, "show", "hours"));
        RemoteViews v = HIKE.equals(kind) ? WidgetRenderer.hike(c, id, p, look) : WidgetRenderer.weather(c, id, p, look);
        AppWidgetManager.getInstance(c).updateAppWidget(id, v);
    }

    // the earliest plan dated today or later (the phone's calendar)
    static JSONObject nextPlan(JSONArray hikes) {
        if (hikes == null) return null;
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        JSONObject best = null;
        for (int i = 0; i < hikes.length(); i++) {
            JSONObject h = hikes.optJSONObject(i);
            if (h == null) continue;
            String d = h.optString("date");
            if (d.compareTo(today) >= 0 && (best == null || d.compareTo(best.optString("date")) < 0)) best = h;
        }
        return best;
    }
}
```

**File (create): `mobile/android/app/src/main/java/app/metablend/widget/WeatherWidgetProvider.java`**
```java
package app.metablend.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

public class WeatherWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        WidgetUpdater.update(c, ids, WidgetUpdater.WEATHER, goAsync());
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle options) {
        WidgetUpdater.showCached(c, id, WidgetUpdater.WEATHER); // older launchers: the layout follows the size
    }

    @Override
    public void onDeleted(Context c, int[] ids) {
        for (int id : ids) WidgetStore.forget(c, id);
    }
}
```

**File (create): `mobile/android/app/src/main/java/app/metablend/widget/HikeWidgetProvider.java`**
```java
package app.metablend.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

public class HikeWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        WidgetUpdater.update(c, ids, WidgetUpdater.HIKE, goAsync());
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle options) {
        WidgetUpdater.showCached(c, id, WidgetUpdater.HIKE);
    }

    @Override
    public void onDeleted(Context c, int[] ids) {
        for (int id : ids) WidgetStore.forget(c, id);
    }
}
```

**File (create): `mobile/android/app/src/main/java/app/metablend/widget/WidgetConfigActivity.java`**
```java
package app.metablend.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

// A widget's settings: on adding (Android 11 and older) and via long-press →
// reconfigure. City and Show only for the weather widget, Style for both.
public class WidgetConfigActivity extends AppCompatActivity {
    private int id = AppWidgetManager.INVALID_APPWIDGET_ID;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        setResult(RESULT_CANCELED);
        Bundle extras = getIntent().getExtras();
        if (extras != null) id = extras.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }
        AppWidgetProviderInfo info = AppWidgetManager.getInstance(this).getAppWidgetInfo(id);
        final boolean hike = info != null && HikeWidgetProvider.class.getName().equals(info.provider.getClassName());
        JSONObject s = WidgetStore.settings(this);
        WidgetText tx = new WidgetText(s == null ? Locale.getDefault().getLanguage() : s.optString("lang", "en"));
        setTitle(tx.get("settings"));

        int pad = dp(20);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(pad, dp(4), pad, pad);

        RadioGroup cities = null, show = null;
        if (!hike) {
            String home = s == null || s.isNull("home") ? "" : s.optString("home", "");
            String chosen = WidgetStore.get(this, id, "city", "");
            List<String> names = new ArrayList<>();
            names.add("");
            JSONArray recent = s == null ? null : s.optJSONArray("recent");
            for (int i = 0; recent != null && i < recent.length(); i++) {
                String n = recent.optString(i);
                if (!n.isEmpty() && !n.equals(home) && !names.contains(n)) names.add(n);
            }
            if (!chosen.isEmpty() && !names.contains(chosen)) names.add(chosen); // keeps working when it left the list
            cities = group(col, tx.get("city"));
            for (String n : names) {
                String label = n.isEmpty() ? tx.get("home") + (home.isEmpty() ? "" : " (" + home + ")") : n;
                option(cities, n, label, n.equals(chosen));
            }
            String sh = WidgetStore.get(this, id, "show", "hours");
            show = group(col, tx.get("show"));
            option(show, "hours", tx.get("hours"), !"days".equals(sh));
            option(show, "days", tx.get("days"), "days".equals(sh));
        }
        String st = WidgetStore.get(this, id, "style", "sky");
        RadioGroup style = group(col, tx.get("style"));
        option(style, "sky", tx.get("sky"), !"system".equals(st));
        option(style, "system", tx.get("system"), "system".equals(st));

        Button save = new Button(this);
        save.setText(tx.get("save"));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(16);
        col.addView(save, lp);
        final RadioGroup fCities = cities, fShow = show;
        save.setOnClickListener(v -> {
            if (fCities != null) WidgetStore.put(this, id, "city", picked(fCities));
            if (fShow != null) WidgetStore.put(this, id, "show", picked(fShow));
            WidgetStore.put(this, id, "style", picked(style));
            WidgetStore.dropCache(this, id); // don't flash the previous city
            WidgetUpdater.update(this, new int[] { id }, hike ? WidgetUpdater.HIKE : WidgetUpdater.WEATHER, null);
            setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id));
            finish();
        });

        ScrollView scroll = new ScrollView(this);
        scroll.addView(col);
        setContentView(scroll);
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private RadioGroup group(LinearLayout col, String title) {
        TextView label = new TextView(this);
        label.setText(title);
        label.setTextSize(13);
        label.setPadding(0, dp(14), 0, dp(2));
        col.addView(label);
        RadioGroup g = new RadioGroup(this);
        col.addView(g);
        return g;
    }

    private void option(RadioGroup g, String value, String text, boolean checked) {
        RadioButton b = new RadioButton(this);
        b.setId(View.generateViewId());
        b.setText(text);
        b.setTag(value);
        g.addView(b);
        if (checked) g.check(b.getId());
    }

    private static String picked(RadioGroup g) {
        View b = g.findViewById(g.getCheckedRadioButtonId());
        return b == null ? "" : String.valueOf(b.getTag());
    }
}
```

**File (create): `mobile/android/app/src/main/res/xml/widget_weather_info.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:configure="app.metablend.widget.WidgetConfigActivity"
    android:description="@string/widget_weather_desc"
    android:initialLayout="@layout/widget_message"
    android:minHeight="110dp"
    android:minResizeHeight="110dp"
    android:minResizeWidth="110dp"
    android:minWidth="110dp"
    android:resizeMode="horizontal|vertical"
    android:targetCellHeight="2"
    android:targetCellWidth="2"
    android:updatePeriodMillis="1800000"
    android:widgetCategory="home_screen"
    android:widgetFeatures="reconfigurable|configuration_optional" />
```

**File (create): `mobile/android/app/src/main/res/xml/widget_hike_info.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:configure="app.metablend.widget.WidgetConfigActivity"
    android:description="@string/widget_hike_desc"
    android:initialLayout="@layout/widget_message"
    android:minHeight="110dp"
    android:minResizeHeight="110dp"
    android:minResizeWidth="110dp"
    android:minWidth="110dp"
    android:resizeMode="horizontal|vertical"
    android:targetCellHeight="2"
    android:targetCellWidth="2"
    android:updatePeriodMillis="1800000"
    android:widgetCategory="home_screen"
    android:widgetFeatures="reconfigurable|configuration_optional" />
```

Add to `res/values/strings.xml` inside `<resources>`:
```xml
    <string name="widget_weather_name">Weather</string>
    <string name="widget_weather_desc">Now, the next hours or the next days for a city</string>
    <string name="widget_hike_name">Next hike</string>
    <string name="widget_hike_desc">The summit window of your next planned hike</string>
```

**File (create): `mobile/android/app/src/main/res/values-de/strings.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="widget_weather_name">Wetter</string>
    <string name="widget_weather_desc">Jetzt, die nächsten Stunden oder Tage für einen Ort</string>
    <string name="widget_hike_name">Nächste Tour</string>
    <string name="widget_hike_desc">Das Gipfelfenster deiner nächsten geplanten Tour</string>
</resources>
```

**File (create): `mobile/android/app/src/main/res/values-fr/strings.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="widget_weather_name">Météo</string>
    <string name="widget_weather_desc">Maintenant, les prochaines heures ou les prochains jours pour une ville</string>
    <string name="widget_hike_name">Prochaine randonnée</string>
    <string name="widget_hike_desc">Le créneau au sommet de votre prochaine randonnée prévue</string>
</resources>
```

**File (create): `mobile/android/app/src/main/res/values-es/strings.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="widget_weather_name">Tiempo</string>
    <string name="widget_weather_desc">Ahora, las próximas horas o los próximos días para una ciudad</string>
    <string name="widget_hike_name">Próxima excursión</string>
    <string name="widget_hike_desc">La ventana de cumbre de tu próxima excursión planificada</string>
</resources>
```

**File (create): `mobile/android/app/src/main/res/values-it/strings.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="widget_weather_name">Meteo</string>
    <string name="widget_weather_desc">Ora, le prossime ore o i prossimi giorni per una città</string>
    <string name="widget_hike_name">Prossima escursione</string>
    <string name="widget_hike_desc">La finestra in vetta della tua prossima escursione pianificata</string>
</resources>
```

`AndroidManifest.xml`, inside `<application>` after the FileProvider:
```xml
        <!-- Home-screen widgets: settings screen + the two providers -->
        <activity
            android:name=".widget.WidgetConfigActivity"
            android:excludeFromRecents="true"
            android:exported="true"
            android:taskAffinity=""
            android:theme="@style/Theme.AppCompat.DayNight.Dialog">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_CONFIGURE" />
            </intent-filter>
        </activity>

        <receiver
            android:name=".widget.WeatherWidgetProvider"
            android:exported="false"
            android:label="@string/widget_weather_name">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/widget_weather_info" />
        </receiver>

        <receiver
            android:name=".widget.HikeWidgetProvider"
            android:exported="false"
            android:label="@string/widget_hike_name">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/widget_hike_info" />
        </receiver>
```

- [ ] **Step 2: Build** — `cd mobile/android && JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew assembleDebug` → BUILD SUCCESSFUL.
- [ ] **Step 3: Emulator (when adb reaches it)** — `adb install -r app/build/outputs/apk/debug/app-debug.apk`; open the app once (sync), add both widgets from the launcher, open the settings via long-press; `adb shell am start -a android.intent.action.VIEW -d "metablend://open?path=%2Fmore"` → app opens on More.
- [ ] **Step 4: Commit + push** — `git add mobile/android && git commit -m "Android widgets: weather and next hike, settings screen, metablend:// links"`

### Task 9: Device checklist

**Files:** Modify `mobile/README.md` — new section after "Push notifications":
```markdown
## Home-screen widgets

Build order: the website side is live with the deploy; the widgets need a
new app build (Android Studio ▶ Run / Xcode ▶ Run). Open the app once after
installing — it hands the widgets their settings.

Check on a device / emulator / simulator:
- [ ] Add "Weather" small: city, temperature, icon, condition, ↑/↓ — same temperature as the app.
- [ ] Resize / add medium: the next 6 hours; settings → Show: Next days → 5 days.
- [ ] Settings → City: the home city and the recent cities are listed; pick another → it shows that city.
- [ ] Two weather widgets with two different cities side by side.
- [ ] Style: System → plain background in light and dark mode; Living sky → the app's sky.
- [ ] "Next hike" with a hike planned for tomorrow → summit window (green) or "No safe window"; without a plan → "Plan a hike in the app".
- [ ] Tap a weather widget → the app opens on that city; tap the hike widget → that peak.
- [ ] Airplane mode, wait for a refresh → the last data stays with its time.
- [ ] App language German + °F → widgets follow after leaving the app.
- [ ] iOS: tinted / clear home screen (long-press home screen → Edit → Customize) → readable, no sky.
```
Commit with Task 8 or separately: `git commit -m "App README: widget checklist"`.

## Stage 3 — iOS (after the owner's Xcode step)

### Task 10: Owner — create the widget target and the App Group (on the Mac)

- [ ] `git pull`, then `cd mobile && npm install && npx cap sync ios`, open `mobile/ios/App/App.xcodeproj`.
- [ ] File → New → Target… → iOS → **Widget Extension** → Next. Product Name **MetaBlendWidgets**. Untick "Include Live Activity" and "Include Control"; tick "Include Configuration App Intent" if offered. Finish; "Activate scheme?" → Activate.
- [ ] Target **MetaBlendWidgets** → General → Minimum Deployments → **iOS 17.0**.
- [ ] Target **App** → Signing & Capabilities → + Capability → **App Groups** → + → `group.app.metablend`. Target **MetaBlendWidgets** → same, tick the same group.
- [ ] `git add mobile/ios && git commit -m "iOS: widget extension target and App Group" && git push`
- [ ] Executor then lists the new target's files (`git show --stat HEAD`) — expected `MetaBlendWidgets/MetaBlendWidgets.swift`, `MetaBlendWidgetsBundle.swift`, `AppIntent.swift`, `Info.plist`, `Assets.xcassets`, `MetaBlendWidgets.entitlements`.

### Task 11: App target — bridge, view controller, URL scheme

**Files:** Modify `mobile/ios/App/App/AppDelegate.swift`, `SceneDelegate.swift`, `Info.plist`

- [ ] **Step 1:** `AppDelegate.swift` — add `import WidgetKit` under the existing imports and append:
```swift

// The website hands the home-screen widgets their settings (language, unit,
// home city, recent cities, planned hikes) through the App Group.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise)]

    @objc func sync(_ call: CAPPluginCall) {
        guard let json = call.getString("json") else { return call.reject("json missing") }
        UserDefaults(suiteName: "group.app.metablend")?.set(json, forKey: "widget_settings")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}

// The app's web view controller with the in-app plugins registered.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetBridgePlugin())
    }
}
```
- [ ] **Step 2:** `SceneDelegate.swift`: `window?.rootViewController = CAPBridgeViewController()` → `window?.rootViewController = MainViewController()`.
- [ ] **Step 3:** `Info.plist`, inside the top `<dict>`:
```xml
	<key>CFBundleURLTypes</key>
	<array>
		<dict>
			<key>CFBundleURLName</key>
			<string>app.metablend</string>
			<key>CFBundleURLSchemes</key>
			<array>
				<string>metablend</string>
			</array>
		</dict>
	</array>
```

### Task 12: Widget extension code

**Files:** Replace the template contents of `mobile/ios/App/MetaBlendWidgets/MetaBlendWidgetsBundle.swift`, `MetaBlendWidgets.swift`, `AppIntent.swift` (same file names → target membership stays as Xcode set it). Delete any other template `.swift` files only if the bundle no longer references them and they don't compile alone.

**File (create): `mobile/ios/App/MetaBlendWidgets/MetaBlendWidgetsBundle.swift`**
```swift
import WidgetKit
import SwiftUI

@main
struct MetaBlendWidgetsBundle: WidgetBundle {
    var body: some Widget {
        WeatherWidget()
        HikeWidget()
    }
}
```

**File (create): `mobile/ios/App/MetaBlendWidgets/AppIntent.swift`**
```swift
import AppIntents
import WidgetKit

enum WidgetStyle: String, AppEnum {
    case sky, system
    static var typeDisplayRepresentation: TypeDisplayRepresentation { "Style" }
    static var caseDisplayRepresentations: [WidgetStyle: DisplayRepresentation] { [.sky: "Living sky", .system: "System"] }
}

enum WidgetShow: String, AppEnum {
    case hours, days
    static var typeDisplayRepresentation: TypeDisplayRepresentation { "Show" }
    static var caseDisplayRepresentations: [WidgetShow: DisplayRepresentation] { [.hours: "Next hours", .days: "Next days"] }
}

// "" is the home city; anything else a city name from the app's recent list.
struct CityEntity: AppEntity {
    let id: String
    static var typeDisplayRepresentation: TypeDisplayRepresentation { "City" }
    static var defaultQuery: CityQuery { CityQuery() }
    var displayRepresentation: DisplayRepresentation {
        guard id.isEmpty else { return DisplayRepresentation(title: "\(id)") }
        let s = WidgetSettings.load()
        let home = Texts.t(s?.lang, .home)
        let title = s?.home.map { "\(home) (\($0))" } ?? home
        return DisplayRepresentation(title: "\(title)")
    }
}

struct CityQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [CityEntity] {
        identifiers.map { CityEntity(id: $0) }
    }
    func suggestedEntities() async throws -> [CityEntity] {
        let s = WidgetSettings.load()
        let others = (s?.recent ?? []).filter { $0 != s?.home }
        return [CityEntity(id: "")] + others.map { CityEntity(id: $0) }
    }
    func defaultResult() async -> CityEntity? { CityEntity(id: "") }
}

struct WeatherConfig: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Weather" }
    static var description: IntentDescription { IntentDescription("Now, the next hours or the next days for a city.") }
    @Parameter(title: "City") var city: CityEntity?
    @Parameter(title: "Show", default: .hours) var show: WidgetShow
    @Parameter(title: "Style", default: .sky) var style: WidgetStyle
}

struct HikeConfig: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Next hike" }
    static var description: IntentDescription { IntentDescription("The summit window of your next planned hike.") }
    @Parameter(title: "Style", default: .sky) var style: WidgetStyle
}
```

**File (create): `mobile/ios/App/MetaBlendWidgets/MetaBlendWidgets.swift`**
```swift
import WidgetKit
import SwiftUI

// MARK: - What the app syncs (WidgetBridge → App Group)

let appGroup = "group.app.metablend"

struct WidgetSettings: Codable {
    struct Hike: Codable {
        let name: String
        let lat: Double
        let lon: Double
        let elev: Double
        let date: String
    }
    let lang: String
    let unit: String
    let base: String
    let home: String?
    let recent: [String]
    let hikes: [Hike]

    static func load() -> WidgetSettings? {
        guard let json = UserDefaults(suiteName: appGroup)?.string(forKey: "widget_settings"),
              let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WidgetSettings.self, from: data)
    }
}

// MARK: - Texts in the app's five languages

enum Texts {
    enum Key: Int { case home, openOnce, pickCity, planHike, offline }
    private static let table: [String: [String]] = [
        "en": ["Home city", "Open MetaBlend once to pick a city", "Pick a city in MetaBlend", "Plan a hike in the app", "No connection — tap to open MetaBlend"],
        "de": ["Heimatstadt", "Öffne MetaBlend einmal, um einen Ort zu wählen", "Wähle einen Ort in MetaBlend", "Plane eine Tour in der App", "Keine Verbindung – tippen, um MetaBlend zu öffnen"],
        "fr": ["Ville principale", "Ouvrez MetaBlend une fois pour choisir une ville", "Choisissez une ville dans MetaBlend", "Planifiez une randonnée dans l’app", "Pas de connexion — touchez pour ouvrir MetaBlend"],
        "es": ["Ciudad principal", "Abre MetaBlend una vez para elegir una ciudad", "Elige una ciudad en MetaBlend", "Planifica una excursión en la app", "Sin conexión: toca para abrir MetaBlend"],
        "it": ["Città principale", "Apri MetaBlend una volta per scegliere una città", "Scegli una città in MetaBlend", "Pianifica un’escursione nell’app", "Nessuna connessione: tocca per aprire MetaBlend"],
    ]
    static func t(_ lang: String?, _ key: Key) -> String {
        let phone = Locale.current.language.languageCode?.identifier ?? "en"
        let row = table[lang ?? phone] ?? table["en"]!
        return row[key.rawValue]
    }
}

// MARK: - Payloads from /api/app-widget (display-ready text)

struct WeatherPayload: Codable {
    struct Now: Codable { let temp: String; let icon: String; let text: String; let sky: String }
    struct Today: Codable { let hi: String; let lo: String }
    struct Hour: Codable { let t: String; let ts: Double; let icon: String; let temp: String; let rain: String; let sky: String }
    struct Day: Codable { let day: String; let icon: String; let hi: String; let lo: String }
    let city: String
    let path: String
    let now: Now
    let today: Today
    let hours: [Hour]
    let days: [Day]
    let skies: [String: [String]]
}

struct HikePayload: Codable {
    let peak: String
    let day: String
    let path: String
    let line: String?
    let good: Bool?
    let icon: String
    let hi: String
    let lo: String
    let wind: String
    let rain: String
    let storm: String?
    let sky: String
    let skies: [String: [String]]
}

enum Api {
    static func get<T: Decodable>(_ type: T.Type, base: String, query: [String: String]) async -> (T?, Int) {
        guard var c = URLComponents(string: base + "/api/app-widget") else { return (nil, 0) }
        c.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        c.percentEncodedQuery = c.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
        guard let url = c.url else { return (nil, 0) }
        do {
            let (data, response) = try await URLSession.shared.data(for: URLRequest(url: url, timeoutInterval: 10))
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard status == 200 else { return (nil, status) }
            return (try? JSONDecoder().decode(T.self, from: data), status)
        } catch {
            return (nil, 0)
        }
    }
}

enum Cache {
    private static var store: UserDefaults? { UserDefaults(suiteName: appGroup) }
    static func save<T: Encodable>(_ value: T, key: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        store?.set(data, forKey: "cache.\(key)")
        store?.set(Date().timeIntervalSince1970, forKey: "cache.\(key).at")
    }
    static func load<T: Decodable>(_ type: T.Type, key: String) -> (T, Date)? {
        guard let data = store?.data(forKey: "cache.\(key)"),
              let value = try? JSONDecoder().decode(T.self, from: data),
              let at = store?.double(forKey: "cache.\(key).at"), at > 0 else { return nil }
        return (value, Date(timeIntervalSince1970: at))
    }
}

// MARK: - Look

extension Color {
    init(hex: String) {
        var v: UInt64 = 0
        Scanner(string: hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))).scanHexInt64(&v)
        self.init(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
    }
}

struct Ink {
    let main: Color
    let dim: Color
}

// white on the sky; the system's colours on a plain or tinted home screen
func palette(sky: Bool, mode: WidgetRenderingMode) -> Ink {
    sky && mode == .fullColor ? Ink(main: .white, dim: .white.opacity(0.85)) : Ink(main: .primary, dim: .secondary)
}

struct SkyBackground: View {
    let colors: [String]?
    let sky: Bool
    var body: some View {
        if sky, let colors, colors.count >= 2 {
            LinearGradient(colors: colors.map { Color(hex: $0) }, startPoint: .top, endPoint: .bottom)
        } else {
            Color(.systemBackground)
        }
    }
}

private let pathAllowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")

func openURL(_ path: String) -> URL {
    let encoded = path.addingPercentEncoding(withAllowedCharacters: pathAllowed) ?? "%2F"
    return URL(string: "metablend://open?path=\(encoded)") ?? URL(string: "metablend://open?path=%2F")!
}

func isOld(_ fetched: Date, _ stale: Bool) -> Bool {
    stale && Date().timeIntervalSince(fetched) > 3 * 3600
}

struct MessageView: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.footnote)
            .multilineTextAlignment(.center)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .containerBackground(for: .widget) { Color(.systemBackground) }
            .widgetURL(openURL("/"))
    }
}

// MARK: - Weather widget

struct WeatherEntry: TimelineEntry {
    enum State {
        case data(WeatherPayload, hour: Int?, fetched: Date, stale: Bool)
        case message(String)
    }
    let date: Date
    let state: State
    let show: WidgetShow
    let style: WidgetStyle
}

struct WeatherProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> WeatherEntry {
        WeatherEntry(date: .now, state: .message("MetaBlend"), show: .hours, style: .sky)
    }

    func snapshot(for configuration: WeatherConfig, in context: Context) async -> WeatherEntry {
        await entries(for: configuration)[0]
    }

    func timeline(for configuration: WeatherConfig, in context: Context) async -> Timeline<WeatherEntry> {
        Timeline(entries: await entries(for: configuration), policy: .after(Date().addingTimeInterval(30 * 60)))
    }

    private func entries(for config: WeatherConfig) async -> [WeatherEntry] {
        let entry = { (state: WeatherEntry.State, date: Date) in
            WeatherEntry(date: date, state: state, show: config.show, style: config.style)
        }
        guard let s = WidgetSettings.load() else { return [entry(.message(Texts.t(nil, .openOnce)), .now)] }
        let chosen = config.city?.id ?? ""
        var city = chosen.isEmpty ? (s.home ?? "") : chosen
        if city.isEmpty { return [entry(.message(Texts.t(s.lang, .pickCity)), .now)] }
        let query = { (name: String) in ["city": name, "lang": s.lang, "unit": s.unit] }
        var (payload, status) = await Api.get(WeatherPayload.self, base: s.base, query: query(city))
        if payload == nil, status == 404, let home = s.home, !home.isEmpty, home != city {
            city = home
            (payload, status) = await Api.get(WeatherPayload.self, base: s.base, query: query(city))
        }
        let key = "weather|\(city)|\(s.lang)|\(s.unit)"
        if let payload {
            Cache.save(payload, key: key)
            return hourly(payload, fetched: .now, stale: false, entry)
        }
        if let cached = Cache.load(WeatherPayload.self, key: key) {
            return hourly(cached.0, fetched: cached.1, stale: true, entry)
        }
        return [entry(.message(Texts.t(s.lang, .offline)), .now)]
    }

    // one entry now, then one per coming hour: the widget moves on with the
    // forecast even when iOS postpones the next refresh
    private func hourly(_ p: WeatherPayload, fetched: Date, stale: Bool, _ entry: (WeatherEntry.State, Date) -> WeatherEntry) -> [WeatherEntry] {
        let now = Date()
        let passed = p.hours.lastIndex { Date(timeIntervalSince1970: $0.ts) <= now }
        var list = [entry(.data(p, hour: passed, fetched: fetched, stale: stale), now)]
        for (i, h) in p.hours.enumerated() where Date(timeIntervalSince1970: h.ts) > now {
            list.append(entry(.data(p, hour: i, fetched: fetched, stale: stale), Date(timeIntervalSince1970: h.ts)))
        }
        return list
    }
}

struct Strip: View {
    let p: WeatherPayload
    let from: Int
    let show: WidgetShow
    let ink: Ink

    var body: some View {
        HStack(spacing: 0) {
            if show == .days {
                ForEach(Array(p.days.prefix(5).enumerated()), id: \.offset) { _, d in
                    cell(top: d.day, icon: d.icon, main: d.hi, sub: d.lo)
                }
            } else {
                ForEach(Array(p.hours.dropFirst(max(from, 0)).prefix(5).enumerated()), id: \.offset) { _, h in
                    cell(top: h.t, icon: h.icon, main: h.temp, sub: h.rain)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func cell(top: String, icon: String, main: String, sub: String) -> some View {
        VStack(spacing: 4) {
            Text(top).font(.system(size: 10)).foregroundStyle(ink.dim)
            Text(icon).font(.system(size: 18))
            Text(main).font(.caption.weight(.medium)).foregroundStyle(ink.main)
            Text(sub).font(.system(size: 10)).foregroundStyle(ink.dim)
        }
        .frame(maxWidth: .infinity)
    }
}

struct WeatherWidgetView: View {
    let entry: WeatherEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.widgetRenderingMode) private var mode

    var body: some View {
        switch entry.state {
        case .message(let text):
            MessageView(text: text)
        case .data(let p, let hour, let fetched, let stale):
            let h = hour.map { p.hours[$0] }
            let onSky = entry.style == .sky
            let ink = palette(sky: onSky, mode: mode)
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(p.city).font(.caption.bold()).foregroundStyle(ink.main).lineLimit(1)
                    HStack(spacing: 4) {
                        Text(h?.temp ?? p.now.temp).font(.system(size: 34, weight: .light)).foregroundStyle(ink.main)
                        Text(h?.icon ?? p.now.icon).font(.title2)
                    }
                    Spacer(minLength: 0)
                    Text(h.map { "💧 \($0.rain)" } ?? p.now.text).font(.caption2).foregroundStyle(ink.dim).lineLimit(1)
                    Text("↑ \(p.today.hi)  ↓ \(p.today.lo)").font(.caption2).foregroundStyle(ink.dim)
                    if stale { Text(fetched, style: .time).font(.system(size: 10)).foregroundStyle(ink.dim) }
                }
                if family == .systemMedium {
                    Strip(p: p, from: (hour ?? -1) + 1, show: entry.show, ink: ink)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .opacity(isOld(fetched, stale) ? 0.55 : 1)
            .containerBackground(for: .widget) { SkyBackground(colors: p.skies[h?.sky ?? p.now.sky], sky: onSky) }
            .widgetURL(openURL(p.path))
        }
    }
}

struct WeatherWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "MetaBlendWeather", intent: WeatherConfig.self, provider: WeatherProvider()) { entry in
            WeatherWidgetView(entry: entry)
        }
        .configurationDisplayName("Weather")
        .description("Now, the next hours or the next days for a city.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Hike widget

struct HikeEntry: TimelineEntry {
    enum State {
        case data(HikePayload, fetched: Date, stale: Bool)
        case message(String)
    }
    let date: Date
    let state: State
    let style: WidgetStyle
}

struct HikeProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> HikeEntry {
        HikeEntry(date: .now, state: .message("MetaBlend"), style: .sky)
    }

    func snapshot(for configuration: HikeConfig, in context: Context) async -> HikeEntry {
        await entry(for: configuration)
    }

    func timeline(for configuration: HikeConfig, in context: Context) async -> Timeline<HikeEntry> {
        Timeline(entries: [await entry(for: configuration)], policy: .after(Date().addingTimeInterval(30 * 60)))
    }

    private static func today() -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    private func entry(for config: HikeConfig) async -> HikeEntry {
        let make = { (state: HikeEntry.State) in HikeEntry(date: .now, state: state, style: config.style) }
        guard let s = WidgetSettings.load() else { return make(.message(Texts.t(nil, .openOnce))) }
        let today = Self.today()
        guard let plan = s.hikes.filter({ $0.date >= today }).min(by: { $0.date < $1.date }) else {
            return make(.message(Texts.t(s.lang, .planHike)))
        }
        let query = [
            "kind": "hike", "name": plan.name, "lat": String(plan.lat), "lon": String(plan.lon),
            "elev": String(Int(plan.elev.rounded())), "date": plan.date, "lang": s.lang, "unit": s.unit,
        ]
        let key = "hike|\(plan.name)|\(plan.date)|\(s.lang)|\(s.unit)"
        let (payload, _) = await Api.get(HikePayload.self, base: s.base, query: query)
        if let payload {
            Cache.save(payload, key: key)
            return make(.data(payload, fetched: .now, stale: false))
        }
        if let cached = Cache.load(HikePayload.self, key: key) {
            return make(.data(cached.0, fetched: cached.1, stale: true))
        }
        return make(.message(Texts.t(s.lang, .offline)))
    }
}

struct HikeWidgetView: View {
    let entry: HikeEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.widgetRenderingMode) private var mode

    var body: some View {
        switch entry.state {
        case .message(let text):
            MessageView(text: text)
        case .data(let p, let fetched, let stale):
            let onSky = entry.style == .sky
            let ink = palette(sky: onSky, mode: mode)
            let good: Color = onSky && mode == .fullColor ? Color(hex: "#A7F3D0") : .green
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("⛰ \(p.peak)").font(.caption.bold()).foregroundStyle(ink.main).lineLimit(1)
                    Text(p.day).font(.caption2).foregroundStyle(ink.dim)
                    Spacer(minLength: 0)
                    HStack(spacing: 6) {
                        Text(p.icon).font(.title3)
                        Text("↑ \(p.hi)  ↓ \(p.lo)").font(.caption2).foregroundStyle(ink.dim)
                    }
                    Text(p.line ?? "💨 \(p.wind)")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(p.good == true ? good : ink.main)
                        .lineLimit(2)
                    if stale { Text(fetched, style: .time).font(.system(size: 10)).foregroundStyle(ink.dim) }
                }
                if family == .systemMedium {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("💨 \(p.wind)")
                        Text("💧 \(p.rain)")
                        if let storm = p.storm { Text("⚡ \(storm)").lineLimit(2) }
                    }
                    .font(.caption)
                    .foregroundStyle(ink.main)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .opacity(isOld(fetched, stale) ? 0.55 : 1)
            .containerBackground(for: .widget) { SkyBackground(colors: p.skies[p.sky], sky: onSky) }
            .widgetURL(openURL(p.path))
        }
    }
}

struct HikeWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "MetaBlendHike", intent: HikeConfig.self, provider: HikeProvider()) { entry in
            HikeWidgetView(entry: entry)
        }
        .configurationDisplayName("Next hike")
        .description("The summit window of your next planned hike.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
```

- [ ] Commit + push: `git add mobile/ios && git commit -m "iOS widgets: weather and next hike, WidgetBridge, metablend:// links"`

### Task 13: Owner — build and check on the iPhone

- [ ] On the Mac: `git pull`, build and run the **App** scheme on the iPhone, open the app once, then add the widgets and go through the checklist in `mobile/README.md`.
- [ ] Compile errors in the extension → send the Xcode error text; fixes land as follow-up commits.
```
