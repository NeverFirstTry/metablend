# Official weather warnings (Europe) — design

Date: 2026-10-08 · Status: approved in conversation, spec for review

## Goal

Show the national weather services' official warnings for a city or peak in
MetaBlend, and send the serious ones as alerts. Official warnings are the
authoritative version of what the app's model-based "severe weather" alerts
guess at today, and few small weather apps carry them.

## Decisions (owner, 2026-10-05 → 2026-10-08)

1. **Coverage: Europe**, through MeteoAlarm (EUMETNET), which carries every
   member's national service (GeoSphere Austria, DWD, Météo-France, AEMET, …).
2. **Notifications: orange and red only.** Yellow shows in the app, never buzzes.
3. **They replace the model-based severe alerts where available.** The existing
   "Severe weather" switch sends official orange/red warnings in covered
   countries and keeps the model-based alerts everywhere else. No new setting.
4. **Hiking included**: peak pages show their area's warnings; a planned hike's
   alert mentions an orange/red warning for its area on the day.
5. **Screen: option C** — a slim strip at the top of the forecast for orange
   and red that jumps to an "Official warnings" card listing every level.
6. **Source: MeteoAlarm's open country feeds + our own region map** (no account).
   Rejected: MeteoAlarm's EDR point-lookup API — needs registration (answers
   "Unauthorized"), unknown re-use terms, a call per city.
7. **Quiet hours (default, changeable):** red goes out at once, day or night;
   orange waits for the end of quiet hours (07:00) and is sent then if still
   active.

## What MeteoAlarm provides (checked 2026-10-08)

- One JSON feed per country, no key:
  `https://feeds.meteoalarm.org/api/v1/warnings/feeds-<country>` (e.g.
  `feeds-austria`, `feeds-germany`) → `{ warnings: [{ uuid, alert }] }`, each
  `alert` a CAP 1.2 message: `identifier`, `msgType` (Alert / Update / Cancel),
  `references`, `sent`, `sender`, and `info[]` — one entry per language
  (DWD: de, en, fr, es, ar, ru, tr, pl) with `event`, `headline`,
  `description`, `instruction`, `onset`, `expires`, `senderName`, `web`, and
  `parameter[]`, which carries
  - `awareness_level`: `"2; yellow; Moderate"`, `"3; orange; Severe"`,
    `"4; red; Extreme"`;
  - `awareness_type`: `"1; Wind"`, `"2; snow-ice"`, `"3; Thunderstorm"`,
    `"4; Fog"`, `"5; high-temperature"`, `"6; low-temperature"`,
    `"7; coastalevent"`, `"8; forest-fire"`, `"9; avalanches"`, `"10; Rain"`,
    `"12; flooding"`, `"13; rain-flood"`.
- Areas are **region codes only** (`geocode` `EMMA_ID`, e.g. `DE103`
  "Kreis Aurich – Küste", `AT803` "Dornbirn"); no outlines in the feed.
- Feeds still list **expired** warnings (DWD: 111 of 138) — filtering by
  `expires` is required.
- Licence: "terms equivalent to CC BY 4.0, with additional requirements for
  redistributing" → attribution to MeteoAlarm and the issuing service on
  every warning shown.
- Region outlines: MeteoAlarm's EMMA_ID geocodes as GeoJSON (2,003 regions,
  36 countries, ~800k points, 31.5 MB), bundled by the open-source
  `NiklasJordan/meteoalarm` package. **Switzerland and the UK are not in it.**

## Architecture

Small units, each testable on its own:

| Unit | Job |
|---|---|
| `scripts/build-warning-regions.mjs` | One-off build (re-run ~yearly): downloads the geocodes GeoJSON, simplifies outlines (Douglas–Peucker, ~0.005° ≈ 400 m), rounds coordinates, adds a bounding box per region → `lib/warnings/regions.json` (target ≤ 2 MB, server-only). |
| `lib/warnings/regions.js` | `regionsAt(lat, lon) → EMMA_ID[]`: bounding-box prefilter, then point-in-polygon (MultiPolygon, holes). Pure. |
| `lib/warnings/parse.js` | `parseFeed(json, country, now) → Warning[]`: one record per alert, expired / cancelled / superseded (an Update or Cancel replaces what it `references`) dropped, level 2–4, type from `awareness_type`, texts per language. Pure. |
| `lib/warnings/text.js` | Picks a warning's text in the reader's language (→ English → first given); level and type labels in the 13 UI languages. Pure. |
| `lib/warnings/rules.js` | Which warnings become alerts: level ≥ 3, once per warning, again on an upgrade, the quiet-hours rule. Pure. |
| `app/api/warnings/refresh` | Job (pg_cron every 15 min, calibrate key via `jobKeyProblem`): fetches the 36 country feeds (in parallel, timeout each), parses, replaces each country's rows in the `warnings` table (a failed country keeps its rows). |
| `app/api/warnings` | `GET ?lat&lon&lang` → the warnings at that point, most serious first, then by start. CDN 5 min per ~1 km. |
| `WarningStrip`, `WarningsCard` | The screen (below). |
| push integration | `lib/push/rules.js` / `dispatch.js`: official warnings for the home city and planned-hike areas. |

### Storage

Supabase table `warnings` (RLS on, no policies — server only):
`id text primary key` (CAP identifier), `country text`, `regions text[]`
(EMMA_IDs, GIN index), `level smallint` (2–4), `type text`, `onset
timestamptz`, `expires timestamptz` (index), `texts jsonb`
(`{ lang: { event, headline, description, instruction } }`), `sender text`
(issuing service's name), `web text`, `fetched_at timestamptz`. Migration in
`supabase/warnings.sql`; the owner applies it (or re-authorises the Supabase
connector).

### Data flow

1. pg_cron `warnings-refresh` at :00/:15/:30/:45 → `/api/warnings/refresh`.
2. Forecast or peak page → `/api/warnings?lat&lon&lang` → `regionsAt` →
   `select … where regions && $ids and expires > now()` → JSON.
3. The 15-minute push run (`push-dispatch-nowcast`, :02/:17/…) and the hourly
   run read the same table for each home city and hike plan.

## Screen (option C)

- **Strip** above the hero, on every forecast tab, when an orange or red
  warning is active or starts within 24 h: level word + ⚠ count, type, time
  ("Orange · Thunderstorms · today 15:00–21:00"), "+N more" when there are
  others; tapping scrolls to the card.
- **"Official warnings" card** at the top of the Today tab, under the
  headline: every level, now and upcoming (48 h), one row each — level chip
  (word + ⚠ / ⚠⚠ / ⚠⚠⚠, never colour alone), type, time span; tapping a row
  opens the official headline, description and advice, then "GeoSphere
  Austria · MeteoAlarm" with a link to the service.
- **Peak pages**: the same card for the peak's position.
- Nothing shows outside covered regions, or when there is nothing to show.
- Accessibility as the rest of the app: named controls, spoken level words,
  AA contrast on every sky, Larger Text reflow.

## Alerts

- "Severe weather" switch on, home city in a covered region → official
  warnings replace the model-based severe alerts for that city; elsewhere the
  model-based alerts stay.
- Level ≥ 3 only; one message per warning id; a new message only on an
  upgrade (orange → red); never for a warning that has expired.
- Quiet hours: red immediately; orange held until 07:00 local and sent then
  if still active.
- Planned hike: on the hike day, an orange/red warning for the peak / route
  start area adds a line to the existing evening/morning hike alert.
- Message (13 languages): "Orange warning in Vienna: Thunderstorms, today
  15:00–21:00" — the type and times are ours; the official headline stays in
  the app.

## Errors and edge cases

- A country feed down → its stored rows stay until they expire; the job logs
  it (`error_log`, `warnings.upstream`).
- Every read filters `expires > now()` — nothing outlives its end time.
- No texts in the reader's language → English → the first given.
- A point on a region border may match the neighbour after simplification
  (~400 m) — acceptable; tested so it never matches nothing inside a country.
- Switzerland / UK / non-members: no warnings shown, model-based alerts as now.

## Testing

- `parseFeed` against saved real feeds (Germany, Spain, Austria): levels,
  types, languages, expired / cancelled / superseded dropped.
- `regionsAt`: Vienna, Innsbruck, Lienz, Berlin, Madrid in their regions;
  border and enclave cases; the sea → none.
- `text.js`: language choice, labels in all 13 languages (parity test).
- `rules.js`: level filter, once per warning, upgrade, quiet hours (orange held,
  red sent), expiry, replacing model-based severe only in covered regions.
- API routes: bad input → 400; refresh needs the key.
- Screen: the axe check and the large-text pass on a page with a warning.

## Out of scope (v1)

Switzerland and the UK (not in the outline set), worldwide coverage, yellow
notifications, translating official texts ourselves, warnings on the
website's static city pages.
