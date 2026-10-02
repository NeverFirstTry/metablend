# More mountains — design

Approved in chat 2026-10-02. First of three queued sub-projects (then more
languages, then store prep).

## Goal

The Hiking screen's curated list grows from 41 Alps peaks to about 200
peaks worldwide, each with the difficulty of its usual way up, and stays
easy to use on a phone: the peaks near you first, everything else grouped
by region.

Owner's choices: all four groups (more Alps, rest of Europe, world classics,
easy hiking hills); layout "nearest first + regions"; difficulty as SAC
grades.

## Data — `lib/hike/featured.json`

Built by `scripts/build-featured-peaks.mjs` as today (hand-picked list,
published heights, exact coordinates from OpenStreetMap via Photon: the
match nearest the hint, within 3 km). Each entry gains two fields:

```json
{ "id": "grossglockner", "name": "Großglockner", "aka": ["Grossglockner"],
  "lat": 47.07455, "lon": 12.69388, "elev": 3798, "country": "AT",
  "kind": "peak", "region": "eastern-alps", "grade": "WS" }
```

- `region` — one of a fixed, ordered list:
  `eastern-alps`, `western-alps`, `dolomites`, `pyrenees-iberia`,
  `british-isles`, `scandinavia`, `carpathians`, `balkans-greece`,
  `mediterranean-islands`, `africa`, `north-america`, `south-america`,
  `asia`, `oceania`. Dolomites wins over Eastern Alps for peaks in the
  Dolomites.
- `grade` — the usual route in good summer conditions on the SAC scales:
  hiking `T1`–`T6`; for routes over glaciers or with climbing the
  mountaineering grade `L`, `WS`, `ZS` or `S`. Huts: the usual way to the
  hut.
- Rough mix, about 200 entries: Alps ~100 (today's 41 included), rest of
  Europe ~40, world classics ~30 (Kilimanjaro, Rockies, Andes, Himalaya
  trekking peaks, Fuji, New Zealand …), easy hiking hills ~30 (T1–T2,
  1,000–2,000 m, mostly Alps and Europe; filed under their region).
- Today's 41 ids stay exactly as they are: saved hike plans, widgets and
  shared links point at `?peak=<id>`.
- The build script refuses to write the file when an id repeats, a region
  or grade is not in the lists above, a height is missing, or Photon finds
  nothing within 3 km of the hint (it prints the entry; the hint gets fixed).

## Hiking screen (app)

1. **Near you** — the 10 featured peaks nearest to:
   - the device position, when location was already granted (permission
     state `granted`; no prompt) or the user tapped "Near me";
   - else the last city looked at (its coordinates from the cached forecast,
     `mb_forecast_last` in localStorage);
   - else no Near you block.
   Each row shows the distance.
2. **All peaks** — every featured peak grouped by region in the fixed order;
   each region is a collapsible section (closed by default). The region of
   the nearest peak starts open; with no position or city, none.
3. Rows: name, height, grade, country (huts keep their hut icon). The peak
   page shows the grade next to the height.
4. A small note under All peaks and next to the grade on the peak page:
   "SAC grade of the usual route in good conditions — check locally."
5. Search (`/api/peaks`) keeps matching featured peaks first; nothing else
   changes there.

The website's hiking teaser keeps its peak of the day, now drawn from the
larger list (peaks only, no huts).

## Texts

New keys in all current languages (en, de, fr, es, it): `hikeNearYou`,
`hikeAllPeaks`, `gradeNote`, and one `region_<id>` per region. New
languages come with the next sub-project.

## Code units

- `lib/hike/featured-list.js` (pure): `REGIONS` (the ordered ids),
  `GRADES`, `nearest(peaks, pos, n = 10)` → peaks with `km`,
  `byRegion(peaks)` → `[{ region, peaks }]` in `REGIONS` order, empty
  regions left out. Tests with a small fixture.
- `scripts/build-featured-peaks.mjs`: LIST rows gain region and grade; the
  validation above.
- `app/components/hike/FeaturedList.jsx`: grade and distance in a row.
- New `app/components/hike/PeakDirectory.jsx`: Near you + collapsible
  regions; used by `HikeApp.jsx` in place of the single list.
- `PeakView.jsx`: grade + note.

## Review focus

- No position and no cached city → no Near you block, all regions closed,
  nothing breaks.
- A cached forecast without `lat`/`lon` (older cache) → treated as no city.
- Location permission denied or the API missing → falls back to the city.
- Long region / peak names on a 390 px phone wrap or truncate, never
  overflow.
- Existing deep links `?peak=<old id>` still open the same peak.

## Out of scope

More languages (next sub-project), store prep (after that), grades for OSM
routes beyond the existing T-grade in the routes list.
