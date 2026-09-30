# Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Weather alerts (rain soon, thunderstorms, severe, heat) for one home city, a morning briefing at a chosen hour, and planned-hike alerts, pushed to the Capacitor app on Android and iOS.

**Architecture:** Pure modules in `lib/push/` decide *what* to send (rules), *how it reads* (text) and *how it's sent* (FCM / APNs senders with injected transports); thin API routes store devices, settings and plans in Supabase; an hourly pg_cron job calls `/api/push/dispatch`, which reads each home city's cached outlook once and sends. The web app (loaded inside the Capacitor shell) talks to `@capacitor/push-notifications` and `@capacitor/preferences` through a lazy-loaded client module.

**Tech Stack:** Next.js 16 App Router (plain JS), `node:test`, Supabase (service role, RLS on), pg_cron + pg_net + Vault, `node:crypto` (RS256 / ES256 JWT), `node:http2` (APNs), FCM HTTP v1, Capacitor 8.5 plugins `@capacitor/push-notifications` 8.1.2, `@capacitor/preferences`, `@capacitor/app-launcher`.

**Spec:** `docs/superpowers/specs/2026-10-01-push-notifications-design.md`

## Global Constraints

- All UI and notification text in 5 languages: en, de, fr, es, it — keys in `lib/i18n.js`, filled with `fill()` from `lib/outlook/text.js`.
- Temperatures shown in the device's unit via `tempFormatter(unit)`; the server stores and compares °C.
- Rules (constants in `lib/push/rules.js`): rain ≥ 60 % after hours < 40 %, lead 30 min–2 h, dedupe 3 h; thunderstorm codes 95–99, lead 1–4 h, dedupe 6 h; severe codes 65, 67, 75, 82, 86 or wind ≥ 60 km/h, lead 1–6 h, dedupe 6 h per type; heat `tempMax` ≥ 30 °C, first run after 07:00 (until 12:00), folded into the briefing when that is on.
- Quiet hours 22:00–06:59 city-local apply to weather alerts only (severe exempt); briefing and hike alerts come at their set times.
- Cap: 3 weather alerts (rain, storm, severe, heat) per city-local day; priority severe > storm > rain > heat.
- Briefing hour 05–11 (default 07), sent at that hour or up to 2 h later if a run was missed, once per local date.
- Hike: evening slot 18:00–20:59 peak-local the day before; morning slot 06:00–08:59 on the day, only after an evening send, only if the window moved ≥ 1 h or appeared/disappeared.
- All local times come from the outlook's / hike payload's `utcOffsetSec` and the dispatcher's `now` — never the server clock's zone.
- Forecasts for the job are fetched as the app fetches them: `https://metablend.app/api/outlook?city=<home_name lower-cased>&lang=<lang>` and `hikeApiPath(plan)`.
- Secrets only in Vercel env, set by the owner, never in chat: `FIREBASE_SERVICE_ACCOUNT`, `APNS_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`. `google-services.json` stays out of git.
- Tables have RLS enabled and no policies (the API uses the service-role key); the backup route's fixed `TABLES` list leaves them out.
- Retention: devices unseen 90 days, plans after their day, log rows after 14 days.
- Commit straight to `main` after each task; every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A home city in a far time zone** (Sydney +10:00, New York −04:00): quiet hours, the briefing hour and the cap's "today" must follow the city's clock → rules test with `utcOffsetSec` 36000 and −14400 (Task 4).
2. **The job runs twice in one hour or an hour late** (pg_cron retry, slow run): no second copy of an alert, a late briefing still arrives → rules tests with a just-sent log entry and a run at briefing hour + 2 (Task 4).
3. **A home city the geocoder no longer finds** (typo, outlook 404): that group is skipped, every other city still gets its alerts → dispatch test with one `getJson` returning null (Task 7).
4. **The cap across local midnight:** an alert sent 23:30 local yesterday doesn't count against today → rules test (Task 4).
5. **Forecast hours with missing values** (`rainPct: null`, no `code`): no crash, no false alert → rules test (Task 4).

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/push.sql` | Record of the migration (tables, indexes, RLS) — applied via Supabase MCP |
| `supabase/cron.sql` | + the `push-dispatch-hourly` job |
| `lib/push/validate.js` | Pure: device key check + SHA-256, bodies for register / settings / plans |
| `lib/push/text.js` | Pure: `pushText(lang, unit, msg)` → `{ title, body }` |
| `lib/push/rules.js` | Pure: `cityEvents`, `decide`, `decideHike`, `windowChanged`, `localParts`, `RULES` |
| `lib/push/jwt.js` | `b64url`, `signJwt(alg, header, payload, pem)` (RS256 / ES256) |
| `lib/push/fcm.js` | `createFcm({ serviceAccount, fetchImpl, now })` → `{ send }` |
| `lib/push/apns.js` | `createApns({ keyPem, keyId, teamId, topic, request, now })` → `{ send }`, `http2Request` |
| `lib/push/send.js` | `createSender({ fcm, apns })`, `senderFromEnv(env)` — routes by platform, picks the Android channel |
| `lib/push/dispatch.js` | `runDispatch({ store, getJson, sender, now, dry, base })` — orchestration with injected deps |
| `lib/push/store.js` | Supabase access: `authDevice`, device upsert, settings, plans, log, dispatch loaders |
| `app/api/push/{register,settings,plans,test,dispatch}/route.js` | Thin routes over validate + store (+ dispatch) |
| `app/api/cleanup/route.js` | + retention deletes |
| `app/privacy/content.jsx` | + notifications section (5 languages) |
| `lib/push-client.js` | Browser/native: device key, API calls, permission, registration, taps, channels, view counts |
| `lib/push-days.js` | Pure: the day chips for planning a hike |
| `app/components/push/NotificationSettings.jsx` | More → Notifications |
| `app/components/push/PushPrompt.jsx` | The soft prompt card on the forecast |
| `app/components/hike/PlanHike.jsx` | 🔔 Plan a hike on a peak |
| `app/components/AppChrome.jsx`, `app/page.js`, `app/more/MoreClient.jsx`, `app/components/hike/PeakView.jsx` | Wiring |
| `mobile/ios/App/App/AppDelegate.swift`, `mobile/android/.gitignore`, `mobile/package.json`, `package.json`, `mobile/README.md` | Native setup |

---

### Task 1: Database tables

**Files:**
- Create: `supabase/push.sql`

**Interfaces:**
- Produces: tables `push_devices`, `hike_plans`, `push_log` with the columns below (later tasks select / insert them by these exact names).

- [ ] **Step 1: Write the migration record**

`supabase/push.sql`:

```sql
-- Push notifications (spec 2026-10-01). Applied live as migration push_tables.
-- RLS on, no policies: only the API (service-role key) reads and writes.
-- Not in the backup route's TABLES list on purpose — device tokens are not
-- learned state.

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  apns_env text check (apns_env in ('prod', 'sandbox')),
  lang text not null default 'en',
  unit text not null default 'C' check (unit in ('C', 'F')),
  home_name text,
  alert_rain boolean not null default false,
  alert_storm boolean not null default false,
  alert_severe boolean not null default false,
  alert_heat boolean not null default false,
  briefing boolean not null default false,
  briefing_hour smallint not null default 7 check (briefing_hour between 5 and 11),
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create table if not exists public.hike_plans (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.push_devices(id) on delete cascade,
  name text not null,
  lat double precision not null,
  lon double precision not null,
  elev integer not null,
  date date not null,
  sent_evening boolean not null default false,
  sent_morning boolean not null default false,
  last_window jsonb,
  created_at timestamptz not null default now()
);
create index if not exists hike_plans_date on public.hike_plans (date);
create index if not exists hike_plans_device on public.hike_plans (device_id);

create table if not exists public.push_log (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.push_devices(id) on delete cascade,
  kind text not null,
  ref text not null,
  sent_at timestamptz not null default now()
);
create index if not exists push_log_device_sent on public.push_log (device_id, sent_at);

alter table public.push_devices enable row level security;
alter table public.hike_plans enable row level security;
alter table public.push_log enable row level security;
```

- [ ] **Step 2: Apply it**

Supabase MCP `apply_migration`, project `loxstrespghksbnprovp`, name `push_tables`, query = the file's contents.

- [ ] **Step 3: Verify**

Supabase MCP `execute_sql`:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('push_devices', 'hike_plans', 'push_log');
```

Expected: 3 rows, `rowsecurity` true for each.

- [ ] **Step 4: Commit**

```bash
git add supabase/push.sql
git commit -m "Push: device, plan and log tables"
```

---

### Task 2: Request validation

**Files:**
- Create: `lib/push/validate.js`
- Test: `lib/push/validate.test.js`

**Interfaces:**
- Consumes: `pickLang`, `pickUnit` from `lib/share.js`.
- Produces:
  - `hashDeviceKey(key: string) → string | null` (64-char hex, null for a bad key)
  - `parseRegister(body) → { ok: true, value: { token, platform, lang, unit } } | { ok: false, status, error }`
  - `parseSettings(body) → { ok: true, value: patch } | { ok: false, status, error }` — patch keys ⊆ `home_name, alert_rain, alert_storm, alert_severe, alert_heat, briefing, briefing_hour, lang, unit`
  - `parsePlan(body, todayUtc: 'YYYY-MM-DD') → { ok: true, value: { name, lat, lon, elev, date } } | { ok: false, status, error }`

- [ ] **Step 1: Write the failing test**

`lib/push/validate.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashDeviceKey, parseRegister, parseSettings, parsePlan } from './validate.js'

const KEY = 'a'.repeat(43)

test('hashDeviceKey — a url-safe key of 32–128 chars hashes to hex; anything else is null', () => {
  assert.match(hashDeviceKey(KEY), /^[0-9a-f]{64}$/)
  assert.equal(hashDeviceKey(KEY), hashDeviceKey(KEY))
  assert.equal(hashDeviceKey('short'), null)
  assert.equal(hashDeviceKey('x'.repeat(40) + ' '), null)
  assert.equal(hashDeviceKey(undefined), null)
})

test('parseRegister — token and platform required, lang / unit fall back', () => {
  assert.deepEqual(parseRegister({ token: 'f'.repeat(64), platform: 'ios', lang: 'de', unit: 'F' }),
    { ok: true, value: { token: 'f'.repeat(64), platform: 'ios', lang: 'de', unit: 'F' } })
  assert.deepEqual(parseRegister({ token: 'f'.repeat(64), platform: 'android', lang: 'xx' }).value,
    { token: 'f'.repeat(64), platform: 'android', lang: 'en', unit: 'C' })
  assert.equal(parseRegister({ token: 'short', platform: 'ios' }).ok, false)
  assert.equal(parseRegister({ token: 'f'.repeat(64), platform: 'web' }).ok, false)
  assert.equal(parseRegister(null).status, 400)
})

test('parseSettings — only known fields, typed; an empty patch is an error', () => {
  assert.deepEqual(parseSettings({ alert_rain: true, briefing_hour: 6, home_name: '  Wien ', junk: 1 }).value,
    { alert_rain: true, briefing_hour: 6, home_name: 'Wien' })
  assert.deepEqual(parseSettings({ home_name: null }).value, { home_name: null })
  assert.equal(parseSettings({ briefing_hour: 4 }).ok, false)
  assert.equal(parseSettings({ briefing_hour: 7.5 }).ok, false)
  assert.equal(parseSettings({ alert_rain: 'yes' }).ok, false)
  assert.equal(parseSettings({ home_name: 'x'.repeat(81) }).ok, false)
  assert.equal(parseSettings({}).ok, false)
  assert.deepEqual(parseSettings({ lang: 'it', unit: 'F' }).value, { lang: 'it', unit: 'F' })
})

test('parsePlan — a peak and a day from yesterday (time zones) to 7 days ahead', () => {
  const ok = parsePlan({ name: 'Triglav', lat: 46.378, lon: 13.837, elev: 2864, date: '2026-10-03' }, '2026-10-01')
  assert.deepEqual(ok, { ok: true, value: { name: 'Triglav', lat: 46.378, lon: 13.837, elev: 2864, date: '2026-10-03' } })
  assert.equal(parsePlan({ name: 'T', lat: 46, lon: 13, elev: 2864, date: '2026-10-09' }, '2026-10-01').ok, false)
  assert.equal(parsePlan({ name: 'T', lat: 46, lon: 13, elev: 2864, date: '2026-09-29' }, '2026-10-01').ok, false)
  assert.equal(parsePlan({ name: 'T', lat: 46, lon: 13, elev: 2864, date: '2026-09-30' }, '2026-10-01').ok, true)
  assert.equal(parsePlan({ name: 'T', lat: 95, lon: 13, elev: 2864, date: '2026-10-02' }, '2026-10-01').ok, false)
  assert.equal(parsePlan({ name: '', lat: 46, lon: 13, elev: 2864, date: '2026-10-02' }, '2026-10-01').ok, false)
  assert.equal(parsePlan({ name: 'T', lat: 46, lon: 13, elev: 2864, date: 'soon' }, '2026-10-01').ok, false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/push/validate.test.js`
Expected: FAIL — `Cannot find module './validate.js'`.

- [ ] **Step 3: Write the implementation**

`lib/push/validate.js`:

```js
// Request bodies for the push API (pure — unit tested). The device key is a
// random secret the app keeps in native storage; the server only ever sees
// and stores its SHA-256.
import { createHash } from 'node:crypto'
import { pickLang, pickUnit } from '../share.js'
import { addDays } from '../localtime.js'

const bad = (error, status = 400) => ({ ok: false, status, error })
const isBool = v => typeof v === 'boolean'
const inRange = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi

export function hashDeviceKey(key) {
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(key)) return null
  return createHash('sha256').update(key).digest('hex')
}

export function parseRegister(b) {
  if (!b || typeof b !== 'object') return bad('Invalid body')
  const { token, platform } = b
  if (typeof token !== 'string' || !/^[A-Za-z0-9:_\-.]{20,4096}$/.test(token)) return bad('Invalid token')
  if (platform !== 'ios' && platform !== 'android') return bad('Invalid platform')
  return { ok: true, value: { token, platform, lang: pickLang(b.lang), unit: pickUnit(b.unit) } }
}

const FLAGS = ['alert_rain', 'alert_storm', 'alert_severe', 'alert_heat', 'briefing']

export function parseSettings(b) {
  if (!b || typeof b !== 'object') return bad('Invalid body')
  const patch = {}
  for (const k of FLAGS) {
    if (!(k in b)) continue
    if (!isBool(b[k])) return bad(`${k} must be true or false`)
    patch[k] = b[k]
  }
  if ('briefing_hour' in b) {
    if (!Number.isInteger(b.briefing_hour) || !inRange(b.briefing_hour, 5, 11)) return bad('briefing_hour must be 5–11')
    patch.briefing_hour = b.briefing_hour
  }
  if ('home_name' in b) {
    if (b.home_name === null) patch.home_name = null
    else {
      const name = typeof b.home_name === 'string' ? b.home_name.trim() : ''
      if (!name || name.length > 80) return bad('Invalid home city')
      patch.home_name = name
    }
  }
  if ('lang' in b) patch.lang = pickLang(b.lang)
  if ('unit' in b) patch.unit = pickUnit(b.unit)
  if (!Object.keys(patch).length) return bad('Nothing to change')
  return { ok: true, value: patch }
}

// todayUtc: the server's UTC date. A peak's "today" can still be yesterday in
// UTC (the Americas in the evening), hence one day of slack backwards.
export function parsePlan(b, todayUtc) {
  if (!b || typeof b !== 'object') return bad('Invalid body')
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  if (!name || name.length > 80) return bad('Invalid peak name')
  if (!inRange(b.lat, -90, 90) || !inRange(b.lon, -180, 180)) return bad('Invalid coordinates')
  if (!inRange(b.elev, 0, 9000)) return bad('Invalid elevation')
  if (typeof b.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return bad('Invalid date')
  if (b.date < addDays(todayUtc, -1) || b.date > addDays(todayUtc, 7)) return bad('The day must be within the next week')
  return { ok: true, value: { name, lat: b.lat, lon: b.lon, elev: Math.round(b.elev), date: b.date } }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/push/validate.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/push/validate.js lib/push/validate.test.js
git commit -m "Push: request validation"
```

---

### Task 3: Notification texts

**Files:**
- Create: `lib/push/text.js`
- Modify: `lib/i18n.js` (add 15 keys to each of the 5 language blocks, after `lbLoading`)
- Test: `lib/push/text.test.js`

**Interfaces:**
- Consumes: `t` (`lib/i18n.js`), `fill`, `tempFormatter`, `headlineText` (`lib/outlook/text.js`), `windowText` (`lib/hike/text.js`).
- Produces: `pushText(lang, unit, msg) → { title, body } | null` where `msg = { kind, vars }`:
  - `rain` vars `{ city, from: 'YYYY-MM-DDTHH:MM', pct }`
  - `storm` `{ city, from, to }`
  - `severe` `{ city, what: 'heavy_rain'|'heavy_snow'|'freezing_rain'|'wind', from }`
  - `heat` `{ city, max }` (°C)
  - `briefing` `{ city, date, min, max, headline, best: 'YYYY-MM-DDTHH:MM'|null, heat: bool }` (`headline` = a `headlineToday()` result)
  - `hike_evening` / `hike_morning` `{ peak, window, date, todayLocal, stormUnknown }` (`window` = a `summitWindow()` result)
  - `test` `{}`

- [ ] **Step 1: Add the translation keys**

Insert after each language's `lbLoading:` line (one Python edit, keeping the file's line endings):

```bash
python - <<'EOF'
import re
f = 'lib/i18n.js'
raw = open(f, encoding='utf-8').read(); crlf = '\r\n' in raw; s = raw.replace('\r\n', '\n')
K = {
 'en': dict(pushRainTitle='🌧 Rain in {city}', pushRainBody='From {from} ({pct}%)', pushStormTitle='⛈ Thunderstorms in {city}', pushStormBody='Likely {from}–{to}', pushSevereTitle='⚠️ {what} in {city}', pushFromBody='From {from}', pushHeavyRain='Heavy rain', pushHeavySnow='Heavy snow', pushFreezingRain='Freezing rain', pushStrongWind='Strong wind', pushHeatTitle='🌡 Hot day in {city}', pushHeatBody='Up to {max}', pushBriefTitle='{city} today', pushTestBody='Notifications work 👍', pushHikeTitle='⛰ {peak}'),
 'de': dict(pushRainTitle='🌧 Regen in {city}', pushRainBody='Ab {from} ({pct} %)', pushStormTitle='⛈ Gewitter in {city}', pushStormBody='Wahrscheinlich {from}–{to}', pushSevereTitle='⚠️ {what} in {city}', pushFromBody='Ab {from}', pushHeavyRain='Starkregen', pushHeavySnow='Starker Schneefall', pushFreezingRain='Gefrierender Regen', pushStrongWind='Sturm', pushHeatTitle='🌡 Heißer Tag in {city}', pushHeatBody='Bis {max}', pushBriefTitle='{city} heute', pushTestBody='Benachrichtigungen funktionieren 👍', pushHikeTitle='⛰ {peak}'),
 'fr': dict(pushRainTitle='🌧 Pluie à {city}', pushRainBody='À partir de {from} ({pct} %)', pushStormTitle='⛈ Orages à {city}', pushStormBody='Probables {from}–{to}', pushSevereTitle='⚠️ {what} à {city}', pushFromBody='À partir de {from}', pushHeavyRain='Fortes pluies', pushHeavySnow='Fortes chutes de neige', pushFreezingRain='Pluie verglaçante', pushStrongWind='Vent fort', pushHeatTitle='🌡 Journée chaude à {city}', pushHeatBody='Jusqu’à {max}', pushBriefTitle='{city} aujourd’hui', pushTestBody='Les notifications fonctionnent 👍', pushHikeTitle='⛰ {peak}'),
 'es': dict(pushRainTitle='🌧 Lluvia en {city}', pushRainBody='A partir de las {from} ({pct} %)', pushStormTitle='⛈ Tormentas en {city}', pushStormBody='Probables {from}–{to}', pushSevereTitle='⚠️ {what} en {city}', pushFromBody='A partir de las {from}', pushHeavyRain='Lluvia intensa', pushHeavySnow='Nevada intensa', pushFreezingRain='Lluvia helada', pushStrongWind='Viento fuerte', pushHeatTitle='🌡 Día caluroso en {city}', pushHeatBody='Hasta {max}', pushBriefTitle='{city} hoy', pushTestBody='Las notificaciones funcionan 👍', pushHikeTitle='⛰ {peak}'),
 'it': dict(pushRainTitle='🌧 Pioggia a {city}', pushRainBody='Dalle {from} ({pct}%)', pushStormTitle='⛈ Temporali a {city}', pushStormBody='Probabili {from}–{to}', pushSevereTitle='⚠️ {what} a {city}', pushFromBody='Dalle {from}', pushHeavyRain='Pioggia forte', pushHeavySnow='Forti nevicate', pushFreezingRain='Pioggia gelata', pushStrongWind='Vento forte', pushHeatTitle='🌡 Giornata calda a {city}', pushHeatBody='Fino a {max}', pushBriefTitle='{city} oggi', pushTestBody='Le notifiche funzionano 👍', pushHikeTitle='⛰ {peak}'),
}
starts = [m.start() for m in re.finditer(r"^  (en|de|fr|es|it): \{", s, re.M)]
langs = re.findall(r"^  (en|de|fr|es|it): \{", s, re.M)
out, off = s, 0
for i, lang in enumerate(langs):
    a = starts[i] + off; b = (starts[i + 1] + off) if i + 1 < len(starts) else len(out)
    seg = out[a:b]; m = re.search(r"\n    lbLoading: '[^']*',\n", seg); assert m, lang
    ins = ''.join(f"    {k}: '{v}',\n" for k, v in K[lang].items())
    seg = seg[:m.end()] + ins + seg[m.end():]; out = out[:a] + seg + out[b:]; off += len(ins)
if crlf: out = out.replace('\n', '\r\n')
open(f, 'w', encoding='utf-8', newline='').write(out); print('ok', out.count('pushTestBody'))
EOF
```

Expected: `ok 5`.

- [ ] **Step 2: Write the failing test**

`lib/push/text.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pushText } from './text.js'

test('pushText — weather alerts in the language, hours as HH:MM', () => {
  assert.deepEqual(pushText('en', 'C', { kind: 'rain', vars: { city: 'Vienna', from: '2026-10-01T15:00', pct: 80 } }),
    { title: '🌧 Rain in Vienna', body: 'From 15:00 (80%)' })
  assert.deepEqual(pushText('de', 'C', { kind: 'rain', vars: { city: 'Wien', from: '2026-10-01T15:00', pct: 80 } }),
    { title: '🌧 Regen in Wien', body: 'Ab 15:00 (80 %)' })
  assert.deepEqual(pushText('en', 'C', { kind: 'storm', vars: { city: 'Vienna', from: '2026-10-01T16:00', to: '2026-10-01T19:00' } }),
    { title: '⛈ Thunderstorms in Vienna', body: 'Likely 16:00–19:00' })
  assert.deepEqual(pushText('fr', 'C', { kind: 'severe', vars: { city: 'Vienne', what: 'wind', from: '2026-10-01T14:00' } }),
    { title: '⚠️ Vent fort à Vienne', body: 'À partir de 14:00' })
})

test('pushText — heat and briefing in the device unit', () => {
  assert.deepEqual(pushText('en', 'F', { kind: 'heat', vars: { city: 'Vienna', max: 34 } }),
    { title: '🌡 Hot day in Vienna', body: 'Up to 93°' })
  const brief = pushText('en', 'C', { kind: 'briefing', vars: {
    city: 'Vienna', date: '2026-10-01', min: 12.4, max: 21.2, heat: false,
    headline: { code: 'dry', night: false, peak: null }, best: '2026-10-01T14:00',
  } })
  assert.deepEqual(brief, { title: 'Vienna today', body: '12–21° · Dry for the rest of today · Best time out 14:00' })
  const hot = pushText('de', 'C', { kind: 'briefing', vars: {
    city: 'Wien', date: '2026-10-01', min: 19, max: 31, heat: true,
    headline: { code: 'dry', night: false, peak: null }, best: null,
  } })
  assert.deepEqual(hot, { title: '🌡 Wien heute', body: '19–31° · Heute bleibt es trocken' })
})

test('pushText — hike windows and the test message', () => {
  const w = { window: { from: '2026-10-02T07:00', to: '2026-10-02T11:00', hours: 4 }, next: { reason: 'storms', at: '2026-10-02T11:00' } }
  const hike = pushText('en', 'C', { kind: 'hike_evening', vars: { peak: 'Triglav', window: w, date: '2026-10-02', todayLocal: '2026-10-01', stormUnknown: false } })
  assert.equal(hike.title, '⛰ Triglav')
  assert.match(hike.body, /07:00/)
  assert.match(hike.body, /11:00/)
  assert.deepEqual(pushText('it', 'C', { kind: 'test', vars: {} }), { title: 'MetaBlend', body: 'Le notifiche funzionano 👍' })
  assert.equal(pushText('en', 'C', { kind: 'nonsense', vars: {} }), null)
})

test('pushText — every kind in every language and unit: filled, no leftover {placeholders}', () => {
  const w = { window: { from: '2026-10-02T07:00', to: '2026-10-02T11:00', hours: 4 }, next: null }
  const msgs = [
    { kind: 'rain', vars: { city: 'X', from: '2026-10-01T15:00', pct: 80 } },
    { kind: 'storm', vars: { city: 'X', from: '2026-10-01T16:00', to: '2026-10-01T19:00' } },
    ...['heavy_rain', 'heavy_snow', 'freezing_rain', 'wind'].map(what => ({ kind: 'severe', vars: { city: 'X', what, from: '2026-10-01T14:00' } })),
    { kind: 'heat', vars: { city: 'X', max: 31 } },
    { kind: 'briefing', vars: { city: 'X', date: '2026-10-01', min: 12, max: 21, heat: true, headline: { code: 'rain_window', from: '2026-10-01T13:00', to: '2026-10-01T17:00', agree: 5, total: 7, night: false, peak: null }, best: '2026-10-01T10:00' } },
    { kind: 'hike_evening', vars: { peak: 'P', window: w, date: '2026-10-02', todayLocal: '2026-10-01', stormUnknown: true } },
    { kind: 'hike_morning', vars: { peak: 'P', window: { window: null, next: { reason: 'storms', at: '2026-10-02T11:00' } }, date: '2026-10-02', todayLocal: '2026-10-02', stormUnknown: false } },
    { kind: 'test', vars: {} },
  ]
  for (const lang of ['en', 'de', 'fr', 'es', 'it']) {
    for (const unit of ['C', 'F']) {
      for (const m of msgs) {
        const r = pushText(lang, unit, m)
        assert.ok(r?.title && r?.body, `${lang} ${unit} ${m.kind}`)
        assert.doesNotMatch(`${r.title} ${r.body}`, /[{}]|undefined|NaN/, `${lang} ${unit} ${m.kind}: ${r.title} / ${r.body}`)
      }
    }
  }
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test lib/push/text.test.js`
Expected: FAIL — `Cannot find module './text.js'`.

- [ ] **Step 4: Write the implementation**

`lib/push/text.js`:

```js
// Notification texts (pure — unit tested): one message as { title, body } in
// the device's language and unit. The briefing reuses the page headlines'
// sentence builder, hike alerts the summit-window one, so the app and its
// notifications always say the same thing.
import { t } from '../i18n.js'
import { fill, tempFormatter, headlineText } from '../outlook/text.js'
import { windowText } from '../hike/text.js'

const hh = iso => iso.slice(11, 16)
const SEVERE_KEY = { heavy_rain: 'pushHeavyRain', heavy_snow: 'pushHeavySnow', freezing_rain: 'pushFreezingRain', wind: 'pushStrongWind' }

export function pushText(lang, unit, msg) {
  const tr = (key, vars = {}) => fill(t(lang, key), vars)
  const fmt = tempFormatter(unit)
  const v = msg?.vars ?? {}
  switch (msg?.kind) {
    case 'rain':
      return { title: tr('pushRainTitle', { city: v.city }), body: tr('pushRainBody', { from: hh(v.from), pct: v.pct }) }
    case 'storm':
      return { title: tr('pushStormTitle', { city: v.city }), body: tr('pushStormBody', { from: hh(v.from), to: hh(v.to) }) }
    case 'severe':
      return { title: tr('pushSevereTitle', { what: t(lang, SEVERE_KEY[v.what]), city: v.city }), body: tr('pushFromBody', { from: hh(v.from) }) }
    case 'heat':
      return { title: tr('pushHeatTitle', { city: v.city }), body: tr('pushHeatBody', { max: fmt(v.max) }) }
    case 'briefing': {
      const head = headlineText(lang, 'today', v.headline, { todayLocal: v.date, fmtTemp: fmt })?.title ?? null
      const range = `${fmt(v.min).replace('°', '')}–${fmt(v.max)}`
      const best = v.best ? `${t(lang, 'bestTimeOut')} ${hh(v.best)}` : null
      return { title: `${v.heat ? '🌡 ' : ''}${tr('pushBriefTitle', { city: v.city })}`, body: [range, head, best].filter(Boolean).join(' · ') }
    }
    case 'hike_evening':
    case 'hike_morning': {
      const w = windowText(lang, v.window, { date: v.date, todayLocal: v.todayLocal, stormUnknown: v.stormUnknown })
      return { title: tr('pushHikeTitle', { peak: v.peak }), body: [w.title, w.sub].filter(Boolean).join(' · ') }
    }
    case 'test':
      return { title: 'MetaBlend', body: t(lang, 'pushTestBody') }
    default:
      return null
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test lib/push/text.test.js`
Expected: PASS, 4 tests. If the briefing assertion fails on the headline wording, print `headlineText('en','today',{code:'dry',night:false,peak:null},{todayLocal:'2026-10-01'})` and align the expected string with the real `hlDryToday` value (the test pins this module's joining, not the headline copy).

- [ ] **Step 6: Commit**

```bash
git add lib/push/text.js lib/push/text.test.js lib/i18n.js
git commit -m "Push: notification texts in 5 languages"
```

---

### Task 4: The rules

**Files:**
- Create: `lib/push/rules.js`
- Test: `lib/push/rules.test.js`

**Interfaces:**
- Consumes: `headlineToday`, `bestTimeOutside` (`lib/outlook/headlines.js`), `addDays`, `addHours` (`lib/localtime.js`).
- Produces:
  - `RULES` (constants)
  - `localParts(nowMs, utcOffsetSec) → { date: 'YYYY-MM-DD', hour: 0–23, iso: 'YYYY-MM-DDTHH:MM' }`
  - `cityEvents(outlook, nowMs) → { city, off, local, rain: {from,pct}|null, storm: {from,to}|null, severe: [{type,from}], heat: {max,date}|null, briefing: {date,min,max,headline,best}|null }`
  - `decide(device, events, log) → [{ kind, ref, vars }]` — `device` has `alert_rain, alert_storm, alert_severe, alert_heat, briefing, briefing_hour`; `log` items `{ kind, ref, sent_at: ms }`
  - `windowChanged(prev, cur) → boolean`
  - `decideHike(plan, hike, nowMs) → { slot: 'evening'|'morning', send: boolean, window, stormUnknown, todayLocal } | null` — `plan` has `date, sent_evening, sent_morning, last_window`

- [ ] **Step 1: Write the failing test**

`lib/push/rules.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cityEvents, decide, decideHike, windowChanged, localParts } from './rules.js'

const VIE = 7200 // Vienna in summer time
const at = (hhmm, date = '2026-10-01', off = VIE) => Date.parse(`${date}T${hhmm}:00Z`) - off * 1000

// an outlook whose hourly items start at `start` (city-local), one per entry
function outlook({ start = '2026-10-01T13:00', off = VIE, hours = [], tempMax = 21, tempMin = 12, city = 'Vienna' } = {}) {
  const base = Date.parse(`${start}:00Z`)
  return {
    city, utcOffsetSec: off, nowLocal: start, sun: { sunrise: '07:00', sunset: '18:40' },
    hourly: hours.map((h, i) => ({ t: new Date(base + i * 3600e3).toISOString().slice(0, 16), temp: 15, rainPct: 0, windKmh: 10, code: 1, ...h })),
    days: [{ date: start.slice(0, 10), tempMax, tempMin }],
  }
}
const dry = n => Array.from({ length: n }, () => ({ rainPct: 5 }))
const ALL = { alert_rain: true, alert_storm: true, alert_severe: true, alert_heat: true, briefing: false, briefing_hour: 7 }

test('localParts — the city clock from its offset', () => {
  assert.deepEqual(localParts(at('13:05'), VIE), { date: '2026-10-01', hour: 13, iso: '2026-10-01T13:05' })
  assert.deepEqual(localParts(at('00:30', '2026-10-02', 36000), 36000), { date: '2026-10-02', hour: 0, iso: '2026-10-02T00:30' })
})

test('rain soon — first wet hour 30 min–2 h ahead after dry hours', () => {
  const o = outlook({ hours: [...dry(2), { rainPct: 80 }, { rainPct: 90 }] }) // 13, 14 dry · 15:00 wet
  assert.deepEqual(cityEvents(o, at('13:05')).rain, { from: '2026-10-01T15:00', pct: 80 })
  assert.deepEqual(cityEvents(o, at('14:05')).rain, { from: '2026-10-01T15:00', pct: 80 }) // lead 55 min
  assert.equal(cityEvents(o, at('14:35')).rain, null) // lead 25 min: too late to help
  assert.equal(cityEvents(outlook({ hours: [...dry(3), { rainPct: 80 }] }), at('13:05')).rain, null) // 16:00, lead 175 min
  assert.equal(cityEvents(outlook({ hours: [{ rainPct: 70 }, { rainPct: 80 }] }), at('13:05')).rain, null) // raining already
  assert.equal(cityEvents(outlook({ hours: [{ rainPct: 50 }, { rainPct: 45 }, { rainPct: 80 }] }), at('13:05')).rain, null) // no dry spell
  assert.equal(cityEvents(outlook({ hours: [...dry(2), { rainPct: 59 }] }), at('13:05')).rain, null)
})

test('thunderstorms — span of the storm hours, and they replace "rain soon"', () => {
  const o = outlook({ hours: [...dry(2), { rainPct: 80, code: 95 }, { rainPct: 85, code: 95 }, { rainPct: 40, code: 3 }] })
  const ev = cityEvents(o, at('13:05'))
  assert.deepEqual(ev.storm, { from: '2026-10-01T15:00', to: '2026-10-01T17:00' })
  assert.equal(ev.rain, null)
})

test('severe — heavy rain / snow / freezing rain codes and strong wind, one per type', () => {
  const o = outlook({ hours: [...dry(4), { code: 65 }, { code: 82 }, { windKmh: 70 }] }) // 17:00, 18:00, 19:00
  assert.deepEqual(cityEvents(o, at('13:05')).severe, [
    { type: 'heavy_rain', from: '2026-10-01T17:00' },
    { type: 'wind', from: '2026-10-01T19:00' },
  ])
})

test('forecast hours with missing values never alert or crash', () => {
  const o = outlook({ hours: [{ rainPct: null, code: null, windKmh: null }, { rainPct: null }, { rainPct: null, code: undefined }] })
  const ev = cityEvents(o, at('13:05'))
  assert.equal(ev.rain, null); assert.equal(ev.storm, null); assert.deepEqual(ev.severe, [])
})

test('decide — switches, quiet hours (severe exempt) and priority under the cap', () => {
  const o = outlook({ start: '2026-10-01T23:00', hours: [{ rainPct: 5 }, { rainPct: 5 }, { rainPct: 90, code: 65 }] })
  const night = decide(ALL, cityEvents(o, at('23:05')), [])
  assert.deepEqual(night.map(m => m.kind), ['severe']) // rain suppressed at night, severe gets through
  assert.deepEqual(decide({ ...ALL, alert_severe: false }, cityEvents(o, at('23:05')), []), [])

  const day = outlook({ hours: [...dry(2), { rainPct: 80 }, { rainPct: 80 }, { code: 65 }], tempMax: 31 })
  const two = [{ kind: 'rain', ref: 'x', sent_at: at('08:00') }, { kind: 'heat', ref: 'y', sent_at: at('08:00') }]
  assert.deepEqual(decide(ALL, cityEvents(day, at('13:05')), two).map(m => m.kind), ['severe']) // one slot left
})

test('decide — the cap counts the city-local day, not the UTC one', () => {
  const o = outlook({ start: '2026-10-01T07:00', hours: [...dry(2), { rainPct: 80 }] })
  const lateYesterday = [1, 2, 3].map(i => ({ kind: 'storm', ref: `r${i}`, sent_at: at('23:30', '2026-09-30') }))
  assert.deepEqual(decide(ALL, cityEvents(o, at('07:05')), lateYesterday).map(m => m.kind), ['rain'])
})

test('decide — no second alert for the same rain spell or storm (late / double runs)', () => {
  const o = outlook({ hours: [...dry(2), { rainPct: 80 }] })
  const ev = cityEvents(o, at('13:05'))
  const sent = decide(ALL, ev, [])
  assert.deepEqual(sent.map(m => [m.kind, m.ref]), [['rain', '2026-10-01T15:00']])
  const log = sent.map(m => ({ ...m, sent_at: at('13:05') }))
  assert.deepEqual(decide(ALL, ev, log), []) // same run again
  const later = cityEvents(outlook({ start: '2026-10-01T14:00', hours: [{ rainPct: 5 }, { rainPct: 5 }, { rainPct: 5 }, { rainPct: 80 }] }), at('15:05'))
  assert.deepEqual(decide(ALL, later, log), []) // new onset 17:00 is < 3 h from 15:00
})

test('decide — heat on its own before noon, or folded into the briefing', () => {
  const o = outlook({ start: '2026-10-01T07:00', hours: dry(10), tempMax: 31 })
  assert.deepEqual(decide(ALL, cityEvents(o, at('07:05')), []).map(m => m.kind), ['heat'])
  assert.deepEqual(decide(ALL, cityEvents(o, at('12:05')), []), []) // too late in the day
  const withBrief = decide({ ...ALL, briefing: true, briefing_hour: 7 }, cityEvents(o, at('07:05')), [])
  assert.deepEqual(withBrief.map(m => m.kind), ['briefing'])
  assert.equal(withBrief[0].vars.heat, true)
  assert.equal(withBrief[0].vars.city, 'Vienna')
})

test('decide — the briefing at its hour, up to 2 h late, once a day, in any time zone', () => {
  const dev = { ...ALL, alert_heat: false, briefing: true, briefing_hour: 7 }
  for (const off of [VIE, 36000, -14400]) {
    const o = outlook({ start: '2026-10-01T07:00', off, hours: dry(12) })
    assert.deepEqual(decide(dev, cityEvents(o, at('07:05', '2026-10-01', off)), []).map(m => m.kind), ['briefing'])
    assert.deepEqual(decide(dev, cityEvents(o, at('09:05', '2026-10-01', off)), []).map(m => m.kind), ['briefing'])
    assert.deepEqual(decide(dev, cityEvents(o, at('10:05', '2026-10-01', off)), []), [])
    assert.deepEqual(decide(dev, cityEvents(o, at('06:05', '2026-10-01', off)), []), [])
    const log = [{ kind: 'briefing', ref: '2026-10-01', sent_at: at('07:05', '2026-10-01', off) }]
    assert.deepEqual(decide(dev, cityEvents(o, at('08:05', '2026-10-01', off)), log), [])
  }
})

test('windowChanged — ≥ 1 h either end, or the window appearing / disappearing', () => {
  const w = (from, to) => ({ window: { from: `2026-10-02T${from}`, to: `2026-10-02T${to}` } })
  assert.equal(windowChanged(w('07:00', '11:00'), w('07:30', '11:30')), false)
  assert.equal(windowChanged(w('07:00', '11:00'), w('08:00', '11:00')), true)
  assert.equal(windowChanged(w('07:00', '11:00'), { window: null }), true)
  assert.equal(windowChanged({ window: null }, { window: null }), false)
})

test('decideHike — evening before, then a morning update only if it changed', () => {
  const win = { window: { from: '2026-10-02T07:00', to: '2026-10-02T11:00', hours: 4 }, next: null }
  const hike = { utcOffsetSec: VIE, nowLocal: '2026-10-01T18:00', notes: [], windows: { today: null, tomorrow: win } }
  const plan = { date: '2026-10-02', sent_evening: false, sent_morning: false, last_window: null }
  const ev = decideHike(plan, hike, at('18:05'))
  assert.equal(ev.slot, 'evening'); assert.equal(ev.send, true); assert.equal(ev.window, win)
  assert.equal(decideHike(plan, hike, at('17:05')), null)
  assert.equal(decideHike(plan, hike, at('21:05')), null) // slot is 3 h old

  const morningHike = { ...hike, nowLocal: '2026-10-02T06:00', windows: { today: win, tomorrow: null } }
  const sentPlan = { ...plan, sent_evening: true, last_window: win }
  const same = decideHike(sentPlan, morningHike, at('06:05', '2026-10-02'))
  assert.equal(same.slot, 'morning'); assert.equal(same.send, false)
  const moved = { ...morningHike, windows: { today: { window: { from: '2026-10-02T09:00', to: '2026-10-02T12:00' } }, tomorrow: null } }
  assert.equal(decideHike(sentPlan, moved, at('06:05', '2026-10-02')).send, true)
  assert.equal(decideHike(plan, morningHike, at('06:05', '2026-10-02')), null) // no evening sent → no morning
  assert.equal(decideHike(plan, null, at('18:05')), null)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/push/rules.test.js`
Expected: FAIL — `Cannot find module './rules.js'`.

- [ ] **Step 3: Write the implementation**

`lib/push/rules.js`:

```js
// Push rules (pure — unit tested): what a phone gets told, and when.
// cityEvents() reads one city's outlook once (device-independent);
// decide() applies one phone's switches, quiet hours, the daily cap and the
// send log; decideHike() handles a planned hike's evening and morning slots.
// All times are the city's own clock, from the payload's utcOffsetSec.
import { headlineToday, bestTimeOutside } from '../outlook/headlines.js'
import { addDays, addHours } from '../localtime.js'

export const RULES = {
  rainPct: 60, dryPct: 40, dryHours: 2, rainLead: [30, 120], rainGapH: 3,
  stormLead: [60, 240], severeLead: [60, 360], spellGapH: 6, severeWindKmh: 60,
  heatC: 30, heatHours: [7, 12],
  quietFrom: 22, quietTo: 7, cap: 3, briefingLateH: 2,
}
const SEVERE_CODE = { 65: 'heavy_rain', 82: 'heavy_rain', 67: 'freezing_rain', 75: 'heavy_snow', 86: 'heavy_snow' }
const PRIORITY = { severe: 0, storm: 1, rain: 2, heat: 3 }
const WEATHER = new Set(['rain', 'storm', 'severe', 'heat'])

const isStorm = c => typeof c === 'number' && c >= 95 && c <= 99
const utcOf = (localIso, off) => Date.parse(`${localIso}:00Z`) - off * 1000
const gapH = (a, b) => Math.abs(Date.parse(`${a}:00Z`) - Date.parse(`${b}:00Z`)) / 3600e3
const within = (m, [lo, hi]) => m >= lo && m <= hi

export function localParts(now, off) {
  const iso = new Date(now + off * 1000).toISOString()
  return { date: iso.slice(0, 10), hour: Number(iso.slice(11, 13)), iso: iso.slice(0, 16) }
}

export function cityEvents(outlook, now) {
  const off = outlook?.utcOffsetSec ?? 0
  const local = localParts(now, off)
  // the current hour onward — a cached outlook can start an hour or two back
  const hours = (outlook?.hourly ?? []).filter(h => utcOf(h.t, off) + 3600e3 > now)
  const lead = h => (utcOf(h.t, off) - now) / 60000
  const ev = { city: outlook?.city ?? null, off, local, rain: null, storm: null, severe: [], heat: null, briefing: null }

  const si = hours.findIndex(h => isStorm(h.code) && within(lead(h), RULES.stormLead))
  if (si >= 0) {
    let j = si
    while (j + 1 < hours.length && isStorm(hours[j + 1].code)) j++
    ev.storm = { from: hours[si].t, to: addHours(hours[j].t, 1) }
  }

  const ri = hours.findIndex(h => typeof h.rainPct === 'number' && h.rainPct >= RULES.rainPct)
  if (ri >= 0 && within(lead(hours[ri]), RULES.rainLead)) {
    const before = hours.slice(Math.max(0, ri - RULES.dryHours), ri)
    if (before.length && before.every(h => typeof h.rainPct === 'number' && h.rainPct < RULES.dryPct)) {
      ev.rain = { from: hours[ri].t, pct: hours[ri].rainPct }
    }
  }
  // the storm message covers rain that starts before or during it
  if (ev.rain && ev.storm && ev.rain.from < ev.storm.to) ev.rain = null

  for (const h of hours) {
    if (!within(lead(h), RULES.severeLead)) continue
    const type = SEVERE_CODE[h.code] ?? (typeof h.windKmh === 'number' && h.windKmh >= RULES.severeWindKmh ? 'wind' : null)
    if (type && !ev.severe.some(s => s.type === type)) ev.severe.push({ type, from: h.t })
  }

  const today = outlook?.days?.find(d => d.date === local.date)
  if (typeof today?.tempMax === 'number' && today.tempMax >= RULES.heatC) ev.heat = { max: today.tempMax, date: local.date }
  if (today) {
    const todays = hours.filter(h => h.t.startsWith(local.date))
    ev.briefing = {
      date: local.date, min: today.tempMin, max: today.tempMax,
      headline: headlineToday(hours, { todayLocal: local.date }),
      best: bestTimeOutside(todays, outlook.sun)?.t ?? null,
    }
  }
  return ev
}

export function decide(device, ev, log = []) {
  const { local, off } = ev
  const seen = (kind, match) => log.some(e => e.kind === kind && match(e))
  const quiet = local.hour >= RULES.quietFrom || local.hour < RULES.quietTo
  const want = []

  if (device.alert_severe) {
    for (const s of ev.severe) {
      const dup = seen('severe', e => e.ref.startsWith(`${s.type}@`) && gapH(e.ref.split('@')[1], s.from) < RULES.spellGapH)
      if (!dup) want.push({ kind: 'severe', ref: `${s.type}@${s.from}`, vars: { city: ev.city, what: s.type, from: s.from } })
    }
  }
  if (device.alert_storm && ev.storm && !quiet && !seen('storm', e => gapH(e.ref, ev.storm.from) < RULES.spellGapH)) {
    want.push({ kind: 'storm', ref: ev.storm.from, vars: { city: ev.city, ...ev.storm } })
  }
  if (device.alert_rain && ev.rain && !quiet && !seen('rain', e => gapH(e.ref, ev.rain.from) < RULES.rainGapH)) {
    want.push({ kind: 'rain', ref: ev.rain.from, vars: { city: ev.city, ...ev.rain } })
  }
  if (device.alert_heat && ev.heat && !device.briefing && within(local.hour, [RULES.heatHours[0], RULES.heatHours[1] - 1]) && !seen('heat', e => e.ref === local.date)) {
    want.push({ kind: 'heat', ref: local.date, vars: { city: ev.city, max: ev.heat.max } })
  }

  const usedToday = log.filter(e => WEATHER.has(e.kind) && localParts(e.sent_at, off).date === local.date).length
  want.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])
  const out = want.slice(0, Math.max(0, RULES.cap - usedToday))

  const h = device.briefing_hour
  if (device.briefing && ev.briefing && within(local.hour, [h, h + RULES.briefingLateH]) && !seen('briefing', e => e.ref === local.date)) {
    out.push({ kind: 'briefing', ref: local.date, vars: { city: ev.city, ...ev.briefing, heat: !!(device.alert_heat && ev.heat) } })
  }
  return out
}

export function windowChanged(prev, cur) {
  const a = prev?.window ?? null, b = cur?.window ?? null
  if (!a || !b) return !a !== !b
  return gapH(a.from, b.from) >= 1 || gapH(a.to, b.to) >= 1
}

export function decideHike(plan, hike, now) {
  if (!hike) return null
  const local = localParts(now, hike.utcOffsetSec ?? 0)
  const hikeToday = hike.nowLocal?.slice(0, 10) ?? local.date
  const w = plan.date === hikeToday ? hike.windows?.today
    : plan.date === addDays(hikeToday, 1) ? hike.windows?.tomorrow : undefined
  if (w === undefined) return null
  const base = { window: w, stormUnknown: !!hike.notes?.includes('no_storm_data'), todayLocal: local.date }
  if (!plan.sent_evening && plan.date === addDays(local.date, 1) && within(local.hour, [18, 20])) {
    return { slot: 'evening', send: true, ...base }
  }
  if (plan.sent_evening && !plan.sent_morning && plan.date === local.date && within(local.hour, [6, 8])) {
    return { slot: 'morning', send: windowChanged(plan.last_window, w), ...base }
  }
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/push/rules.test.js`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/push/rules.js lib/push/rules.test.js
git commit -m "Push: alert, briefing and hike rules"
```

---

### Task 5: Senders (FCM, APNs)

**Files:**
- Create: `lib/push/jwt.js`, `lib/push/fcm.js`, `lib/push/apns.js`, `lib/push/send.js`
- Test: `lib/push/senders.test.js`

**Interfaces:**
- Produces:
  - `signJwt(alg: 'RS256'|'ES256', header, payload, pem) → string`
  - `createFcm({ serviceAccount, fetchImpl, now }) → { send({ token, title, body, url, channel, collapse }) → Promise<{ ok, gone?, error? }> }`
  - `createApns({ keyPem, keyId, teamId, topic, request, now }) → { send({ token, env, title, body, url, collapse }) → Promise<{ ok, env?, gone?, error? }> }`
  - `http2Request({ host, path, headers, body }) → Promise<{ status, body }>`
  - `createSender({ fcm, apns }) → { send(device, { title, body, url, kind }) → Promise<{ ok, env?, gone?, error? }> }`
  - `senderFromEnv(env = process.env) → sender` (missing secrets → that platform returns `{ ok: false, error: '… not configured' }`)

- [ ] **Step 1: Write the failing test**

`lib/push/senders.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, verify } from 'node:crypto'
import { signJwt } from './jwt.js'
import { createFcm } from './fcm.js'
import { createApns } from './apns.js'
import { createSender } from './send.js'

const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 })
const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pem = k => k.export({ type: 'pkcs8', format: 'pem' })
const part = (jwt, i) => JSON.parse(Buffer.from(jwt.split('.')[i], 'base64url'))

test('signJwt — RS256 and ES256 (raw r||s) signatures verify', () => {
  for (const [alg, pair, opts] of [['RS256', rsa, {}], ['ES256', ec, { dsaEncoding: 'ieee-p1363' }]]) {
    const jwt = signJwt(alg, { alg, kid: 'k1' }, { iss: 'me', iat: 1 }, pem(pair.privateKey))
    const [h, p, s] = jwt.split('.')
    assert.equal(part(jwt, 0).alg, alg)
    assert.equal(verify('sha256', Buffer.from(`${h}.${p}`), { key: pair.publicKey, ...opts }, Buffer.from(s, 'base64url')), true)
  }
})

function fakeFetch(responses) {
  const calls = []
  const f = async (url, init) => { calls.push({ url, init }); const r = responses.shift(); return { ok: r.status < 300, status: r.status, json: async () => r.json } }
  f.calls = calls
  return f
}
const SA = { project_id: 'mb', client_email: 'push@mb.iam', private_key: pem(rsa.privateKey), token_uri: 'https://oauth2.googleapis.com/token' }

test('fcm — one OAuth token for many sends, channel and link in the message', async () => {
  const f = fakeFetch([{ status: 200, json: { access_token: 'AT', expires_in: 3600 } }, { status: 200, json: { name: 'm1' } }, { status: 200, json: { name: 'm2' } }])
  const fcm = createFcm({ serviceAccount: SA, fetchImpl: f, now: () => 1_700_000_000_000 })
  assert.deepEqual(await fcm.send({ token: 'T1', title: 'A', body: 'B', url: '/?city=Vienna', channel: 'alerts', collapse: 'rain' }), { ok: true })
  await fcm.send({ token: 'T2', title: 'A', body: 'B', url: '/', channel: 'briefing', collapse: 'briefing' })
  assert.equal(f.calls.length, 3) // token fetched once
  const msg = JSON.parse(f.calls[1].init.body).message
  assert.equal(f.calls[1].url, 'https://fcm.googleapis.com/v1/projects/mb/messages:send')
  assert.equal(f.calls[1].init.headers.Authorization, 'Bearer AT')
  assert.deepEqual(msg.notification, { title: 'A', body: 'B' })
  assert.deepEqual(msg.data, { url: '/?city=Vienna' })
  assert.equal(msg.android.notification.channel_id, 'alerts')
  assert.equal(msg.android.priority, 'high')
})

test('fcm — an unregistered token is gone, other errors are not', async () => {
  const gone = fakeFetch([{ status: 200, json: { access_token: 'AT', expires_in: 3600 } }, { status: 404, json: { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } } }])
  assert.equal((await createFcm({ serviceAccount: SA, fetchImpl: gone }).send({ token: 'T', title: 'A', body: 'B', url: '/', channel: 'alerts' })).gone, true)
  const busy = fakeFetch([{ status: 200, json: { access_token: 'AT', expires_in: 3600 } }, { status: 503, json: { error: { status: 'UNAVAILABLE' } } }])
  const r = await createFcm({ serviceAccount: SA, fetchImpl: busy }).send({ token: 'T', title: 'A', body: 'B', url: '/', channel: 'alerts' })
  assert.equal(r.ok, false); assert.equal(r.gone, false)
})

function fakeRequest(responses) {
  const calls = []
  const r = async req => { calls.push(req); return responses.shift() }
  r.calls = calls
  return r
}

test('apns — production first, sandbox when production rejects the token, 410 is gone', async () => {
  const req = fakeRequest([{ status: 400, body: '{"reason":"BadDeviceToken"}' }, { status: 200, body: '' }])
  const apns = createApns({ keyPem: pem(ec.privateKey), keyId: 'KID', teamId: 'TEAM', request: req, now: () => 1_700_000_000_000 })
  assert.deepEqual(await apns.send({ token: 'abc', env: null, title: 'A', body: 'B', url: '/', collapse: 'rain' }), { ok: true, env: 'sandbox' })
  assert.deepEqual(req.calls.map(c => c.host), ['api.push.apple.com', 'api.sandbox.push.apple.com'])
  assert.equal(req.calls[0].path, '/3/device/abc')
  assert.equal(req.calls[0].headers['apns-topic'], 'app.metablend')
  assert.equal(part(req.calls[0].headers.authorization.replace('bearer ', ''), 0).kid, 'KID')
  assert.deepEqual(JSON.parse(req.calls[0].body).aps.alert, { title: 'A', body: 'B' })

  const gone = fakeRequest([{ status: 410, body: '{"reason":"Unregistered"}' }])
  assert.equal((await createApns({ keyPem: pem(ec.privateKey), keyId: 'K', teamId: 'T', request: gone }).send({ token: 'x', env: 'prod', title: 'A', body: 'B', url: '/' })).gone, true)
})

test('sender — by platform, Android channel by kind, missing config fails softly', async () => {
  const seen = []
  const s = createSender({ fcm: { send: async m => { seen.push(m); return { ok: true } } }, apns: null })
  await s.send({ platform: 'android', token: 'T' }, { title: 'A', body: 'B', url: '/', kind: 'briefing' })
  await s.send({ platform: 'android', token: 'T' }, { title: 'A', body: 'B', url: '/', kind: 'hike_evening' })
  await s.send({ platform: 'android', token: 'T' }, { title: 'A', body: 'B', url: '/', kind: 'severe' })
  assert.deepEqual(seen.map(m => m.channel), ['briefing', 'hikes', 'alerts'])
  assert.deepEqual(await s.send({ platform: 'ios', token: 'T', apns_env: null }, { title: 'A', body: 'B', url: '/', kind: 'rain' }), { ok: false, error: 'APNs not configured' })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/push/senders.test.js`
Expected: FAIL — `Cannot find module './jwt.js'`.

- [ ] **Step 3: Write the implementation**

`lib/push/jwt.js`:

```js
// Compact JWTs signed with node:crypto — no SDK. RS256 for Google's service
// account, ES256 (raw r||s, as JOSE wants it) for Apple's push key.
import { createSign } from 'node:crypto'

export const b64url = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url')

export function signJwt(alg, header, payload, pem) {
  const data = `${b64url(header)}.${b64url(payload)}`
  const signer = createSign('SHA256').update(data)
  const sig = alg === 'ES256' ? signer.sign({ key: pem, dsaEncoding: 'ieee-p1363' }) : signer.sign(pem)
  return `${data}.${sig.toString('base64url')}`
}
```

`lib/push/fcm.js`:

```js
// Android pushes via FCM HTTP v1. The OAuth access token comes from a
// self-signed service-account JWT and is reused until 5 min before it expires.
import { signJwt } from './jwt.js'

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'

export function createFcm({ serviceAccount, fetchImpl = fetch, now = () => Date.now() }) {
  const sa = serviceAccount
  let cached = null
  async function accessToken() {
    if (cached && cached.exp - 300e3 > now()) return cached.token
    const iat = Math.floor(now() / 1000)
    const assertion = signJwt('RS256', { alg: 'RS256', typ: 'JWT' }, { iss: sa.client_email, scope: SCOPE, aud: sa.token_uri, iat, exp: iat + 3600 }, sa.private_key)
    const r = await fetchImpl(sa.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    })
    const j = await r.json()
    if (!r.ok || !j.access_token) throw new Error(`FCM auth failed (${r.status})`)
    cached = { token: j.access_token, exp: now() + (j.expires_in ?? 3600) * 1000 }
    return cached.token
  }
  return {
    async send({ token, title, body, url, channel = 'alerts', collapse }) {
      try {
        const r = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: {
            token, notification: { title, body }, data: { url: url ?? '/' },
            android: { priority: channel === 'alerts' ? 'high' : 'normal', ...(collapse ? { collapse_key: collapse } : {}), notification: { channel_id: channel } },
          } }),
        })
        if (r.ok) return { ok: true }
        const j = await r.json().catch(() => ({}))
        const codes = (j.error?.details ?? []).map(d => d.errorCode)
        const gone = r.status === 404 || codes.includes('UNREGISTERED') || (r.status === 400 && /registration token/i.test(j.error?.message ?? ''))
        return { ok: false, gone, error: `FCM ${r.status} ${codes.join(',') || j.error?.status || ''}`.trim() }
      } catch (e) {
        return { ok: false, gone: false, error: e.message }
      }
    },
  }
}
```

`lib/push/apns.js`:

```js
// iOS pushes straight to APNs over HTTP/2 with the ES256 provider token
// (reused for 50 min; Apple wants it renewed within the hour). Builds from
// Xcode register with the sandbox, App Store builds with production: an
// unknown device tries production first and falls back once.
import { connect } from 'node:http2'
import { signJwt } from './jwt.js'

const HOST = { prod: 'api.push.apple.com', sandbox: 'api.sandbox.push.apple.com' }

export function http2Request({ host, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const client = connect(`https://${host}`)
    client.on('error', reject)
    const req = client.request({ ':method': 'POST', ':path': path, ...headers })
    let status = 0, data = ''
    req.setEncoding('utf8')
    req.on('response', h => { status = h[':status'] })
    req.on('data', c => { data += c })
    req.on('end', () => { client.close(); resolve({ status, body: data }) })
    req.on('error', e => { client.close(); reject(e) })
    req.end(body)
  })
}

export function createApns({ keyPem, keyId, teamId, topic = 'app.metablend', request = http2Request, now = () => Date.now() }) {
  let cached = null
  const token = () => {
    if (cached && now() - cached.at < 50 * 60e3) return cached.jwt
    cached = { at: now(), jwt: signJwt('ES256', { alg: 'ES256', kid: keyId }, { iss: teamId, iat: Math.floor(now() / 1000) }, keyPem) }
    return cached.jwt
  }
  async function attempt(env, { token: device, title, body, url, collapse }) {
    const res = await request({
      host: HOST[env], path: `/3/device/${device}`,
      headers: { authorization: `bearer ${token()}`, 'apns-topic': topic, 'apns-push-type': 'alert', 'apns-priority': '10', ...(collapse ? { 'apns-collapse-id': collapse } : {}) },
      body: JSON.stringify({ aps: { alert: { title, body }, sound: 'default' }, url: url ?? '/' }),
    })
    let reason = ''
    try { reason = JSON.parse(res.body || '{}').reason ?? '' } catch { /* empty body on success */ }
    return { status: res.status, reason }
  }
  return {
    async send(m) {
      try {
        const first = m.env === 'sandbox' ? 'sandbox' : 'prod'
        let r = await attempt(first, m)
        if (r.status === 200) return { ok: true, env: first }
        if (r.status === 400 && r.reason === 'BadDeviceToken' && !m.env) {
          r = await attempt('sandbox', m)
          if (r.status === 200) return { ok: true, env: 'sandbox' }
        }
        const gone = r.status === 410 || r.reason === 'BadDeviceToken' || r.reason === 'Unregistered'
        return { ok: false, gone, error: `APNs ${r.status} ${r.reason}`.trim() }
      } catch (e) {
        return { ok: false, gone: false, error: e.message }
      }
    },
  }
}
```

`lib/push/send.js`:

```js
// One entry point for the dispatcher and the test route: route a message to
// FCM or APNs by the device's platform; Android gets the channel by kind so
// people can mute alerts, briefings or hikes separately.
import { createFcm } from './fcm.js'
import { createApns } from './apns.js'

const channelFor = kind => (kind === 'briefing' ? 'briefing' : kind?.startsWith('hike') || kind === 'test' ? 'hikes' : 'alerts')

export function createSender({ fcm, apns }) {
  return {
    async send(device, { title, body, url, kind }) {
      if (device.platform === 'android') {
        if (!fcm) return { ok: false, error: 'FCM not configured' }
        return fcm.send({ token: device.token, title, body, url, channel: channelFor(kind), collapse: kind })
      }
      if (!apns) return { ok: false, error: 'APNs not configured' }
      return apns.send({ token: device.token, env: device.apns_env ?? null, title, body, url, collapse: kind })
    },
  }
}

// Vercel env holds the secrets (the owner sets them); a .p8 pasted into one
// line keeps literal "\n" — turn those back into line breaks.
export function senderFromEnv(env = process.env) {
  let fcm = null, apns = null
  try { if (env.FIREBASE_SERVICE_ACCOUNT) fcm = createFcm({ serviceAccount: JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) }) } catch { fcm = null }
  if (env.APNS_KEY && env.APNS_KEY_ID && env.APNS_TEAM_ID) {
    apns = createApns({ keyPem: env.APNS_KEY.replace(/\\n/g, '\n'), keyId: env.APNS_KEY_ID, teamId: env.APNS_TEAM_ID })
  }
  return createSender({ fcm, apns })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/push/senders.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/push/jwt.js lib/push/fcm.js lib/push/apns.js lib/push/send.js lib/push/senders.test.js
git commit -m "Push: FCM and APNs senders without SDKs"
```

---

### Task 6: Store and device API

**Files:**
- Create: `lib/push/store.js`, `app/api/push/register/route.js`, `app/api/push/settings/route.js`, `app/api/push/plans/route.js`, `app/api/push/test/route.js`

**Interfaces:**
- Consumes: `hashDeviceKey`, `parseRegister`, `parseSettings`, `parsePlan` (Task 2); `pushText` (Task 3); `senderFromEnv` (Task 5); `supabase` (`lib/supabase.js`); `createRateLimiter` (`lib/ratelimit.js`); `clientIp` (`lib/auth.js`); `withErrorLog` (`lib/log.js`).
- Produces (used by Task 7):
  - `authDevice(request) → Promise<device | null>` (null: no/bad key or unknown device)
  - `registerDevice(keyHash, { token, platform, lang, unit }) → Promise<device>`
  - `updateSettings(deviceId, patch)`, `listPlans(deviceId)`, `addPlan(deviceId, plan)`, `deletePlan(deviceId, id)`
  - `logSent(deviceId, kind, ref, nowMs)`, `deleteDevice(id)`, `setApnsEnv(id, env)`, `updatePlan(id, patch)`
  - `devicesForDispatch(extraIds: string[]) → device[]`, `openPlans(nowMs) → plan[]`, `recentLog(ids, sinceMs) → [{ device_id, kind, ref, sent_at: ms }]`
  - `SETTINGS_COLS` (the settings columns returned to the app)

- [ ] **Step 1: Write the store**

`lib/push/store.js`:

```js
// Supabase access for push (server only). Thin on purpose: the decisions
// live in rules.js / validate.js, which are unit tested; this is plumbing.
import { supabase } from '../supabase.js'
import { hashDeviceKey } from './validate.js'
import { addDays } from '../localtime.js'

export const SETTINGS_COLS = 'id, home_name, alert_rain, alert_storm, alert_severe, alert_heat, briefing, briefing_hour, lang, unit'
const DEVICE_COLS = `${SETTINGS_COLS}, token, platform, apns_env`

export async function authDevice(request) {
  const hash = hashDeviceKey(request.headers.get('x-device-key'))
  if (!hash) return null
  const { data } = await supabase.from('push_devices').select(DEVICE_COLS).eq('key_hash', hash).maybeSingle()
  return data ?? null
}

// A token belongs to one phone: a reinstall (new key, same token) moves it.
export async function registerDevice(keyHash, { token, platform, lang, unit }) {
  await supabase.from('push_devices').delete().eq('token', token).neq('key_hash', keyHash)
  const { data, error } = await supabase.from('push_devices')
    .upsert({ key_hash: keyHash, token, platform, lang, unit, last_seen: new Date().toISOString() }, { onConflict: 'key_hash' })
    .select(SETTINGS_COLS).single()
  if (error) throw error
  return data
}

export async function updateSettings(id, patch) {
  const { data, error } = await supabase.from('push_devices').update(patch).eq('id', id).select(SETTINGS_COLS).single()
  if (error) throw error
  return data
}

export async function listPlans(deviceId) {
  const since = addDays(new Date().toISOString().slice(0, 10), -1)
  const { data } = await supabase.from('hike_plans').select('id, name, lat, lon, elev, date')
    .eq('device_id', deviceId).gte('date', since).order('date')
  return data ?? []
}

export async function addPlan(deviceId, plan) {
  const { count } = await supabase.from('hike_plans').select('id', { count: 'exact', head: true })
    .eq('device_id', deviceId).gte('date', addDays(new Date().toISOString().slice(0, 10), -1))
  if ((count ?? 0) >= 10) return { error: 'At most 10 planned hikes' }
  const { data, error } = await supabase.from('hike_plans').insert({ device_id: deviceId, ...plan }).select('id, name, lat, lon, elev, date').single()
  if (error) throw error
  return { plan: data }
}

export async function deletePlan(deviceId, id) {
  await supabase.from('hike_plans').delete().eq('id', id).eq('device_id', deviceId)
}

export async function logSent(deviceId, kind, ref, now = Date.now()) {
  await supabase.from('push_log').insert({ device_id: deviceId, kind, ref, sent_at: new Date(now).toISOString() })
}

export const deleteDevice = id => supabase.from('push_devices').delete().eq('id', id)
export const setApnsEnv = (id, env) => supabase.from('push_devices').update({ apns_env: env }).eq('id', id)
export const updatePlan = (id, patch) => supabase.from('hike_plans').update(patch).eq('id', id)

export async function devicesForDispatch(extraIds = []) {
  const any = 'alert_rain.eq.true,alert_storm.eq.true,alert_severe.eq.true,alert_heat.eq.true,briefing.eq.true'
  const { data } = await supabase.from('push_devices').select(DEVICE_COLS)
    .or(extraIds.length ? `${any},id.in.(${extraIds.join(',')})` : any)
  return data ?? []
}

export async function openPlans(now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10)
  const { data } = await supabase.from('hike_plans').select('id, device_id, name, lat, lon, elev, date, sent_evening, sent_morning, last_window')
    .gte('date', addDays(today, -1)).lte('date', addDays(today, 2)).eq('sent_morning', false)
  return data ?? []
}

export async function recentLog(ids, since) {
  if (!ids.length) return []
  const { data } = await supabase.from('push_log').select('device_id, kind, ref, sent_at')
    .in('device_id', ids).gte('sent_at', new Date(since).toISOString())
  return (data ?? []).map(e => ({ ...e, sent_at: Date.parse(e.sent_at) }))
}
```

- [ ] **Step 2: Write the routes**

`app/api/push/register/route.js`:

```js
import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { hashDeviceKey, parseRegister } from '@/lib/push/validate'
import { registerDevice } from '@/lib/push/store'

// Called at every app start with the current push token.
const limiter = createRateLimiter({ max: 20, windowMs: 60e3 })

export const POST = withErrorLog('push.register', async (request) => {
  if (limiter.limited(clientIp(request))) return Response.json({ error: 'Too many requests' }, { status: 429 })
  const keyHash = hashDeviceKey(request.headers.get('x-device-key'))
  if (!keyHash) return Response.json({ error: 'Missing device key' }, { status: 401 })
  const parsed = parseRegister(await request.json().catch(() => null))
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  return Response.json({ settings: await registerDevice(keyHash, parsed.value) })
})
```

`app/api/push/settings/route.js`:

```js
import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { parseSettings } from '@/lib/push/validate'
import { authDevice, updateSettings, listPlans, SETTINGS_COLS } from '@/lib/push/store'

const limiter = createRateLimiter({ max: 60, windowMs: 60e3 })
const pick = d => Object.fromEntries(SETTINGS_COLS.split(', ').filter(k => k !== 'id').map(k => [k, d[k]]))

export const GET = withErrorLog('push.settings', async (request) => {
  const device = await authDevice(request)
  if (!device) return Response.json({ registered: false }, { status: 404 })
  return Response.json({ registered: true, settings: pick(device), plans: await listPlans(device.id) })
})

export const PUT = withErrorLog('push.settings', async (request) => {
  if (limiter.limited(clientIp(request))) return Response.json({ error: 'Too many requests' }, { status: 429 })
  const device = await authDevice(request)
  if (!device) return Response.json({ error: 'Unknown device' }, { status: 404 })
  const parsed = parseSettings(await request.json().catch(() => null))
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  return Response.json({ settings: pick(await updateSettings(device.id, parsed.value)) })
})
```

`app/api/push/plans/route.js`:

```js
import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { parsePlan } from '@/lib/push/validate'
import { authDevice, addPlan, deletePlan, listPlans } from '@/lib/push/store'

const limiter = createRateLimiter({ max: 30, windowMs: 60e3 })

export const GET = withErrorLog('push.plans', async (request) => {
  const device = await authDevice(request)
  if (!device) return Response.json({ error: 'Unknown device' }, { status: 404 })
  return Response.json({ plans: await listPlans(device.id) })
})

export const POST = withErrorLog('push.plans', async (request) => {
  if (limiter.limited(clientIp(request))) return Response.json({ error: 'Too many requests' }, { status: 429 })
  const device = await authDevice(request)
  if (!device) return Response.json({ error: 'Unknown device' }, { status: 404 })
  const parsed = parsePlan(await request.json().catch(() => null), new Date().toISOString().slice(0, 10))
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const r = await addPlan(device.id, parsed.value)
  if (r.error) return Response.json({ error: r.error }, { status: 409 })
  return Response.json({ plan: r.plan })
})

export const DELETE = withErrorLog('push.plans', async (request) => {
  const device = await authDevice(request)
  if (!device) return Response.json({ error: 'Unknown device' }, { status: 404 })
  const id = new URL(request.url).searchParams.get('id') ?? ''
  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: 'Invalid id' }, { status: 400 })
  await deletePlan(device.id, id)
  return Response.json({ ok: true })
})
```

`app/api/push/test/route.js`:

```js
import { withErrorLog } from '@/lib/log'
import { authDevice, logSent, deleteDevice } from '@/lib/push/store'
import { pushText } from '@/lib/push/text'
import { senderFromEnv } from '@/lib/push/send'

// "Send a test notification" in More — once a minute per phone.
const last = new Map()

export const POST = withErrorLog('push.test', async (request) => {
  const device = await authDevice(request)
  if (!device) return Response.json({ error: 'Unknown device' }, { status: 404 })
  if (Date.now() - (last.get(device.id) ?? 0) < 60e3) return Response.json({ error: 'Wait a minute between tests' }, { status: 429 })
  last.set(device.id, Date.now())
  const r = await senderFromEnv().send(device, { ...pushText(device.lang, device.unit, { kind: 'test', vars: {} }), url: '/more', kind: 'test' })
  if (r.gone) { await deleteDevice(device.id); return Response.json({ error: 'This phone is no longer registered' }, { status: 410 }) }
  if (!r.ok) return Response.json({ error: r.error }, { status: 502 })
  await logSent(device.id, 'test', 'test')
  return Response.json({ ok: true })
})
```

- [ ] **Step 3: Lint, build, smoke-test locally**

Run: `npx eslint app lib && npm test && npm run build`
Expected: no lint output, all tests pass, `✓ Compiled successfully`, routes `/api/push/register`, `/api/push/settings`, `/api/push/plans`, `/api/push/test` listed.

Then with `npm start -- -p 3000` running (this hits the production database — the device rows are removed at the end):

```bash
K=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")
curl -s -X POST localhost:3000/api/push/register -H "x-device-key: $K" -H 'content-type: application/json' -d '{"token":"plan-smoke-token-0123456789","platform":"android","lang":"de"}'
curl -s -X PUT localhost:3000/api/push/settings -H "x-device-key: $K" -H 'content-type: application/json' -d '{"home_name":"Wien","alert_rain":true}'
curl -s -X POST localhost:3000/api/push/plans -H "x-device-key: $K" -H 'content-type: application/json' -d "{\"name\":\"Triglav\",\"lat\":46.378,\"lon\":13.837,\"elev\":2864,\"date\":\"$(date -u +%F)\"}"
curl -s localhost:3000/api/push/settings -H "x-device-key: $K"
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/api/push/settings -H "x-device-key: nope"
```

Expected: register → `{"settings":{…"lang":"de"…}}`; PUT → `home_name":"Wien"`, `alert_rain":true`; plan → `{"plan":{…}}`; GET → `registered":true` with 1 plan; bad key → `404`.
Cleanup (Supabase MCP `execute_sql`): `delete from push_devices where token = 'plan-smoke-token-0123456789';`

- [ ] **Step 4: Commit**

```bash
git add lib/push/store.js app/api/push
git commit -m "Push: device registration, settings, hike plans and test API"
```

---

### Task 7: Dispatcher, hourly job, retention, privacy

**Files:**
- Create: `lib/push/dispatch.js`, `app/api/push/dispatch/route.js`
- Modify: `supabase/cron.sql` (append job), `app/api/cleanup/route.js:147-155` (retention deletes), `app/privacy/content.jsx` (section per language)
- Test: `lib/push/dispatch.test.js`

**Interfaces:**
- Consumes: `cityEvents`, `decide`, `decideHike` (Task 4); `pushText` (Task 3); store functions (Task 6); `senderFromEnv` (Task 5); `hikeApiPath`, `peakHref` (`lib/hike/params.js`).
- Produces: `runDispatch({ store, getJson, sender, now, dry, base }) → Promise<summary>`; `GET /api/push/dispatch[?dry=1]`.

- [ ] **Step 1: Write the failing test**

`lib/push/dispatch.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runDispatch } from './dispatch.js'

const VIE = 7200
const at = (hhmm, date = '2026-10-01') => Date.parse(`${date}T${hhmm}:00Z`) - VIE * 1000
const NOW = at('13:05')
const rainy = {
  city: 'Wien', utcOffsetSec: VIE, nowLocal: '2026-10-01T13:00', sun: { sunrise: '07:00', sunset: '18:40' },
  hourly: ['13:00', '14:00', '15:00'].map((h, i) => ({ t: `2026-10-01T${h}`, temp: 15, rainPct: i === 2 ? 80 : 5, windKmh: 10, code: 1 })),
  days: [{ date: '2026-10-01', tempMax: 20, tempMin: 12 }],
}
const dev = (id, over = {}) => ({ id, token: `tok-${id}`, platform: 'android', apns_env: null, lang: 'de', unit: 'C', home_name: 'Wien', alert_rain: true, alert_storm: false, alert_severe: false, alert_heat: false, briefing: false, briefing_hour: 7, ...over })

function fakeStore({ devices = [], plans = [], log = [] } = {}) {
  const calls = { logged: [], deleted: [], plans: [], env: [] }
  return {
    calls,
    devicesForDispatch: async () => devices,
    openPlans: async () => plans,
    recentLog: async () => log,
    logSent: async (id, kind, ref) => calls.logged.push([id, kind, ref]),
    deleteDevice: async id => calls.deleted.push(id),
    updatePlan: async (id, patch) => calls.plans.push([id, patch]),
    setApnsEnv: async (id, env) => calls.env.push([id, env]),
  }
}

test('dispatch — one forecast per city and language, a message per phone, logged', async () => {
  const urls = []
  const getJson = async url => { urls.push(url); return rainy }
  const sent = []
  const sender = { send: async (d, m) => { sent.push([d.id, m.title, m.url]); return { ok: true } } }
  const store = fakeStore({ devices: [dev('a'), dev('b'), dev('c', { home_name: ' wien ' })] })
  const r = await runDispatch({ store, getJson, sender, now: NOW })
  assert.deepEqual(urls, ['https://metablend.app/api/outlook?city=wien&lang=de'])
  assert.deepEqual(sent.map(s => s[0]), ['a', 'b', 'c'])
  assert.equal(sent[0][1], '🌧 Regen in Wien')
  assert.equal(sent[0][2], '/?city=Wien')
  assert.deepEqual(store.calls.logged.map(l => l[1]), ['rain', 'rain', 'rain'])
  assert.equal(r.sent, 3)
})

test('dispatch — an unknown home city skips only its group; gone tokens remove the phone', async () => {
  const getJson = async url => (url.includes('city=atlantis') ? null : rainy)
  const sender = { send: async d => (d.id === 'b' ? { ok: false, gone: true } : { ok: true }) }
  const store = fakeStore({ devices: [dev('a'), dev('b'), dev('x', { home_name: 'Atlantis' })] })
  const r = await runDispatch({ store, getJson, sender, now: NOW })
  assert.deepEqual(store.calls.deleted, ['b'])
  assert.deepEqual(store.calls.logged.map(l => l[0]), ['a'])
  assert.equal(r.removed, 1)
})

test('dispatch — dry run lists messages, sends and stores nothing', async () => {
  const store = fakeStore({ devices: [dev('a')] })
  let sends = 0
  const r = await runDispatch({ store, getJson: async () => rainy, sender: { send: async () => { sends++; return { ok: true } } }, now: NOW, dry: true })
  assert.equal(sends, 0)
  assert.deepEqual(store.calls.logged, [])
  assert.equal(r.messages[0].title, '🌧 Regen in Wien')
})

test('dispatch — hike evening alert, then the plan is marked sent', async () => {
  const win = { window: { from: '2026-10-02T07:00', to: '2026-10-02T11:00', hours: 4 }, next: null }
  const hike = { utcOffsetSec: VIE, nowLocal: '2026-10-01T18:00', notes: [], windows: { today: null, tomorrow: win } }
  const plan = { id: 'p1', device_id: 'h', name: 'Triglav', lat: 46.378, lon: 13.837, elev: 2864, date: '2026-10-02', sent_evening: false, sent_morning: false, last_window: null }
  const store = fakeStore({ devices: [dev('h', { alert_rain: false, home_name: null })], plans: [plan] })
  const sent = []
  await runDispatch({ store, getJson: async url => (url.includes('/api/hike') ? hike : null), sender: { send: async (d, m) => { sent.push(m); return { ok: true } } }, now: at('18:05') })
  assert.equal(sent[0].title, '⛰ Triglav')
  assert.match(sent[0].url, /^\/hike\?lat=46\.378/)
  assert.deepEqual(store.calls.plans, [['p1', { sent_evening: true, last_window: win }]])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/push/dispatch.test.js`
Expected: FAIL — `Cannot find module './dispatch.js'`.

- [ ] **Step 3: Write the implementation**

`lib/push/dispatch.js`:

```js
// The hourly run (deps injected — unit tested with fakes): read each home
// city's outlook and each planned peak's summit forecast once, decide per
// phone, send, and record what went out. `dry` returns the messages instead.
import { cityEvents, decide, decideHike } from './rules.js'
import { pushText } from './text.js'
import { hikeApiPath, peakHref } from '../hike/params.js'

const NO_FEATURED = new Set()

export async function runDispatch({ store, getJson, sender, now = Date.now(), dry = false, base = 'https://metablend.app' }) {
  const plans = await store.openPlans(now)
  const devices = await store.devicesForDispatch([...new Set(plans.map(p => p.device_id))])
  const byId = new Map(devices.map(d => [d.id, d]))
  const log = await store.recentLog(devices.map(d => d.id), now - 24 * 3600e3)
  const logOf = id => log.filter(e => e.device_id === id)
  const outbox = []

  const groups = new Map()
  for (const d of devices) {
    const on = d.alert_rain || d.alert_storm || d.alert_severe || d.alert_heat || d.briefing
    if (!on || !d.home_name?.trim()) continue
    const key = `${d.home_name.trim().toLowerCase()}|${d.lang}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(d)
  }
  for (const [key, ds] of groups) {
    const [city, lang] = key.split('|')
    const outlook = await getJson(`${base}/api/outlook?city=${encodeURIComponent(city)}&lang=${lang}`)
    if (!outlook) continue // unknown city or a hiccup: the others still go out
    const ev = cityEvents(outlook, now)
    const url = `/?city=${encodeURIComponent(outlook.city)}`
    for (const d of ds) for (const msg of decide(d, ev, logOf(d.id))) outbox.push({ device: d, msg, url })
  }

  const peaks = new Map()
  for (const p of plans) {
    const path = hikeApiPath(p)
    if (!peaks.has(path)) peaks.set(path, [])
    peaks.get(path).push(p)
  }
  const planUpdates = []
  for (const [path, ps] of peaks) {
    const hike = await getJson(`${base}${path}`)
    for (const p of ps) {
      const d = byId.get(p.device_id)
      const r = d && decideHike(p, hike, now)
      if (!r) continue
      const patch = r.slot === 'evening' ? { sent_evening: true, last_window: r.window } : { sent_morning: true, last_window: r.window }
      if (!r.send) { planUpdates.push([p.id, patch]); continue }
      const msg = { kind: `hike_${r.slot}`, ref: `${p.id}:${r.slot}`, vars: { peak: p.name, window: r.window, date: p.date, todayLocal: r.todayLocal, stormUnknown: r.stormUnknown } }
      outbox.push({ device: d, msg, url: peakHref(p, NO_FEATURED), plan: [p.id, patch] })
    }
  }

  const text = o => pushText(o.device.lang, o.device.unit, o.msg)
  if (dry) {
    return { dry: true, devices: devices.length, cities: groups.size, peaks: peaks.size, messages: outbox.map(o => ({ device: o.device.id, kind: o.msg.kind, ref: o.msg.ref, url: o.url, ...text(o) })) }
  }

  let sent = 0, failed = 0, removed = 0
  const gone = new Set()
  const errors = []
  for (const o of outbox) {
    if (gone.has(o.device.id)) continue
    const r = await sender.send(o.device, { ...text(o), url: o.url, kind: o.msg.kind })
    if (r.env && r.env !== o.device.apns_env) { await store.setApnsEnv(o.device.id, r.env); o.device.apns_env = r.env }
    if (r.ok) {
      sent++
      await store.logSent(o.device.id, o.msg.kind, o.msg.ref, now)
      if (o.plan) planUpdates.push(o.plan)
    } else if (r.gone) {
      removed++; gone.add(o.device.id)
      await store.deleteDevice(o.device.id)
    } else {
      failed++; errors.push(r.error)
    }
  }
  for (const [id, patch] of planUpdates) await store.updatePlan(id, patch)
  return { devices: devices.length, cities: groups.size, peaks: peaks.size, sent, failed, removed, errors: errors.slice(0, 5) }
}
```

`app/api/push/dispatch/route.js`:

```js
import { withErrorLog, logError } from '@/lib/log'
import { runDispatch } from '@/lib/push/dispatch'
import * as store from '@/lib/push/store'
import { senderFromEnv } from '@/lib/push/send'

// Hourly from pg_cron (supabase/cron.sql, job push-dispatch-hourly), with the
// calibrate secret from Vault — same gate as /api/station-calibrate.
// ?dry=1 lists what would be sent right now without sending anything.
export const maxDuration = 300

async function getJson(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) })
    if (!r.ok) return null
    const j = await r.json()
    return j?.error ? null : j
  } catch { return null }
}

export const GET = withErrorLog('push.dispatch', async (request) => {
  const secret = process.env.CALIBRATE_SECRET
  if (secret) {
    const provided = request.headers.get('x-calibrate-key') ?? (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (provided !== secret) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dry = new URL(request.url).searchParams.get('dry') === '1'
  const summary = await runDispatch({ store, getJson, sender: senderFromEnv(), dry })
  if (summary.failed) await logError('push.dispatch', new Error(`${summary.failed} sends failed`), { errors: summary.errors })
  return Response.json(summary, { headers: { 'Cache-Control': 'no-store' } })
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/push/dispatch.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Retention in the nightly cleanup**

In `app/api/cleanup/route.js`, extend the `deletes` array (after the `error_log` line):

```js
    // push: phones unseen for 90 days, hikes after their day, the 14-day send log
    supabase.from('push_devices').delete().lt('last_seen', new Date(Date.now() - 90 * 86_400_000).toISOString()),
    supabase.from('hike_plans').delete().lt('date', new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10)),
    supabase.from('push_log').delete().lt('sent_at', new Date(Date.now() - 14 * 86_400_000).toISOString()),
```

- [ ] **Step 6: Privacy section in 5 languages**

In `app/privacy/content.jsx`, insert into each language's `sections` array right before its "How long we keep it" / equivalent entry:

```jsx
      { title: 'Notifications (app)', body: <>If you turn on notifications in the app, we store your phone’s push token (from Apple or Google), a hash of a random key the app creates, your home city, which alerts you switched on and your briefing hour, planned peaks and dates, your language and unit, and a log of what we sent in the last 14 days. There is no account and no location. Phones that haven’t opened the app for 90 days are deleted automatically, planned hikes after their day. Turning notifications off in the app or deleting the app stops them.</> },
```

de:

```jsx
      { title: 'Benachrichtigungen (App)', body: <>Wenn du in der App Benachrichtigungen einschaltest, speichern wir den Push-Token deines Telefons (von Apple oder Google), einen Hash eines zufälligen Schlüssels, den die App erzeugt, deine Heimatstadt, welche Hinweise du eingeschaltet hast und die Uhrzeit deines Morgenberichts, geplante Gipfel und Tage, Sprache und Einheit sowie ein Protokoll dessen, was wir in den letzten 14 Tagen gesendet haben. Es gibt kein Konto und keinen Standort. Telefone, die die App 90 Tage nicht geöffnet haben, werden automatisch gelöscht, geplante Touren nach ihrem Tag. Benachrichtigungen in der App ausschalten oder die App löschen beendet sie.</> },
```

fr:

```jsx
      { title: 'Notifications (app)', body: <>Si vous activez les notifications dans l’app, nous enregistrons le jeton push de votre téléphone (d’Apple ou de Google), l’empreinte d’une clé aléatoire créée par l’app, votre ville principale, les alertes activées et l’heure de votre point du matin, les sommets et dates prévus, votre langue et votre unité, ainsi qu’un journal de ce que nous avons envoyé ces 14 derniers jours. Aucun compte, aucune position. Les téléphones qui n’ont pas ouvert l’app depuis 90 jours sont supprimés automatiquement, les randonnées prévues après leur jour. Désactiver les notifications dans l’app ou supprimer l’app les arrête.</> },
```

es:

```jsx
      { title: 'Notificaciones (app)', body: <>Si activas las notificaciones en la app, guardamos el token push de tu teléfono (de Apple o Google), un hash de una clave aleatoria que crea la app, tu ciudad principal, qué avisos activaste y la hora de tu resumen matinal, las cumbres y fechas planificadas, tu idioma y unidad, y un registro de lo que enviamos en los últimos 14 días. No hay cuenta ni ubicación. Los teléfonos que no abren la app en 90 días se borran automáticamente, las excursiones planificadas después de su día. Desactivar las notificaciones en la app o borrar la app las detiene.</> },
```

it:

```jsx
      { title: 'Notifiche (app)', body: <>Se attivi le notifiche nell’app, salviamo il token push del tuo telefono (di Apple o Google), l’hash di una chiave casuale creata dall’app, la tua città principale, quali avvisi hai attivato e l’ora del tuo riepilogo mattutino, le vette e le date pianificate, lingua e unità, e un registro di ciò che abbiamo inviato negli ultimi 14 giorni. Nessun account, nessuna posizione. I telefoni che non aprono l’app da 90 giorni vengono eliminati automaticamente, le escursioni pianificate dopo il loro giorno. Disattivare le notifiche nell’app o eliminare l’app le interrompe.</> },
```

Also bump each language's `updated:` line to October 2026 (en `'Last updated October 2026'`, de `'Zuletzt aktualisiert Oktober 2026'`, fr/es/it — replace the month word with `octobre` / `octubre` / `ottobre`).

- [ ] **Step 7: The hourly job**

Append to `supabase/cron.sql`:

```sql
-- Push notifications: weather alerts, briefings and hike alerts, hourly at :05.
-- Same Vault secret as the station calibration.
select cron.schedule(
  'push-dispatch-hourly',
  '5 * * * *',
  $job$
  select net.http_get(
    url := 'https://metablend.app/api/push/dispatch',
    headers := jsonb_build_object(
      'x-calibrate-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'calibrate_secret')
    ),
    timeout_milliseconds := 300000
  );
  $job$
);
```

Do NOT schedule it yet — Task 11 applies it after the dry run.

- [ ] **Step 8: Lint, test, build**

Run: `npx eslint app lib && npm test && npm run build`
Expected: clean; all tests pass; `/api/push/dispatch` in the route list.

- [ ] **Step 9: Commit**

```bash
git add lib/push/dispatch.js lib/push/dispatch.test.js app/api/push/dispatch supabase/cron.sql app/api/cleanup/route.js app/privacy/content.jsx
git commit -m "Push: hourly dispatcher, retention and privacy notice"
```

---

### Task 8: App client and wiring

**Files:**
- Create: `lib/push-client.js`
- Modify: `package.json`, `mobile/package.json` (plugins), `app/components/AppChrome.jsx` (start-up + taps), `app/page.js` (count views)

**Interfaces:**
- Consumes: `isNative` (`lib/native.js`); API routes (Task 6).
- Produces (used by Tasks 9–10):
  - `pushApi(path, { method, body }) → Promise<{ status, json }>`
  - `permission() → Promise<'granted'|'denied'|'prompt'|'unavailable'>`
  - `enablePush({ lang, unit }) → Promise<{ ok: boolean, reason?: 'denied'|'error' }>`
  - `initPush({ lang, unit, onOpen }) → Promise<() => void>`
  - `bumpCityView(city) → Promise<void>`; `promptState() → Promise<{ views, topCity, dismissed }>`; `dismissPrompt() → Promise<void>`
  - `openSystemSettings() → Promise<boolean>` (iOS only; false elsewhere)

- [ ] **Step 1: Install the plugins (web app and native shell)**

```bash
npm install @capacitor/push-notifications@^8.1.2 @capacitor/preferences@^8 @capacitor/app-launcher@^8
cd mobile && npm install @capacitor/push-notifications@^8.1.2 @capacitor/preferences@^8 @capacitor/app-launcher@^8 && npx cap sync android && cd ..
```

Expected: both `package.json` files list the three plugins; `cap sync` reports them for Android. (iOS sync happens on the Mac in Task 11.)

- [ ] **Step 2: Write the client module**

`lib/push-client.js`:

```js
// Push inside the app (browser side). Plugins are dynamic-imported only when
// running natively. The device key lives in native storage (Preferences):
// iOS may purge WebView storage, and losing the key means losing settings.
import { isNative } from './native'

const KEY = 'mb_device_key', VIEWS = 'mb_city_views', DISMISSED = 'mb_push_prompt_off'
const prefs = async () => (await import('@capacitor/preferences')).Preferences
const plugin = async () => (await import('@capacitor/push-notifications')).PushNotifications

async function deviceKey() {
  const P = await prefs()
  const { value } = await P.get({ key: KEY })
  if (value) return value
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const key = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  await P.set({ key: KEY, value: key })
  return key
}

export async function pushApi(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api/push/${path}`, {
    method,
    headers: { 'x-device-key': await deviceKey(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

const platform = () => window.Capacitor?.getPlatform?.()

export async function permission() {
  if (!isNative()) return 'unavailable'
  try { return (await (await plugin()).checkPermissions()).receive } catch { return 'unavailable' }
}

// register() → the token arrives in the 'registration' event
async function tokenOnce(P) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no token')), 15000)
    let subs = []
    const done = fn => v => { clearTimeout(timer); subs.forEach(s => s.remove()); fn(v) }
    Promise.all([
      P.addListener('registration', done(t => resolve(t.value))),
      P.addListener('registrationError', done(e => reject(new Error(e?.error ?? 'registration failed')))),
    ]).then(s => { subs = s; return P.register() }).catch(reject)
  })
}

async function register(P, { lang, unit }) {
  const token = await tokenOnce(P)
  const r = await pushApi('register', { method: 'POST', body: { token, platform: platform(), lang, unit } })
  return r.status === 200
}

export async function enablePush({ lang, unit }) {
  if (!isNative()) return { ok: false, reason: 'error' }
  try {
    const P = await plugin()
    let { receive } = await P.checkPermissions()
    if (receive === 'prompt' || receive === 'prompt-with-rationale') receive = (await P.requestPermissions()).receive
    if (receive !== 'granted') return { ok: false, reason: 'denied' }
    return (await register(P, { lang, unit })) ? { ok: true } : { ok: false, reason: 'error' }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

const CHANNELS = [
  { id: 'alerts', name: 'Weather alerts', importance: 4 },
  { id: 'briefing', name: 'Morning briefing', importance: 3 },
  { id: 'hikes', name: 'Hike alerts', importance: 3 },
]

// At app start: channels, tap handling, and a fresh token when allowed.
export async function initPush({ lang, unit, onOpen }) {
  if (!isNative()) return () => {}
  try {
    const P = await plugin()
    if (platform() === 'android') for (const c of CHANNELS) await P.createChannel(c).catch(() => {})
    const tap = await P.addListener('pushNotificationActionPerformed', a => {
      const url = a?.notification?.data?.url
      if (typeof url === 'string' && url.startsWith('/')) onOpen(url)
    })
    if ((await P.checkPermissions()).receive === 'granted') register(P, { lang, unit }).catch(() => {})
    return () => tap.remove()
  } catch {
    return () => {}
  }
}

export async function bumpCityView(city) {
  if (!isNative() || !city) return
  try {
    const P = await prefs()
    const counts = JSON.parse((await P.get({ key: VIEWS })).value ?? '{}')
    counts[city] = (counts[city] ?? 0) + 1
    await P.set({ key: VIEWS, value: JSON.stringify(counts) })
  } catch { /* counting is a nicety */ }
}

export async function promptState() {
  if (!isNative()) return { views: 0, topCity: null, dismissed: true }
  const P = await prefs()
  const counts = JSON.parse((await P.get({ key: VIEWS })).value ?? '{}')
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return { views: entries.reduce((s, [, n]) => s + n, 0), topCity: entries[0]?.[0] ?? null, dismissed: !!(await P.get({ key: DISMISSED })).value }
}

export async function dismissPrompt() {
  if (isNative()) await (await prefs()).set({ key: DISMISSED, value: '1' })
}

// iOS can jump straight to the app's page in Settings; Android has no
// official way, so the UI explains the path there instead.
export async function openSystemSettings() {
  if (platform() !== 'ios') return false
  try { await (await import('@capacitor/app-launcher')).AppLauncher.openUrl({ url: 'app-settings:' }); return true } catch { return false }
}
```

- [ ] **Step 3: Start-up and taps in AppChrome**

In `app/components/AppChrome.jsx`, add the import:

```js
import { initPush } from '@/lib/push-client'
import { getCookie } from '@/lib/prefs'
```

and inside the existing `useEffect`, after `onBackButton(...)` (still inside `if (inApp)` flow), add:

```js
    let offPush = () => {}
    initPush({ lang: getCookie('metablend_lang') ?? 'en', unit: getCookie('metablend_unit') === 'F' ? 'F' : 'C', onOpen: url => router.push(url) })
      .then(fn => { if (gone) fn(); else offPush = fn })
```

and change the cleanup to `return () => { gone = true; off(); offPush(); themeWatch.disconnect() }`.

- [ ] **Step 4: Count forecast views for the prompt and the home-city preset**

In `app/page.js`, import `import { bumpCityView } from '@/lib/push-client'` and, in `loadForecast`, right after `setRecent(pushRecent(json.city ?? q))`, add:

```js
      if (!silent) bumpCityView(json.city ?? q) // app only: the soft prompt and the home-city preset
```

- [ ] **Step 5: Lint, test, build**

Run: `npx eslint app lib && npm test && npm run build`
Expected: clean, all tests pass, compiled.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json mobile/package.json mobile/package-lock.json mobile/android lib/push-client.js app/components/AppChrome.jsx app/page.js
git commit -m "Push: app client, registration at start, taps open the right screen"
```

---

### Task 9: More → Notifications

**Files:**
- Create: `app/components/push/NotificationSettings.jsx`
- Modify: `app/more/MoreClient.jsx` (render it inside the app), `lib/i18n.js` (UI keys)

**Interfaces:**
- Consumes: `pushApi`, `permission`, `enablePush`, `promptState`, `openSystemSettings` (Task 8); `SectionTitle` (`app/components/ui.jsx`); `isNative` (`lib/native.js`).
- Produces: `<NotificationSettings lang unit />`.

- [ ] **Step 1: UI translation keys**

Insert after each language's `pushHikeTitle:` line (keeps the file's line endings):

```bash
python - <<'EOF'
import re
f = 'lib/i18n.js'
raw = open(f, encoding='utf-8').read(); crlf = '\r\n' in raw; s = raw.replace('\r\n', '\n')
K = {
 'en': dict(notifTitle='Notifications', notifEnable='Turn on notifications', notifHome='Home city', notifChange='Change', notifAlerts='Weather alerts', notifRain='Rain soon', notifStorm='Thunderstorms', notifSevere='Severe weather', notifHeat='Heat', notifBriefing='Morning briefing', notifHikes='Hike alerts', notifNoHikes='No planned hikes — plan one on a peak with 🔔.', notifRules='No weather alerts 22:00–07:00 except severe weather, at most 3 a day.', notifTest='Send a test notification', notifTestSent='Sent — it should arrive in a few seconds.', notifBlocked='Notifications are off for MetaBlend in your phone’s settings.', notifBlockedHow='Settings → Apps → MetaBlend → Notifications', notifOpenSettings='Open settings', notifError='That didn’t work — check your connection and try again.', promptTitle='Get a heads-up before rain in {city}?', promptOn='Turn on', promptDone='Done — you’ll hear from us before rain.', planHike='Plan a hike', planPick='Which day?', planSaved='Planned — the summit window arrives the evening before at 18:00.', planRemove='Remove'),
 'de': dict(notifTitle='Benachrichtigungen', notifEnable='Benachrichtigungen einschalten', notifHome='Heimatstadt', notifChange='Ändern', notifAlerts='Wetterhinweise', notifRain='Bald Regen', notifStorm='Gewitter', notifSevere='Unwetter', notifHeat='Hitze', notifBriefing='Morgenbericht', notifHikes='Tourenhinweise', notifNoHikes='Keine geplanten Touren – plane eine auf einem Gipfel mit 🔔.', notifRules='Keine Wetterhinweise von 22:00 bis 07:00 außer bei Unwetter, höchstens 3 am Tag.', notifTest='Testbenachrichtigung senden', notifTestSent='Gesendet – sie sollte in ein paar Sekunden ankommen.', notifBlocked='Benachrichtigungen für MetaBlend sind in den Telefoneinstellungen aus.', notifBlockedHow='Einstellungen → Apps → MetaBlend → Benachrichtigungen', notifOpenSettings='Einstellungen öffnen', notifError='Das hat nicht geklappt – prüfe die Verbindung und versuch es nochmal.', promptTitle='Vor Regen in {city} Bescheid bekommen?', promptOn='Einschalten', promptDone='Erledigt – du hörst von uns, bevor es regnet.', planHike='Tour planen', planPick='Welcher Tag?', planSaved='Geplant – das Gipfelfenster kommt am Vorabend um 18:00.', planRemove='Entfernen'),
 'fr': dict(notifTitle='Notifications', notifEnable='Activer les notifications', notifHome='Ville principale', notifChange='Modifier', notifAlerts='Alertes météo', notifRain='Pluie imminente', notifStorm='Orages', notifSevere='Intempéries', notifHeat='Chaleur', notifBriefing='Point du matin', notifHikes='Alertes randonnée', notifNoHikes='Aucune randonnée prévue – planifiez-en une sur un sommet avec 🔔.', notifRules='Pas d’alerte météo de 22:00 à 07:00 sauf intempéries, 3 par jour au maximum.', notifTest='Envoyer une notification test', notifTestSent='Envoyée – elle devrait arriver dans quelques secondes.', notifBlocked='Les notifications de MetaBlend sont désactivées dans les réglages du téléphone.', notifBlockedHow='Paramètres → Applications → MetaBlend → Notifications', notifOpenSettings='Ouvrir les réglages', notifError='Ça n’a pas marché – vérifiez la connexion et réessayez.', promptTitle='Être prévenu avant la pluie à {city} ?', promptOn='Activer', promptDone='C’est fait – on vous prévient avant la pluie.', planHike='Planifier une randonnée', planPick='Quel jour ?', planSaved='C’est prévu – la fenêtre au sommet arrive la veille à 18:00.', planRemove='Retirer'),
 'es': dict(notifTitle='Notificaciones', notifEnable='Activar notificaciones', notifHome='Ciudad principal', notifChange='Cambiar', notifAlerts='Avisos meteorológicos', notifRain='Lluvia pronto', notifStorm='Tormentas', notifSevere='Tiempo severo', notifHeat='Calor', notifBriefing='Resumen matinal', notifHikes='Avisos de excursión', notifNoHikes='No hay excursiones planificadas: planifica una en una cumbre con 🔔.', notifRules='Sin avisos de 22:00 a 07:00 salvo tiempo severo, como máximo 3 al día.', notifTest='Enviar una notificación de prueba', notifTestSent='Enviada: debería llegar en unos segundos.', notifBlocked='Las notificaciones de MetaBlend están desactivadas en los ajustes del teléfono.', notifBlockedHow='Ajustes → Aplicaciones → MetaBlend → Notificaciones', notifOpenSettings='Abrir ajustes', notifError='No ha funcionado: revisa la conexión e inténtalo de nuevo.', promptTitle='¿Aviso antes de que llueva en {city}?', promptOn='Activar', promptDone='Hecho: te avisaremos antes de que llueva.', planHike='Planificar excursión', planPick='¿Qué día?', planSaved='Planificada: la ventana en la cumbre llega la víspera a las 18:00.', planRemove='Quitar'),
 'it': dict(notifTitle='Notifiche', notifEnable='Attiva le notifiche', notifHome='Città principale', notifChange='Cambia', notifAlerts='Avvisi meteo', notifRain='Pioggia in arrivo', notifStorm='Temporali', notifSevere='Maltempo', notifHeat='Caldo', notifBriefing='Riepilogo mattutino', notifHikes='Avvisi escursione', notifNoHikes='Nessuna escursione pianificata: pianificane una su una vetta con 🔔.', notifRules='Nessun avviso dalle 22:00 alle 07:00 salvo maltempo, al massimo 3 al giorno.', notifTest='Invia una notifica di prova', notifTestSent='Inviata: dovrebbe arrivare tra pochi secondi.', notifBlocked='Le notifiche di MetaBlend sono disattivate nelle impostazioni del telefono.', notifBlockedHow='Impostazioni → App → MetaBlend → Notifiche', notifOpenSettings='Apri impostazioni', notifError='Non ha funzionato: controlla la connessione e riprova.', promptTitle='Un avviso prima della pioggia a {city}?', promptOn='Attiva', promptDone='Fatto: ti avviseremo prima della pioggia.', planHike='Pianifica un’escursione', planPick='Quale giorno?', planSaved='Pianificata: la finestra in vetta arriva la sera prima alle 18:00.', planRemove='Rimuovi'),
}
starts = [m.start() for m in re.finditer(r"^  (en|de|fr|es|it): \{", s, re.M)]
langs = re.findall(r"^  (en|de|fr|es|it): \{", s, re.M)
out, off = s, 0
for i, lang in enumerate(langs):
    a = starts[i] + off; b = (starts[i + 1] + off) if i + 1 < len(starts) else len(out)
    seg = out[a:b]; m = re.search(r"\n    pushHikeTitle: '[^']*',\n", seg); assert m, lang
    ins = ''.join(f"    {k}: '{v}',\n" for k, v in K[lang].items())
    seg = seg[:m.end()] + ins + seg[m.end():]; out = out[:a] + seg + out[b:]; off += len(ins)
if crlf: out = out.replace('\n', '\r\n')
open(f, 'w', encoding='utf-8', newline='').write(out); print('ok', out.count('planRemove'))
EOF
```

Expected: `ok 5`.

- [ ] **Step 2: Write the component**

`app/components/push/NotificationSettings.jsx`:

```jsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, Trash2 } from 'lucide-react'
import { t } from '@/lib/i18n'
import { SectionTitle } from '../ui'
import { pushApi, permission, enablePush, promptState, openSystemSettings } from '@/lib/push-client'

const ALERTS = [['alert_rain', 'notifRain'], ['alert_storm', 'notifStorm'], ['alert_severe', 'notifSevere'], ['alert_heat', 'notifHeat']]
const HOURS = [5, 6, 7, 8, 9, 10, 11]

// More → Notifications (app only). Loads the phone's settings from the
// server; every switch saves on its own.
export default function NotificationSettings({ lang, unit }) {
  const [state, setState] = useState({ loading: true, perm: 'prompt', settings: null, plans: [] })
  const [msg, setMsg] = useState(null)
  const [editHome, setEditHome] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState([])
  const timer = useRef(null)

  async function load() {
    const perm = await permission()
    const r = await pushApi('settings')
    setState({ loading: false, perm, settings: r.status === 200 ? r.json.settings : null, plans: r.json.plans ?? [] })
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads once after mount
  useEffect(() => { load() }, [])

  async function save(patch) {
    const r = await pushApi('settings', { method: 'PUT', body: { ...patch, lang, unit } })
    if (r.status === 200) setState(s => ({ ...s, settings: r.json.settings }))
    else setMsg(t(lang, 'notifError'))
  }

  async function turnOn() {
    const r = await enablePush({ lang, unit })
    if (!r.ok) { setMsg(r.reason === 'denied' ? null : t(lang, 'notifError')); await load(); return }
    const { topCity } = await promptState()
    await pushApi('settings', { method: 'PUT', body: { home_name: topCity ?? null, alert_rain: true, alert_storm: true, alert_severe: true, alert_heat: true, lang, unit } })
    await load()
  }

  function search(v) {
    setQuery(v)
    clearTimeout(timer.current)
    if (v.trim().length < 2) { setHits([]); return }
    timer.current = setTimeout(async () => {
      try {
        const d = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(v)}&count=5&language=${lang}`)).json()
        setHits(d.results ?? [])
      } catch { setHits([]) }
    }, 250)
  }

  async function test() {
    const r = await pushApi('test', { method: 'POST' })
    setMsg(r.status === 200 ? t(lang, 'notifTestSent') : r.json.error ?? t(lang, 'notifError'))
  }

  async function removePlan(id) {
    await pushApi(`plans?id=${id}`, { method: 'DELETE' })
    setState(s => ({ ...s, plans: s.plans.filter(p => p.id !== id) }))
  }

  const box = 'bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3'
  const caption = 'text-zinc-500 text-xs uppercase tracking-wider'
  const toggle = (key, label) => (
    <label key={key} className="flex items-center justify-between gap-3 text-sm py-1">
      <span>{label}</span>
      <input type="checkbox" className="h-5 w-5 accent-emerald-400" checked={!!state.settings?.[key]} onChange={e => save({ [key]: e.target.checked })} />
    </label>
  )

  if (state.loading) return null
  const s = state.settings
  return (
    <section className="space-y-3">
      <SectionTitle icon={Bell}>{t(lang, 'notifTitle')}</SectionTitle>
      {state.perm === 'denied' ? (
        <div className={box}>
          <p className="text-sm">{t(lang, 'notifBlocked')}</p>
          <p className="text-xs text-zinc-400">{t(lang, 'notifBlockedHow')}</p>
          <button onClick={openSystemSettings} className="press text-sm text-emerald-400 underline underline-offset-4">{t(lang, 'notifOpenSettings')}</button>
        </div>
      ) : !s ? (
        <div className={box}>
          <button onClick={turnOn} className="press w-full bg-emerald-400 text-black font-semibold rounded-full py-2.5 text-sm hover:bg-emerald-300">{t(lang, 'notifEnable')}</button>
          <p className="text-xs text-zinc-400">{t(lang, 'notifRules')}</p>
        </div>
      ) : (
        <>
          <div className={box}>
            <div className="flex items-center justify-between gap-3">
              <div><div className={caption}>{t(lang, 'notifHome')}</div><div className="text-sm mt-0.5">{s.home_name ?? '–'}</div></div>
              <button onClick={() => setEditHome(v => !v)} className="press text-sm text-emerald-400">{t(lang, 'notifChange')}</button>
            </div>
            {editHome && (
              <div className="space-y-1">
                <input value={query} onChange={e => search(e.target.value)} maxLength={80} autoFocus
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400" />
                {hits.map(h => (
                  <button key={h.id} onClick={() => { save({ home_name: h.name }); setEditHome(false); setQuery(''); setHits([]) }}
                    className="press block w-full text-left text-sm px-3 py-1.5 rounded-lg hover:bg-zinc-800">
                    {h.name}<span className="text-zinc-500"> · {[h.admin1, h.country].filter(Boolean).join(', ')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={box}>
            <div className={caption}>{t(lang, 'notifAlerts')}</div>
            {ALERTS.map(([k, label]) => toggle(k, t(lang, label)))}
            <p className="text-xs text-zinc-400">{t(lang, 'notifRules')}</p>
          </div>
          <div className={box}>
            {toggle('briefing', t(lang, 'notifBriefing'))}
            {s.briefing && (
              <div className="flex flex-wrap gap-1">
                {HOURS.map(h => (
                  <button key={h} onClick={() => save({ briefing_hour: h })} aria-pressed={s.briefing_hour === h}
                    className={`press rounded-lg px-2.5 py-1 text-xs tabular-nums ${s.briefing_hour === h ? 'bg-emerald-400 text-black font-semibold' : 'bg-zinc-800 text-zinc-400'}`}>
                    {String(h).padStart(2, '0')}:00
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={box}>
            <div className={caption}>{t(lang, 'notifHikes')}</div>
            {state.plans.length ? state.plans.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>⛰ {p.name} · <span className="tabular-nums">{p.date}</span></span>
                <button onClick={() => removePlan(p.id)} aria-label={t(lang, 'planRemove')} className="press text-zinc-500 hover:text-red-400"><Trash2 size={15} aria-hidden /></button>
              </div>
            )) : <p className="text-xs text-zinc-400">{t(lang, 'notifNoHikes')}</p>}
          </div>
          <button onClick={test} className="press text-sm text-emerald-400 underline underline-offset-4">{t(lang, 'notifTest')}</button>
        </>
      )}
      {msg && <p className="text-xs text-zinc-400" role="status">{msg}</p>}
    </section>
  )
}
```

- [ ] **Step 3: Render it in More, inside the app only**

In `app/more/MoreClient.jsx` import `NotificationSettings` and `isNative`, add state `const [native, setNative] = useState(false)` with `useEffect(() => setNative(isNative()), [])` (with the same `eslint-disable-next-line react-hooks/set-state-in-effect -- post-hydration environment sync` comment the file uses), and render right after the Settings `<section>`:

```jsx
      {native && <NotificationSettings lang={lang} unit={u} />}
```

- [ ] **Step 4: Lint, test, build**

Run: `npx eslint app lib && npm test && npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/components/push/NotificationSettings.jsx app/more/MoreClient.jsx lib/i18n.js
git commit -m "Push: More → Notifications"
```

---

### Task 10: The soft prompt and hike planning

**Files:**
- Create: `lib/push-days.js`, `app/components/push/PushPrompt.jsx`, `app/components/hike/PlanHike.jsx`
- Modify: `app/page.js` (render the prompt), `app/components/hike/PeakView.jsx` (render the bell)
- Test: `lib/push-days.test.js`

**Interfaces:**
- Consumes: `enablePush`, `pushApi`, `promptState`, `dismissPrompt`, `permission` (Task 8); `dayWord` (`lib/outlook/text.js`); `addDays` (`lib/localtime.js`).
- Produces: `planDays(lang, todayLocal) → [{ date, label }]` (8 entries), `<PushPrompt lang unit />`, `<PlanHike peak lang unit todayLocal />`.

- [ ] **Step 1: Write the failing test**

`lib/push-days.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planDays } from './push-days.js'

test('planDays — today and the next 7 days, named in the language', () => {
  const days = planDays('en', '2026-10-01')
  assert.equal(days.length, 8)
  assert.deepEqual(days.slice(0, 2).map(d => d.date), ['2026-10-01', '2026-10-02'])
  assert.equal(days[7].date, '2026-10-08')
  assert.ok(days.every(d => typeof d.label === 'string' && d.label.length > 0))
  assert.notEqual(planDays('de', '2026-10-01')[1].label, days[1].label)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/push-days.test.js`
Expected: FAIL — `Cannot find module './push-days.js'`.

- [ ] **Step 3: Write the helper**

`lib/push-days.js`:

```js
// The day chips for "Plan a hike" (pure — unit tested): today … +7 in the
// peak's own calendar, named like the rest of the app ("Tomorrow", "Fri").
import { dayWord } from './outlook/text.js'
import { addDays } from './localtime.js'

export function planDays(lang, todayLocal) {
  return Array.from({ length: 8 }, (_, i) => {
    const date = addDays(todayLocal, i)
    return { date, label: dayWord(lang, date, todayLocal) }
  })
}
```

Run: `node --test lib/push-days.test.js` → PASS. If `dayWord` returns an empty string for today, use `t(lang, 'tabToday')` for index 0 and keep the test.

- [ ] **Step 4: The soft prompt**

`app/components/push/PushPrompt.jsx`:

```jsx
'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fill } from '@/lib/outlook/text'
import { isNative } from '@/lib/native'
import { enablePush, pushApi, promptState, dismissPrompt, permission } from '@/lib/push-client'

// "Get a heads-up before rain in Vienna?" — app only, from the 3rd forecast
// view, never again once dismissed or once notifications are on.
export default function PushPrompt({ lang, unit }) {
  const [show, setShow] = useState(null) // null | { city } | 'done'
  useEffect(() => {
    if (!isNative()) return
    let off = false
    Promise.all([promptState(), permission(), pushApi('settings')]).then(([st, perm, r]) => {
      const registered = r.status === 200 && r.json.registered
      if (!off && st.views >= 3 && !st.dismissed && perm !== 'denied' && !registered && st.topCity) setShow({ city: st.topCity })
    }).catch(() => {})
    return () => { off = true }
  }, [])
  if (!show) return null
  if (show === 'done') return <p className="text-sm text-zinc-400 animate-fade-in" role="status">{t(lang, 'promptDone')}</p>

  async function turnOn() {
    const r = await enablePush({ lang, unit })
    if (r.ok) {
      await pushApi('settings', { method: 'PUT', body: { home_name: show.city, alert_rain: true, alert_storm: true, alert_severe: true, alert_heat: true, lang, unit } })
      setShow('done')
    } else {
      await dismissPrompt(); setShow(null)
    }
  }
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 flex items-center gap-3 animate-fade-in">
      <span className="flex-1 text-sm">{fill(t(lang, 'promptTitle'), { city: show.city })}</span>
      <button onClick={turnOn} className="press bg-emerald-400 text-black text-sm font-semibold rounded-full px-4 py-1.5 hover:bg-emerald-300">{t(lang, 'promptOn')}</button>
      <button onClick={async () => { await dismissPrompt(); setShow(null) }} aria-label="×" className="press text-zinc-500 hover:text-zinc-300"><X size={16} aria-hidden /></button>
    </div>
  )
}
```

In `app/page.js`: `import PushPrompt from './components/push/PushPrompt'`, and render `<PushPrompt lang={lang} unit={unit} />` directly after the outlook ternary (`{outlook ? (…) : outlookError ? (…) : (<SkyLoader … />)}`).

- [ ] **Step 5: Plan a hike**

`app/components/hike/PlanHike.jsx`:

```jsx
'use client'

import { useState } from 'react'
import { BellRing } from 'lucide-react'
import { t } from '@/lib/i18n'
import { planDays } from '@/lib/push-days'
import { enablePush, pushApi, permission } from '@/lib/push-client'

// 🔔 Plan a hike (app only): pick a day, get the summit window the evening
// before at 18:00 and a morning update if it moves.
export default function PlanHike({ peak, lang, unit, todayLocal }) {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState(null)

  async function plan(date) {
    if ((await permission()) !== 'granted') {
      const r = await enablePush({ lang, unit })
      if (!r.ok) { setMsg(t(lang, r.reason === 'denied' ? 'notifBlocked' : 'notifError')); return }
    }
    const r = await pushApi('plans', { method: 'POST', body: { name: peak.name, lat: peak.lat, lon: peak.lon, elev: peak.elev, date } })
    setMsg(r.status === 200 ? t(lang, 'planSaved') : r.json.error ?? t(lang, 'notifError'))
    setOpen(false)
  }

  return (
    <div className="space-y-2">
      <button onClick={() => { setOpen(o => !o); setMsg(null) }} aria-expanded={open}
        className="press inline-flex items-center gap-1.5 text-sm text-emerald-400 border border-emerald-400/40 rounded-full px-3 py-1.5 hover:bg-emerald-400/10">
        <BellRing size={14} aria-hidden /> {t(lang, 'planHike')}
      </button>
      {open && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2 animate-fade-in">
          <div className="text-xs text-zinc-500">{t(lang, 'planPick')}</div>
          <div className="flex flex-wrap gap-1.5">
            {planDays(lang, todayLocal).map(d => (
              <button key={d.date} onClick={() => plan(d.date)} className="press rounded-lg bg-zinc-800 px-3 py-1.5 text-sm hover:text-emerald-400">{d.label}</button>
            ))}
          </div>
        </div>
      )}
      {msg && <p className="text-xs text-zinc-400" role="status">{msg}</p>}
    </div>
  )
}
```

In `app/components/hike/PeakView.jsx`: import `PlanHike` and `isNative`; add `const [native, setNative] = useState(false)` with a mount effect `setNative(isNative())` (same eslint comment as elsewhere); render below `<RangeTabs … />`:

```jsx
      {native && d && <PlanHike peak={peak} lang={lang} unit={unit} todayLocal={todayLocal} />}
```

- [ ] **Step 6: Lint, test, build**

Run: `npx eslint app lib && npm test && npm run build`
Expected: clean; `push-days` test passes.

- [ ] **Step 7: Commit**

```bash
git add lib/push-days.js lib/push-days.test.js app/components/push/PushPrompt.jsx app/components/hike/PlanHike.jsx app/page.js app/components/hike/PeakView.jsx
git commit -m "Push: soft prompt on the forecast, plan a hike on a peak"
```

---

### Task 11: Native setup, go live, device checks

**Files:**
- Modify: `mobile/android/.gitignore`, `mobile/ios/App/App/AppDelegate.swift`, `mobile/README.md`, `CHANGELOG.md`

- [ ] **Step 1: Keep the Firebase file out of git**

Append to `mobile/android/.gitignore`:

```
# Firebase config for push (the owner keeps it locally)
app/google-services.json
```

- [ ] **Step 2: Hand iOS push tokens to Capacitor**

In `mobile/ios/App/App/AppDelegate.swift`, inside `class AppDelegate`, add (Capacitor's documented hooks for `@capacitor/push-notifications`):

```swift
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
```

- [ ] **Step 3: Device checklist in `mobile/README.md`**

Add a "Push notifications" section:

```markdown
## Push notifications

One-time setup (owner — keys never go through chat):
1. Firebase console → new project → add Android app `app.metablend` → download
   `google-services.json` into `mobile/android/app/`.
2. Firebase → Project settings → Service accounts → Generate new private key →
   paste the whole JSON into Vercel env `FIREBASE_SERVICE_ACCOUNT` (Production).
3. Apple Developer → Certificates, IDs & Profiles → Keys → + → Apple Push
   Notifications service (APNs) → download the .p8 once. Vercel env:
   `APNS_KEY` (the file's contents), `APNS_KEY_ID` (the key's ID),
   `APNS_TEAM_ID` (Membership → Team ID). Redeploy.
4. Xcode (Mac): `git pull && cd mobile && npm install && npx cap sync ios`,
   open the project, target App → Signing & Capabilities → + Capability →
   Push Notifications.

Check on a device / emulator / simulator:
- [ ] More → Notifications → Turn on → the system asks → Allow.
- [ ] "Send a test notification" arrives within seconds.
- [ ] Tapping it opens the app on More.
- [ ] Home city shows the city you look at most; Change → pick another → saved.
- [ ] A peak → Plan a hike → Tomorrow → shows up under Hike alerts.
- [ ] Android: Settings → Apps → MetaBlend → Notifications lists Weather
      alerts, Morning briefing, Hike alerts.
```

- [ ] **Step 4: CHANGELOG**

Add at the top of `CHANGELOG.md`, under a new `## 2026-10-01` heading if the file doesn't have one yet:

```markdown
### Added — push notifications (phase 4 of the app)
- **Weather alerts** for one home city: rain soon (30 min–2 h ahead), thunderstorms,
  severe weather (heavy rain / snow, freezing rain, strong wind) and heat. Quiet
  hours 22:00–07:00 (severe weather still comes through), at most 3 a day.
- **Morning briefing** at an hour you pick (05–11): the day's range, rain and the
  best time outside, in your language and unit.
- **Hike alerts**: 🔔 Plan a hike on a peak → the summit window the evening before
  at 18:00, and a morning update only if it moved.
- **More → Notifications** (home city, switches, briefing hour, planned hikes, test
  button) and a one-time "Get a heads-up before rain?" card after the 3rd forecast.
- Sending straight to FCM (Android) and APNs (iOS) with self-signed JWTs — no SDKs;
  an hourly pg_cron job (`push-dispatch-hourly`) reads each home city's cached
  outlook once. `lib/push/*` (rules, texts, validation, senders, dispatcher) tested.
- Privacy notice updated; phones unseen for 90 days, past hikes and the 14-day send
  log are cleaned up nightly.
```

- [ ] **Step 5: Ship the code, dry-run against real data**

```bash
npx eslint app lib && npm test && npm run build
git add mobile/android/.gitignore mobile/ios/App/App/AppDelegate.swift mobile/README.md CHANGELOG.md
git commit -m "Push: native hooks, device checklist, changelog"
git push origin main
```

After the deploy is live, find a city with rain starting 30 min–2 h from now — check a few until one fits:

```bash
for c in london dublin bergen reykjavik vancouver singapore; do
  curl -s "https://metablend.app/api/outlook?city=$c&lang=en" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);console.log('$c', o.nowLocal, (o.hourly||[]).slice(0,4).map(h=>h.t.slice(11,16)+' '+h.rainPct+'%').join(' | '))})"
done
```

Register a smoke device with that city as home and rain alerts on:

```bash
K=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")
curl -s -X POST https://metablend.app/api/push/register -H "x-device-key: $K" -H 'content-type: application/json' -d '{"token":"dry-run-smoke-token-0123456789","platform":"android","lang":"en"}'
curl -s -X PUT https://metablend.app/api/push/settings -H "x-device-key: $K" -H 'content-type: application/json' -d '{"home_name":"<that city>","alert_rain":true,"alert_storm":true,"alert_severe":true,"briefing":true,"briefing_hour":<current local hour there, 5–11 if possible>}'
```

Then call the dry run through the database, so the calibrate secret stays in the Vault and never appears in chat or a terminal:

```sql
select net.http_get(url := 'https://metablend.app/api/push/dispatch?dry=1',
  headers := jsonb_build_object('x-calibrate-key', (select decrypted_secret from vault.decrypted_secrets where name = 'calibrate_secret')));
-- then:
select status_code, left(content, 800) from net._http_response order by created desc limit 1;
```

Expected: `200` with `"dry":true` and the smoke device's message(s) in `messages` (the rain alert, and the briefing if its hour matches). Delete the smoke device afterwards (Supabase MCP): `delete from push_devices where token = 'dry-run-smoke-token-0123456789';`

- [ ] **Step 6: Schedule the hourly job**

Supabase MCP `execute_sql`: the `push-dispatch-hourly` block from `supabase/cron.sql`. Verify: `select jobname, schedule from cron.job where jobname = 'push-dispatch-hourly';` → one row, `5 * * * *`.

- [ ] **Step 7: Owner device run**

Owner completes the README one-time setup (Firebase project + `google-services.json`, service account in Vercel, APNs key in Vercel, Xcode capability) and works through the checklist on the Pixel emulator and the iOS Simulator. Then check the first real hourly runs:

```sql
select start_time, status from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'push-dispatch-hourly') order by start_time desc limit 3;
select status_code, left(content, 300) from net._http_response order by created desc limit 3;
```

Expected: `succeeded`, `200` with `sent` / `failed` / `removed` counts; `failed: 0` once the secrets are set.
