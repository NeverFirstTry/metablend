
# MetaBlend 🌤



**Weather truth through consensus.**

Every weather app gives you one number and asks you to trust it. MetaBlend asks up
to 20 weather sources at once the same question, weighs each one by how accurate it's actually
been, and gives you the blended answer — plus how confident the sources are that
they agree.

🔗 Live: https://metablend.app 
  "For issues or support either open an issue in github or contact me using info@metablend.app"

---

DISCLAIMER

"This project was built with strong assistance from Claude AI and Claude Code. The idea, architecture decisions, feature design and debugging were done by a human. A big part of the code was written by AI. We believe in transparency about AI usage in development."

---

## How it works

1. **Geocode** the city you typed into coordinates.
2. **Fan out** to every configured weather API in parallel and grab the current
   conditions (temperature, rain probability, wind, feels-like).
3. **Blend** them into a weighted average. Each source carries a weight between
   0 and 1; better sources count for more.
4. **Score the confidence** from how tightly the sources agree — when they all
   land on the same temperature, confidence is high; when they scatter, it drops.
5. **Learn over time.** Several signals move each API's score up or down and the
   weights re-normalise. Weights are tracked *per region*, so an API that nails
   European weather but struggles in Asia is rewarded where it earns it.

The weighting is deliberately simple: an API's recent accuracy (the median of its
last scoring deltas) scales a raw factor `exp(avgScore · 0.5)`, and all the factors
are normalised so they sum to 1. A source more than 5 °C off the cross-API median
takes an extra penalty as an outlier guard. No black boxes — just "be right more
often, count for more."

### How the weights get calibrated

All of these share the exact same scoring math (`lib/scoring.js`):

- **Community feedback** — you report the actual weather; it's compared against
  the current consensus and re-weights immediately (`/api/feedback`).
- **Station calibration (hourly)** — `/api/station-calibrate` pulls aviation
  METAR observations (NOAA Aviation Weather Center — free, no key) near each
  recently-searched city, takes the median of the nearest fresh reports as
  ground truth, and scores the last hour of forecasts against it — temperature
  as the primary delta plus a second, stricter-scaled delta for wind accuracy
  when both sides report wind. Real measurements, every hour. Gated by
  `CALIBRATE_SECRET` and triggered by a Supabase `pg_cron` job
  (`supabase/cron.sql`) — Vercel sub-daily crons need a Pro plan, and GitHub
  Actions' hourly schedule proved unreliable, so the database fires it itself.
- **Daily calibration** — `/api/calibrate` scores yesterday's forecasts against
  Visual Crossing historical actuals (6 am UTC cron).
- **Nightly validation** — `/api/cleanup` prunes old rows (5 am UTC cron) and,
  when Visual Crossing isn't configured, checks yesterday's forecasts against
  Meteostat instead — one ground truth per day, never both.
- **Self-calibration (on demand)** — `/api/self-calibrate` rebalances every
  source against the live multi-source median across a basket of cities; handy
  for seeding non-uniform weights. Admin-only (`CALIBRATE_SECRET`).
- **Outlook verification (nightly)** — the same `/api/cleanup` run checks every
  saved future prediction whose time has come (see *The outlook* below) against
  NOAA METAR history and moves the per-range outlook weights.

### MetaBlend Local — our own forecast

Once a city has collected enough ground truth, MetaBlend serves its own
prognostic source: the live consensus corrected by a learned per-city bias —
an exponential moving average of *(ground truth − consensus)* fed by user
feedback and the hourly station calibration (`lib/blend.js`, `city_bias`
table). The bias is learned in separate **day and night buckets**, since
consensus errors are usually asymmetric (models routinely miss nighttime
cooling). It is deliberately **excluded from the consensus** it derives from
(no circularity), but it is stored and scored by the daily calibration exactly
like every other source — so the leaderboard shows, honestly, whether
consensus + local correction beats the raw APIs.

### The outlook — today, tomorrow, the week

"Right now" is something anyone can see out of the window, so the page leads
with what's coming. `/api/outlook` blends the future from ~10 independent
weather models in one Open-Meteo request (ECMWF, GFS, ICON, UKMO, GEM, JMA,
Météo-France, plus the KNMI / DMI / MET Nordic high-resolution models where they
cover the city) and the national services that publish real forecasts (NWS,
SMHI, DWD MOSMIX via Bright Sky). Two rules keep the consensus honest:

- **No echoes.** Regional models are requested as their *pure* versions, which
  stop at the edge of their range and area; their `*_seamless` variants
  silently continue as ECMWF copies and would fake agreement. MET Norway's
  locationforecast is only a fallback for the same reason (measured, see
  `docs/superpowers/specs/2026-09-29-future-forecast-design.md`).
- **Honest spread.** Each hour and day carries how far the sources disagree,
  drawn as a band behind the consensus and as an agreement meter per day.

The outlook stops at a week on purpose: beyond that only ECMWF and GFS remain
and the answer turns into a trend nobody plans a day around. Each tab opens
with one headline: the next rain window today (through the night once it's
evening), tomorrow's rain, high and change from today, and the best day of the
week. And the learning loop covers the future too: every source's predictions
at +6 / 12 / 24 / 48 h and for days 1–7 are saved
(`outlook_snapshots`) and checked nightly against airport observations once
their time has come, so `outlook_weights` learns **who is right about tomorrow
and next week**, per region and per range — shown as extra tabs on the
leaderboard next to the live ranking.

Both routes answer from **Vercel's CDN** (`s-maxage` 30 min for the outlook,
15 min for right now, stale-while-revalidate, errors never cached): a city
viewed by 1 or 1,000 people costs the same upstream calls.

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

`/hike` shows the full hiking section inside the app (search with "near me",
41 featured peaks, a peak's Today / Tomorrow / Week summit forecast with the
summit window as the headline) and a crawlable teaser everywhere else: the
live summit window of the peak of the day, the featured list and the store
badges (`lib/hike/stores.js`). The app is recognised by its user agent
(`MetaBlendApp`); `?app=1` shows the app view in any browser for testing.

### The app (`mobile/`)

A Capacitor 8 shell for Android and iOS that loads metablend.app. Inside it
the website adds app chrome — a bottom tab bar (Forecast · Hiking · More),
safe areas, `/more` settings — and uses native share, location, haptics and
the Android back button through `lib/native.js` (plugin code is only
downloaded inside the app). Website updates reach the app instantly; only
native changes need a store build. Setup and device checklist:
`mobile/README.md`.

### Backups

`/api/backup` (gated like the other job endpoints) exports the learned state —
`api_weights`, `outlook_weights`, `city_bias`, `feedback`, `api_stats` — and a nightly GitHub
Action (`.github/workflows/backup.yml`) stores it as a 30-day workflow
artifact. This data is the product's memory and cannot be re-derived; the
export contains nothing that isn't already public via the app's own endpoints.

---

## Features

- **The outlook in three tabs** — **Today** (hourly chart with the sources'
  spread, hour strip, next rain window, UV / air / pollen, radar),
  **Tomorrow** (the whole day hour by hour, high / low, best time out, vs the
  10-year normal) and **Week** (low/high, rain chance and an agreement meter
  per day, a warning where the models split, tap a day for its hours, the
  week vs normal); each opens with a one-sentence answer
- **Weighted consensus** across many weather APIs with a confidence score,
  compact on top ("right now" is one tap away)
- **Honest rain chances** — real probabilities where a source publishes one,
  otherwise the share of sources calling rain; never a made-up 0 %
- **Severe-weather warnings** when every source agrees on thunderstorms or heavy rain
- **Best time to be outside** today and tomorrow, scored on rain, comfort and wind
- **UV index, air quality and pollen**, colour-coded at a glance
- **Live rain radar** (RainViewer over OpenStreetMap)
- **Community feedback** that retrains the weights, with abuse/sanity guards
- **Per-region leaderboard** — who's right now, and who's right about today
  and tomorrow and about the week, in Europe, Asia, etc., with a
  recent-accuracy sparkline per source
- **Global feedback heatmap** showing where the consensus was right vs. wrong
- **Favorite & recent cities** for one-tap access
- **Server-rendered city pages** (`/weather/vienna`, …) — crawlable consensus
  forecasts for 54 cities, ISR-cached; any city works on demand
- **MetaBlend Aviation** (`/aviation`) — decoded METAR & TAF, flight-rules
  badge, per-runway crosswind components and density altitude for 12,000+
  ICAO airports (NOAA AWC + OurAirports data). Supplementary information
  only — every page carries a "not for flight planning" disclaimer. The
  flight-rules, wind-component and altitude math is verified against NOAA's
  own classification and FAA reference formulas
- **Travel planner** — best months to visit, from 10 years of climate data
- **CDN-cached per city** (30 min outlook, 15 min right now) — one upstream
  lookup per city and period, however many people are looking
- **Offline mode** (PWA + service worker) showing your last known forecast
- **Installable PWA** on iOS and Android
- **Multi-language UI** (EN, DE, FR, ES, IT)

---

## Tech stack

- **[Next.js](https://nextjs.org)** (App Router) — UI + API routes
- **[Supabase](https://supabase.com)** (Postgres) — forecasts, feedback, API weights
- **[Vercel](https://vercel.com)** — hosting
- **[Leaflet](https://leafletjs.com)** + **[OpenStreetMap](https://www.openstreetmap.org)** — maps
- **[RainViewer](https://www.rainviewer.com)** — rain radar tiles
- **[Tailwind CSS](https://tailwindcss.com)** — styling
- **[Plausible](https://plausible.io)** — privacy-friendly analytics

---

## Weather data sources

Up to 20 weather sources answer at once: 14 everywhere, plus the regional
models and services that cover the place (most in Austria and Bavaria — 20; the
Alps 19, Germany and the Nordics 17–18, the US 16). MetaBlend Local is made from
them and isn't counted. Retired (2026-10-29): NASA POWER (hourly data ~7 days
behind), World Weather Online (no free plan left) and Tomorrow.io (the free
plan's 500 calls a day missed one forecast in six).

| Source | Key needed | Notes |
| --- | --- | --- |
| [Open-Meteo](https://open-meteo.com) | no | Also powers geocoding, 7-day, hourly, UV, air quality & pollen; MET Norway is the 7-day fallback |
| ECMWF IFS · NOAA GFS · DWD ICON · Météo-France | no | Individual model feeds served via Open-Meteo — genuine model diversity, weighted separately |
| UK Met Office · Canada GEM · JMA · CMA GRAPES · ECMWF AIFS (AI) | no | More global models via Open-Meteo, all in one shared request |
| MeteoSwiss ICON-CH · ItaliaMeteo ICON-2I · KNMI / DMI HARMONIE · NOAA NBM | no | Regional models via the same request — they only appear inside their own area |
| KNMI HARMONIE · DMI HARMONIE · MET Nordic | no | Outlook only (via Open-Meteo): high-resolution regional models, ~2.5 days, Europe / Nordics |
| [DWD MOSMIX](https://brightsky.dev) (Bright Sky) | no | Outlook only: Germany, statistical forecast |
| [MET Norway](https://api.met.no) | no | Yr.no's public API |
| [GeoSphere Austria](https://data.hub.geosphere.at) | no | INCA analysis grid; Austria/DACH coverage only |
| [NWS / weather.gov](https://www.weather.gov/documentation/services-web-api) | no | US only; hourly gridpoint forecast |
| [Bright Sky (DWD)](https://brightsky.dev) | no | Germany only; station observations |
| [SMHI](https://opendata.smhi.se/metfcst/) | no | Scandinavia + Baltic; snow1g point forecast |
| MetaBlend Local | — | Synthetic: our consensus + learned per-city bias (see above) |
| [OpenWeatherMap](https://openweathermap.org/api) | yes | |
| [WeatherAPI](https://www.weatherapi.com) | yes | |
| [Visual Crossing](https://www.visualcrossing.com) | yes | Also the daily calibration source |
| [Pirate Weather](https://pirateweather.net) | yes | Optional — off until `PIRATE_WEATHER_KEY` is set |
| [Meteostat](https://meteostat.net) (via RapidAPI) | yes | Nightly historical validation only |
| [Aviation METARs](https://aviationweather.gov) (NOAA AWC) | no | Ground truth for hourly station calibration; also powers the `/aviation` METAR/TAF pages |

Airport and runway data for the Aviation pages comes from
[OurAirports](https://ourairports.com) (public domain), trimmed to
ICAO-coded fields at build time (`lib/airports.json`).

Sources without a configured key are simply skipped — the app still works with
just the keyless ones.

Summits and huts for the Hiking screen come from OpenStreetMap through
[Nominatim](https://nominatim.org), within its
[usage policy](https://operations.osmfoundation.org/policies/nominatim/): at
most one request a second for the whole app — every server instance takes a
slot from one row in the database (`supabase/nominatim.sql`,
`lib/hike/nominatim.js`) — answers cached 30 days, a User-Agent with a contact
address, OpenStreetMap credited under the results, and no search-as-you-type:
typing shows featured peaks and the geocoder's mountains; Nominatim is asked
only when a search is sent (Enter, or "Search peaks, huts and places").
`NOMINATIM_URL` points the server at another Nominatim without an app update.

### Summits, huts and towns (our own data)

Search (as you type), "Near you" and "around a town" read our own tables
(`supabase/places.sql`: PostGIS for nearest-first, pg_trgm + unaccent for
names with typos and accents). Named summits and volcanoes (with a height, or
a Wikidata item) and named huts come from OpenStreetMap (ODbL); towns with
5 000+ people and their other names from GeoNames (CC BY 4.0). Rebuild every
few months — on this PC, free:

```bash
pip install osmium                       # pyosmium, once
node scripts/places/osm.mjs              # every Geofabrik region (~90 GB, one at a time; resumes)
node scripts/places/build.mjs            # GeoNames towns + the rows → data/places/*.ndjson
node scripts/places/load.mjs             # into the dev database (.env.local)
node scripts/places/load.mjs --production   # into production — asks for the project ref
```

`places_bench()` times each query inside the database, `places_size()`
shows the tables' size. Until the tables hold data, the API keeps using
Nominatim / Photon / the geocoder as before.

---

## Run it locally

```bash
git clone https://github.com/NeverFirstTry/metablend.git
cd metablend
npm install
```

Create a `.env.local` in the root. Only the two Supabase vars are required; every
weather key is optional (missing ones get skipped):

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Server-only — bypasses RLS. Required in production once RLS is enabled.
SUPABASE_SERVICE_ROLE_KEY=

# Optional weather APIs
OPENWEATHERMAP_API_KEY=
WEATHERAPI_KEY=
VISUAL_CROSSING_KEY=    # also the daily calibration source
PIRATE_WEATHER_KEY=          # optional, free tier at pirateweather.net — the source stays off without it
RAPIDAPI_KEY=           # Meteostat, for nightly validation

# Optional jobs / admin
CALIBRATE_SECRET=       # gates /api/self-calibrate + /api/station-calibrate
                        # (any random string; also stored in Supabase Vault
                        # as calibrate_secret, see supabase/cron.sql)
CRON_SECRET=            # gates the cron jobs (/api/calibrate, /api/cleanup,
                        # /api/webhook); Vercel sends it automatically to crons
WEBHOOK_URL=            # optional low-confidence alert target
```

Set up the database by pasting **`supabase/dev-schema.sql`** into the Supabase SQL
editor of a fresh project and running it — the whole schema in one idempotent
script (every table, the weight seeds, row level security on), built from the
files in `supabase/` by `node scripts/dev-db.mjs build`. It leaves out the
scheduled jobs (`supabase/cron.sql`): they call the live site.

### Databases

Two Supabase projects: **production** (the live site) and a **dev** project for
everything that runs on your machine.

- `.env.local` points at the **dev** project. `node scripts/dev-db.mjs check`
  confirms it isn't production and that every table is there.
- After changing `.env.local`, build again: Next bakes `NEXT_PUBLIC_…`
  variables (the database URL among them) into the build, server code too.
- Production is written only by the deployed site and by admin scripts. A local
  server, script or test that still points at production can read it, but every
  write is refused before it's sent (`lib/db-target.js`).
- Admin scripts that change production (`scripts/backfill-route-heights.mjs`)
  take its keys from **`.env.production-admin`** (git-ignored; Next never loads
  it), say what they'll change and go on only once you type the project ref (or
  pass `--confirm=<ref>`). Read-only ones (`scripts/verify-local.mjs`) and the
  tester list (`scripts/testers.mjs`, through the live site's API) use the same
  file, without asking.

```bash
npm run dev    # start the app
npm test       # run the scoring unit tests
```

Open http://localhost:3000.

---

## Security

The browser never talks to Supabase directly — only to the app's own `/api/*`
routes. So the database is locked down with **row-level security enabled on every
table and no policies** (deny-all for the public anon key). The server uses
`SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS. Run `supabase/enable_rls.sql`
once to apply this; it drops any lingering permissive policies first. The
`SUPABASE_SERVICE_ROLE_KEY` must be set both locally and in your host's
environment (e.g. Vercel) — without it, server reads/writes fail under RLS.

A small `error_log` table plus server-console logging (`lib/log.js`) captures
runtime errors for visibility.

**Job endpoints.** `/api/self-calibrate` and `/api/station-calibrate` require the
`CALIBRATE_SECRET` (sent as the `x-calibrate-key` header). The cron jobs
(`/api/calibrate`, `/api/cleanup`, `/api/webhook`) are gated by `CRON_SECRET`:
set it in the environment and Vercel attaches it to cron invocations
automatically, while public callers get a `401`. Until `CRON_SECRET` is set these
endpoints stay open so the crons keep working without it.

**Rate limiting.** `/api/forecast` (cache miss) and `/api/feedback` are throttled
per IP to protect the metered upstream APIs and the weighting from abuse.

---

## Contributing

PRs welcome.

1. Fork and branch off `main` (`git checkout -b my-feature`).
2. Keep the style that's already there — terse comments, no ceremony.
3. `npm run build` should pass before you push.
4. Open a PR describing what changed and why.

Adding a weather source is the easiest first contribution: write a
`fetchYourApi(lat, lon)` in `lib/weather.js` that returns the standard shape
(`apiId`, `displayName`, `temp`, `feelsLike`, `rainPct`, `windKmh`, `condition`),
wire it into `app/api/forecast/route.js`, and add its weight rows in
`supabase/setup_all.sql`. Set `rainIsProb: true` only if `rainPct` is a real
precipitation probability — if the API only offers cloud cover or humidity,
return `rainPct: null` instead.

---

## Legal

- **Privacy notice** — [`/privacy`](https://metablend.app/privacy):
  what data is collected (cookies, feedback, transient IP rate-limiting,
  cookieless Plausible analytics) and how it's used.
- **Terms & data attribution** — [`/terms`](https://metablend.app/terms):
  beta "as is" disclaimer and credit/licenses for the weather and map sources.

## License

**© 2026 MetaBlend. All rights reserved.** The source is published here for
transparency and reference; no permission is granted to copy, modify, or
redistribute it without written consent. See [`LICENSE`](LICENSE). Weather and
map data remain the property of their respective providers and are used under
their own licenses.
