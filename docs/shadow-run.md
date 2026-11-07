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
