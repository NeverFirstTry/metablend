# Changelog

All notable changes to MetaBlend. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Dates are UTC.

## 2026-07-12

### Verified
- **Aviation math audited against independent references.** On live METARs for
  LOWI, LOWW, EDDM, EGLL, KJFK and KLAX: flight-rules classification matches
  aviationweather.gov's own category everywhere and the NWS boundary table on
  all 12 edge cases; runway wind components match an independent vector-math
  implementation on every runway end, with the from-left/from-right sign
  convention proven by known-answer cases; pressure altitude is within 3 ft of
  the FAA formula. Density altitude reads 15–112 ft *above* the exact ISA
  dry-air value on the test fields — conservative in the safe direction; the
  page already labels it an approximation and defers to POH charts. The red
  "not for flight planning" disclaimer renders unconditionally in the page
  component and was confirmed live on all 16 sitemap airports.
- Terms now call out the Aviation pages explicitly in the safety-critical
  clause (all 5 languages) and credit OurAirports in the attribution list.

## 2026-07-11

### Added — MetaBlend Aviation
- **`/aviation` hub with ICAO search and `/aviation/<icao>` airport pages**:
  decoded METAR and TAF, flight-rules badge (VFR/MVFR/IFR/LIFR), head/cross
  wind components for every runway end (best headwind starred), pressure and
  density altitude — NOAA Aviation Weather Center data plus OurAirports
  runway data, 12,118 ICAO airports bundled at build time. Supplementary
  information only; a "not for flight planning" disclaimer sits on every
  page. Linked from the header nav (5 languages) and the footer.

### Added
- New app icon (cloud + sun in brand emerald), rasterized from an SVG source
  into all favicon/PWA sizes.
- Contact address info@metablend.app in the footer and the privacy notice
  (all 5 languages).

### Fixed
- **Batch weight upsert violated the live NOT NULL constraint on `name`** —
  every batch since the 07-09 speedup had silently fallen back to the slow
  per-row path (the error-log tripwire added on 07-09 caught exactly this,
  194 entries). Batch rows now carry the name column; verified clean in
  production.
- Plausible reports to the single canonical domain now that metablend.app
  exists in the dashboard.

## 2026-07-09

### SEO
- **metablend.app is the canonical domain everywhere** — share text, embed
  widget, RSS feed, OG image, README and the GitHub workflows (redirect-safe
  `curl -L`, so flipping Vercel's primary-domain redirect can't break crons).
- **IndexNow ping on every deploy** (GitHub Action + public key file) for
  instant Bing/Yandex indexing; honest sitemap `lastModified` for static
  pages.
- All meta descriptions trimmed under Bing's 160-character limit — URL
  inspection flagged them as Errors, which counts against indexing a new
  domain.

### Fixed
- **Hourly station calibration no longer 504s**: weight upserts batched (17
  round-trips → 1), METAR ground truth prefetched in parallel across cities,
  `maxDuration 300` on the calibration routes. Batch failures now log to
  `error_log` instead of silently degrading.

## 2026-07-07

### Added — per-city pages
- **Server-rendered city pages** at `/weather/<slug>` (e.g. `/weather/vienna`)
  with a crawlable hub at `/weather`: real consensus data in plain HTML —
  current conditions, a semantic 7-day table, which sources are currently most
  trusted in that region, and climate context. ISR-cached 15 minutes (no
  build-time fetching, so deploys don't burn upstream quota). 54 curated
  cities in the sitemap; any other city renders on demand. This is the
  programmatic-SEO surface: "weather <city>" queries vastly outnumber
  "weather app" queries, and the per-city accuracy data is content nobody
  else has.
- **`/?city=X` deep links work now** — the home page loads that city on
  mount. The RSS feed has been linking to these URLs all along; they used to
  do nothing.
- Plausible analytics now report to both domain dashboards (comma-separated
  `data-domain`), so canonical-domain visits aren't lost.

### SEO
- **The site is finally findable.** English-first metadata (the html said
  `lang="de"` with German titles while the SSR content is English), a
  keyword-rich title/description with a `%s · MetaBlend` template, per-page
  titles and descriptions for the leaderboard, heatmap, planner, privacy and
  terms (they all shared the root title before), JSON-LD `WebApplication`
  structured data, and `metablend.app` declared as the canonical domain across
  metadata, sitemap and robots — consolidating ranking signals that were split
  between the two live domains.

### Added
- **Consensus 7-day forecast.** The daily strip was single-source (Open-Meteo
  only) — odd for a product whose thesis is "never trust one source". It now
  blends five keyless daily forecasts (Open-Meteo best-match, GFS, ICON,
  ECMWF, MET Norway) per day with the same learned weights as the live blend
  (`blendDailyForecasts`, pure and unit-tested).
- **Wind accuracy counts now.** METAR observations carry wind; hourly station
  calibration scores each source's wind forecast on a stricter-scaled scheme
  (±3/8/15/25 km/h) as a second delta alongside temperature.
- **Day/night bias buckets for MetaBlend Local.** Consensus errors are
  asymmetric (models miss nighttime cooling), so the per-city bias now learns
  and serves separate day (06–21 local) and night buckets, falling back to a
  samples-weighted blend while one bucket is still cold.
- **Nightly backups.** `/api/backup` exports the learned state (weights, bias,
  feedback, stats) and a GitHub Action stores it as a 30-day artifact —
  Supabase's free tier has no automated backups and this data is the product's
  memory. Reuses the existing `CALIBRATE_SECRET`; `error_log` excluded.
- **Learning-pipeline unit tests.** The weight normalization core
  (`buildWeightUpdates`), the bias EMA (`emaBias`) and the daily blender are
  now pure, exported and covered by `node --test` (21 tests).

## 2026-07-06

### Fixed
- **Hourly station calibration actually runs now.** It required a Weather
  Underground PWS key that was never configured, so every hourly run since
  launch had silently skipped. Ground truth now comes from aviation METAR
  observations (NOAA Aviation Weather Center — free, no key): all fresh
  reports within 60 km of each recently-searched city, median of the nearest
  four. One bbox request per city instead of up to seven, and it feeds
  MetaBlend Local's per-city bias learning from day one.

### Added
- **Six new keyless sources.** ECMWF IFS, NOAA GFS and DWD ICON as individual
  model feeds via Open-Meteo (genuine model diversity, each weighted
  separately), plus three regional agencies: NWS/weather.gov (US, hourly
  gridpoint forecast with real precipitation probability), Bright Sky/DWD
  (Germany, station observations) and SMHI (Scandinavia + Baltic, the new
  snow1g API — pmp3g was retired 2026-03). All verified against the live
  endpoints; regional sources return null outside their coverage boxes.
- **MetaBlend Local — our own prognostic source.** The live consensus
  corrected by a learned per-city temperature bias: an EMA of
  (ground truth − consensus) fed by user feedback and the hourly PWS station
  calibration (`lib/blend.js`, new `city_bias` table, RLS enabled). Served
  once a city has ≥3 samples. Deliberately excluded from the consensus it
  derives from (no circularity), but stored and scored like any other source —
  the leaderboard will show whether it earns its keep.
- **The whole site speaks all five languages now** (EN/DE/FR/ES/IT), not just
  the home page: the privacy notice and terms are fully translated (server
  wrapper keeps the SEO metadata, a client component renders the localized
  body from the language cookie), and the leaderboard, heatmap, planner and
  footer use the shared dictionary via a new `useLang()` hook. Month names in
  the planner localize via `toLocaleDateString`. The consent-banner text now
  honestly lists the preference cookies (language, unit, theme, recent
  cities) instead of claiming there is only one.
- **Light mode.** Dark stays the default and the brand; the sun/moon toggle in
  the header opts into a print-style light theme (paper surfaces, ink text,
  the emerald recalibrated to emerald-700 for AA contrast on white). The JSX
  keeps its dark-palette classes — `globals.css` owns the entire translation
  in one `[data-theme="light"]` block, applied before first paint via a cookie
  (`metablend_theme`), so there is no flash either way. Map tiles drop the
  dark-invert filter in light mode.
- **The current condition is finally in the hero** — big weather icon plus the
  translated condition ("Partly cloudy") above the temperature, judged
  day/night by the city's own clock. Previously the single most-asked weather
  question was only answered inside the per-source cards.
- **The MetaBlend logo is clickable** and returns to the start view.

### Accessibility
- Dimmest text bumped from `zinc-600` to `zinc-500` everywhere (the old value
  sat below AA contrast on the card background); visible `:focus-visible`
  outline for keyboard users; the toast announces via `role="status"`; unit
  toggle exposes `aria-pressed`; the language select and theme toggle have
  proper labels in all five languages. (Reduced-motion support already
  existed.)

### Changed
- **Privacy notice matches reality again.** Community feedback is retained to
  power the heatmap and long-term rankings (it was previously described as
  deleted within 48 h — true before yesterday's retention change); reports
  always carry the searched city's geocoded coordinates, never device GPS,
  and the notice now says so; the server-side validation providers (Weather
  Underground, Meteostat) are listed as data recipients.

## 2026-07-05

Correctness pass on the consensus and the learning loop (after a code review).

### Fixed — rain consensus
- **`rainPct` no longer mixes humidity/cloud cover into the rain answer.** Every
  source now declares whether its number is a true precipitation probability
  (`rainIsProb`); OpenWeatherMap, WeatherAPI, World Weather Online and
  Weatherstack were reporting cloud cover or humidity as "rain %", which biased
  "Will it rain today?" toward yes. The consensus rain %, the ≥40% yes/no answer
  and the heavy-rain warning now use only real probabilities (Open-Meteo,
  MET Norway, Tomorrow.io, Visual Crossing), with the NASA POWER / GeoSphere
  precip-amount heuristics as fallback. Sources without a probability show no
  rain % on their cards.

### Fixed — timezones
- **"Best time to be outside" uses the city's clock, not the server's** (UTC on
  Vercel). Previously the "hours left today" filter was wrong for any city far
  from UTC.
- **The "no sunny reports at night" guard is now local time**, estimated from
  the report's longitude — it was checking UTC, which blocked e.g. Sydney from
  reporting sun for most of its day.

### Fixed — weight learning loop
- **New `lib/weights.js`** — the load → score → normalize → persist pipeline the
  five calibration paths had each copy-pasted (and let drift) now lives in one
  place. Persistence uses an **upsert**: the old `.update().eq(region)` silently
  no-oped when the `(id, region)` row didn't exist, and its error fallback wrote
  to every region at once.
- **`/api/calibrate` scores with the `daily` thresholds** — it compares point
  forecasts against Visual Crossing's 24-h mean, same as the Meteostat check,
  but was using the tighter `instant` scheme.
- **No more double scoring** — the Meteostat validation in `/api/cleanup` now
  runs only when Visual Crossing isn't configured, so each day's forecasts are
  scored once, not twice against two different ground truths.
- Meteostat validation skipped days whose average temp was exactly 0 °C (falsy
  check), scored duplicate forecast rows per API instead of the latest, and
  lacked the ±5 °C outlier guard the other paths apply — all fixed.
- "Latest forecast per API" is now actually the latest (`order by created_at`;
  row order was unspecified before).

### Fixed — dates & stats
- **Forecasts are tagged with the city's local date**, not the server's UTC
  date (`localDateForLon`, solar-time approximation from the longitude). An
  evening search in Asia/Pacific used to land on the wrong calendar day, so
  daily calibration compared it against the wrong day's actuals. The
  "vs yesterday" badge uses the city's yesterday too.
- **`api_stats` updates are atomic** — a new `bump_api_stats` DB function
  (setup_all.sql) does the EMA + counters in one upsert, so concurrent forecast
  requests can't clobber each other's counts. Falls back to the old
  read-modify-write on DBs that haven't re-run setup_all.sql. Anon execution is
  revoked so the public key can't pollute stats via `/rpc`.
- **`npm run lint` actually lints now** — the script was a bare `eslint` with
  no target, which checks nothing; it's `eslint .`. The two
  `react-hooks/set-state-in-effect` errors it then surfaced (the deliberate
  post-hydration cookie/localStorage sync in `page.js` and the widget) are
  documented and locally disabled — reading those values in a state
  initializer would cause a server/client hydration mismatch.

### Changed
- **Community feedback is no longer deleted after 48 h** — only the internal job
  sentinels age out. Real reports feed the heatmap, which was pointless with a
  two-day memory.
- `/api/cleanup` is no longer fired on every forecast cache miss (it's a daily
  cron; that was two table-scan deletes per search).
- Job routes (`calibrate`, `cleanup`, `station-calibrate`, `self-calibrate`)
  declare `maxDuration = 60` so long runs aren't cut off at the default limit;
  station-calibrate reads its PWS stations in parallel.
- Feedback rejected by validation no longer burns the one-report-per-hour slot
  (the limit is marked only after a report is accepted).
- A weather source with an invalid API key (401/403) is treated as "not
  configured" instead of showing as "down".
- City suggestions are debounced (250 ms) and drop out-of-order responses.

## 2026-06-22

Security hardening pass (after an application security review), plus social/SEO
and attribution fixes.

### Security
- **Rate limit on `/api/forecast`** — the cache-miss path is throttled per IP
  (40/min) so nobody can drain the metered upstream weather APIs (and run up
  costs) by spamming distinct cities. Cache hits stay free.
- **Cron endpoints gated by `CRON_SECRET`** — `/api/calibrate`, `/api/cleanup`,
  and `/api/webhook` now reject unauthenticated callers once `CRON_SECRET` is
  set (Vercel attaches it to cron invocations automatically; the forecast route
  passes it on its internal calls). Until it's set they stay open, so nothing
  breaks before the env var is added. New shared helper `lib/auth.js`.
- **Removed the legacy `/api/migrate` route** — an unauthenticated DB-write
  endpoint that `supabase/setup_all.sql` long ago superseded.
- **Calibrate secret is header-only** — `/api/self-calibrate` and
  `/api/station-calibrate` no longer accept the secret as a `?key=` query param
  (query strings can leak into access logs); `x-calibrate-key` / Bearer only.
- **Security headers** — `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  and a `Permissions-Policy` are now sent on every response (`next.config.mjs`).
  No `X-Frame-Options` on purpose, so the `/widget` embeds keep working.

### Added — social & SEO
- **Generated OG/Twitter share image** — `app/opengraph-image.js` +
  `twitter-image.js` render a branded 1200×630 card. The old metadata pointed at
  an `og.png` that never existed, so every shared link showed a broken preview.
- **`robots.txt` and `sitemap.xml`** via `app/robots.js` / `app/sitemap.js`.

### Fixed
- **Terms copyright wording** — reworded so "no license … is granted" can't be
  misread as granting one.
- **Privacy notice** now discloses BigDataCloud reverse-geocoding (used only when
  you tap "my location").
- **Rain radar** map tiles carry the standard "OpenStreetMap contributors"
  attribution (matching the heatmap).
- Removed unused create-next-app scaffold SVGs from `public/`.

### Environment variables
- `CRON_SECRET` — gates the cron job endpoints. Set it in the host environment
  (Vercel sends it to crons automatically).

## 2026-06-21

Beta launch hardening: locked down the database, made the forecast resilient,
unified the scoring math, added self-calibration, a few user-facing features,
error logging, and the legal/site pages.

### Security
- **Database locked down with RLS.** All tables now have row-level security
  enabled with **no policies** (deny-all for the public anon key). The server
  uses `SUPABASE_SERVICE_ROLE_KEY` (`lib/supabase.js`), which bypasses RLS; the
  browser only ever talks to `/api/*` routes. Verified via Supabase's security
  advisor.
- **`supabase/enable_rls.sql`** — drops any lingering permissive policies, then
  enables RLS on every app table. **`supabase/setup_all.sql`** — one-shot,
  idempotent, RLS-neutral schema setup (consolidates all migrations, drops the
  `forecasts.api_id` FK that blocked inserts, adds `forecasts.created_at`).

### Calibration & scoring
- **`/api/self-calibrate`** (admin, gated by `CALIBRATE_SECRET`) — probes a
  16-city basket, rebalances weights against the live consensus median, and
  seeds forecasts so the daily cron can refine them against real actuals. A
  "Recalibrate weights" button on the leaderboard triggers it (prompts for the
  key).
- **`/api/station-calibrate`** — finds Weather Underground personal weather
  stations within 10 km of each recently-searched city, takes the median of their
  live temperatures as ground truth, and re-weights the last hour of forecasts
  against it. Real measured actuals. Gated by `CALIBRATE_SECRET` and triggered
  hourly by a GitHub Action (Vercel sub-daily crons need a Pro plan).
- **`lib/scoring.js`** — single source of truth for `median`, `deltaFromDiff`,
  and `rawFactor`; the feedback, calibrate, cleanup, self-calibrate, and
  station-calibrate routes all share it (with a `node:test` suite, `npm test`).
- **Exponential weight scaling** — `rawFactor` now scales `exp(avgScore * 0.5)`
  so accurate sources pull far more weight (linear scaling let weights converge);
  floor lowered to 0.01.
- **Outlier penalty** — any source more than 5 °C off the cross-API median temp
  takes a hard −2, on top of the actual-vs-forecast delta.
- **Feedback re-weights on every report** (`MIN_REPORTS_TO_UPDATE` 5 → 1).

### Reliability
- **Keyless 7-day fallback** — if Open-Meteo's daily endpoint is down, the
  forecast falls back to a MET Norway daily aggregation instead of blanking the
  strip; `geocodeCity`/`fetchOpenMeteo` now degrade on non-OK/non-JSON responses
  instead of 500-ing the route.
- **`/api/cleanup` added to the cron** (daily) alongside `/api/calibrate`.
- Forecast insert failures are now logged instead of silently swallowed.

### Added — source
- **GeoSphere Austria** — a free, keyless DACH-region source (Austria coverage),
  seeded for the `europe` + `global` weight pools only.

### Added — features
- **Favorite cities** — star toggle on a loaded city; saved to `localStorage`
  and shown as chips.
- **Leaderboard accuracy sparklines** — per-API bar sparkline of recent scoring
  deltas (from `delta_history`).
- **PWA install prompt** — an "Install app" button via `beforeinstallprompt`.
- **Beta disclaimer** — a `BETA` badge + in-development banner (`BetaBanner`) on
  every page, translated across EN/DE/FR/ES/IT.

### Added — observability
- **Error logging** — `lib/log.js` (`logError` + `withErrorLog`) always logs to
  the server console (→ Vercel logs) and best-effort writes to a new `error_log`
  table; `/api/forecast` and `/api/feedback` handlers are wrapped.

### Added — legal & site
- **Footer** on every page with a **GitHub source link**, Privacy/Terms links,
  copyright, and weather/map data attribution.
- **`/privacy`** — plain-language notice (cookies, feedback data, IP
  rate-limiting, Plausible analytics, third-party APIs, Supabase/Vercel hosting,
  ~48h retention; contact via GitHub issues).
- **`/terms`** — beta "as is" disclaimer, acceptable use, copyright, and
  data-source attribution/licenses (Open-Meteo CC BY, MET Norway, OSM ODbL, …).
- Heatmap map tiles now carry the standard "© OpenStreetMap contributors"
  attribution.

### Fixed
- **Offline banner** only shows when the device is genuinely offline
  (`navigator.onLine`), not on any failed request.
- **Service worker** (`public/sw.js`) only caches successful same-origin shell
  responses, never the API; cache bumped to `v2`.
- **Leaderboard** falls back to a region-less query on pre-migration databases.

### Changed
- **License changed from MIT to all-rights-reserved.** The source stays public on
  GitHub for transparency, but reuse now requires permission.

### Database migrations (run in the Supabase SQL editor)
- `supabase/setup_all.sql` — full idempotent schema (safe to re-run; RLS-neutral).
- `supabase/enable_rls.sql` — lock the database down (run after setting
  `SUPABASE_SERVICE_ROLE_KEY` in the server env). Adds/locks the `error_log` table.

### Environment variables
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; bypasses RLS. **Required in
  production** once RLS is enabled (set in `.env.local` and on Vercel).
- `CALIBRATE_SECRET` — gates `/api/self-calibrate`.
- `WUNDERGROUND_KEY` — Weather Underground PWS API key for `/api/station-calibrate`
  (the hourly cron requires a Vercel plan that allows sub-daily crons).

## 2026-06-04

A large batch of new features, internationalization, docs, and fixes.
Baseline for this entry is commit `5a5e2f5` (9 weather sources, region weights,
median-based feedback weighting).

### Added — forecast & display
- **Rain radar** — Leaflet map with a live RainViewer overlay over an
  OpenStreetMap base, loaded from CDN (`lib/leaflet.js`, `app/components/RainRadar.jsx`).
- **UV index, air quality (AQI) & pollen** — fetched from Open-Meteo's keyless
  air-quality API and shown as color-coded cards in the hero.
- **Simple rain answer** — a large "Yes, it will rain today 🌧 / No rain today ☀️"
  card driven by the 40% consensus threshold.
- **Severe-weather warning** — prominent red card when every source agrees on
  thunderstorms or heavy rain (>80%).
- **Best time of day** — picks the nicest remaining daylight hour (low rain,
  15–25 °C comfort band, low wind) from Open-Meteo hourly data.
- **Details section** — snowfall (mm), visibility (km), cloud cover (%), ground
  temperature, and precipitation (mm), color-coded.
- **Climate context** — current-month historical average temp, today-vs-average,
  and average rainy days, from the Open-Meteo ERA5 archive.
- **Weather records** — hottest / coldest / wettest for the current month over
  the last 10 years, with a "close to a record" flag.
- **Weather trend** — "getting warmer / colder / stable" next to the 7-day title,
  computed from the existing 7-day data.
- **Vs. yesterday** — indicator in the hero comparing today's consensus with
  yesterday's actual temperature (ERA5 archive).
- **Intraday consensus chart** — SVG sparkline of how today's consensus
  temperature has moved, from saved `consensus_history` snapshots.

### Added — pages & sharing
- **`/heatmap`** — world map of submitted feedback, dots colored by how accurate
  the consensus was (green → red).
- **`/leaderboard`** (reworked) — per-region API rankings via region tabs, now
  also showing each API's uptime % and average response time.
- **`/planner`** — travel planner with a 12-month avg-temp & rainy-days chart and
  "best months to visit" (`/api/planner`).
- **`/widget/[city]`** — minimal 300×200 embeddable consensus card.
- **Share button** — native Web Share on mobile, formatted clipboard copy on
  desktop, with a "Copied!" toast.
- **Embed button** — shows a live widget preview plus copyable iframe code.
- **Recent cities** — last 5 searched cities (deduped) as clickable chips,
  stored in the `metablend_recent` cookie.
- **City comparison** — Compare mode shows two cities side by side
  (temp / rain / wind / consensus).

### Added — units, i18n, UX
- **°C / °F toggle** — unit selector by the language switcher; preference stored
  in `metablend_unit` (1-year cookie); every temperature and the feedback input
  convert accordingly, with the unit shown next to each value.
- **Full internationalization** — weather conditions, AQI categories
  (Good/Moderate/Unhealthy…/Hazardous), UV levels, and pollen levels are now
  translated via `translateCondition`, `uvText`, `aqiText`, `pollenText` in
  `lib/i18n.js` across EN/DE/FR/ES/IT; all API-derived strings run through i18n.
- **Keyboard shortcuts** — Enter to search, Escape to clear and close suggestions.

### Added — APIs, jobs & infrastructure
- **15-minute response cache** in `app/api/forecast` (in-memory, keyed by
  city + language).
- **Offline mode** — service worker (`public/sw.js`) caches the app shell;
  last forecast per city is cached in `localStorage` and shown with an
  "you are offline" banner when the network is down.
- **PWA** — generated 192/512 + apple-touch icons, manifest theme color set to
  `#0e0e12`, installable on iOS/Android.
- **`/api/rss`** — RSS 2.0 feed of the last 24h of consensus snapshots for a
  city (`application/rss+xml`).
- **`/api/webhook`** — POSTs to `WEBHOOK_URL` when a city's consensus confidence
  drops below 40%; fired in the background by the forecast route.
- **`/api/calibrate`** + **`vercel.json` cron (6am UTC daily)** — scores
  yesterday's forecasts against Visual Crossing historical actuals and re-weights
  the APIs using the same logic as user feedback.
- **API response-time & uptime tracking** — each source call is timed (5s
  timeout via a shared `tfetch`); failed sources show a red "down" badge; rolling
  averages and success/fail counts persist to the `api_stats` table.

### Changed
- Forecast route now returns lat/lon, extras, details, climate, records,
  per-source response times, down sources, yesterday's temp, and today's history.
- Feedback now stores lat/lon and a consensus-accuracy score (for the heatmap);
  inserts gracefully retry without the new columns if the migration hasn't run.
- Feedback validation: "Clear"/"Klar" is allowed at any hour; only
  "Sunny"/"Sonnig" is rejected between 9 PM and 6 AM. The condition picker shows
  "Clear" alongside "Sunny" during the day.
- Code cleanup pass: trimmed AI-style comments to a more natural style and
  removed a redundant abstraction in the forecast route.
- Added `README.md` (overview, consensus explanation, stack, sources, setup,
  contributing) and an MIT `LICENSE`.

### Fixed
- Share/Embed button icons (`↗`, `</>`) are now vertically centered with the
  label (`inline-flex items-center`, `leading-none`).
- Embeddable widget's "MetaBlend" mark is centered along the bottom (was pinned
  bottom-right and looked off-center).

### Database migrations (run in order in the Supabase SQL editor)
- `supabase/migration4.sql` — `lat`, `lon`, `accuracy` on `feedback` (heatmap).
- `supabase/migration5.sql` — `consensus_history` table (RSS + intraday chart).
- `supabase/migration6.sql` — `api_stats` table (response time + uptime).

### Environment variables
- `WEBHOOK_URL` — optional; target for low-confidence alerts.
- `VISUAL_CROSSING_KEY` — required for the daily calibration cron (already used
  as a weather source).
