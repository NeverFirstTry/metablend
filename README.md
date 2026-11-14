# MetaBlend

One forecast from up to 20 weather sources, weighted by how right each one has been where you are.

[metablend.app](https://metablend.app)

## What MetaBlend is

MetaBlend asks up to 20 weather services and models the same question at the same moment and blends their answers into one forecast. Sources that have been right in your region count for more, and when they disagree, MetaBlend says so instead of hiding it. It covers the weather right now, the next hours, tomorrow and the week, with summit forecasts for hikers and decoded airport weather for pilots. It runs on the web and as an app for iPhone and Android, in 13 languages. MetaBlend is built by one developer in Lienz, in the Austrian Alps.

Forecasts can be wrong. Don't rely on MetaBlend alone for safety-critical decisions.

## How the consensus works

1. Every source is asked about the same place at the same time.
2. The answers are blended into a weighted average, and how closely they agree becomes an agreement figure.
3. Each source's weight comes from how close it has been lately, region by region, checked against weather stations, airport reports (METAR) and reports from people on the ground.

The short version is on the start page, under ["What is consensus forecasting?"](https://metablend.app/#how-it-works). The technical details are in [docs/how-it-works.md](docs/how-it-works.md).

## Features

* **Now and ahead:** current conditions, then Today, Tomorrow and the Week, each opening with a one-sentence answer, with an hourly chart and hour by hour.
* **Agreement in plain sight:** how far the sources agree, and which ones have been right most often where you are.
* **Rain:** rain in the next two hours and a live rain radar.
* **Official weather warnings** from Europe's national weather services.
* **UV index, air quality and pollen**, and the best time to be outside today and tomorrow.
* **Mountain weather:** summit forecasts with wind on top, freezing level, thunderstorm risk and the favourable window to be on the summit, plus avalanche danger levels from Europe's avalanche warning services.
* **Hiking routes:** the weather along a route, with GPX import.
* **Rankings:** which sources have been right lately, region by region.
* **Heatmap** of where the consensus was right and where it was wrong.
* **Travel planner:** the best months to visit a place, from 10 years of climate data.
* **Aviation:** decoded METAR and TAF, flight rules, crosswind per runway and density altitude for airports worldwide. Supplementary information, not for flight planning.
* **In the app:** home screen widgets and push notifications for rain, storms, official warnings, heat, a morning briefing and planned hikes.
* **13 languages:** English, German, French, Spanish, Italian, Dutch, Polish, Czech, Slovenian, Portuguese, Japanese, Chinese and Korean. Light and dark mode.

## Platforms and links

* **Website:** [metablend.app](https://metablend.app)
* **iPhone:** App Store, coming soon
* **Android:** Google Play, coming soon
* **Test the apps before launch:** [metablend.app/testers](https://metablend.app/testers)
* **Support:** [metablend.app/support](https://metablend.app/support) or [info@metablend.app](mailto:info@metablend.app)
* **Privacy:** [metablend.app/privacy](https://metablend.app/privacy)
* **Terms and data credits:** [metablend.app/terms](https://metablend.app/terms)
* **Legal notice (Impressum):** [metablend.app/impressum](https://metablend.app/impressum)
* **Source code and issues:** [github.com/NeverFirstTry/metablend](https://github.com/NeverFirstTry/metablend)
* **Social media:** [Instagram](https://www.instagram.com/metablend.app/), [TikTok](https://www.tiktok.com/@metablend.app), [X](https://x.com/MetaBlendapp)

## Data sources and credits

Weather and map data come from these providers, under their own licences. The same list, in every language, is on [metablend.app/terms](https://metablend.app/terms), which applies.

* [Open-Meteo](https://open-meteo.com) (CC BY 4.0): "Weather data by Open-Meteo.com", including model feeds from ECMWF (IFS and the AI model AIFS), NOAA (GFS, NBM), DWD ICON, Météo-France, CHMI, MeteoSwiss, ItaliaMeteo, KNMI, DMI, JMA, CMA and Environment Canada (GEM)
* This service is based on data and products of the European Centre for Medium-Range Weather Forecasts (ECMWF). Source: [www.ecmwf.int](https://www.ecmwf.int). Licence: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). MetaBlend blends these data with other sources, so what it shows is changed from the original.
* ALADIN model forecasts. Source: Czech Hydrometeorological Institute (ČHMÚ), [www.chmi.cz](https://www.chmi.cz). Licence: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). MetaBlend blends these data with other sources, so what it shows is changed from the original.
* [EAWS](https://avalanches.org): avalanche danger levels from the official bulletins of Europe's avalanche warning services (via avalanche.report); avalanche region outlines CC0
* [MeteoAlarm](https://meteoalarm.org) (EUMETNET, CC BY 4.0): official weather warnings of Europe's national weather services
* [MET Norway](https://www.met.no) (NLOD / CC BY 4.0): "Data from MET Norway"
* [Weather data © OpenWeather](https://openweathermap.org) (ODbL)
* [Powered by WeatherAPI.com](https://www.weatherapi.com/), with [WeatherAPI's notice](https://metablend.app/terms#weatherapi-notice) on our terms page
* [Weather data provided by Visual Crossing Weather](https://www.visualcrossing.com)
* [GeoSphere Austria](https://data.hub.geosphere.at) (CC BY 4.0): blended with other sources, so changed from the original
* [NOAA](https://www.weather.gov) (NWS and Aviation Weather METARs, US public domain)
* [Bright Sky / DWD](https://brightsky.dev) (CC BY 4.0; Datenbasis: Deutscher Wetterdienst, eigene Bearbeitung: mit anderen Quellen gemittelt)
* [SMHI](https://opendata.smhi.se) (CC BY 4.0): blended with other sources, so changed from the original
* Radar: [Weather data by RainViewer](https://www.rainviewer.com/), the rain radar map
* Source: [Meteostat](https://meteostat.net), Deutscher Wetterdienst (CC BY 4.0): reference measurements for scoring the sources
* [OurAirports](https://ourairports.com) (public domain): airport and runway data on the Aviation pages
* © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL): maps, routes, and the summits and huts in the hiking search (how our copy of them is made: [scripts/places](scripts/places))
* Map data: © OpenStreetMap contributors, SRTM | Map style: © [OpenTopoMap](https://opentopomap.org) (CC-BY-SA): route maps in the app
* © OpenStreetMap contributors, [Overture Maps Foundation](https://docs.overturemaps.org/attribution/) (ODbL): the country boundaries by which each summit and hut is given its country
* [GeoNames](https://www.geonames.org/) (CC BY 4.0): towns for the hiking search (summits and huts around a town)

Weather data remains the property of its respective providers and is used under their licences.

## Tech stack

* **[Next.js](https://nextjs.org) 16** (App Router) and **React 19**: the website, the API routes and the pages the apps show
* **[Supabase](https://supabase.com)** (Postgres with PostGIS): forecasts, scores and weights, and our own summits, huts and towns
* **[Vercel](https://vercel.com)**: hosting and CDN caching
* **[Capacitor](https://capacitorjs.com) 8**: the iPhone and Android apps, with native widgets and push notifications
* **[Tailwind CSS](https://tailwindcss.com) 4**
* **[Leaflet](https://leafletjs.com)**, self-hosted, with OpenStreetMap and OpenTopoMap: the radar and route maps
* **Node's built-in test runner** and ESLint; GitHub Actions checks the phone layout after every deploy

## Local development

```bash
git clone https://github.com/NeverFirstTry/metablend.git
cd metablend
npm install
cp .env.example .env.local
```

Fill in `.env.local` with values from your own Supabase project, never the production one. [`.env.example`](.env.example) lists every variable and what it is for: the three Supabase values are required, every weather key is optional, and a source without its key is skipped. Keys never go into the repository; `.env.local` and key files are git-ignored.

Create the database by running `supabase/dev-schema.sql` in the SQL editor of a fresh Supabase project. Then:

```bash
npm run dev       # http://localhost:3000
npm test          # unit and route tests
npx eslint .
npx next build
```

CI and Vercel use Node.js 24. The apps are in [mobile/](mobile/README.md).

## License

MetaBlend is source-available under the [Functional Source License 1.1 with Apache 2.0 as its future licence](LICENSE) (FSL-1.1-ALv2), a [Fair Source](https://fair.io) licence: you may read, run, change and share the code for any purpose except a commercial product or service that competes with MetaBlend. Each version also becomes available under the Apache License 2.0 two years after it was published.

The licence covers the code. The name MetaBlend and its logo are not part of it, and weather and map data remain the property of their providers and are used under their licences. The software and fonts MetaBlend ships are listed with their licences in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); how to take part is in [CONTRIBUTING.md](CONTRIBUTING.md).

## How MetaBlend is made

Development is AI-assisted: much of the code is written with Claude and Claude Code. The idea, the design, large parts of the consensus logic and every feature decision are mine.
