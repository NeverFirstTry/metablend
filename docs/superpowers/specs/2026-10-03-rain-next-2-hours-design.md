# Rain in the next 2 hours — design

Approved in chat 2026-10-03 ("2hour is go").

## Goal

Answer "will it rain in the next two hours, and when exactly?" — the
question people open a weather app for most — on the forecast page and the
weather widget, and make the existing "Rain soon" notification
minute-accurate.

Owner's choices: direction "rain in the next 2 hours"; show it **and**
sharpen the alert (15-minute checks for home cities); no background
location.

## Data

- Open-Meteo `minutely_15=precipitation`, `forecast_minutely_15=8` (2 h),
  one request per place with
  `models=best_match,icon_d2,meteofrance_arome_france_hd,knmi_harmonie_arome_europe,dmi_harmonie_arome_europe,metno_nordic,gfs_hrrr,ukmo_uk_deterministic_2km`.
  Verified 2026-10-03: the response contains only the models that cover
  the place (Vienna: icon_d2, KNMI, DMI; New York: HRRR; Sydney: none).
- **Fine models** = every returned model except `best_match`. With at least
  one fine model the result is `precision: 'fine'` and `best_match` is
  ignored (it is one of them already); with none, `best_match` alone,
  `precision: 'rough'`.
- Steps are 15 minutes, local time of the place (`timezone=auto`); the first
  step is the current quarter hour.

## Blend — `lib/nowcast.js` (pure)

- `blendSteps(response) → { precision, models: n, steps: [{ t, mm, wet, agree }] }`
  per step: `mm` = median of the models' values (null values dropped),
  `wet` = more than half of the models ≥ 0.1 mm, `agree` = share of models
  on the majority side (0.5–1).
- `intensity(mm)` per 15 min: light < 0.6, moderate < 2, heavy ≥ 2
  (≈ < 2.5 / < 8 / ≥ 8 mm/h).
- `summarize(steps, nowMin) → one of`:
  - `{ kind: 'dry' }` — no wet step;
  - `{ kind: 'start', at, minutes, until?, intensity }` — dry now, rain
    from step k (`at` = its time, `minutes` = minutes from now, `until` =
    end of the first wet run if it ends within 2 h);
  - `{ kind: 'stop', until, intensity }` — wet now, a dry step later;
  - `{ kind: 'all', intensity }` — wet for all 8 steps.
- Texts (13 languages, new keys): full sentence for the forecast card and a
  short one for the widget:
  `ncDry` "Dry for the next 2 hours", `ncStart` "Rain from ~{at} · {intensity}",
  `ncStartFor` "Rain from ~{at} for about {duration} · {intensity}",
  `ncStop` "Rain now, stops ~{until}", `ncAll` "Rain for the next 2 hours ·
  {intensity}", `ncLight`/`ncModerate`/`ncHeavy`, `ncShortStart` "Rain ~{at}",
  `ncShortStop` "Rain until ~{until}", `ncRough` "Rough estimate — no
  short-range model covers this place", `ncTitle` "Next 2 hours",
  `pushNowcastBody` "In ~{minutes} min · {intensity}, about {duration}".

## Endpoint — `/api/nowcast?lat&lon`

- Rounds lat/lon to 2 decimals (≈ 1 km; also the cache key), fetches once,
  returns `{ precision, models, steps, summary, utcOffsetSec }`.
- CDN `s-maxage=300, stale-while-revalidate=300`; in-memory 5 min; the
  existing limiter on cache misses.
- Open-Meteo failing → 502 with `upstream` (like the other routes), logged
  as `nowcast.upstream`; the page then just leaves the card out.

## Forecast page

- A "Next 2 hours" card under the headline (today tab and the start view
  of a city): the sentence, 8 bars (height by mm, coloured by intensity,
  faint when the models disagree), quarter-hour labels every 30 min, and the
  `ncRough` note when `precision === 'rough'`.
- Fetched after the forecast (needs its lat/lon); refreshes with the
  page's auto-refresh. No card when the fetch fails.

## Weather widget

- `/api/app-widget` fetches the nowcast for the city; when the summary is
  `start` or `stop` (rain within 2 h), `now.text` becomes the short text
  (`ncShortStart` / `ncShortStop`). Otherwise unchanged. Server-only — no
  app rebuild (both widgets render `now.text` on one line).

## Alert — 15-minute dispatch

- New pg_cron job `push-dispatch-nowcast` every 15 minutes (:02, :17, :32,
  :47) calling `/api/push/dispatch?only=rain` with the same secret.
- `runDispatch({ only: 'rain', getNowcast })`: for devices with
  `alert_rain` and a home city — one nowcast per home city — send when
  `summary.kind === 'start'`, `10 ≤ minutes ≤ 60`, `precision === 'fine'`
  and the first wet step's `agree ≥ 0.66`. Message kind `rain` (so the
  existing dedupe, 3-per-day cap and quiet hours apply), body
  `pushNowcastBody`, title the existing `pushRainTitle`.
- The hourly job no longer evaluates the hourly rain rule for devices whose
  home city has `precision: 'fine'` nowcasts; for `rough` places the hourly
  rule stays (the 2-hour data there is no better than hourly).
- Storms, severe weather, heat and the briefing are unchanged.

## Tests

- Blend: recorded Open-Meteo responses (Vienna with fine models, Sydney
  rough) → precision, median, wet/agree; null handling.
- Summary: dry / start (with and without `until`) / stop / all; minutes from
  now with the current quarter in progress.
- Texts: parity test (13 languages) covers the new keys.
- Alert rule: lead window, dry-now, agreement, rough → no nowcast alert and
  hourly fallback, dedupe against a recent hourly `rain` log entry.
- Endpoint: 502 on upstream failure; widget payload swaps `now.text` only
  for `start`/`stop`.

## Out of scope

Radar extrapolation, alerts for the phone's current position, nowcast for
peaks/routes, snow-specific wording.
