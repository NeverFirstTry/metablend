# Hiking v2: routes and GPX — design

Status: approved in conversation 2026-10-02; this spec is for review.
Builds on `2026-09-30-hiking-app-design.md` (v1: summit forecast per peak),
which deferred "weather along a route (option B)" to v2.

## 1. Intent

**The owner asked for:** two ways into a route — **import a GPX** and
**find the marked routes up a peak** (not drawing routes, not recording
hikes); timing that **suggests a start time** from distance, climb and a
pace setting; routes **saved on the phone** and usable in **Plan a hike**, so
the evening-before alert covers the whole route with the suggested start;
approach 1 of 3 — a **server route engine**.

**Why (assumed, not contradicted):** the summit forecast answers "is the
summit OK at noon?"; hikers actually need "when do I start so every part of
my route is OK?" — the app-exclusive reason to keep MetaBlend for hiking.

**Success looks like:**
- a Komoot / Outdooractive / Strava GPX opens in the app and shows map,
  profile, walking time and the weather at each stage within a few seconds;
- a well-mapped Alpine peak (e.g. Großglockner) lists its marked routes
  (e.g. "712 Alter Kalser Weg");
- the suggestion is concrete ("Start by 07:30 — summit 10:45–11:15") or an
  explicit "no safe start on this day" with the reason;
- a hike planned on a route gets an evening alert with that start time;
- one route lookup costs the OpenStreetMap API at most once per peak a week.

**Out of scope:** drawing routes, GPS recording / live tracking, offline
maps, turn-by-turn, multi-day timing (only the first day is timed), routes
on the website (it keeps the hiking teaser), sharing routes between users.

## 2. Facts this rests on

Verified 2026-10-02:
- The official OpenStreetMap API answers fast: `GET /api/0.6/map.json?bbox=…`
  for a ~1.2 × 1.3 km box around Großglockner (47.0745, 12.6941) took ~0.8 s
  (420 KB) and contains the summit node (`natural=peak`, ele 3798), trail
  ways with `sac_scale` and names ("Normalweg Großglockner (von
  Adlersruhe)", `difficult_alpine_hiking`) and **3 `route=hiking`
  relations** (712A Mürztaler Steig, 712 Alter Kalser Weg, …).
  `GET /api/0.6/relation/14622955/full.json` (712) took 0.3 s, 15 KB: 3 ways,
  77 nodes, tags `ref`, `name`, `loc_name`, `osmc:symbol`, `network`.
- Coverage varies: not every peak has route relations; the box of a valley
  test point had none.
- Overpass (`overpass-api.de`, `overpass.kumi.systems`,
  `overpass.private.coffee`) failed or timed out (7–25 s) in the same test;
  Waymarked Trails' `list/by_area` returned no results. Neither is used.
- Open-Meteo accepts several locations in one request, each with its own
  `elevation` (comma lists) and returns an array, one object per location,
  with per-model columns — verified with 2 points and 3 models.
- The summit engine (`lib/hike/`) already has: `blocker(hour)` and
  `LIMITS = { rainPct: 30, windKmh: 40, feels: -20 }` (window.js),
  `stormRisk`, `summitWind`, `freezingLevel` (physics.js),
  `blendSummitHourly` (blend.js), `parseSummitMulti` (parse.js, skips models
  missing from a response), `parseElevations` + the elevation API
  (heights.js / sources.js), `withCoreFallback` and `CORE_MODELS`
  (lib/outlook/models.js).
- Hike plans live in `hike_plans` (per push device; `name, lat, lon, elev,
  date`); the hourly dispatcher sends the evening-before / morning hike
  alerts (`lib/push/rules.js`, `lib/push/dispatch.js`).
- Maps use Leaflet from unpkg (`lib/leaflet.js`) with OSM standard tiles.

## 3. What people get

### Finding a route
- **Peak page → "Routes"** (under the summit window): marked routes whose
  ways reach within 1 km of the summit (Alpine club routes usually end at the
  last hut — the 712 stops at the Erzherzog-Johann-Hütte, 660 m short; the
  route is walked on from its point nearest the summit to the summit), each as `ref name · difficulty ·
  distance · ↑climb · ~time` (time at normal pace). None: "No marked routes
  found — import a GPX".
- **Hiking tab → "Import GPX"**: the system file picker; tracks (`<trk>`)
  and routes (`<rte>`) are read; several segments are joined in file order.
- **Hiking tab → "My routes"**: routes saved on the phone (up to 30),
  newest first, each removable.

### The route view
- Topographic map (OpenTopoMap tiles, OSM standard tiles as fallback) with
  the line and start / high point / end markers.
- Elevation profile (SVG) with the stage points marked.
- Distance, ascent, descent, walking time; **pace** slow / normal / fast
  (time × 1.25 / 1 / 0.8).
- **Day**: today … the last forecast day.
- **The suggestion**: "Start by 07:30 — summit 10:45–11:15, all stages inside
  the safe window", with **Change** for an own start time (15-min steps).
- **Stages**: start, each sample point (named after a nearby hut / pass when
  OSM has one in the relation, else "km 3.2 · 2 140 m"), high point, end —
  each with arrival time, temperature / feels-like, wind at that height,
  rain %, storm risk; the first unsafe stage is highlighted with its reason
  ("storms likely", "too windy", "rain", "dangerously cold" — the summit
  engine's words).
- No safe start that day: "No safe start on Saturday — storms from 11:00 on
  the upper half" plus the next day that has one, if any.
- **Save** (to the phone) and **Plan this hike** (day + start): the evening
  alert reads "Hochstadel via 712: start by 07:30, summit ~10:45 — window
  until 13:00"; the morning update comes only if the suggested start moved
  by ≥ 30 min or the day became unsafe.
- Units and language follow the app.

## 4. Architecture

### 4.1 Pure modules — `lib/route/` (ESM, unit tested)

| Module | Job |
|---|---|
| `gpx.js` | `parseGpx(xmlString) → { name, points: [{lat, lon, ele\|null}] } \| null`; tracks and routes, segments joined; rejects files without ≥ 2 points |
| `geometry.js` | `haversineM`, `cumulative(points)` (distance per point), `climb(points)` → `{ ascentM, descentM }` with a 5 m hysteresis against GPS noise, `simplify(points, maxPoints = 500)` (Douglas–Peucker, keeps first / last / highest) |
| `timing.js` | `legMinutes(distM, upM, downM)` = DIN 33466: horizontal at 4 km/h, vertical at 300 m/h up and 500 m/h down, total = max + min/2; `etas(points, { start, pace })` → minutes from start per point; `PACE = { slow: 1.25, normal: 1, fast: 0.8 }` |
| `samples.js` | `pickSamples(points)` → indexes of 6–10 points: start, end, highest, and a point every ~1.5 km or 300 m of climb, whichever comes first |
| `verdict.js` | `stageHour(series, eta)` (the blended hour for an arrival time), `stageBlocker(hour)` = `blocker()` from window.js; `suggestStart({ samples, hoursByPoint, day, sun, pace })` → earliest start (15-min steps, from first light) with no blocker on any stage between first light and sunset, or `{ none, reason, firstBad }` |
| `osm.js` | `routesNear(mapJson, summit, radiusM = 1000)` → relation ids + tags whose member ways pass within the radius; `stitch(relationFullJson)` → one ordered polyline (member ways joined end-to-end, reversed where needed) + `{ ref, name, from, to, symbol, difficulty }` (hardest `sac_scale` on the member ways) |

### 4.2 Server

- **`GET /api/routes?lat&lon&elev&name`**
  - Bbox ±0.006° lat / ±0.009° lon around the summit → `map.json`;
    `routesNear` → for each relation (max 8) `relation/{id}/full.json` →
    `stitch` → `simplify(…, 300)` → elevation for the simplified points
    from Open-Meteo's elevation API → stats (distance, climb, time at
    normal pace).
  - Response `{ routes: [{ id, ref, name, from, to, difficulty, distanceKm,
    ascentM, descentM, minutes, points: [[lat, lon, ele]…] }] }`.
  - Cache: Supabase table `route_cache (peak_key text primary key, routes
    jsonb, fetched_at timestamptz)` with peak_key = rounded `lat,lon`
    (3 decimals), 7-day TTL; CDN `s-maxage=86400`. OSM failures return the
    stale cache if any, else 502. User-Agent `MetaBlend/1.0
    (metablend.app)` (OSM API usage policy).
- **`POST /api/route-weather`** body `{ points: [[lat, lon, ele|null]…]
  (≤ 500), date: 'YYYY-MM-DD', pace, start?: 'HH:MM', lang, unit }`
  - Validates (lengths, ranges, date within the forecast), fills missing
    elevations (elevation API), picks samples, fetches one multi-location
    Open-Meteo request (summit variables `SUMMIT_HOURLY`, the 3
    `CORE_MODELS`, `forecast_days=8`, per-point `elevation`), blends each
    point with `blendSummitHourly`, runs `suggestStart` (and the timeline
    for `start` when given).
  - Response `{ stats, samples: [{ i, km, ele, label }], suggestion: { start,
    highAt, windowEnd } | { none, reason, firstBad, nextDay }, stages: [{ i,
    eta, temp, feels, wind, rain, storm, blocker }] }` — numbers, formatted
    by the client like the summit view.
  - Rate limit 20 / min / IP; `maxDuration = 60`; failures `no-store`;
    upstream failures logged like `hike.upstream`.

### 4.3 App

- `app/components/hike/RouteList.jsx` (peak page section, calls
  `/api/routes`), `RouteView.jsx` (map, profile, stats, pace / day / start,
  stages, save, plan), `ImportGpx.jsx` (file input, size ≤ 5 MB, `parseGpx`
  + `simplify` in the browser), `MyRoutes.jsx` (saved list).
- `lib/route-store.js`: routes in native Preferences (`mb_routes`, JSON,
  ≤ 30, each simplified to ≤ 500 points); web fallback none (app only).
- Map tiles: `https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png` with
  attribution "© OpenTopoMap (CC-BY-SA), © OpenStreetMap contributors";
  tile errors switch the layer to OSM standard tiles.
- Deep link `/hike?route=<saved id>` opens a saved route (push taps).

### 4.4 Plan a hike on a route

- `hike_plans.route jsonb` (nullable): `{ name, pace, points: [[lat, lon,
  ele]…] ≤ 150 }`; `parsePlan` accepts and validates it; the peak fields stay
  (the route's highest point).
- Dispatcher: plans with a route run the route-weather pipeline instead of
  the summit window; texts `pushHikeRouteEvening` / `pushHikeRouteMorning`
  in the 5 languages.
- Privacy page: "Routes stay on your phone; a route you plan a hike on is
  stored with the plan to send its alerts and deleted with it."

## 5. Errors and edge cases

| Case | Behaviour |
|---|---|
| GPX unreadable / no track / > 5 MB | "This file has no route we can read" / "This file is too big (max 5 MB)" |
| GPX without elevation | elevations from Open-Meteo (server) |
| Route longer than one day (> 12 h at the pace) | timed up to sunset, banner "Longer than a day — only the first day is timed" |
| OSM API down | stale cache if any, else "Routes unavailable right now — try again later" |
| Peak without route relations | "No marked routes found — import a GPX" |
| Weather request fails | route, map and stats still show; stages area "Weather unavailable — Retry" |
| No safe start | explicit reason + next safe day within the forecast, else none |
| Start time chosen after sunset | rejected in the picker (first light … sunset) |
| Saved routes full (30) | oldest unplanned route is dropped after a confirmation |

## 6. Testing

- `node --test`: `gpx` (Komoot-style track fixture, route-only file,
  multi-segment, junk), `geometry` (known distances, climb with noisy
  elevations, simplify keeps endpoints / high point), `timing` (DIN
  examples: 4 km flat = 60 min; 900 m up over 3 km = 3 h + 22.5 min),
  `samples`, `verdict` (all-safe day, storm from 11:00, windy ridge only),
  `osm` (recorded Großglockner `map.json` + `relation/14622955/full.json`
  fixtures: finds 712 / 712A, stitches the 3 ways in order).
- Endpoints smoke on production: Großglockner routes; route-weather for the
  712 polyline on tomorrow.
- Device checklist in `mobile/README.md`: import a Komoot GPX, peak routes,
  pace and day changes, own start time, save / reopen, plan → evening alert.

## 7. Build order

One plan, three stages, each shippable:
1. `lib/route/*` + `route_cache` table + `/api/routes` + `/api/route-weather`
   (live, unused by the UI).
2. App: RouteList on the peak page, RouteView, Import GPX, My routes.
3. Plan a hike on a route: `hike_plans.route`, dispatcher texts, privacy
   page.
