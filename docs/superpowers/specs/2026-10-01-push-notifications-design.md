# Push notifications — design

Status: approved in conversation 2026-10-01; this spec is for review.
Supersedes §6 ("Push alerts") of `2026-09-30-hiking-app-design.md`, which
covered only the hike alert. The home-screen widget is a separate
sub-project with its own spec.

## 1. Intent

**The owner asked for:** push notifications as the next app feature, with all
three kinds — weather alerts, a morning briefing and hike alerts — each
switchable (answer D); alerts for **one home city** (A); alert triggers
**rain soon, thunderstorms, severe weather, heat** (1, 2, 3, 5 — not frost);
quiet hours 22:00–07:00 with severe weather exempt; at most 3 weather alerts
a day; the briefing at an **hour the user picks** (A); delivery **approach 1**
(official Capacitor plugin, server sends to FCM and APNs directly).

**Why (assumed, not contradicted):** reasons to install and keep the app —
the website can't do this — and native value for Apple's review.

**Success looks like:**
- someone who turns on alerts gets a heads-up 30 min–2 h before rain,
  storms or severe weather in their home city, and is never woken at night
  except for severe weather;
- the briefing arrives at the chosen hour in their language and unit;
- a planned hike gets the evening-before summit window and at most one
  morning update;
- 1 or 1,000 phones in a city cost the same forecast requests per hour;
- works on Android (Pixel emulator) and iOS (simulator on the owner's Mac).

**Out of scope:** frost alerts, several cities per phone, location-based
alerts, the website (it can't receive them), rich notifications (images,
action buttons), the home-screen widget.

## 2. Facts this rests on

Verified 2026-10-01:
- `@capacitor/push-notifications` 8.1.2 exists for Capacitor ≥ 8.
- The outlook's hourly items carry `rainPct`, `windKmh` (10 m mean wind),
  `code` (WMO, model majority) and `temp`; `days[0].tempMax` is today's
  high; `nowLocal` and `sun` are city-local. `/api/outlook` and `/api/hike`
  are CDN-cached (30 min) per URL and geocode in the given language.
- The Apple Developer membership is active (owner, 2026-10-01).

To verify at the start of the relevant step (not assumed):
- The plugin yields an APNs token on iOS and an FCM token on Android, and
  Android picks up `google-services.json` through the template's
  google-services plugin hook.
- Remote pushes reach the iOS Simulator (Xcode 14+, Apple-silicon Mac,
  APNs sandbox).
- APNs ES256 JWT via `node:crypto` (`dsaEncoding: 'ieee-p1363'`) and
  HTTP/2 via `node:http2` run in a Vercel Node function; FCM HTTP v1 with a
  self-signed RS256 service-account JWT.

## 3. What people see (app only)

**Permission, in context.** The system prompt appears only after the user
asks for notifications — never at launch.
- After the 3rd forecast view, a quiet card under the headline: "Get a
  heads-up before rain in {city}?" [Turn on] [×]. × hides it for good; the
  count and the dismissal live in native storage.
- More → Notifications offers the same at any time.

**More → Notifications**
- Home city — preset to the most-viewed city (per-city view counts kept in
  native storage next to the prompt counter), changeable via the city search.
- Weather alerts: Rain soon · Thunderstorms · Severe weather · Heat.
- Morning briefing: switch + hour (05:00–11:00, default 07:00, city time).
- Hike alerts: the planned hikes, each removable.
- One line on quiet hours and the daily cap.
- "Send a test notification".
- If notifications are blocked in system settings: a note and a button that
  opens them.

**Hike alerts.** A 🔔 "Plan a hike" on a peak → pick a day (today … +7).

**Tap** opens the city's forecast (alerts, briefing) or the peak (hike).

**Texts** (5 languages, the user's unit; examples in English):
- Rain: "🌧 Rain in Vienna from 15:00 (80 %)"
- Storm: "⛈ Thunderstorms likely in Vienna 16:00–19:00"
- Severe: "⚠️ Heavy rain in Vienna from 14:00" / "strong wind" / "heavy snow"
- Heat: "🌡 Hot day in Vienna: up to 34°"
- Briefing: "Vienna today · 12–21°, dry · best time outside 14:00"
- Hike: "⛰ Triglav tomorrow: summit window 07:00–11:00" / "no safe window —
  storms from 11:00"

## 4. Data and API

**Device identity without accounts.** On first launch the app creates a
random 32-byte key and keeps it in native storage (`@capacitor/preferences`
— WebView storage can be purged by iOS). Every request sends it in
`x-device-key`; the server stores only its SHA-256.

**Tables** (Supabase, RLS enabled with no policies — service role via the
API only; excluded from backups, not learned state):
- `push_devices`: `id` uuid pk · `key_hash` text unique · `token` text
  unique · `platform` ('ios'|'android') · `apns_env` ('prod'|'sandbox',
  null on Android) · `lang` · `unit` ('C'|'F') · `home_name` text null ·
  `alert_rain`, `alert_storm`, `alert_severe`, `alert_heat`, `briefing`
  bool (default false) · `briefing_hour` smallint (5–11, default 7) ·
  `created_at` · `last_seen`.
- `hike_plans`: `id` uuid · `device_id` → push_devices (cascade) · `name`,
  `lat`, `lon`, `elev` · `date` · `sent_evening`, `sent_morning` bool ·
  `last_window` jsonb · `created_at`. Max 10 open plans per device.
- `push_log`: `id` · `device_id` (cascade) · `kind` ('rain'|'storm'|
  'severe'|'heat'|'briefing'|'hike_evening'|'hike_morning'|'test') · `ref`
  text (spell start `YYYY-MM-DDTHH:00`, date, or plan id + slot) ·
  `sent_at`. Index on (device_id, sent_at).

**API** (`x-device-key` authorises every call; per-IP rate limit like the
other routes; bodies validated in a pure `lib/push/validate.js`):
- `POST /api/push/register` `{ token, platform, lang, unit }` — upsert by
  key hash; a token held by another row moves here (the old row is
  deleted); refreshes `last_seen`. Called at every app start.
- `GET /api/push/settings` → switches, hour, home city, open plans.
- `PUT /api/push/settings` `{ home_name?, alert_*?, briefing?,
  briefing_hour?, lang?, unit? }`.
- `POST /api/push/plans` `{ name, lat, lon, elev, date }`;
  `DELETE /api/push/plans?id=`.
- `POST /api/push/test` — one test message, at most once a minute.
- `GET /api/push/dispatch` — hourly job only (Vault key header, like
  `station-calibrate`); `?dry=1` returns what would be sent without sending.

Forecasts for the job are fetched the way the app fetches them —
`/api/outlook?city=<home_name lower-cased>&lang=<lang>` and `/api/hike` —
through the public domain, so they hit the same CDN copies and the same place.

## 5. The hourly job

pg_cron `push-dispatch-hourly` at :05 → `GET /api/push/dispatch` (Vault key,
same pattern as `station-calibrate-hourly`, recorded in `supabase/cron.sql`).

1. Load devices with any switch on, plans due in the next day, and each
   device's log for the last 24 h.
2. Fetch each distinct (home city, language) outlook once, and each distinct
   planned peak's `/api/hike` once.
3. For each device, the pure `decide()` (`lib/push/rules.js`) returns the
   messages; texts come from `lib/push/text.js`.
4. Send, log each success, handle failures (§6).

**Rules** (all in city-local time from the outlook's `nowLocal`; hours are
the outlook's hourly items):

| Kind | Fires when | Dedupe |
|---|---|---|
| Rain soon | first hour with `rainPct` ≥ 60 starts 30 min–2 h from now, and the 2 hours before it are < 40 | no rain alert with a start hour within 3 h |
| Thunderstorms | a code 95–99 hour starts within 1–4 h; the message spans the consecutive storm hours; replaces "rain soon" for the same stretch | 6 h |
| Severe | within 1–6 h: code 65, 67, 75, 82 or 86, or `windKmh` ≥ 60; allowed in quiet hours | 6 h per type |
| Heat | `days[0].tempMax` ≥ 30 °C; at the first run after 07:00, or inside the briefing when that is on | per date |
| Briefing | local hour = `briefing_hour`, or up to 2 h later if that run was missed | per date |
| Hike | 18:00 peak-local the evening before; 06:00 on the day if the window moved ≥ 1 h or appeared/disappeared (vs `last_window`) | per plan and slot; retried until the slot is 3 h old |

- Quiet hours 22:00–06:59 apply to weather alerts: only severe gets through.
  The briefing and hike alerts come at their set times (a 06:00 briefing or
  the 06:00 hike update is asked for, not an interruption).
- Cap: at most 3 weather alerts (rain, storm, severe, heat) per local day;
  briefing, hike and test messages don't count.
- Priority when the cap would be hit: severe > storm > rain > heat.
- Thresholds are constants in `lib/push/rules.js`, to be tuned with real use.

## 6. Sending

- **Android — FCM HTTP v1:** OAuth token from a service-account JWT (RS256,
  `node:crypto`), cached in module scope until 5 min before expiry. Channels
  "Weather alerts" (high), "Morning briefing" (default), "Hike alerts"
  (default), created by the app.
- **iOS — APNs HTTP/2:** ES256 provider JWT (key id + team id), reused ≤ 50
  min; topic `app.metablend`, push type `alert`, collapse id per kind.
  `apns_env` unknown → try production; `BadDeviceToken` → retry sandbox and
  store the working one.
- Payload: title, body, and `url` (city forecast or peak) that the app opens
  on tap.
- FCM `UNREGISTERED` / invalid token, APNs 410 or `BadDeviceToken` in both
  environments → delete the device. Other errors → `error_log`, not logged
  as sent, so the next run retries within the rules above.
- Secrets, set by the owner in Vercel (never in chat):
  `FIREBASE_SERVICE_ACCOUNT` (JSON), `APNS_KEY` (.p8 contents),
  `APNS_KEY_ID`, `APNS_TEAM_ID`. `google-services.json` goes into
  `mobile/android/app/` on the owner's machine (git-ignored); the iOS target
  gets the Push Notifications capability in Xcode.

## 7. Privacy and retention

Privacy page (5 languages): push token, a hash of a random device key, home
city, notification switches and hour, planned peaks and dates, language and
unit, and a 14-day send log — nothing else, no account, no location.
Nightly `/api/cleanup`: delete devices unseen for 90 days, plans after their
day, log rows after 14 days.

## 8. Testing

- `decide()` unit-tested with recorded outlook / hike fixtures: rain edges
  (59/60 %, 29 min / 2 h leads, a wet hour before), storm replacing rain,
  severe in quiet hours, the cap and its priority, spell dedupe, heat folded
  into the briefing, missed-run catch-up, hike window change ≥ 1 h.
- `text.js`: every kind in 5 languages, °C and °F.
- `validate.js`: register / settings / plan bodies.
- Senders with injected fetch / http2: JWT shape, retry-sandbox path, token
  deletion on the error codes above.
- `?dry=1` against production data before the first real send.
- On devices: the test button, then a real alert on the Pixel emulator and
  the iOS Simulator (owner, following a checklist added to `mobile/README.md`).

## 9. Build order (one plan)

1. Server: migration (tables), `lib/push/*` (validate, rules, text, fcm,
   apns), the API routes, the dispatcher, pg_cron, cleanup, privacy text.
2. App: plugins (`@capacitor/push-notifications`, `@capacitor/preferences`),
   device key + registration, More → Notifications, the soft prompt, the
   hike 🔔, tap routing, Android channels.
3. Android end to end on the emulator — needs the owner's Firebase project.
4. iOS end to end in the Simulator — needs the owner's APNs key (.p8) and the
   capability in Xcode.
