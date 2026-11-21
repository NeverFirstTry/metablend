# Weighting shadow run: dates

| Date (UTC) | What |
|---|---|
| 2026-11-06 22:17 | First rows: airports only (`truth = 'metar'`). |
| 2026-11-07 12:17 | Full run: airports, official Austrian town stations (`station`) and five summits (`summit`). |
| 2026-11-21 | Interim report, two weeks of the full run. |
| 2026-12-05 | Final report, four weeks. Rows are kept 30 days, so all of it is still there. |

## Dates that split the data

The reports read `station_errors`. Anything below changes what a source's errors mean, so the reports score that source separately on each side of the date.

| Date (UTC) | Source | Change |
|---|---|---|
| 2026-11-07 12:22, deploy of `49f2112` | `geosphere` | Moved from INCA-v1 (the south-west corner of a small box) to the nearest cell of INCA-v2. Errors before and after are different data. |

## What the run keeps since the interim report

Two things the interim report of 2026-11-21 could not say, kept from the deploy of `feat/shadow-summit-shown-and-weights` on (owner, 2026-11-21; the changelog has the day):

- **What the app shows on a summit.** A summit row's `shown` holds the temperature the app's peak view displays for that hour: the same blend (`lib/hike/blend.js`) with the outlook's weights (`lib/shadow.js`, `summitShown`). Rows before that deploy have none, so the final report scores summits' shown value only from then on.
- **The live weights, once a day.** The nightly job writes one row per region into `weights_daily` (`supabase/weights-daily.sql`): the day and `{ source: weight }` as the forecasts use them. With them the final report can describe today's formula (how many sources tie, how far the weights move from day to day). Drop the table with `station_errors` once the formula is decided.
