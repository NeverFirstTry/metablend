# Changelog

All notable changes to MetaBlend. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Dates are UTC.

## 2026-10-08

### Added — official weather warnings (Europe)
- The national weather services' warnings via MeteoAlarm in 17 countries
  (Austria, Bosnia and Herzegovina, Cyprus, Denmark, Finland, Germany, Greece,
  Italy, Latvia, Lithuania, Montenegro, the Netherlands, Poland, Portugal,
  Serbia, Slovakia, Spain): an "Official warnings" card on the forecast and peak pages (yellow, orange, red —
  each as a word and ⚠ count — with the issuer's own text and advice), and a
  slim strip at the top of the forecast for orange and red.
- "Severe weather" alerts send official orange and red warnings for your home
  city (red at any hour, orange after 7:00) and name them in planned-hike
  alerts; outside MeteoAlarm's countries the model-based alerts stay.

## 2026-10-05

### Fixed — Near you
- Hiking → Near you lists the notable summits around you from OpenStreetMap,
  not just the nearest of the 200 featured peaks: around Lienz that is now
  Schleinitz, Große Sandspitze, Hochschober and Petzeck instead of Großglockner
  and the Drei Zinnen. The highest within about 20 km (50 km in flat country),
  one per mountain, nearest first; featured peaks in range always included.
  New `/api/peaks/near`, cached per ~5 km for a day; the featured list stays
  as the fallback.

### Security — pre-release review
- Accuracy feedback only from MetaBlend's own pages, and a city moves the
  source weights at most once per 30 minutes.
- Job endpoints refuse requests when their secret is missing; keys compared in
  constant time; secrets never sent to a host taken from a request.
- The forecast API only accepts known languages; deep links and notification
  taps only open MetaBlend pages; no other site may frame MetaBlend (except the
  embeddable /widget); stricter escaping; key files ignored in git; Android no
  longer backs up the app's device key.

## 2026-10-04

### Faster — only your language
- Pages now ship English plus just the visitor's language (fetched on demand,
  ~8 KB) instead of all 13: about 70 KB less JavaScript on every page (home
  290 → 221 KB gzipped), so pages become usable sooner, most of all on slow
  connections. The server-rendered hiking page carries its language inline.

### Fixed — accessibility follow-ups
- The chart is read as "Low 5° at 23:00, high 14° at 14:00" — no false direction
  when the high comes first — and leaves out the rain chance on dry days.
- The app starts at your text size: the last Larger Text size is applied before
  the first paint instead of jumping once the phone answers.
- Android: changing the font size no longer reloads the page; the text follows
  in place.
- The large-text wrap rule only touches rows (not column boxes or rows meant to
  stay on one line); tests now cover °F summaries and older app builds without
  the text-size plugin.

### Fixed — App Store
- The location purpose string Apple asks for (ITMS-90683,
  NSLocationAlwaysAndWhenInUseUsageDescription) in all 13 languages. The app
  still only asks for location while it is in use.

## 2026-10-03

### Added — accessibility
- **Larger Text** in the app: text follows the phone's text-size setting (up to
  double) and updates live; small labels and hour cards grow with it, and rows
  that would run off the screen rearrange instead of cutting words.
- **VoiceOver / TalkBack**: every button is named; the temperature chart, each
  hour card, the agreement dots and the leaderboard sparklines are read as one
  sentence each; the hour strips can be focused and scrolled from a keyboard.
- **Contrast**: small text on every sky and on the light theme meets WCAG AA —
  the bright skies (day, dawn, dusk, cloudy, snow) are a few shades deeper and
  faint labels a little stronger.
- Storm risk shows 1 / 2 / 3 segments, not just a colour.
- `npm run a11y` checks 12 pages in both themes and the brightest skies, then
  every main app page at double text size (nothing off screen or under the tab
  bar); `lib/sky-contrast.test.js` does the sums for text over the sky gradient.

### Added — rain in the next 2 hours
- **Next 2 hours** on the forecast: when rain starts or stops, how long and
  how heavy, from a blend of the short-range models that cover the place
  (ICON-D2, AROME, HARMONIE, MET Nordic, UKMO, HRRR) in 15-minute steps;
  "rough estimate" where none does.
- The weather widget shows "Rain ~14:20" / "Rain until ~14:40" when rain is
  due within 2 hours.
- **Rain soon** alerts come from the nowcast, checked every 15 minutes: "Rain
  in Vienna — in ~20 min · light, about 25 min". The hourly rule stays where no
  short-range model covers the home city.

### Added — beta testers
- **metablend.app/testers** in 13 languages: how to join the Android closed test
  (Google Group + opt-in link) and TestFlight, what to try, and the 14 days
  Google asks for; each platform says "opening soon" until its links are set
  in `lib/testers.js`. The website's hiking page links to it.
- **More → Send feedback** in the app: an email to info@metablend.app with the
  app version, phone OS and language filled in.

### Added — store prep
- Store listings in 13 languages (App Store: 12 — no Slovenian there) in the
  fastlane layout, captioned screenshots for iPhone and Android made by
  `scripts/store-shots.mjs`, the Play feature graphic, and copy-paste answers
  for Apple's App Privacy, Google's Data safety, content rating and export
  compliance (`store/compliance.md`).
- iPhone only (iPads run the iPhone version); no export-compliance question
  per build; Android release signing from a git-ignored key file.
- `mobile/README.md`: the steps to TestFlight and a Google Play closed test.

### Changed
- A dry "next 2 hours" is a slim line under the headline instead of a card;
  the card with bars shows when rain is coming. "Send feedback" in More looks
  like the other rows.
- Alert runs ask our own forecast endpoints with the server key, so they never
  hit the per-visitor limits however many home cities there are.
- Peak search: at most 5 featured peaks, names starting with what you typed
  first — "mount" no longer fills every result and hides OpenStreetMap hits.
- Long peak names wrap instead of being cut off in the peak lists; the grade
  reads "CAS" in French and Italian (their name for the SAC scale).
- Traditional-Chinese phones no longer get a blank first moment on the
  website (they read the English page, nothing to swap).
- The website's hiking page sends a quarter less peak data to the browser.
- **Hour strips** (forecast and summit): drag them with the mouse; our own
  scroll bar sits centred in the gap below the cards and is easy to see —
  press or drag it to scroll. The native bar overlaid the cards and faded out.
- Week headline reads **"Best day of the week: …"** in every language ("Best
  day outside: today" sounded off).

### Added — more languages
- **13 languages**: Dutch, Polish, Czech, Slovenian, Portuguese (Brazil),
  Japanese, Chinese (Simplified) and Korean join English, German, French,
  Spanish and Italian — website, app, notifications, widgets and the privacy
  notice. "System" picks the phone's language (Traditional Chinese phones get
  English); Polish, Czech and Slovenian counts use their own plural forms.
- Texts live in one file per language (`lib/i18n/`); a test makes sure every
  language has every text with the same placeholders.

## 2026-10-02

### Added — more mountains (app)
- **200 featured peaks** instead of 41: more Alps (Dolomites, Swiss and French
  4000ers, easy day-hike summits), the rest of Europe (Pyrenees, Tatras,
  Scandinavia, British Isles, Balkans, Etna …) and world classics (Kilimanjaro,
  Rockies, Andes, Himalaya trekking peaks, Fuji, New Zealand).
- **SAC grade** of the usual route on every featured peak (T1–T6, or L / WS /
  ZS / S over glaciers and with climbing), in the list and on the peak page.
- **Near you**: the 10 featured peaks nearest to you (or to the last city you
  looked at); **All peaks** grouped by region, folded, yours open. The website
  teaser lists the regions too.

### Added — hiking routes (app)
- **Routes to a peak**: each peak page lists the marked OpenStreetMap routes
  that reach it (number / name, SAC grade T1–T6, length, climb, walking time), walked
  up to the summit and back.
- **Import a GPX** from the phone; routes are saved on the phone under
  **My routes** (up to 30).
- **Route view**: topo map, elevation profile, day and pace (slow / normal /
  fast) — then a suggested start window that keeps every part of the walk
  clear of rain, strong wind, deep cold and darkness, the time you reach each
  stage, and the next safe day when today or tomorrow doesn't work.
- **Plan a hike on a route**: the evening before at 18:00 the alert gives the
  start ("Start by 07:30 — summit ~10:45"), the morning brings an update only if
  the start moved by 30 minutes or more or the day turned unsafe; tapping opens
  the route. The plan keeps the chosen pace and a simplified copy of the route
  (deleted with the plan); the route is kept under My routes.
- Privacy notice: routes, OpenTopoMap tiles, the summit-only OSM lookup.
- `/api/routes` (OSM routes near a summit, cached 7 days) and
  `/api/route-weather` (blended forecast at 6–10 points along the route, walking
  times by DIN 33466).

### Added — home-screen widgets (app)
- **Weather widget** on iPhone and Android: city, temperature, condition, high /
  low; medium adds the next 6 hours or the next 5 days (a setting), large shows
  both plus rain and wind. City = the home city or one of the recent ones; style
  = living sky or plain system. Refreshes about every 30 minutes, keeps the last
  data with its time when offline, taps open that city.
- **Next hike widget**: the next planned hike's summit window (or its day
  summary), tapping opens the peak.
- `/api/app-widget` boils forecast / outlook / summit forecast down to
  display-ready text (CDN-cached); the app hands the widgets their settings
  through a native `WidgetBridge`; `metablend://` links route widget taps. iOS:
  WidgetKit extension (iOS 17+, App Group); Android: RemoteViews providers with
  a settings screen. Gallery and Edit Widget texts in the phone's language.

### Added — new logo, app icon picker
- **New mark**: the M (white / navy) and the B (sunlight gold) from the brand
  typeface, centred, with two clouds; Light, Dark and Sky versions. The iPhone
  icon follows light / dark / tinted, Android and the web use Sky, themed /
  tinted icons and the notification icon show the letters alone; new splash
  screens. The website's tab icon is a plain cloud that follows the browser
  theme. `scripts/brand/` regenerates every icon file.
- **More → App icon**: Automatic / Light / Dark / Sky on iPhone (alternate
  icons), Sky / Light / Dark on Android (launcher aliases; warns that the home
  screen may lose the icon).

### Changed
- **Language**: a "System" choice (the default) follows the phone's language,
  English when we don't have it; picking a language pins it. The iPhone location
  prompt is translated.
- No more English / °C flash for other languages: the content waits for the
  swap (at most 1.2 s). The website header fits one row on phones (icon links),
  "1 weather model" / "1 check" read right.
- Push: an APNs key limited to one environment switches to the other server;
  Android gets a proper status-bar icon, the notification permission and
  channel names in the app language; turning push on says why it failed.

### Fixed
- **Hiking back buttons**: "All peaks" and the route's back go back instead of
  adding a step, so the phone's back button no longer returns to the peak just
  left; a peak or route opened from a notification or link still goes to its
  list.
- **Recent** lists only cities you searched for or tapped: notification and
  widget taps and shared / city-page links no longer add to it (inside the app
  the Forecast tab still reopens the city you last looked at).
- **Short city names landing on the wrong place**: the place lookup also
  matches airport codes, so "Kos" showed Sihanoukville, Cambodia (airport KOS)
  and put it into Recent. A short search whose top match doesn't start with it
  now goes to the town of exactly that name (Kos, Greece); "Vie" → Vienna and
  "Gra" → Graz stay as they were.
- **Mountain and city forecasts sometimes didn't load**: Open-Meteo requests
  from Vercel occasionally hang past 10 s. They now retry once, then fall back
  to the three core models (ECMWF, ICON, GFS) before the single-source backup;
  every fallback is logged and a 502 names the upstream reason.
- The planner downloaded 10 years of climate data on every request: cached a
  day and rate-limited. Heatmap and leaderboard are CDN-cached and no longer
  send raw database errors; the map loader and the notification prompt fail
  soft instead of throwing.
- Widgets read cached data against the real clock (no "Friday" as the next day
  after midnight).

### Security
- Next.js 16.3.8 and patched dependencies (`npm audit`: 0); the two batch
  database functions got a fixed `search_path` (Supabase advisor).

## 2026-10-01

### Added — push notifications (phase 4 of the app)
- **Weather alerts** for one home city: rain soon (30 min–2 h ahead), thunderstorms,
  severe weather (heavy rain / snow, freezing rain, strong wind) and heat. Quiet
  hours 22:00–07:00 (severe weather still comes through), at most 3 a day.
- **Morning briefing** at an hour you pick (05–11): the day's range, rain and the
  best time outside, in your language and unit.
- **Hike alerts**: 🔔 Plan a hike on a peak → the summit window the evening before
  at 18:00, and a morning update only if it moved.
- **More → Notifications** (home city, switches, briefing hour, planned hikes, test
  button) and a one-time "Get a heads-up before rain?" card after the 3rd forecast.
- Sending straight to FCM (Android) and APNs (iOS) with self-signed JWTs — no SDKs;
  an hourly pg_cron job (`push-dispatch-hourly`) reads each home city's cached
  outlook once. `lib/push/*` (rules, texts, validation, senders, dispatcher) tested.
- Privacy notice updated; phones unseen for 90 days, past hikes and the 14-day send
  log are cleaned up nightly.

## 2026-09-30

### Changed — share and embed
- **Share** sends a link to that city (`/city/<name>`) with a line in the
  sharer's language and unit ("Wien · 18° · Klar / 10 Wetterquellen, 90 %
  Einigkeit"); the link shows a live preview card of the city's weather on its
  sky (`/api/og/city`, CDN-cached) and forwards to the forecast. Desktop copies
  text + link; cancelling the share sheet no longer copies anyway.
- **Embed** — the widget is rebuilt on the living sky: city, thin temperature,
  condition, high / low, sources, in 5 languages, °C/°F, auto / dark / light,
  compact 300×200 or wide 480×180, tapping opens the forecast. The panel
  picks size and look with a true-size live preview and a working copy button
  (it used to read "Copied" before anything was copied). `lib/share.js`, tested.

### Fixed
- **One city, one history** — the live forecast now files everything it
  stores or learns (forecast rows, the per-city bias behind MetaBlend Local,
  consensus history) under the place's English name, like the outlook; the
  response carries it as `learnCity` and feedback reports use it, so they still
  match. Existing data was merged: Wien (Austria) → Vienna, München → Munich,
  Klagenfurt am Wörthersee → Klagenfurt, with the city biases combined by
  sample count (Wien, Missouri stays its own city).
- **The outlook looked cities up in English**: "Wien" in German showed Vienna's
  weather now but Wien, Missouri's Today / Tomorrow / Week. It now uses the
  visitor's language like the live forecast; its learning snapshots stay keyed
  by the English place name (GeoNames id lookup), so "Wien" and "Vienna" remain
  one city.
- A shared or restored city loaded in English on first visit (the language
  wasn't read yet), which also picked the wrong place for such names.

### Changed — system theme, iPhone safe areas
- **Appearance follows the device by default** (dark or light, live when the
  device switches); More → Appearance offers System / Dark / Light, and the
  header button stores an explicit choice. `lib/theme.js` (pre-paint script,
  tested) and `components/ThemeSync.jsx`; browser bars get a colour per scheme.
- **The app's header sat under the iPhone status bar** — every page now ships
  `viewport-fit=cover` in its HTML (the boot script used to add it at runtime,
  which didn't take on iOS) and pads the content by the safe area: the sky runs
  under the status bar and home indicator, the content stays clear of them.
  0 in a normal browser tab; also fixes the home-screen web app.

### Changed — daylight sky, loader, night icons
- **The light theme wears the sky too** — the same eight skies as pale
  daylight (zenith colour on top, bright horizon below), navy ink, frosted
  white glass, a deep-sky blue accent and navy pill buttons. Switching theme
  fades one sky into the other.
- **Loader** (`components/SkyLoader.jsx`) — a cloud drifting past the sun
  with "Gathering the forecast" and the sources being asked ticking by,
  instead of grey skeletons. Used for city search, compare, the outlook, the
  summit forecast (its 10 models), the leaderboard and the planner.
- The loader's parts are separate layers that only move or fade, so it runs
  on the compositor: 8 paints in 3 s instead of 118. No filters on moving
  layers (the cloud's shadow is drawn in), a wider sway, no 3 px bob, and a
  calmer 1.6 s source ticker.
- Panels are a tint over the sky instead of a live backdrop blur (the sky
  behind them is a smooth gradient, so the blur was invisible but cost every
  frame on weaker GPUs); only the fixed bars and the suggestion list blur.
  The entrance no longer animates a blur either.
- Headlines read as sentences in German, French, Spanish and Italian
  ("Heute Nacht bleibt es trocken", "Morgen bleibt es trocken").
- Native controls follow the theme (`color-scheme`); the language list no
  longer shows light text on a white popup.
- Hour icons turn to the moon after sunset and before sunrise, from the
  city's (or summit's) real sun times; the hero's clear-sky icon uses them
  too instead of a fixed 21:00–06:00 guess.

### Changed — living sky design
- **The page wears the sky** of the city (or summit) on screen: night, dawn,
  day, cloudy, rain, storm, snow or dusk, from the current weather code and
  the local sun times (`lib/sky.js`). The gradient eases between skies; the
  light theme keeps its paper look.
- Glass panels over the sky, sunlight-gold accent, white pill buttons, the
  system font (SF Pro on Apple devices, Hanken Grotesk elsewhere) and
  sentence-case labels instead of spaced capitals; the → arrows are gone.
- **Hero** — the temperature as a large thin numeral on the sky, condition,
  "feels like" and agreement beside it; the details open in a glass card.
- Motion: the city, temperature and headline rise into place on load and on
  every new answer; cards reveal on scroll where the browser supports it.
  Reduced motion turns both off.
- Page titles use the translated page name instead of two-colour wordmarks;
  `<html lang>` follows the chosen language, so German compounds hyphenate
  in narrow cards and screen readers pick the right voice.
- Android builds on Android Gradle Plugin 9.4 / Gradle 9.6.

### Added — app shell (phase 3 of the app)
- **`mobile/`** — Capacitor 8 projects for Android and iOS (Swift Package
  Manager) that load metablend.app with the `MetaBlendApp` user agent, plus an
  offline screen. Native plugins: back button, location, share, haptics;
  SystemBars for the status bar and safe areas. Build steps and a device
  checklist in `mobile/README.md`.
- **App chrome on the website, only inside the app** — a bottom tab bar
  (Forecast · Hiking · More), notch / gesture-bar safe areas, footer, install
  button and beta banner hidden, toasts and the consent notice lifted above
  the bar; Android back goes back or closes the app on the first screen.
- **`/more`** — settings (language, °C/°F, dark/light — the same cookies as
  the home page) and links to rankings, heatmap, planner, aviation and the
  legal pages. 5 languages.
- Share uses the native sheet and "Near me" the native location inside the
  app; plugin code is only downloaded inside the app.
- Inside the app the header row (units, theme, language, section links) is
  hidden — it lives in the tab bar and More — and no service worker runs:
  Android drops the app's user agent on service-worker requests, which made
  the Hiking tab show the web teaser. The app is now also recognised by a
  cookie the boot script sets.

### Added — hiking UI (phase 2 of the app)
- **`/hike`** — inside the app: peak search (debounced, "near me" sorts the
  featured peaks by distance), 41 featured Alps peaks, and a peak page with
  Today / Tomorrow / Week: the summit window as the headline ("Summit window
  tomorrow 07:00–12:00 · storms likely from 14:00"), the summit temperature
  chart, an hour strip with summit wind, rain and storm risk, summit wind /
  freezing level / storm risk cards, and the week's summit lows/highs, wind
  and freezing level. Everyone else gets a crawlable teaser: the peak of the
  day's live summit window, the featured list and "Coming soon" store badges.
  All 5 languages; disclaimer and OpenStreetMap attribution on every view,
  the borrowed-trust note on the peak page. A peak whose models report no
  storm energy never gets a green headline — it says the storm risk is unknown.
- Header link **Hiking**; `/hike` in the sitemap; privacy notice lists Photon
  and OpenStreetMap (5 languages).

### Added — hiking engine (phase 1 of the app)
- **`/api/hike`** — summit forecasts: the outlook's ~10 models downscaled to
  the peak's height; summit wind interpolated from the 850 / 700 / 600 hPa
  levels; freezing level (GFS / ICON, else from the summit temperature);
  hourly thunderstorm risk (CAPE + rain chance, lightning potential in
  Europe); the summit window for today and tomorrow and what ends it
  ("storms from 14:00"); 7 summit days. Weights borrowed from the region's
  outlook learning. CDN-cached per peak for 30 min.
- **`/api/peaks`** — worldwide peak and hut search (OpenStreetMap via Photon,
  GeoNames fallback), 41 featured Alps peaks first, umlaut- and
  alias-tolerant ("glockner", "Raxalpe", "Oetscher"). Heights are
  OpenStreetMap's surveyed `ele` (Ben Nevis 1345 m, Mount Whitney 4420 m);
  the 90 m terrain model — which reads sharp summits 50–200 m low — is only
  the fallback and flagged `elevApprox`. A search answered while a source was
  down is cached for 5 minutes instead of a day.
- Summit windows end at sunset, use each day's own sun times (DST-safe), and
  never run across the night; peaks above 4200 m use the 500 / 300 hPa winds;
  models without upper-air wind sit the summit-wind vote out.
- The outlook's daylight rule is shared (`inDaylight`) so best-time-out and
  the summit window agree on what daylight is.

## 2026-09-29

### Changed — Today · Tomorrow · Week
- **The outlook's tabs are now Today, Tomorrow and Week**; the 14-day view is
  gone. Past a week only two models remain and the answer turns into a trend
  nobody plans a day around, so the page now spends its space on the days
  people actually plan.
  - **Today** — the rest of today hour by hour (from 18:00 on it runs through
    the night to 06:00), the next rain window, the best time out, UV / air /
    pollen and the radar. Headlines like "Dry for the rest of today" or "Rain
    through the night".
  - **Tomorrow** — the whole day hour by hour, rain window or "Dry tomorrow",
    its high and when, "3° warmer than today", high / low with the sources'
    agreement, and tomorrow vs the 10-year normal.
  - **Week** — the 7-day list as before, now with the week vs normal and
    rainy days vs normal (moved over from the 14-day tab).
  All 5 languages.
- **Leaner engine.** The model request fetches 8 days instead of 16 and the
  ensemble request (only used for week 2) is gone: one upstream call fewer per
  lookup. Records and the trend chart went with the 14-day tab.
- **Learning follows the tabs**: predictions are saved for days 1–7, the
  leaderboard ranks "Today & tomorrow" and "Week". Older day-8–14 checkpoints
  expire unscored instead of skewing the week's ranking.
- City pages lead with today's and tomorrow's headline.

### Fixed — "best time out" after dark
- The best time to be outside could land at 21:00, long after sunset: a
  calm evening won on wind alone. It now only considers daylight (from the
  city's sunrise to half an hour before sunset), ignores breezes under
  15 km/h, prefers temperatures near 21 °C, and shows nothing when every
  remaining hour is wet anyway. Today's and tomorrow's are picked separately.
- Tomorrow's rain headline starts at 06:00: a wet hour at midnight is
  tonight's (the Today tab covers the night) and no longer becomes "Rain
  likely 00:00–01:00 tomorrow".
- "Models split by 4° on tomorrow" → "… tomorrow" / "… on Monday"; German
  now says "am Montag", Spanish no longer says "el mañana".

### Added — the outlook: 48 hours, 7 days, 14 days
- **The page now leads with what's coming, not what's outside the window.**
  "Right now" shrinks to one line (tap for the details), and three tabs take
  over: **48 h** (hourly chart with the sources' spread band, hour strip, best
  time outside, UV/air/pollen, radar), **7 days** (low/high bar, rain chance and
  an agreement meter per day, "models split by N°" warnings, tap a day for its
  hours) and **14 days** (trend against the 10-year normal, an uncertainty band
  that visibly widens with range, week 2 labelled "trend only", this month's
  records). Each tab opens with a one-sentence answer: the next rain window,
  the best day to go outside, the trend. The last tab is remembered. All 5
  languages.
- **A new future engine, `/api/outlook`.** ~10 independent weather models in
  one Open-Meteo request (ECMWF, GFS, ICON, UKMO, GEM, JMA, Météo-France and the
  KNMI / DMI / MET Nordic high-resolution models) plus NWS, SMHI and DWD MOSMIX
  where they apply; ECMWF + GEFS ensembles (82 members) for the week-2 band;
  10-year normals from the climate archive. Sources were measured for
  independence first: the regional models' `*_seamless` variants turned into
  copies of each other after ~2 days and MET Norway's own forecast tracked MET
  Nordic to 0.04 °C, so pure models are used and MET Norway is only the
  fallback. Rain chance is a real probability where published, otherwise the
  share of sources calling rain — null (never 0 %) when nobody says anything.
- **MetaBlend now learns who's right about the future.** Every source's
  predictions at +6 / 12 / 24 / 48 h and for days 1–14 are saved per city and
  checked by the nightly cleanup against NOAA METAR history once their time
  has come (checkpoints are marked done before scoring, so nothing is ever
  counted twice). Separate weights per region and range (`outlook_weights`)
  feed back into the blend; the leaderboard gets **Right now · 48 h · 7 days ·
  14 days** tabs. Verified end to end against real Vienna airport data.
- **One upstream lookup per city and period, however many people look.** Both
  routes are served from Vercel's CDN (30 min outlook, 15 min right now,
  stale-while-revalidate, concurrent misses collapsed; errors never cached).
  Confirmed in production: repeat requests come back `HIT`.

### Changed
- `/api/forecast` is "right now" only: the 7-day bundle, hourly best time,
  10-year history, rain verdict and intraday chart moved to the outlook (about
  15 → 5 Open-Meteo calls per lookup). City pages (`/weather/<city>`) take their
  7-day table, rain sentence and climate line from the outlook.
- `app/page.js` split into focused components (1,431 → ~930 lines).
- The landing-page explainer and the privacy notice (the saved forecast range)
  updated in all 5 languages.
- **Station calibration really runs hourly now.** GitHub Actions' "hourly"
  schedule had been firing only every 6–8 hours, so the trigger moved into the
  database: a Supabase `pg_cron` job (`station-calibrate-hourly`, :17 every hour)
  calls the endpoint through `pg_net`, reading the key from Supabase Vault at
  run time. The GitHub workflow stays as a manual button. See
  `supabase/cron.sql`.

### Fixed — security: feedback input
- **Stored XSS on /heatmap.** Feedback city names are user input, and the
  heatmap pasted them straight into Leaflet popups, which render as
  innerHTML. Every interpolated popup value is now escaped
  (`lib/html.js`), which also neutralizes any rows already stored.
- **Feedback is validated before it can touch anything** (`lib/feedback.js`,
  unit tested): the temperature must be a real number (a string like `"abc"`
  failed every comparison, slipped past the range check and scored every
  source −2), the condition must be one of the form's keys (the
  `__calibrate__` job sentinel, sent with yesterday's date, could switch off
  the daily calibration), the city a short string, and malformed JSON is a
  400 instead of a logged 500.
- **The server no longer trusts the client for what it can derive itself.**
  The report date is always the city-local today; the weight region and the
  heatmap pin come from the city's own stored forecast coordinates, so a
  report can no longer steer another region's weights or drop a pin at
  arbitrary coordinates. Reports with nothing to compare against get no pin.

### Fixed
- **7-day weekdays and record dates were one day early for everyone west of
  UTC.** `new Date('2026-09-30')` is UTC midnight, which a New York browser
  renders as Tuesday. Calendar dates are now formatted in UTC
  (`formatCalendarDate`).
- **Feedback now shows its effect**: the new weights come back in the
  response and update the source cards in place. The old reload re-fetched
  whatever was typed in the search box, and hit the 15-minute cache anyway.
- The feedback form's "sunny" option is gated by the city's clock, matching
  the server rule, instead of the viewer's.
- The intraday consensus chart starts at the city's midnight, not the
  server's UTC midnight.
- The 7-day strip and compare view show "–" instead of a bare "%" when no
  source reported a rain probability.

### Changed
- `/api/cleanup` now prunes `consensus_history` and `error_log` after 30 days;
  both grew without bound. New indexes on `forecasts(created_at)` and
  `consensus_history(created_at)` in `setup_all.sql` — **re-run it once in the
  Supabase SQL editor** (idempotent) to create them.
- City-local time helpers (solar hour, night, local date, local midnight)
  live in one pure module, `lib/localtime.js`, shared by server and client —
  they had been copied into four places.
- Removed a stray, unused root `layout.jsx` and untracked `_dev.log`.
- **Vercel Speed Insights is live** (cookieless Core Web Vitals). The package
  had been installed for months, but its snippet sat in that stray file and
  never loaded. Disclosed in the privacy notice in all 5 languages, whose
  retention section now also states the 30-day pruning.

## 2026-08-09

### Fixed — sources could publish a probability they never reported
- **MET Norway was injecting a fabricated 0 % rain probability into every
  search since launch.** `locationforecast` reports precipitation *amount*,
  never `probability_of_precipitation` (verified against both the compact and
  complete products, four continents) — but the fetcher read
  `probability_of_precipitation ?? 0` and flagged the result `rainIsProb:
  true`. A high-weight source therefore voted "0 % chance" in every rain
  consensus, which is the underlying cause of the headline reading "no rain"
  while other sources reported active rain. Its amount now becomes a
  pseudo-probability in the same fallback tier as NASA POWER and GeoSphere:
  usable when no real probability source answered, never a vote of its own.
- Tomorrow.io, Visual Crossing and Open-Meteo had the same `?? 0` pattern and
  would have published a fabricated 0 % on any response missing the field.
  All four sources now report `rainPct: null` with `rainIsProb: false` when
  the probability is absent. Regression tests cover the whole class.
- The aviation TAF-vs-METAR comparison anchored to `Date.now()`, which on an
  ISR page is the regeneration time rather than the observation's. It now uses
  the METAR's own `obsTime`, and `activeTafPeriod()` refuses an unknown
  reference time instead of matching the first period. This also clears the
  one ESLint error in the repo (`npm run lint` is green again).

## 2026-07-12

### Added — Aviation, per dispatcher feedback
- **Ceiling and visibility are now the lead values on every airport page** —
  they decide dispatch legality and alternates, so they get the big numbers,
  each colored by its own NWS category (LIFR purple → VFR green), with
  "lowest BKN/OVC layer AGL" spelled out. Wind, temperature and QNH moved
  down into the small grid.
- **Significant-weather flagging from METAR and TAF**: an alert strip below
  the disclaimer surfaces thunderstorms, freezing precipitation, hail,
  squalls, funnel clouds, dust/sand storms, ice pellets, blowing snow and
  TAF windshear groups — severe in red, caution in amber, each with its time
  window. Flagged codes are also highlighted inline in the TAF timeline.
- **RVR** is shown when (and only when) it is measured in the METAR raw
  text — RVR is never forecast, so it never appears under a TAF.
- **Live TAF-vs-METAR divergence**: each airport page compares the latest
  METAR against the TAF period valid right now, at category level plus
  significant weather, and shows a card only on disagreement ("Ceiling:
  METAR IFR vs TAF MVFR — conditions worse than forecast"). Vicinity
  variants count as anticipated (VCTS in the TAF matches TS in the METAR),
  TEMPO overlays count for weather but not for category, and unknown values
  never count as divergence.

### Added — Design
- **Source-spread strip in the hero**: every reporting source as a dot on a
  temperature scale centered on the consensus (minimum ±4 °C, so a tight
  cluster actually looks tight), colliding dots stacking into lanes, the
  MetaBlend value as the only accent-colored mark. The one-glance version of
  what the product does; per-dot tooltips, source cards below stay the
  detail view. All 5 languages.
- **Live flight-category board on /aviation**: 30 airports in three regional
  groups as chips colored by their current VFR/MVFR/IFR/LIFR category (one
  batched METAR call, 10-minute revalidation, same no-guessing category gate
  as the airport pages — unclassifiable METARs show "–").
- Back buttons on the aviation hub and airport pages, matching the other
  subpages.
- **MetaBlend Local highlighted in the source cards**: pinned first (the API
  appends it last), emerald border and glow, an "our model" badge in all 5
  languages — while the card body stays identical to every other source, so
  it visibly competes on the same terms.

### Added
- **Landing-page explainer**: "What is consensus forecasting?" in plain
  language above the footer, in all 5 languages — the first real prose on
  an otherwise UI-only page, phrased around the generic queries new
  visitors search for.
- The verification tooling is committed and re-runnable:
  `scripts/verify-aviation.mjs` + `scripts/verify-local.mjs` with method and
  results in `docs/aviation-verification.md` and
  `docs/metablend-local-verification.md`.

### Fixed — rain headline vs. sources contradiction
- The hero could confidently say "No rain" while source cards right below
  reported "moderate rain": the rain consensus only averaged sources with a
  true precipitation-probability feed, so sources *observing* rain (but
  reporting it only as a condition) couldn't move the number. Their share
  now works as an ensemble vote that floors the headline probability, the
  hero notes "N of M sources report rain now", and the confident no-rain
  banner becomes an explicit "Rain possible — the sources disagree" state
  whenever ≥2 sources report active rain or today's daily outlook is stormy —
  it never claims "no" against evidence, and never silently disappears.
- Mobile: long metric labels could escape their card (German "Luftqualität");
  labels now wrap inside the card and the German label is the shorter (and
  more Austrian) "Luftgüte".

### Fixed — METAR decode-hardening (unreported values fail visibly)
- `VV///`, `OVX` and `BKN///` (ceiling-forming layer, height not reported)
  no longer disappear into a green "No ceiling" — the page shows *Obscured*
  (LIFR purple) or *Not reported* (gray), and the flight-category badge is
  replaced by an explicit **CAT N/A** chip naming the missing input. A METAR
  with missing visibility can no longer silently read as VFR.
- Variable wind (VRB): the crosswind section states that per-runway
  components cannot be computed and gives the honest worst case (full wind
  speed as crosswind on any runway) instead of silently vanishing.
- AUTO / COR / CAVOK are surfaced as chips next to the station name.
- TAF cloud bases are zero-padded (BKN005, not BKN5).

### Verified
- **Aviation math audited against independent references.** On live METARs for
  LOWI, LOWW, EDDM, EGLL, KJFK and KLAX: flight-rules classification matches
  aviationweather.gov's own category everywhere and the NWS boundary table on
  all 12 edge cases; runway wind components match an independent vector-math
  implementation on every runway end, with the from-left/from-right sign
  convention proven by known-answer cases; pressure altitude is within 3 ft of
  the FAA formula. Density altitude reads 15–112 ft *above* the exact ISA
  dry-air value on the test fields — conservative in the safe direction; the
  page already labels it an approximation and defers to POH charts. The red
  "not for flight planning" disclaimer renders unconditionally in the page
  component and was confirmed live on all 16 sitemap airports.
- **MetaBlend Local verified against an independent ground truth.** Meteostat
  hourly observations (which feed nothing in the current calibration — it's
  only the cleanup fallback and Visual Crossing is configured) scored ~1,000
  stored forecasts across 10 cities / 3 days: MetaBlend Local ranks #2 of 14
  sources on overall MAE (0.91 °C) and beats 12 of 13 raw sources on strictly
  paired samples (edges +0.01 to +0.48 °C per forecast); only the
  Germany-only Bright Sky is marginally ahead (−0.07 °C, n=29). Early data —
  one weather regime, European summer — but the leaderboard position is not
  an artifact of scoring against its own training signal.
- Terms now call out the Aviation pages explicitly in the safety-critical
  clause (all 5 languages) and credit OurAirports in the attribution list.

## 2026-07-11

### Added — MetaBlend Aviation
- **`/aviation` hub with ICAO search and `/aviation/<icao>` airport pages**:
  decoded METAR and TAF, flight-rules badge (VFR/MVFR/IFR/LIFR), head/cross
  wind components for every runway end (best headwind starred), pressure and
  density altitude — NOAA Aviation Weather Center data plus OurAirports
  runway data, 12,118 ICAO airports bundled at build time. Supplementary
  information only; a "not for flight planning" disclaimer sits on every
  page. Linked from the header nav (5 languages) and the footer.

### Added
- New app icon (cloud + sun in brand emerald), rasterized from an SVG source
  into all favicon/PWA sizes.
- Contact address info@metablend.app in the footer and the privacy notice
  (all 5 languages).

### Fixed
- **Batch weight upsert violated the live NOT NULL constraint on `name`** —
  every batch since the 07-09 speedup had silently fallen back to the slow
  per-row path (the error-log tripwire added on 07-09 caught exactly this,
  194 entries). Batch rows now carry the name column; verified clean in
  production.
- Plausible reports to the single canonical domain now that metablend.app
  exists in the dashboard.

## 2026-07-09

### SEO
- **metablend.app is the canonical domain everywhere** — share text, embed
  widget, RSS feed, OG image, README and the GitHub workflows (redirect-safe
  `curl -L`, so flipping Vercel's primary-domain redirect can't break crons).
- **IndexNow ping on every deploy** (GitHub Action + public key file) for
  instant Bing/Yandex indexing; honest sitemap `lastModified` for static
  pages.
- All meta descriptions trimmed under Bing's 160-character limit — URL
  inspection flagged them as Errors, which counts against indexing a new
  domain.

### Fixed
- **Hourly station calibration no longer 504s**: weight upserts batched (17
  round-trips → 1), METAR ground truth prefetched in parallel across cities,
  `maxDuration 300` on the calibration routes. Batch failures now log to
  `error_log` instead of silently degrading.

## 2026-07-07

### Added — per-city pages
- **Server-rendered city pages** at `/weather/<slug>` (e.g. `/weather/vienna`)
  with a crawlable hub at `/weather`: real consensus data in plain HTML —
  current conditions, a semantic 7-day table, which sources are currently most
  trusted in that region, and climate context. ISR-cached 15 minutes (no
  build-time fetching, so deploys don't burn upstream quota). 54 curated
  cities in the sitemap; any other city renders on demand. This is the
  programmatic-SEO surface: "weather <city>" queries vastly outnumber
  "weather app" queries, and the per-city accuracy data is content nobody
  else has.
- **`/?city=X` deep links work now** — the home page loads that city on
  mount. The RSS feed has been linking to these URLs all along; they used to
  do nothing.
- Plausible analytics now report to both domain dashboards (comma-separated
  `data-domain`), so canonical-domain visits aren't lost.

### SEO
- **The site is finally findable.** English-first metadata (the html said
  `lang="de"` with German titles while the SSR content is English), a
  keyword-rich title/description with a `%s · MetaBlend` template, per-page
  titles and descriptions for the leaderboard, heatmap, planner, privacy and
  terms (they all shared the root title before), JSON-LD `WebApplication`
  structured data, and `metablend.app` declared as the canonical domain across
  metadata, sitemap and robots — consolidating ranking signals that were split
  between the two live domains.

### Added
- **Consensus 7-day forecast.** The daily strip was single-source (Open-Meteo
  only) — odd for a product whose thesis is "never trust one source". It now
  blends five keyless daily forecasts (Open-Meteo best-match, GFS, ICON,
  ECMWF, MET Norway) per day with the same learned weights as the live blend
  (`blendDailyForecasts`, pure and unit-tested).
- **Wind accuracy counts now.** METAR observations carry wind; hourly station
  calibration scores each source's wind forecast on a stricter-scaled scheme
  (±3/8/15/25 km/h) as a second delta alongside temperature.
- **Day/night bias buckets for MetaBlend Local.** Consensus errors are
  asymmetric (models miss nighttime cooling), so the per-city bias now learns
  and serves separate day (06–21 local) and night buckets, falling back to a
  samples-weighted blend while one bucket is still cold.
- **Nightly backups.** `/api/backup` exports the learned state (weights, bias,
  feedback, stats) and a GitHub Action stores it as a 30-day artifact —
  Supabase's free tier has no automated backups and this data is the product's
  memory. Reuses the existing `CALIBRATE_SECRET`; `error_log` excluded.
- **Learning-pipeline unit tests.** The weight normalization core
  (`buildWeightUpdates`), the bias EMA (`emaBias`) and the daily blender are
  now pure, exported and covered by `node --test` (21 tests).

## 2026-07-06

### Fixed
- **Hourly station calibration actually runs now.** It required a Weather
  Underground PWS key that was never configured, so every hourly run since
  launch had silently skipped. Ground truth now comes from aviation METAR
  observations (NOAA Aviation Weather Center — free, no key): all fresh
  reports within 60 km of each recently-searched city, median of the nearest
  four. One bbox request per city instead of up to seven, and it feeds
  MetaBlend Local's per-city bias learning from day one.

### Added
- **Six new keyless sources.** ECMWF IFS, NOAA GFS and DWD ICON as individual
  model feeds via Open-Meteo (genuine model diversity, each weighted
  separately), plus three regional agencies: NWS/weather.gov (US, hourly
  gridpoint forecast with real precipitation probability), Bright Sky/DWD
  (Germany, station observations) and SMHI (Scandinavia + Baltic, the new
  snow1g API — pmp3g was retired 2026-03). All verified against the live
  endpoints; regional sources return null outside their coverage boxes.
- **MetaBlend Local — our own prognostic source.** The live consensus
  corrected by a learned per-city temperature bias: an EMA of
  (ground truth − consensus) fed by user feedback and the hourly PWS station
  calibration (`lib/blend.js`, new `city_bias` table, RLS enabled). Served
  once a city has ≥3 samples. Deliberately excluded from the consensus it
  derives from (no circularity), but stored and scored like any other source —
  the leaderboard will show whether it earns its keep.
- **The whole site speaks all five languages now** (EN/DE/FR/ES/IT), not just
  the home page: the privacy notice and terms are fully translated (server
  wrapper keeps the SEO metadata, a client component renders the localized
  body from the language cookie), and the leaderboard, heatmap, planner and
  footer use the shared dictionary via a new `useLang()` hook. Month names in
  the planner localize via `toLocaleDateString`. The consent-banner text now
  honestly lists the preference cookies (language, unit, theme, recent
  cities) instead of claiming there is only one.
- **Light mode.** Dark stays the default and the brand; the sun/moon toggle in
  the header opts into a print-style light theme (paper surfaces, ink text,
  the emerald recalibrated to emerald-700 for AA contrast on white). The JSX
  keeps its dark-palette classes — `globals.css` owns the entire translation
  in one `[data-theme="light"]` block, applied before first paint via a cookie
  (`metablend_theme`), so there is no flash either way. Map tiles drop the
  dark-invert filter in light mode.
- **The current condition is finally in the hero** — big weather icon plus the
  translated condition ("Partly cloudy") above the temperature, judged
  day/night by the city's own clock. Previously the single most-asked weather
  question was only answered inside the per-source cards.
- **The MetaBlend logo is clickable** and returns to the start view.

### Accessibility
- Dimmest text bumped from `zinc-600` to `zinc-500` everywhere (the old value
  sat below AA contrast on the card background); visible `:focus-visible`
  outline for keyboard users; the toast announces via `role="status"`; unit
  toggle exposes `aria-pressed`; the language select and theme toggle have
  proper labels in all five languages. (Reduced-motion support already
  existed.)

### Changed
- **Privacy notice matches reality again.** Community feedback is retained to
  power the heatmap and long-term rankings (it was previously described as
  deleted within 48 h — true before yesterday's retention change); reports
  always carry the searched city's geocoded coordinates, never device GPS,
  and the notice now says so; the server-side validation providers (Weather
  Underground, Meteostat) are listed as data recipients.

## 2026-07-05

Correctness pass on the consensus and the learning loop (after a code review).

### Fixed — rain consensus
- **`rainPct` no longer mixes humidity/cloud cover into the rain answer.** Every
  source now declares whether its number is a true precipitation probability
  (`rainIsProb`); OpenWeatherMap, WeatherAPI, World Weather Online and
  Weatherstack were reporting cloud cover or humidity as "rain %", which biased
  "Will it rain today?" toward yes. The consensus rain %, the ≥40% yes/no answer
  and the heavy-rain warning now use only real probabilities (Open-Meteo,
  MET Norway, Tomorrow.io, Visual Crossing), with the NASA POWER / GeoSphere
  precip-amount heuristics as fallback. Sources without a probability show no
  rain % on their cards.

### Fixed — timezones
- **"Best time to be outside" uses the city's clock, not the server's** (UTC on
  Vercel). Previously the "hours left today" filter was wrong for any city far
  from UTC.
- **The "no sunny reports at night" guard is now local time**, estimated from
  the report's longitude — it was checking UTC, which blocked e.g. Sydney from
  reporting sun for most of its day.

### Fixed — weight learning loop
- **New `lib/weights.js`** — the load → score → normalize → persist pipeline the
  five calibration paths had each copy-pasted (and let drift) now lives in one
  place. Persistence uses an **upsert**: the old `.update().eq(region)` silently
  no-oped when the `(id, region)` row didn't exist, and its error fallback wrote
  to every region at once.
- **`/api/calibrate` scores with the `daily` thresholds** — it compares point
  forecasts against Visual Crossing's 24-h mean, same as the Meteostat check,
  but was using the tighter `instant` scheme.
- **No more double scoring** — the Meteostat validation in `/api/cleanup` now
  runs only when Visual Crossing isn't configured, so each day's forecasts are
  scored once, not twice against two different ground truths.
- Meteostat validation skipped days whose average temp was exactly 0 °C (falsy
  check), scored duplicate forecast rows per API instead of the latest, and
  lacked the ±5 °C outlier guard the other paths apply — all fixed.
- "Latest forecast per API" is now actually the latest (`order by created_at`;
  row order was unspecified before).

### Fixed — dates & stats
- **Forecasts are tagged with the city's local date**, not the server's UTC
  date (`localDateForLon`, solar-time approximation from the longitude). An
  evening search in Asia/Pacific used to land on the wrong calendar day, so
  daily calibration compared it against the wrong day's actuals. The
  "vs yesterday" badge uses the city's yesterday too.
- **`api_stats` updates are atomic** — a new `bump_api_stats` DB function
  (setup_all.sql) does the EMA + counters in one upsert, so concurrent forecast
  requests can't clobber each other's counts. Falls back to the old
  read-modify-write on DBs that haven't re-run setup_all.sql. Anon execution is
  revoked so the public key can't pollute stats via `/rpc`.
- **`npm run lint` actually lints now** — the script was a bare `eslint` with
  no target, which checks nothing; it's `eslint .`. The two
  `react-hooks/set-state-in-effect` errors it then surfaced (the deliberate
  post-hydration cookie/localStorage sync in `page.js` and the widget) are
  documented and locally disabled — reading those values in a state
  initializer would cause a server/client hydration mismatch.

### Changed
- **Community feedback is no longer deleted after 48 h** — only the internal job
  sentinels age out. Real reports feed the heatmap, which was pointless with a
  two-day memory.
- `/api/cleanup` is no longer fired on every forecast cache miss (it's a daily
  cron; that was two table-scan deletes per search).
- Job routes (`calibrate`, `cleanup`, `station-calibrate`, `self-calibrate`)
  declare `maxDuration = 60` so long runs aren't cut off at the default limit;
  station-calibrate reads its PWS stations in parallel.
- Feedback rejected by validation no longer burns the one-report-per-hour slot
  (the limit is marked only after a report is accepted).
- A weather source with an invalid API key (401/403) is treated as "not
  configured" instead of showing as "down".
- City suggestions are debounced (250 ms) and drop out-of-order responses.

## 2026-06-22

Security hardening pass (after an application security review), plus social/SEO
and attribution fixes.

### Security
- **Rate limit on `/api/forecast`** — the cache-miss path is throttled per IP
  (40/min) so nobody can drain the metered upstream weather APIs (and run up
  costs) by spamming distinct cities. Cache hits stay free.
- **Cron endpoints gated by `CRON_SECRET`** — `/api/calibrate`, `/api/cleanup`,
  and `/api/webhook` now reject unauthenticated callers once `CRON_SECRET` is
  set (Vercel attaches it to cron invocations automatically; the forecast route
  passes it on its internal calls). Until it's set they stay open, so nothing
  breaks before the env var is added. New shared helper `lib/auth.js`.
- **Removed the legacy `/api/migrate` route** — an unauthenticated DB-write
  endpoint that `supabase/setup_all.sql` long ago superseded.
- **Calibrate secret is header-only** — `/api/self-calibrate` and
  `/api/station-calibrate` no longer accept the secret as a `?key=` query param
  (query strings can leak into access logs); `x-calibrate-key` / Bearer only.
- **Security headers** — `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  and a `Permissions-Policy` are now sent on every response (`next.config.mjs`).
  No `X-Frame-Options` on purpose, so the `/widget` embeds keep working.

### Added — social & SEO
- **Generated OG/Twitter share image** — `app/opengraph-image.js` +
  `twitter-image.js` render a branded 1200×630 card. The old metadata pointed at
  an `og.png` that never existed, so every shared link showed a broken preview.
- **`robots.txt` and `sitemap.xml`** via `app/robots.js` / `app/sitemap.js`.

### Fixed
- **Terms copyright wording** — reworded so "no license … is granted" can't be
  misread as granting one.
- **Privacy notice** now discloses BigDataCloud reverse-geocoding (used only when
  you tap "my location").
- **Rain radar** map tiles carry the standard "OpenStreetMap contributors"
  attribution (matching the heatmap).
- Removed unused create-next-app scaffold SVGs from `public/`.

### Environment variables
- `CRON_SECRET` — gates the cron job endpoints. Set it in the host environment
  (Vercel sends it to crons automatically).

## 2026-06-21

Beta launch hardening: locked down the database, made the forecast resilient,
unified the scoring math, added self-calibration, a few user-facing features,
error logging, and the legal/site pages.

### Security
- **Database locked down with RLS.** All tables now have row-level security
  enabled with **no policies** (deny-all for the public anon key). The server
  uses `SUPABASE_SERVICE_ROLE_KEY` (`lib/supabase.js`), which bypasses RLS; the
  browser only ever talks to `/api/*` routes. Verified via Supabase's security
  advisor.
- **`supabase/enable_rls.sql`** — drops any lingering permissive policies, then
  enables RLS on every app table. **`supabase/setup_all.sql`** — one-shot,
  idempotent, RLS-neutral schema setup (consolidates all migrations, drops the
  `forecasts.api_id` FK that blocked inserts, adds `forecasts.created_at`).

### Calibration & scoring
- **`/api/self-calibrate`** (admin, gated by `CALIBRATE_SECRET`) — probes a
  16-city basket, rebalances weights against the live consensus median, and
  seeds forecasts so the daily cron can refine them against real actuals. A
  "Recalibrate weights" button on the leaderboard triggers it (prompts for the
  key).
- **`/api/station-calibrate`** — finds Weather Underground personal weather
  stations within 10 km of each recently-searched city, takes the median of their
  live temperatures as ground truth, and re-weights the last hour of forecasts
  against it. Real measured actuals. Gated by `CALIBRATE_SECRET` and triggered
  hourly by a GitHub Action (Vercel sub-daily crons need a Pro plan).
- **`lib/scoring.js`** — single source of truth for `median`, `deltaFromDiff`,
  and `rawFactor`; the feedback, calibrate, cleanup, self-calibrate, and
  station-calibrate routes all share it (with a `node:test` suite, `npm test`).
- **Exponential weight scaling** — `rawFactor` now scales `exp(avgScore * 0.5)`
  so accurate sources pull far more weight (linear scaling let weights converge);
  floor lowered to 0.01.
- **Outlier penalty** — any source more than 5 °C off the cross-API median temp
  takes a hard −2, on top of the actual-vs-forecast delta.
- **Feedback re-weights on every report** (`MIN_REPORTS_TO_UPDATE` 5 → 1).

### Reliability
- **Keyless 7-day fallback** — if Open-Meteo's daily endpoint is down, the
  forecast falls back to a MET Norway daily aggregation instead of blanking the
  strip; `geocodeCity`/`fetchOpenMeteo` now degrade on non-OK/non-JSON responses
  instead of 500-ing the route.
- **`/api/cleanup` added to the cron** (daily) alongside `/api/calibrate`.
- Forecast insert failures are now logged instead of silently swallowed.

### Added — source
- **GeoSphere Austria** — a free, keyless DACH-region source (Austria coverage),
  seeded for the `europe` + `global` weight pools only.

### Added — features
- **Favorite cities** — star toggle on a loaded city; saved to `localStorage`
  and shown as chips.
- **Leaderboard accuracy sparklines** — per-API bar sparkline of recent scoring
  deltas (from `delta_history`).
- **PWA install prompt** — an "Install app" button via `beforeinstallprompt`.
- **Beta disclaimer** — a `BETA` badge + in-development banner (`BetaBanner`) on
  every page, translated across EN/DE/FR/ES/IT.

### Added — observability
- **Error logging** — `lib/log.js` (`logError` + `withErrorLog`) always logs to
  the server console (→ Vercel logs) and best-effort writes to a new `error_log`
  table; `/api/forecast` and `/api/feedback` handlers are wrapped.

### Added — legal & site
- **Footer** on every page with a **GitHub source link**, Privacy/Terms links,
  copyright, and weather/map data attribution.
- **`/privacy`** — plain-language notice (cookies, feedback data, IP
  rate-limiting, Plausible analytics, third-party APIs, Supabase/Vercel hosting,
  ~48h retention; contact via GitHub issues).
- **`/terms`** — beta "as is" disclaimer, acceptable use, copyright, and
  data-source attribution/licenses (Open-Meteo CC BY, MET Norway, OSM ODbL, …).
- Heatmap map tiles now carry the standard "© OpenStreetMap contributors"
  attribution.

### Fixed
- **Offline banner** only shows when the device is genuinely offline
  (`navigator.onLine`), not on any failed request.
- **Service worker** (`public/sw.js`) only caches successful same-origin shell
  responses, never the API; cache bumped to `v2`.
- **Leaderboard** falls back to a region-less query on pre-migration databases.

### Changed
- **License changed from MIT to all-rights-reserved.** The source stays public on
  GitHub for transparency, but reuse now requires permission.

### Database migrations (run in the Supabase SQL editor)
- `supabase/setup_all.sql` — full idempotent schema (safe to re-run; RLS-neutral).
- `supabase/enable_rls.sql` — lock the database down (run after setting
  `SUPABASE_SERVICE_ROLE_KEY` in the server env). Adds/locks the `error_log` table.

### Environment variables
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; bypasses RLS. **Required in
  production** once RLS is enabled (set in `.env.local` and on Vercel).
- `CALIBRATE_SECRET` — gates `/api/self-calibrate`.
- `WUNDERGROUND_KEY` — Weather Underground PWS API key for `/api/station-calibrate`
  (the hourly cron requires a Vercel plan that allows sub-daily crons).

## 2026-06-04

A large batch of new features, internationalization, docs, and fixes.
Baseline for this entry is commit `5a5e2f5` (9 weather sources, region weights,
median-based feedback weighting).

### Added — forecast & display
- **Rain radar** — Leaflet map with a live RainViewer overlay over an
  OpenStreetMap base, loaded from CDN (`lib/leaflet.js`, `app/components/RainRadar.jsx`).
- **UV index, air quality (AQI) & pollen** — fetched from Open-Meteo's keyless
  air-quality API and shown as color-coded cards in the hero.
- **Simple rain answer** — a large "Yes, it will rain today 🌧 / No rain today ☀️"
  card driven by the 40% consensus threshold.
- **Severe-weather warning** — prominent red card when every source agrees on
  thunderstorms or heavy rain (>80%).
- **Best time of day** — picks the nicest remaining daylight hour (low rain,
  15–25 °C comfort band, low wind) from Open-Meteo hourly data.
- **Details section** — snowfall (mm), visibility (km), cloud cover (%), ground
  temperature, and precipitation (mm), color-coded.
- **Climate context** — current-month historical average temp, today-vs-average,
  and average rainy days, from the Open-Meteo ERA5 archive.
- **Weather records** — hottest / coldest / wettest for the current month over
  the last 10 years, with a "close to a record" flag.
- **Weather trend** — "getting warmer / colder / stable" next to the 7-day title,
  computed from the existing 7-day data.
- **Vs. yesterday** — indicator in the hero comparing today's consensus with
  yesterday's actual temperature (ERA5 archive).
- **Intraday consensus chart** — SVG sparkline of how today's consensus
  temperature has moved, from saved `consensus_history` snapshots.

### Added — pages & sharing
- **`/heatmap`** — world map of submitted feedback, dots colored by how accurate
  the consensus was (green → red).
- **`/leaderboard`** (reworked) — per-region API rankings via region tabs, now
  also showing each API's uptime % and average response time.
- **`/planner`** — travel planner with a 12-month avg-temp & rainy-days chart and
  "best months to visit" (`/api/planner`).
- **`/widget/[city]`** — minimal 300×200 embeddable consensus card.
- **Share button** — native Web Share on mobile, formatted clipboard copy on
  desktop, with a "Copied!" toast.
- **Embed button** — shows a live widget preview plus copyable iframe code.
- **Recent cities** — last 5 searched cities (deduped) as clickable chips,
  stored in the `metablend_recent` cookie.
- **City comparison** — Compare mode shows two cities side by side
  (temp / rain / wind / consensus).

### Added — units, i18n, UX
- **°C / °F toggle** — unit selector by the language switcher; preference stored
  in `metablend_unit` (1-year cookie); every temperature and the feedback input
  convert accordingly, with the unit shown next to each value.
- **Full internationalization** — weather conditions, AQI categories
  (Good/Moderate/Unhealthy…/Hazardous), UV levels, and pollen levels are now
  translated via `translateCondition`, `uvText`, `aqiText`, `pollenText` in
  `lib/i18n.js` across EN/DE/FR/ES/IT; all API-derived strings run through i18n.
- **Keyboard shortcuts** — Enter to search, Escape to clear and close suggestions.

### Added — APIs, jobs & infrastructure
- **15-minute response cache** in `app/api/forecast` (in-memory, keyed by
  city + language).
- **Offline mode** — service worker (`public/sw.js`) caches the app shell;
  last forecast per city is cached in `localStorage` and shown with an
  "you are offline" banner when the network is down.
- **PWA** — generated 192/512 + apple-touch icons, manifest theme color set to
  `#0e0e12`, installable on iOS/Android.
- **`/api/rss`** — RSS 2.0 feed of the last 24h of consensus snapshots for a
  city (`application/rss+xml`).
- **`/api/webhook`** — POSTs to `WEBHOOK_URL` when a city's consensus confidence
  drops below 40%; fired in the background by the forecast route.
- **`/api/calibrate`** + **`vercel.json` cron (6am UTC daily)** — scores
  yesterday's forecasts against Visual Crossing historical actuals and re-weights
  the APIs using the same logic as user feedback.
- **API response-time & uptime tracking** — each source call is timed (5s
  timeout via a shared `tfetch`); failed sources show a red "down" badge; rolling
  averages and success/fail counts persist to the `api_stats` table.

### Changed
- Forecast route now returns lat/lon, extras, details, climate, records,
  per-source response times, down sources, yesterday's temp, and today's history.
- Feedback now stores lat/lon and a consensus-accuracy score (for the heatmap);
  inserts gracefully retry without the new columns if the migration hasn't run.
- Feedback validation: "Clear"/"Klar" is allowed at any hour; only
  "Sunny"/"Sonnig" is rejected between 9 PM and 6 AM. The condition picker shows
  "Clear" alongside "Sunny" during the day.
- Code cleanup pass: trimmed AI-style comments to a more natural style and
  removed a redundant abstraction in the forecast route.
- Added `README.md` (overview, consensus explanation, stack, sources, setup,
  contributing) and an MIT `LICENSE`.

### Fixed
- Share/Embed button icons (`↗`, `</>`) are now vertically centered with the
  label (`inline-flex items-center`, `leading-none`).
- Embeddable widget's "MetaBlend" mark is centered along the bottom (was pinned
  bottom-right and looked off-center).

### Database migrations (run in order in the Supabase SQL editor)
- `supabase/migration4.sql` — `lat`, `lon`, `accuracy` on `feedback` (heatmap).
- `supabase/migration5.sql` — `consensus_history` table (RSS + intraday chart).
- `supabase/migration6.sql` — `api_stats` table (response time + uptime).

### Environment variables
- `WEBHOOK_URL` — optional; target for low-confidence alerts.
- `VISUAL_CROSSING_KEY` — required for the daily calibration cron (already used
  as a weather source).
