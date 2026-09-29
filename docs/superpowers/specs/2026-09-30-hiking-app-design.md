# MetaBlend app with app-exclusive hiking — design

Date: 2026-09-30 · Status: approved in brainstorming (scope, approach 1,
sections 1–4: hiking engine, app shell, push alerts, teaser/testing/release)

This merges the two remaining sub-projects of the 2026-09-29 plan (mountains
& hiking hub, Android/iOS apps): hiking becomes the app's exclusive feature.
One spec; implemented in five phases, each with its own plan (§9).

## 1. Intent

**Said by the owner:**
- Make hiking "an app exclusive so people actually download it".
- The app contains everything the website has, plus hiking.
- Hiking v1 = mountain weather for a peak (option A); weather along a route
  (option B) is wanted later, not now.
- Peaks: worldwide search plus featured Alps peaks.
- Free, no login, but leave room for paid extras later (in-app purchases).
- Owner has a MacBook Air (iOS builds) and works on Windows otherwise.

**Assumed and confirmed:**
- The website keeps all current features; `/hike` on the web is a teaser that
  sells the app and catches mountain searches, not a hidden page.
- Build approach: a Capacitor shell around the live site (approach 1 of 3),
  chosen because "everything the website has" rules out rebuilding screens.
- One push alert type in v1: the summit window for a planned hike.
- All UI text in 5 languages (en, de, fr, es, it), like the rest of the app.

**Success looks like:**
- people install the app because hiking is only fully usable there;
- the app passes Apple review (guideline 4.2: real native value — hiking
  exclusive, push, native location, app navigation);
- a planned hike gets one useful notification the evening before, and at
  most one update on the morning itself;
- a peak viewed by 1 or 1,000 people costs the same upstream calls per 30 min.

**Out of scope (v1):** routes / GPX (v2), live GPS tracking, offline maps,
home-screen widgets (v1.1 candidate — first thing to add if Apple objects),
in-app purchases, accounts, avalanche bulletins.

## 2. Verified facts this design rests on (probed 2026-09-30)

- Open-Meteo forecast accepts `elevation=<m>` and downscales to it
  (Großglockner, 3798 m requested → temperatures ~1 °C below the 3641 m
  default).
- Per model at a summit (7 models probed): `cape` from 6 of 7 (not JMA);
  `freezing_level_height` only GFS and ICON; `wind_speed_700hPa` /
  `temperature_700hPa` broadly available; `lightning_potential` only ICON
  (Europe); `visibility` only GFS / ICON.
- Open-Meteo geocoding (GeoNames) finds famous peaks (feature code `MT`) with
  elevation but misses many (no Austrian Schneeberg).
- Photon (photon.komoot.io, OpenStreetMap) finds peaks (`osm_tag=natural:peak`)
  and huts (`tourism:alpine_hut`) worldwide, but returns no elevation, and its
  ranking is not by prominence.

Still to verify at the start of the relevant phase (not assumed):
- Photon public-instance usage policy and attribution; OSM ODbL attribution.
- Capacitor injects its native bridge into pages loaded via `server.url`
  (needed for plugins on the remote site) and supports `appendUserAgent`.
- FCM HTTP v1 send via a service-account JWT (RS256) with no SDK.
- Current Apple / Google store requirements for the listings.

## 3. Hiking engine (phase 1)

New pure modules under `lib/hike/` (ESM, unit tested), plus two routes.

### 3.1 Peaks

- `lib/hike/featured.json` — ~40 hand-picked Alps peaks and huts (AT, DE,
  CH, IT, FR, SI): `{ id, name, lat, lon, elev, country, kind: 'peak'|'hut' }`
  with exact published heights. Coordinates resolved once by a script
  (`scripts/build-featured-peaks.mjs`) via Photon, then committed.
- `GET /api/peaks?q=<text>&lat=&lon=` — worldwide search:
  1. Photon with `osm_tag=natural:peak`, `natural:volcano`,
     `tourism:alpine_hut`, location bias from `lat`/`lon` when given;
  2. heights for results without one from the Open-Meteo elevation API
     (one batched call);
  3. featured entries that match are merged in first (exact heights win);
  4. fallback when Photon fails: Open-Meteo geocoding filtered to mountain
     feature codes.
  Response: `[{ id, name, lat, lon, elev, country, region, kind }]`, max 10.
  CDN-cached per query (`s-maxage` 1 day). Rate-limited like `/api/forecast`.

### 3.2 Summit forecast — `GET /api/hike?lat=&lon=&elev=&name=`

One Open-Meteo multi-model request (the outlook's models) with
`elevation=<elev>` and the hourly variables: temperature, apparent
temperature, precipitation probability/amount, weather code, `cape`,
`freezing_level_height`, `lightning_potential`, cloud cover, and
temperature + wind at 850 / 700 / 600 hPa. 8 days, city-local time.

Pure pieces (each unit tested):
- `summitWind(elev, levels)` — linear interpolation between the pressure
  levels that bracket the summit (850 ≈ 1500 m, 700 ≈ 3000 m, 600 ≈ 4200 m;
  below 1500 m the 10 m wind is used). Reason: 10 m model wind sits on
  smoothed terrain and understates ridge wind.
- `freezingLevel(point, elev)` — the model's value where published (GFS,
  ICON), else derived from summit temperature with the standard lapse rate
  (0.65 °C / 100 m), clamped to ≥ 0 m.
- `stormRisk(hour)` — `low | moderate | high`, starting values (one table,
  tuned later against real days): **high** when CAPE ≥ 1000 J/kg and rain
  chance ≥ 30 %, or lightning potential ≥ 1; **moderate** when CAPE ≥ 300
  and rain chance ≥ 20 %; otherwise **low**. Blended hours use the weighted
  mean CAPE and rain chance.
- `blendSummit(series, weights)` — the outlook's blend (weighted mean +
  spread band) applied to summit hours and days; weights = the region's
  learned outlook weights (`h48` / `d7`), because summits cannot be
  verified on their own (no METAR on summits). The page states this.
- `summitWindow(hours, sun)` — longest run of daylight hours (reusing the
  outlook's sunrise/sunset rule) that are dry (rain < 30 %), storm risk low,
  summit wind < 40 km/h, apparent temperature > −20 °C. Returns
  `{ from, to }` or null plus the first "why not" after it
  (`storms_from`, `wind_from`, `rain_from`).
- `buildHike(...)` — assembles the payload: peak, `nowLocal`, `sun`,
  `hourly` (168 h: temp band, apparent temp, rain, summit wind, freezing
  level, storm risk, icon), `days` (7: summit high/low, freezing level
  range, max storm risk, rain chance), `windows` (`today`, `tomorrow`),
  `headlines` (codes; sentences come from `lib/hike/text.js` like the
  outlook's `text.js`), `notes`.

Caching: CDN `s-maxage` 1800 / SWR 3600, key = coordinates rounded to 3
decimals + elevation; errors `no-store`. Rate limit like `/api/outlook`.

## 4. Hiking UI (phase 2)

`/hike` renders one of two views from the same route:

- **App view** (request carries the app marker, §5.2): peak search (with
  "near me" via native location), featured peaks, and a peak page with tabs
  **Today · Tomorrow · Week** mirroring the outlook: headline (e.g. "Summit
  window tomorrow 07:00–12:00 · storms likely after 14:00"), hourly chart
  with the summit temperature band plus rows for summit wind, freezing level
  and storm risk, hour strip, and the "borrowed trust" note. "🔔 Plan a hike"
  button (phase 4).
- **Web teaser** (everyone else, server-rendered, crawlable): "Mountain
  weather lives in the app", a live summit window for one featured peak
  (rotates daily by date), the featured list without details, store badges
  (`lib/hike/stores.js` holds the store URLs; "Coming soon" while empty).
  Header nav gets a **Hiking** link next to Aviation.
- Disclaimer on every hiking view, like Aviation: mountain weather changes
  fast; not a substitute for official mountain forecasts and judgement.

## 5. App shell (phase 3)

### 5.1 Project

`mobile/` holds a Capacitor project: `capacitor.config.ts`, `android/`,
`ios/`, `www/` (a tiny bundled offline page: "No connection · Retry").
App name **MetaBlend**, bundle ID `app.metablend`, `server.url`
`https://metablend.app`, `appendUserAgent: 'MetaBlendApp'`.

### 5.2 App detection

- Server: user agent contains `MetaBlendApp` → `lib/app-client.js`
  `isAppRequest(headers)`.
- Client: `window.Capacitor?.isNativePlatform()` → `isNativeApp()`.
- Dev/test switch: `?app=1` sets a cookie that the server treats like the
  user agent (so screenshots and local testing can render the app view in
  a normal browser). Never shown in the UI.

### 5.3 Native pieces

Plugins (JS packages added to the web app, no-ops on the website): push
notifications, geolocation, share, haptics, status bar, splash screen, app
(Android back button, links). External links open in the system browser.

### 5.4 App-only UI

- Bottom tab bar **Forecast · Hiking · More** (More: leaderboard, heatmap,
  aviation, planner, settings), safe-area aware (notch, home indicator).
- Hidden in the app: "Install app" button, website footer.
- Share uses the native share sheet.

### 5.5 Builds

Android: Android Studio on Windows. iOS: Xcode on the MacBook (pull, one
sync command, build). Store updates only when native parts change; web
changes ship with every normal deploy.

## 6. Push alerts (phase 4)

### 6.1 Behaviour

"🔔 Plan a hike" on a peak → pick a day (today … +7 days).
- **18:00 peak-local, the evening before:** summit window for that day, or
  "no safe window" with the reason ("storms from 11:00").
- **06:00 peak-local, on the day:** a second push only if the window moved
  by ≥ 1 h or appeared/disappeared.
- The plan expires after its day. No recurring alerts.

### 6.2 Data (Supabase, RLS deny-all, service role via API only)

- `devices`: `id`, `token` (unique), `platform` (`ios|android`), `lang`,
  `unit`, `key_hash` (SHA-256 of a random device key the app generates and
  keeps in native storage), `created_at`, `last_seen`.
- `hike_plans`: `id`, `device_id`, peak `name/lat/lon/elev`, `date`,
  `utc_offset_sec`, `sent_evening`, `sent_morning`, `last_window`
  (json), `created_at`.

API (device key in a header authorizes every change):
- `POST /api/push/register` — upsert device by token.
- `POST /api/push/plans` / `DELETE /api/push/plans/:id` / `GET /api/push/plans`.

### 6.3 Sending

- pg_cron job `hike-push-hourly` at :05 → `GET /api/push/dispatch` with the
  Vault key (same pattern as `station-calibrate-hourly`).
- Dispatcher: select plans whose 18:00 (day before) or 06:00 (day of) has
  just passed in peak-local time and not yet sent → compute each distinct
  peak's window once → build messages per device language → send via FCM
  HTTP v1 (Android direct, iOS via APNs key in Firebase) → mark sent.
- FCM auth: service-account JWT signed with `node:crypto` (RS256), token
  cached until expiry. `UNREGISTERED` / invalid token → delete device.
- Owner setup (secrets never in chat): Firebase project, Apple APNs key
  uploaded to Firebase, service account JSON in Vercel env
  `FIREBASE_SERVICE_ACCOUNT`, `google-services.json` /
  `GoogleService-Info.plist` in the native projects.

### 6.4 Privacy & retention

Privacy notice (5 langs): push token, planned peaks and dates, language and
unit; nothing else. Nightly `/api/cleanup`: delete plans after their day,
devices unseen for 90 days. Backup excludes both tables (not learned state).

## 7. Error handling

- Photon down → geocoding fallback; both down → search shows "Search is
  unavailable, try a featured peak".
- Elevation API down → results without `elev` are dropped from search
  (a summit forecast needs a height).
- Open-Meteo down → `/api/hike` 502 `no-store`; the page shows the retry
  state the outlook already uses.
- Models missing a variable are skipped for that variable only; a summit
  window is still computed if at least one model reports storm energy,
  otherwise the headline says the storm risk is unknown.
- Push send failures are logged per plan; the plan stays unsent and is
  retried on the next hourly run until the slot is 3 h old.
- App launched offline → bundled offline page with retry.

## 8. Testing

- Test-first for every pure module: `summitWind`, `freezingLevel`,
  `stormRisk`, `summitWindow`, `blendSummit`, `buildHike`, peak result
  merging, `isAppRequest`, due-plan selection, message building (5 langs),
  JWT signing (with a generated test key).
- Recorded fixtures (Open-Meteo summit response, Photon, elevation API)
  via `scripts/record-hike-fixtures.mjs`.
- UI: the headless Edge phone script at 390 px renders both the teaser and
  the app view (`?app=1`); checks overflow and console errors each phase.
- Devices: Android phone/emulator; iPhone via Xcode + TestFlight.

## 9. Phases

1. Hiking engine: `lib/hike/*`, featured list, `/api/peaks`, `/api/hike`.
2. Hiking UI: `/hike` app view + web teaser, header link, 5 languages.
3. Capacitor shell: `mobile/`, app detection, plugins, tab bar, offline
   page; Android first, then iOS.
4. Push alerts: tables, device/plan API, dispatcher, pg_cron, FCM, privacy.
5. Store preparation: icon, screenshots at store sizes, listings (en, de),
   Apple privacy details, Google data-safety form, release checklist.

Each phase: its own implementation plan, test-first, lands on `main`.
