
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
5. **Learn over time.** When you report the actual weather (or the nightly
   Meteostat job checks yesterday's forecasts against reality), each API's score
   moves up or down and the weights re-normalise. Weights are tracked *per region*,
   so an API that nails European weather but struggles in Asia is rewarded where
   it earns it.

The weighting is deliberately simple: an API's recent accuracy (the median of its
last scoring deltas) nudges a raw factor up or down, and all the factors are
normalised so they sum to 1. No black boxes — just "be right more often, count
for more."

---

## Features

- **Weighted consensus** across many weather APIs with a confidence score
- **Will it rain today?** — one big, honest yes/no card
- **Severe-weather warnings** when every source agrees on thunderstorms or heavy rain
- **Best time to be outside** today, scored on rain, comfort and wind
- **UV index, air quality and pollen**, colour-coded at a glance
- **Live rain radar** (RainViewer over OpenStreetMap)
- **7-day forecast**
- **Community feedback** that retrains the weights, with abuse/sanity guards
- **Per-region API leaderboard** — see who wins in Europe, Asia, etc.
- **Global feedback heatmap** showing where the consensus was right vs. wrong
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
| [Open-Meteo](https://open-meteo.com) | no | Also powers geocoding, 7-day, hourly, UV, air quality & pollen |
| [MET Norway](https://api.met.no) | no | Yr.no's public API |
| [NASA POWER](https://power.larc.nasa.gov) | no | Satellite-derived hourly data |
| [OpenWeatherMap](https://openweathermap.org/api) | yes | |
| [WeatherAPI](https://www.weatherapi.com) | yes | |
| [Tomorrow.io](https://www.tomorrow.io) | yes | |
| [Visual Crossing](https://www.visualcrossing.com) | yes | |
| [World Weather Online](https://www.worldweatheronline.com) | yes | |
| [Weatherstack](https://weatherstack.com) | yes | |
| [Meteostat](https://meteostat.net) (via RapidAPI) | yes | Nightly historical validation only |

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

# Optional weather APIs
OPENWEATHERMAP_API_KEY=
WEATHERAPI_KEY=
TOMORROW_KEY=
VISUAL_CROSSING_KEY=
WORLD_WEATHER_KEY=
WEATHERSTACK_KEY=
RAPIDAPI_KEY=          # Meteostat, for nightly validation
```

Set up the database by running the SQL files in `supabase/` (in order:
`migration.sql` → `migration2.sql` → `migration3.sql` → `migration4.sql`) in the
Supabase SQL editor, then hit `/api/migrate` once to seed the weight rows.

```bash
npm run dev
```

Open http://localhost:3000.

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
wire it into `app/api/forecast/route.js`, and add its weight rows to a migration.

---

## License

MIT — see below.

```
MIT License

Copyright (c) 2026 MetaBlend

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
