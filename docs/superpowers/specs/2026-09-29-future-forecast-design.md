# Future-focused forecast ("Outlook") — design

Date: 2026-09-29 · Status: approved in brainstorming (tabs, tab contents,
engine option 1, caching, learning, page/error/testing sections)

This is sub-project 1 of 3. Sub-project 2 (mountains & hiking hub) and
sub-project 3 (Android/iOS apps with native-only features) get their own specs
and reuse the engine built here.

## 1. Intent

**Said by the owner:** the product should look ahead instead of dwelling on
"right now" ("any user can just look outside"). The existing "who is right
right now" learning stays; learning who is right about the *future* is added
alongside it. The page must stay uncluttered: one range at a time, chosen
with a switcher, more detail for the near term. Upstream APIs must not be
drained by many users looking at the same city — cache per city for 30 min.

**Assumed and confirmed:** the consensus + learned-weights identity stays the
core; one codebase; free, no accounts; all UI text in 5 languages.

**Success looks like:**
- the landing view answers "what's coming" (next 48 h) in one sentence;
- 7-day and 14-day views show how much the sources agree, openly;
- the leaderboard shows who is best at 48 h / 7 days / 14 days per region,
  from verified results, next to the existing "right now" ranking;
- a city viewed by 1 or 1,000 people costs the same upstream calls per 30 min.

## 2. UX

A compact **now line** sits on top (consensus temp, condition icon, agreement,
"n of m sources report rain now"); tapping it expands the current details
(feels like, wind, source-spread strip, cloud/visibility/precip/snow/ground
temp, vs-yesterday). Below it, a **3-way tab switch: 48 h · 7 days · 14
days** (tabs, not a slider — chosen in brainstorming). Default tab 48 h; the
last-used tab is remembered per device.

Every tab opens with a one-sentence **headline** (the answer), then its chart
or list, then details:

| Tab | Headline | Body |
| --- | --- | --- |
| 48 h | next rain window ("Rain likely 15–18 h today · 7 of 9 sources") or "dry", plus tomorrow's peak | hourly temp line with source-spread band, rain bars, scrollable hour strip, best time outside, UV/air/pollen, rain radar (folded) |
| 7 days | best day to go outside | one row per day: low/high range bar, rain chance, agreement meter (●●● / ●●○ / ●○○), "models split by N°" warning when the spread exceeds 4 °C; tap a day for its hours |
| 14 days | trend vs normal ("Cooling off from the weekend") | high/low lines vs the 10-year normal, uncertainty band that widens with range, week 2 labelled "trend only", vs-normal and rainy-day counts, records for this month (folded) |

Folded on every tab: **Sources & who's right now** (today's source cards and
spread strip) and **How's the weather where you are?** (feedback form). The
severe-weather banner stays above the tabs. The intraday consensus sparkline
is dropped.

Times are shown in the **city's** local time exactly as delivered (never
re-interpreted in the viewer's timezone).

## 3. Architecture

### Routes

- **`/api/outlook?city=<normalized>`** (new) — the future forecast. Language
  neutral: headlines are codes + numbers, translated in the browser (and by
  the server for the SEO city pages via the same pure text module).
- **`/api/forecast`** (existing, slimmed) — right now only: live sources,
  consensus, confidence, warning, rainingNow, extras (UV/AQI/pollen),
  details, yesterdayTemp, MetaBlend Local, stats/forecast-row side effects.
  Loses: forecast7, sunrise/sunset, climate, records, bestTime, willRain,
  historyToday, and the Open-Meteo daily/hourly/archive fetches behind them.
- The page requests both in parallel; each part renders when ready and fails
  independently.

### Caching (both routes)

- Successful responses carry
  `Cache-Control: public, s-maxage=<ttl>, stale-while-revalidate=<2×ttl>`;
  ttl = 1800 s for `/api/outlook`, 900 s for `/api/forecast`.
  Vercel's CDN then serves repeat requests without invoking the function,
  collapses concurrent misses into one invocation per region, and serves the
  last copy while one background refresh runs.
- Error responses carry `Cache-Control: no-store` — an outage must never be
  frozen for 30 minutes.
- The browser normalizes the city key (trimmed, lower-cased) so all visitors
  share one cache entry. `/api/outlook` has no `lang` in its key;
  `/api/forecast` keeps `lang` (geocoded display name), max 5 variants.
- The payload carries `generatedAt`; the page shows "updated N min ago".
- The existing per-instance in-memory cache in `/api/forecast` stays as a
  second layer.
- The 10-year climate archive fetch uses Next's fetch cache with a 24 h
  revalidate (climate normals don't change within a day).

### Sources for the outlook

One Open-Meteo `/v1/forecast` request, hourly + daily, `forecast_days=16`,
`timezone=auto`, with these models (ranges measured 2026-09-29):

| id | Open-Meteo model | reach |
| --- | --- | --- |
| ecmwf | ecmwf_ifs025 | 15 d |
| gfs | gfs_seamless | 16 d |
| icon | icon_seamless | 7.5 d |
| ukmo | ukmo_global_deterministic_10km | 7 d |
| gem | gem_seamless | 10 d |
| jma | jma_seamless | 11 d |
| meteofrance | meteofrance_seamless | 4.5 d |
| knmi | knmi_harmonie_arome_europe | 3 d, Europe only |
| dmi | dmi_harmonie_arome_europe | 3 d, Europe only |
| metno-nordic | metno_nordic | 3 d, Nordics only |

The **pure** regional models are used on purpose: their `*_seamless`
variants silently continue as ECMWF-derived copies of each other after ~2
days (measured: knmi/dmi/metno seamless within 0.27–0.59 °C of each other in
Vienna, London and Oslo), which would fake agreement. Pure models return
null outside their range/domain, so they drop out by themselves.

National services with real forecasts, fetched in parallel:
- **met-norway** (locationforecast) — **only inside the Nordic box**; outside
  it tracks ECMWF within 0.2–0.4 °C (measured), so it would be a duplicate.
- **nws** (US hourly gridpoint, 7 d), **smhi** (snow1g, 10 d, Nordics),
  **brightsky** (DWD MOSMIX via Bright Sky, Germany, 10 d).
- Implementation step: measure each national product against the models in
  its home region (3 cities, first 72 h); any product within 0.4 °C mean
  |Δ| of another included source is dropped as a duplicate.

Week-2 uncertainty: one Open-Meteo **ensemble** request (`ecmwf_ifs025` = 51
members, `gfs025` = 31 members; keys `*_ecmwf_ifs025_ensemble`,
`*_ncep_gefs025`), daily max/min/precip, 16 days.

Climate: Open-Meteo archive, 10 years daily max/min/mean/precip → per-date
normals (±7-day window across years), monthly records, rainy-day normals.

Upstream cost per city refresh: ~3 Open-Meteo calls + national services
(regional ones only where they apply). Free Open-Meteo limit 10,000
calls/day → ~50–70 continuously viewed cities; the commercial plan exists if
the app outgrows it.

### Blending (pure, `lib/outlook/blend.js`)

- **Hourly** (next 168 h, city-local hours): per hour, weighted mean temp over
  the sources with data, weights = learned `outlook_weights` for the city's
  region and the horizon the lead time falls into (unknown → equal).
  Band = min–max of contributing sources (p10–p90 when ≥ 6 sources).
  Wind = weighted mean. Icon/condition from the highest-weighted source.
- **Daily** days 1–7: same rules on daily max/min; `spread` = max−min of the
  sources' daily max; `agree` = 3 (≤ 2 °C), 2 (≤ 4 °C), 1 (> 4 °C);
  a split warning when spread > 4 °C.
- **Days 8–14**: central values from the deterministic models that reach;
  band = ensemble p10–p90 of member daily max (and min); week 2 flagged
  `confident: false`.
- **Rain chance** (hour or day): sources publishing a real probability
  contribute it; sources with only an amount contribute a vote (hour:
  ≥ 0.1 mm → 100, else 0; day: ≥ 1 mm). Weighted mean of all contributions.
  **null when no source says anything about rain** — never a fabricated 0.
  Days 8–14 use the ensemble share of members with ≥ 1 mm.
- **Best time outside**: the existing scoring (rain, wind, 15–25 °C comfort
  band), over daytime hours (07–21 local) of the next 48 h.

### Headlines (pure, `lib/outlook/headlines.js`), language-neutral

- 48 h: `rain_now {until}` | `rain_window {from, to, agree, total}` | `dry`;
  always with `peak {temp, at}` for tomorrow. A window = consecutive hours
  with rain chance ≥ 50 %; `agree` = sources calling rain in the window.
- 7 days: `best_day {date, tempMax, rainPct}` | `no_good_day`; plus
  `splits: [{date, spread}]`.
- 14 days: `trend {dir: warmer|cooler|normal, week1, week2}` where weekN =
  mean anomaly of daily max vs normal; `|anomaly| < 1 °C` = normal.
- Text rendering in `lib/outlook/text.js` (uses `lib/i18n.js`), shared by the
  client and the SEO city pages.

### Response shape (`/api/outlook`)

```
{ city, country, lat, lon, region, generatedAt, utcOffsetSec,
  sources: [{ id, name, reachHours }],
  notes: ['fewer_sources' | 'ensemble_unavailable' | ...],
  sun: { sunrise, sunset },
  hourly: [{ t, temp, lo, hi, rainPct, windKmh, icon }],        // 168 h
  bestTime: { t, temp, rainPct, windKmh, icon } | null,
  days: [{ date, tempMax, tempMin, maxLo, maxHi, minLo, minHi,
           rainPct, windKmh, icon, agree, spread, confident }],  // 14 d
  normals: [{ date, max, min }], vsNormal: { week1, week2 },
  rainyDays: { forecast, normal }, records: { hottest, coldest, wettest },
  headlines: { h48, d7, d14 } }
```

### Code layout

`lib/outlook/` — `sources.js` (fetch + parse, network), `blend.js`,
`ensemble.js`, `climate.js`, `headlines.js`, `text.js`, `checkpoints.js`,
`verify.js` (pure matching/scoring), `weights.js` (DB). Everything except
`sources.js` fetchers and `weights.js` is pure and unit tested. Display names
for all source ids move to one shared module (today duplicated in the
forecast route and the leaderboard page).

## 4. Learning who's right about the future

### Snapshots

When `/api/outlook` recomputes and the city has no snapshot in the last 6 h
(models refresh every ~6 h), insert one row per contributing source into
`outlook_snapshots` with its checkpoints:
- hourly: temp + rain call at +6, +12, +24, +48 h (UTC target times);
- daily: max, min, rain call for local days D+1 … D+14 (as far as it reaches).

### Verification (daily, inside the existing `/api/cleanup` cron)

- Due = hourly target in the past; daily = the local day has ended.
- Ground truth: METAR history from NOAA AWC (`ids=…&hours=50`; the service
  returns ~75 h per station, measured), batched for all due cities. Station =
  nearest reporting airport within 60 km from `lib/airports.json`
  (up to 3 candidates, nearest reporting wins).
- Hourly checkpoint vs the report closest to the target (±30 min): temp
  error + rain yes/no from the report's weather string.
- Daily checkpoint vs the local day's max/min over ≥ 18 reports, and whether
  any precipitation was reported. (Hourly readings can miss the true peak by
  a few tenths of a degree — identical for every source, so rankings stay
  fair.)
- Scoring reuses `lib/scoring.js` with range-widening schemes:
  `h48` [1.5, 3, 5, 7] °C (hourly + D+1), `d7` [2, 3.5, 5.5, 8] (D+2…D+7),
  `d14` [3, 5, 7, 10] (D+8…D+14); rain adds a separate delta from the Brier
  score with scheme [0.05, 0.15, 0.35, 0.6].
- **Never double counts:** checkpoints are marked in the snapshot's
  `verified` set *before* deltas are applied (a crash loses a signal rather
  than applying it twice — same policy as station calibration). Checkpoints
  without a station or data within the window are marked expired.
- Weights: `outlook_weights (id, region, horizon)`, same normalization as the
  live weights (`buildWeightUpdates`), missing rows seeded on first use.
- Snapshots are deleted once fully verified or after 16 days.

### Leaderboard

Tabs **Right now · 48 h · 7 days · 14 days**, each per region.
`/api/leaderboard` adds `horizons: { h48, d7, d14 }` (same region/apis shape)
and keeps its current fields. Young horizons show "still learning — N checks".

## 5. Data model (added to `supabase/setup_all.sql` + applied via migration)

```sql
create table if not exists outlook_snapshots (
  id bigserial primary key,
  city text not null, lat double precision, lon double precision,
  region text default 'global', source text not null,
  issued_at timestamptz not null default now(),
  hourly jsonb not null default '[]',   -- [{t, lead, temp, rain}]
  daily  jsonb not null default '[]',   -- [{date, lead, max, min, rain}]
  verified jsonb not null default '{}'  -- {checkpointKey: 'scored'|'expired'}
);
create index if not exists outlook_snapshots_issued on outlook_snapshots (issued_at);
create index if not exists outlook_snapshots_city   on outlook_snapshots (city, issued_at desc);

create table if not exists outlook_weights (
  id text not null, region text not null default 'global', horizon text not null,
  name text, weight double precision default 0.25,
  score integer default 0, reports integer default 0,
  delta_history jsonb default '[]', updated_at timestamptz default now(),
  primary key (id, region, horizon)
);
```
RLS enabled with no policies, like every other table (`enable_rls.sql`).

## 6. Error handling

- A failing source drops out (as today).
- Open-Meteo multi-model failure → 48 h/7 d fall back to national services
  (MET Norway worldwide in this case) with `notes: ['fewer_sources']`.
- Ensemble failure → week-2 band from the deterministic spread,
  `notes: ['ensemble_unavailable']`.
- Nothing at all → 502 `no-store`; the tab shows an error + retry, the now
  line keeps working.
- Stale-while-revalidate keeps the last good copy if a refresh fails.

## 7. Testing & verification

- TDD for all pure modules: parsing (against a recorded Open-Meteo fixture),
  model cutoffs, blending (weights, bands, rain rules incl. null), ensemble
  percentiles, normals, headlines, text rendering, checkpoint extraction,
  METAR matching, daily max/min, scoring schemes, weight updates.
- Build + lint + full `npm test`.
- Local run of `/api/outlook` for Vienna, London, Oslo, New York, Tokyo.
- After deploy: second request for the same city returns `x-vercel-cache:
  HIT`; an error response is not cached; all three tabs at phone width;
  spot-check languages.

## 8. Rollout order

1. Backend: `/api/outlook`, snapshots, verification, weights, leaderboard API
   — ship first so learning data accumulates while the UI is built.
2. Page: now line, tabs, three tab views, folded sections, `/api/forecast`
   slimming, city pages, i18n, offline cache of both payloads.
3. Leaderboard tabs.
4. Docs: README, changelog, privacy notice (no new personal data — confirm).

## 9. Out of scope

MetaBlend Local for future ranges; paid APIs' forecast endpoints; the hourly
pg_cron trigger (separate, waiting on the Vault secret); mountains; apps.
