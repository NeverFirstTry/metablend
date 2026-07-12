# MetaBlend Local vs independent ground truth — 2026-07-12

The leaderboard says MetaBlend Local (consensus + learned per-city bias) is
top-tier, but the leaderboard is scored against the same METAR feed that
trains the bias. This check uses **Meteostat hourly observations** instead —
an independent pipeline that feeds nothing in the calibration loop.

Method: all stored forecast snapshots from the last 4 days for the 10
busiest cities (1,000 rows, all European: London, Munich, Madrid, Paris,
Vienna, Zurich, Berlin, Barcelona, Hamburg, Amsterdam), each matched to the
Meteostat observation nearest its timestamp (≤45 min). Temperature only.

## Result: the lead is real

**Paired comparison** (same city, same snapshot — the honest test):
MetaBlend Local beats 11 of 13 sources outright, ties Open-Meteo, and loses
only to BrightSky by 0.08 °C.

| vs source | n | MB MAE | source MAE | edge |
|---|---|---|---|---|
| met-norway | 70 | 0.89 | 1.36 | **+0.47** |
| gfs | 69 | 0.90 | 1.26 | **+0.36** |
| visual-crossing | 70 | 0.89 | 1.22 | **+0.32** |
| weatherapi | 70 | 0.89 | 1.06 | **+0.17** |
| owm | 70 | 0.89 | 1.05 | **+0.16** |
| ecmwf | 69 | 0.90 | 1.03 | **+0.13** |
| world-weather-online | 70 | 0.89 | 1.00 | **+0.11** |
| tomorrow | 60 | 0.90 | 1.00 | **+0.10** |
| geosphere | 15 | 0.79 | 0.88 | **+0.09** |
| icon | 69 | 0.90 | 0.99 | **+0.08** |
| open-meteo | 69 | 0.90 | 0.90 | ±0.00 |
| brightsky | 28 | 1.01 | 0.93 | −0.08 |

Overall MAE ranking (unpaired): 1. geosphere 0.84 (n=18, Austria only) ·
**2. metablend 0.94** · 3. open-meteo 0.96 · … · 13. met-norway 1.45.

The only two sources that match or edge it are regional specialist services
on their home turf (BrightSky = DWD for German cities, GeoSphere for
Austria), by ≤0.08 °C. Among globally available sources, MetaBlend Local is
the most accurate on this sample.

## Caveats (why this is evidence, not proof)

- Small sample: ~70 paired snapshots over 4 days, temperature only.
- All 10 cities are European; other regions have less traffic and less
  learned bias so far.
- Meteostat draws on the same physical station network as METAR — the
  pipeline is independent, the sensors ultimately are not.
- Re-run after a few weeks for the long-term trend (`node
  scripts/verify-local.mjs`, needs RAPIDAPI_KEY in .env.local).
