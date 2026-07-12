# Aviation math verification — 2026-07-12

Independent audit of every number the aviation pages display, per the project
rule "no displayed number that hasn't been checked against a source". Run with
live NOAA AWC data for LOWI, LOWW, EDDM, EGLL, KJFK, KLAX at 19:20Z/18:51Z.
The verification script tests the real exported functions from
`lib/aviation.js` against independently written reference implementations
(no shared code).

## Results: no mismatches

| Check | Reference | Result |
|---|---|---|
| Flight rules (6 airports) | AWC's own `fltCat` field | 6/6 match |
| Flight rules (12 boundary cases) | NWS category table (vis 1/3/5 SM, ceiling 500/1000/3000 ft) | 12/12 pass |
| Pressure altitude | FAA: `elev + (29.92 − inHg) × 1000` | max Δ 3 ft |
| Density altitude | Exact dry-air ISA power law `145442.16 × (1 − σ^0.235)` | Δ 23–55 ft |
| Crosswind/headwind (28 runway ends) | Independent 2-D vector implementation | all ≤ 0.5 kt after rounding |
| Crosswind signs | Known-answer cases (E6B: wind 090@10 on RWY36 = 10 kt from RIGHT, etc.) | 5/5 pass |
| Disclaimer | Fetched all 6 live pages | present on all (unconditional in the component) |

## Documented approximations (not bugs)

- **Pressure altitude** uses 30 ft/hPa; the FAA inches formula works out to
  29.53 ft/hPa. Error ≤ 3 ft at normal QNH, ~14 ft at extreme QNH (960 hPa).
- **Density altitude** uses the 120 ft/°C rule of thumb (FAA rule is 118.8);
  vs the exact ISA solution the pages read 20–60 ft high in summer conditions.
  The page already labels the value "Approximation — verify with your POH".
- **True vs magnetic**: METAR winds are true-north referenced and OurAirports
  runway headings are true (`_degT`), so the crosswind math is internally
  consistent. Tower/ATIS winds are magnetic, so a pilot comparing against ATIS
  will see slightly different numbers where declination is large.

## Data quirks noticed

- LOWI lists grass strips 08G/28G with non-reciprocal headings (080°/280°) in
  OurAirports source data. Displayed as-is; the math on them is still correct
  for the headings shown.

Script: `node scripts/verify-aviation.mjs` — it patches the `airports.json`
import so plain Node can load `lib/aviation.js`, then compares the real
exported functions against the references above. Re-run any time; it prints
a per-airport report and a final issue list.
