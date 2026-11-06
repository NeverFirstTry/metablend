# Weighting shadow run: dates that split the data

The interim and final reports read `station_errors`. Anything below changes what a source's errors mean, so the reports must score that source separately on each side of the date.

| Date (UTC) | Source | Change |
|---|---|---|
| 2026-11-06, when `fix/sources-and-copy` reached production | `geosphere` | Moved from INCA-v1 (corner of a small box) to the nearest cell of INCA-v2. Errors before and after are different data. |
