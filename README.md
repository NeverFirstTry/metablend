
# MetaBlend 🌤



**Weather truth through consensus.**

Every weather app gives you one number and asks you to trust it. MetaBlend asks a
dozen forecasts the same question, weighs each one by how accurate it's actually
been, and gives you the blended answer — plus how confident the sources are that
they agree.

🔗 Live: https://metablend-beta.vercel.app

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
  ground truth, and scores the last hour of forecasts against it. Real
  measurements, every hour. Gated by
  `CALIBRATE_SECRET` and triggered by a GitHub Action
  (`.github/workflows/station-calibrate.yml`) — Vercel sub-daily crons need a Pro
  plan, so an external scheduler keeps it on any plan.
- **Daily calibration** — `/api/calibrate` scores yesterday's forecasts against
  Visual Crossing historical actuals (6 am UTC cron).
- **Nightly validation** — `/api/cleanup` prunes old rows (5 am UTC cron) and,
  when Visual Crossing isn't configured, checks yesterday's forecasts against
  Meteostat instead — one ground truth per day, never both.
- **Self-calibration (on demand)** — `/api/self-calibrate` rebalances every
  source against the live multi-source median across a basket of cities; handy
  for seeding non-uniform weights. Admin-only (`CALIBRATE_SECRET`).

### MetaBlend Local — our own forecast

Once a city has collected enough ground truth, MetaBlend serves its own
prognostic source: the live consensus corrected by a learned per-city bias —
an exponential moving average of *(ground truth − consensus)* fed by user
feedback and the hourly station calibration (`lib/blend.js`, `city_bias`
table). It is deliberately **excluded from the consensus** it derives from (no
circularity), but it is stored and scored by the daily calibration exactly
like every other source — so the leaderboard shows, honestly, whether
consensus + local correction beats the raw APIs.

---

## Features

- **Weighted consensus** across many weather APIs with a confidence score
- **Will it rain today?** — one big, honest yes/no card, averaged only from
  sources that report a true precipitation probability (cloud cover and
  humidity don't count as rain)
- **Severe-weather warnings** when every source agrees on thunderstorms or heavy rain
- **Best time to be outside** today, scored on rain, comfort and wind
- **UV index, air quality and pollen**, colour-coded at a glance
- **Live rain radar** (RainViewer over OpenStreetMap)
- **7-day forecast**
- **Community feedback** that retrains the weights, with abuse/sanity guards
- **Per-region API leaderboard** — see who wins in Europe, Asia, etc., with a
  recent-accuracy sparkline per source
- **Global feedback heatmap** showing where the consensus was right vs. wrong
- **Favorite & recent cities** for one-tap access
- **Travel planner** — best months to visit, from 10 years of climate data
- **15-minute response caching** to keep the upstream APIs happy
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

| Source | Key needed | Notes |
| --- | --- | --- |
| [Open-Meteo](https://open-meteo.com) | no | Also powers geocoding, 7-day, hourly, UV, air quality & pollen; MET Norway is the 7-day fallback |
| ECMWF IFS · NOAA GFS · DWD ICON | no | Individual model feeds served via Open-Meteo — genuine model diversity, weighted separately |
| [MET Norway](https://api.met.no) | no | Yr.no's public API |
| [NASA POWER](https://power.larc.nasa.gov) | no | Satellite-derived hourly data |
| [GeoSphere Austria](https://data.hub.geosphere.at) | no | INCA analysis grid; Austria/DACH coverage only |
| [NWS / weather.gov](https://www.weather.gov/documentation/services-web-api) | no | US only; hourly gridpoint forecast |
| [Bright Sky (DWD)](https://brightsky.dev) | no | Germany only; station observations |
| [SMHI](https://opendata.smhi.se/metfcst/) | no | Scandinavia + Baltic; snow1g point forecast |
| MetaBlend Local | — | Synthetic: our consensus + learned per-city bias (see above) |
| [OpenWeatherMap](https://openweathermap.org/api) | yes | |
| [WeatherAPI](https://www.weatherapi.com) | yes | |
| [Tomorrow.io](https://www.tomorrow.io) | yes | |
| [Visual Crossing](https://www.visualcrossing.com) | yes | Also the daily calibration source |
| [World Weather Online](https://www.worldweatheronline.com) | yes | |
| [Weatherstack](https://weatherstack.com) | yes | |
| [Meteostat](https://meteostat.net) (via RapidAPI) | yes | Nightly historical validation only |
| [Aviation METARs](https://aviationweather.gov) (NOAA AWC) | no | Ground truth for hourly station calibration only |

Sources without a configured key are simply skipped — the app still works with
just the keyless ones.

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
TOMORROW_KEY=
VISUAL_CROSSING_KEY=    # also the daily calibration source
WORLD_WEATHER_KEY=
WEATHERSTACK_KEY=
RAPIDAPI_KEY=           # Meteostat, for nightly validation

# Optional jobs / admin
CALIBRATE_SECRET=       # gates /api/self-calibrate (set to any random string)
CRON_SECRET=            # gates the cron jobs (/api/calibrate, /api/cleanup,
                        # /api/webhook); Vercel sends it automatically to crons
WEBHOOK_URL=            # optional low-confidence alert target
```

Set up the database by pasting **`supabase/setup_all.sql`** into the Supabase SQL
editor and running it — it's one idempotent script that creates every table and
seeds the weight rows (the older `migrationN.sql` files are no longer needed).
To lock the database down, set `SUPABASE_SERVICE_ROLE_KEY` and then run
**`supabase/enable_rls.sql`** (see Security below).

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

- **Privacy notice** — [`/privacy`](https://metablend-beta.vercel.app/privacy):
  what data is collected (cookies, feedback, transient IP rate-limiting,
  cookieless Plausible analytics) and how it's used.
- **Terms & data attribution** — [`/terms`](https://metablend-beta.vercel.app/terms):
  beta "as is" disclaimer and credit/licenses for the weather and map sources.

## License

**© 2026 MetaBlend. All rights reserved.** The source is published here for
transparency and reference; no permission is granted to copy, modify, or
redistribute it without written consent. See [`LICENSE`](LICENSE). Weather and
map data remain the property of their respective providers and are used under
their own licenses.
