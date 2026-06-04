# Changelog

All notable changes to MetaBlend. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Dates are UTC.

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
