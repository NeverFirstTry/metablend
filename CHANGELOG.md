# Changelog

All notable changes to MetaBlend. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Dates are UTC.

## 2026-11-10

### Changed — the code is source-available under the Functional Source License
- MetaBlend's code is under the Functional Source License 1.1 with Apache 2.0 as its future licence (FSL-1.1-ALv2, a Fair Source licence) instead of "all rights reserved": it may be read, run, changed and shared for any purpose except a commercial product or service that competes with MetaBlend, and each version also becomes available under the Apache License 2.0 two years after it was published. `LICENSE` is the official text with the copyright line "Copyright 2026 Rene Kostmann"; both package files name the licence.
- `THIRD_PARTY_NOTICES.md` lists the software and fonts MetaBlend ships (33 components: the npm packages, Leaflet, Hanken Grotesk and Geist Mono, the apps' native libraries) with their licence texts; `node scripts/third-party-notices.mjs` writes it again after a dependency changes.
- `CONTRIBUTING.md`: no outside code for now, issues are welcome.
- The terms page says the same in all 13 languages (the German is the original): its copyright section names the licence, what it allows, the two years, and that the MetaBlend name and logo are not covered by it. Before, it said "all rights reserved" and that publishing the code granted no licence.

### Added — the imprint is linked from the app's terms notice
- The notice on the app's first start links to the imprint as well, next to the terms and the privacy notice, in all 13 languages: the imprint has to be reachable at all times, and until the notice is passed the More tab is not.
- Phone layout check: the app's notice without a link to the imprint is a finding.

### Fixed — contrast: the Rankings link in both themes, the coloured headlines in the light theme
- The "Rankings" link at the end of the most accurate sources (forecast page, website) is underlined, in both themes. Its gold read at 1.76:1 against the grey text around it in the light theme and 1.19:1 in the dark one; no gold reaches 3:1 against that text and 4.5:1 on the page at once, so the underline marks it. Its colour is unchanged.
- The green, blue and orange headlines (a good window, rain, a warning) are a touch darker in the light theme and read at 4.61:1 on their tinted box over the sky, where they read at 4.31, 4.27 and 4.24:1: green #127e4b to #117948, blue #1d6dca to #1c68c0, orange #bb4a00 to #b24600. Green still means agreement and dry; the same three colours read a little darker everywhere in the light theme. The dark theme keeps its colours.
- Accessibility check: no serious or critical finding left in either theme (18 pages, 4 dark skies and 2 light ones). Before: 14 in the light theme and 20 in the dark one.

### Fixed — the home page showed two headers
- The website's home page showed the site header twice whenever the host had rendered the page again after its hour. The page then believed its address was "/index", the host's own name for it, and the header that every other page gets did not recognise the home page. "/index" now counts as the home page, for that header and for the app's tab bar (where no tab was marked). Seen live on 2026-11-10 from 17:16 UTC; deployments a day old do the same when their home page is rendered again.

### Checks cost no weather quota, and only the live site counts visits
- Plausible, Vercel Web Analytics and Speed Insights load only on metablend.app (and in the apps, which open it), no longer on preview deployments or local builds (`app/components/SiteAnalytics.jsx`).
- The phone layout check takes the pages' data from a recording (`scripts/layout-fixtures.json`: every `/api/` answer and the search box's place suggestions) instead of production, so a run after a deploy asks the weather sources only for the two live requests it starts with (the Vienna city page's forecast and the Großglockner summit page's), which still turn it red when the production API is broken and which those two pages read next. `RECORD=1` records the answers again. It also fails when analytics load on another host than metablend.app, or none load on metablend.app.
- The two live answers are recorded too, and the check fails with "re-record fixtures" when a live answer's shape (its keys and their types) differs from its recording, so a renamed or removed field in the API cannot go unnoticed behind an old recording (`scripts/lib/shape.mjs`). Keys that are data (the forecast's weights and scores per source) and the `cached` flag are not counted as shape.
- The accessibility check and the store screenshot runs block the analytics like the layout check and fail if any got through (`scripts/lib/analytics-block.mjs`).
- Both also pick a free debugging port like the layout check (they were fixed at 9377 and 9371), so two runs at once never share a browser, and remove their browser profile when they end, also after an error or Ctrl+C (`scripts/lib/browser.mjs`); a profile is about 400 MB, and 85 left behind by earlier runs (4 GB) were removed from this PC.

### Added — MetaBlend on Instagram, TikTok and X
- Plain links to MetaBlend's Instagram, TikTok and X profiles in the website footer, on the support page and as a small row in the app's More tab. The marks are drawn on the page: no embed, script or share button from the networks, so nothing loads from them until someone follows a link. A test renders all three places and fails if a link is missing or anything from the networks is on the page.

### Added — a Terms of Use notice: the app's first start, and the website's one-time bar
- The app shows a notice once, on its first start: with "Continue" you accept the Terms of Use, the privacy notice is linked as information, and there is the one button. Until it is passed nothing else of the app shows; the terms, the privacy notice and the imprint can be read from it. In all 13 languages.
- On the website the one-time bar at the bottom of the forecast page carries the same two sentences and the same button instead of the cookie line. It blocks nothing.
- The device keeps the version of the terms the notice was passed for, in its own storage, which never reaches our server. When the terms change in substance, the version in `lib/terms.js` changes with them and the notice comes once more, saying that the terms have changed.
- Privacy notice, "What stays on your device", in all 13 languages: it names that kept version, and no longer a consent. The cookie that remembered the OK on the cookie line is not set any more and is removed from devices that still have it.
- Layout check, accessibility check and store screenshots mark the notice as passed, so pages are captured as before; the layout check and the accessibility check also look at the notice and the bar themselves.

### Changed — link previews in the current design
- The cards chats and social networks show for a MetaBlend link are on Slate with the faint gold glow where the sun is, white text and gold only for "Blend" and the address: the start page (which every page without its own card shows: cities, summits, airports, hiking), the language pages in all 13 languages (one design now, the start card is the English one) and a shared city (the glow by the city's time of day, none at night; the moon lavender, clouds neutral, as in the app). The old navy and sky gradients are gone.
- A shared city's card no longer leaves a gap after longer names ("Tokyo , Japan").
- Under the hood: lib/og-look.js holds the card colours and the glow; app/components/OgCard.jsx is the start and language card; the card font subset holds the English letters too, and its glyph test covers English.

### Changed — meta tags without dashes
- Search results and link previews show no em or en dash any more: page titles, descriptions, Open Graph and Twitter cards on every page type, the landing pages in all 13 languages ("MetaBlend · Eine Vorhersage aus bis zu 20 Wetterquellen") and the RSS feed titles. Subtitles take a colon ("Großglockner Weather: Summit Forecast (3798 m)"), the brand a middle dot. The site description is 150 characters instead of 178.
- Under the hood: the site-wide metadata moved to lib/site-metadata.js; a new test (lib/meta-wording.test.js) reads every page type's meta texts in every language a page has, with the layout's title template, and fails on an em or en dash or a safety word. The test hooks resolve next/og and next/headers.

### Fixed — phone layout check: two runs at once no longer share a browser
- Each run's browser picks a free debugging port (it was fixed at 9441), and the first line of the output names it. On 2026-11-10 two sessions ran the check at once on 9441: one run stalled for 25 minutes, the other saw a website page "opened as the app".
- The app pages and the website pages run in two fresh browser contexts, so nothing the app pages set (the app flag, cookies, storage) reaches the website pages.
- Time limits: every browser call 45 seconds, a page 2 minutes (the page is named and the run stops there), the whole run 20 minutes. A normal run takes 6 to 6.5 minutes on CI (346 to 380 s over 27 runs) and about 5 minutes on a PC through DATA (315 to 316 s, also with a second run going at the same time). The last line counts the page checks and gives the time.
- At the end the browser is closed over DevTools and its profile folder (about 400 MB) removed; a killed browser kept it locked, and every run left one behind in TEMP (34 folders, 13.8 GB on one PC by 2026-11-10).
- Proof against the local build of this branch with DATA: three runs, 68 of 68 page checks each, two of them at the same time on ports 61795 and 58954; a run against a closed port stops after one page and leaves no profile behind.

### README for launch
- The README is rewritten for visitors, journalists, store reviewers and developers: what MetaBlend is, how the consensus works, features, data sources and credits as on /terms, platforms and links, tech stack, local development, license (pending) and a note on AI-assisted development. No dashes; a wording test keeps em and en dashes and "safe" out of it.
- The README links MetaBlend on Instagram, TikTok and X, and "What is consensus forecasting?" on the start page, which now has the address metablend.app/#how-it-works.
- The README's technical sections moved unchanged to `docs/how-it-works.md`; `.env.example` lists every environment variable with no values.

### Changed — push alerts ask the rain nowcast only where it can lead to an alert
- The quarter-hourly rain run asks the rain nowcast for a home place only when someone there has rain alerts on, it is not the place's quiet hours (22:00 to 07:00, when no rain alert goes out) and the outlook shows a chance of rain in the next 3 hours: an hour with 10 % or more, or any source calling rain. Before, every home place was asked every quarter hour, 96 requests to Open-Meteo a day each, rain or shine.
- Rain is looked at every 30 minutes instead of every 15: a "rain soon" alert is for rain starting in 10 to 60 minutes, so every start still meets a run, and the alert comes up to 15 minutes later than before. Official warnings keep their quarter hour; the run between two rain runs sends only those.
- Homes in the same 0.1° cell (about 11 by 8 km) share one nowcast per run, asked at the cell's position, which is up to about 6 km from a home. The alert rules and texts are unchanged.
- The run's summary (job_runs) says how many nowcasts were asked and how many home places were skipped.

### Fixed — place names in your language
- The forecast shows the city in your language where Open-Meteo has the name ("Vienna" searched in German reads "Wien"), and the country in your language from its ISO code ("Österreich", "オーストリア"); before, every visitor read the country in English. Recent, Favourites and the share text take that name.
- The country is named from its code in the reader's language everywhere a place is shown: forecast header, search suggestions, city pages, planner, the home city picker in Notifications and the share preview image.
- A long city name in the header wraps between words only (Japanese, Chinese, Korean included), and the refresh button stays beside it.
- Under the hood: /api/forecast and /api/planner send `cc`, the ISO code; one of our towns is named in the visitor's language by an Open-Meteo id lookup, once per language, kept 30 days. Test: the route and the header line in German (Wien, Österreich), Japanese and English; the golden recording gains `cc`.

### Changed — the hours always start now; the outlook is kept 2 hours, the summit forecast 1 hour
- The hour strip, the Today, Tomorrow and 7 days tabs, the headlines and the best time outside always start at the current hour of the place: the page works out "now" itself, also when the hour turns on an open page and after midnight. Before, they started at the hour the server had built its answer for, which could be 90 minutes back.
- The outlook is kept 2 hours instead of 30 minutes, then 30 minutes more while a new copy is built: never older than two and a half hours. The models behind it change every few hours; the conditions right now (15 minutes) and the rain nowcast (10 minutes) are not affected. About a third fewer outlook requests to Open-Meteo at today's traffic (734 a day to about 470), and the push job's share falls from 48 to 12 a day per home place.
- The summit forecast is kept 1 hour instead of 30 minutes, then 30 minutes more: 90 minutes at most, as before.
- The city pages, the embed widget and the share image read the outlook the same way (`lib/outlook/at-now.js`); push alerts and the app's widgets already did.
- Phone layout check: it waits up to 30 seconds for the browser on the CI runner and says so when it does not start (run 29 failed after 10 seconds without loading a page).

### Added: a support page
- metablend.app/support in all 13 languages: the contact address, how to send feedback from the app, five common questions (where the forecasts come from, why MetaBlend differs from other apps, notifications, deleting your data, relying on it alone in the mountains) and the legal pages. The website footer links to it as "Support"; the app shows no footer and is unchanged.
- The App Store support URL is now https://metablend.app/support in all 12 languages (live with the next upload). The page is in the sitemap and in the phone layout check (17 pages); a test renders it in every language.
- Japanese footer: "All rights reserved" now reads 無断転載を禁じます. The other 12 footers were checked and are translated; a test keeps Japanese, Chinese and Korean footer lines from staying English.

### Changed — the app's header and the store listing
- The Beta badge next to the logo is gone for launch, in the app as on the website.
- On a phone in German, Czech or Japanese, the refresh button stays next to the city name; a long name wraps instead of pushing the button onto its own line.
- Store screenshots: captions with no dashes and no claims of safety, reliability or accuracy, screen 2 "The week ahead and where the sources agree", screen 4 "The best window for the summit"; the hiking screens stand in Lienz, so the list shows the Alps; screens 4 and 5 show an open summit window and a favourable start with real data; the Play feature graphic says "One forecast from up to 20 sources". The capture script refuses a caption that breaks these rules.
- Store screenshots in Japanese, Chinese and Korean no longer split a word across caption lines (Japanese and Chinese break only between words, Korean only at spaces), and their captions are set in Noto Sans on every machine. Screen 2 drops the comma before "and" in English, German, French, Spanish, Italian and Portuguese; Dutch follows with the final capture.

### Fixed — forecasts with missing sources: Open-Meteo through one gate
- At most four requests to Open-Meteo are in flight per server instance, whatever asks (forecast, outlook, rain nowcast, summits, route weather, planner, calibration); the rest wait their turn, and the same request asked twice at the same moment is sent once. A forecast miss sent eight at once and a burst of places many times that; Open-Meteo refused some of them and the blend went thin (Vienna with 10 of 20 sources for two minutes during the store run on 2026-11-10; 82 thin blends in a day). The summit forecast's own gate, which took its refusals from 47 a day to none, is now this shared one.
- A forecast request Open-Meteo refuses for being one too many at that instant is asked once more after 300 ms (the summit path already did); its limits per minute, hour and day are not asked again.
- Toronto, Vancouver, Prague and other places inside the area of NWS or Bright Sky that those services do not cover no longer count as a failed source: their forecasts were marked incomplete and refreshed every 2 minutes instead of 15.
- A request's time limit (5 seconds for a forecast source) starts when the request leaves the queue, not while it waits its turn: in a burst of twenty places the last in line waited longer than that and would have given up without having asked. The wait has its own limit of 10 seconds: a request still without a turn then counts as failed, so a flood of places cannot hold requests open without end.
- The thin-blend log (error_log, scope forecast.partial) now says what Open-Meteo answered to each failed request: status, reason and which request.
- The Open-Meteo count (open_meteo_calls) now covers everything asked of the forecast host: outlook, rain nowcast, summits, route weather and terrain heights, next to the forecast, the planner and the calibration. Figures from the day this goes live are higher than, and not comparable with, earlier days. The outlook's 10-year climate request and the peak search's name lookup are not counted.
- The count is kept per kind of request: forecast, geocoding (a city name looked up), outlook, summit, nowcast, route, heights, planner and shadow (the station calibration's five summits). Each row has the plain number of requests and the weighted calls; rows from before the split are `unsplit`. Needs the new `kind` column (supabase/open-meteo-calls.sql, run on dev and production before this went live).

### Legal and privacy
- “My location” no longer shows the device’s position to a third party. The phone rounds it to 0.1°, about 10 km, and asks our own server (`/api/place`), which names the town from our own list (of the towns within 10 km the one with the most people for its distance, in the visitor’s language) and asks OpenStreetMap’s Nominatim, with the same rounded position, only where no town of 5,000 and more is that close. BigDataCloud is gone from the site, the content policy and the notice.
- Maps load Leaflet from our own site (`public/vendor/leaflet-1.9.4`: the published 1.9.4 files, their hashes checked by a test) instead of unpkg.
- /privacy, German first, all 13 languages: the app’s cookie metablend_app and its 30 days; stored forecasts go after up to 72 hours (it said about 48); the list of summits near you rounds the position to about 5 km, the searches to about 10 km; map tiles, the rain radar and search suggestions come straight from the browser, so those providers see the IP address and the map area or the typed text; BigDataCloud and unpkg are no longer named; the retention paragraph has no dashes left. Store answers (`store/compliance.md`): precise location is not collected any more; untick it in Play’s Data safety form once this is live.

### Changed — nine Open-Meteo requests per forecast miss instead of twelve
- ECMWF IFS, NOAA GFS, DWD ICON and Météo-France share one Open-Meteo request instead of one each, and nothing a visitor sees changes: the shared request reads each model at Open-Meteo’s 15-minute step, the value its own request gave (compared live for Lienz and Perth, every field equal). UV, air quality, the current-conditions details and yesterday’s temperature are kept an hour per place in memory, so four of the nine are asked once an hour per place. By Open-Meteo’s counting (variables × models) a forecast miss costs 12 calls at most, 8 while the hourly values are kept, where it cost 14. A golden test (lib/forecast-golden.test.js, scripts/record-golden.mjs) replays a Lienz miss recorded through the old twelve requests and gets the same blend, source by source, from the new nine.

## 2026-11-09

### Store listing
- The App Store text and screenshots can go up from the PC with fastlane (`fastlane/Fastfile`): an en-US text-only lane for a first check and a lane for every language with screenshots. No build upload, no submission, no release; the App Store Connect API key comes only from environment variables and must live outside the repo. Google Play has a placeholder lane. A project test pins those settings.
- App Store keywords rewritten in all 12 languages (live with the next upload): no words the name or subtitle already carry, no "consensus" or ECMWF; rain radar, mountain weather, storms, avalanches and routes instead, each within 100 characters.
- App Store copyright set: "2026 Rene Kostmann" (`fastlane/metadata/copyright.txt`, one field for all languages).
- New store test: no store text or screenshot caption names an old source count (16 or 26; production has up to 20). The subtitles already say "up to 20" in all 12 App Store languages and stay within 30 characters (existing limits test); support and marketing URLs stay https://metablend.app.

### iPhone app (next native build)
- iPhone only, finished: the last iPad setting (the iPad's screen orientations) is gone from the app's Info.plist; the app and its widgets were already iPhone-only. iPads run the iPhone version. A project test keeps it so: no iPad keys in any Info.plist, and store screenshots for iPhone and Android phones only.

### Tests
- Play production access answers (`docs/play-production-access.md`) fit Google's 300-character limit per text field: seven answers, each with its count, plus the two choices. `lib/play-answers.test.js` fails if an answer is longer than 300 characters, its stated count is wrong, or it has an em or en dash or the word safe or reliable.
- Recent places: the home page's first load decides in one tested helper which place goes into Recent (a place typed into the error screen's search, never a link, the start city or a resumed load); the test renders the error screen's form instead of reading its source, and fails if the decision or the form's mark breaks.
- New guard (`lib/source-match.test.js`): a test may not check an app/ code line only by its source text. It flags tests that read an app/ file and match its text while rendering, calling or requesting nothing from app/; bans (text that must not appear) don't count, and an opt-out comment must give a reason. 18 existing tests flagged: one fixed with a render (the tile's classes), 17 opted out with their reasons, plus the Recent test above.
- Route behaviour tests for the scheduled jobs and the summit forecast, with every outside call faked (`lib/test-route-fakes.js`, the forecast route test's pattern): each of the five jobs writes one job_runs row under its own name and none when refused; the cleanup prunes job_runs after 14 days and WeatherAPI rows after an hour; the hourly station calibration purges them on both exits, after the weights are saved; /api/hike answers an Open-Meteo refusal with 200, unavailable and no-store, the summit page throws on it and the widget answers 502. Four source-match opt-outs gone (one stays for the peak view, which fetches in an effect). The test hooks load the app's JSON imports and give server pages notFound().
- The source-match guard reads test files with a parser: a test generated inside a loop is judged on its own, together with the loop that feeds it, and paths listed between tests no longer count against the test before them. The job-log route test is back to its plain form (a list of route paths, each imported inside its test). Over the whole suite with every opt-out removed, the old and the new guard flag the same 13 tests.

### Legal and privacy
- /terms: the liability section is rewritten, German first, all 13 languages, five paragraphs each. Forecasts are probability statements that can be off; MetaBlend is a planning aid that replaces no official warning, avalanche report or judgement on site; the Aviation pages are not for flight preparation; the exclusion covers slight negligence only, and intent, gross negligence and culpably caused injury to life, body or health are expressly not excluded (§ 6 Abs. 1 Z 9 KSchG); uninterrupted availability is not promised. A test checks in every language that all three exceptions stand in the not-excluded sentence, none of them in the exclusion, and that the availability sentence closes the paragraph, so no translation is wider than the German.
- /privacy: the ImprovMX sentence names the standard contractual clauses of its data processing agreement (version of 9 September 2026 with Annexes I–III, countersigned by both sides on 2026-11-09) and says that ImprovMX keeps only basic mail metadata (log level Minimum) for 7 days — German first, all 13 languages, add-only.
- /terms: the WeatherAPI.com end-user disclaimer now stands in WeatherAPI’s own words, with a German version beside it. The Sources panel shows one short line in the visitor’s language whenever WeatherAPI data is in the blend, linking to that notice (13 languages).
- /privacy: WeatherAPI named as a processor for the coordinates we send (data processing agreement signed 2026-11-09, Art. 28 GDPR) — German first, all 13 languages, add-only.
- Data retention, WeatherAPI: it feeds only current conditions, no forecast values are stored anywhere; its rows already go after the hourly scoring (60-minute cap), and the daily cleanup now purges any older than an hour should an hourly run be missed. The Vienna test fixture carries no WeatherAPI reading any more.
- WeatherAPI can be called through the EU-only hostname its data processing agreement offers (clause 9.6): WEATHERAPI_HOST names it, api.weatherapi.com stays the default.

### Fixed — a model missing from Open-Meteo’s shared answer makes the blend thin
- Sources that came back empty without failing (a global model absent from Open-Meteo’s multi-model answer, or that request refused) did not count toward partial, so a thin blend was kept 15 minutes: Vienna showed 10 of 18 sources with one failed source reported. Now the shared request is null when refused and the global models missing from its answer are named with the failed sources (partial: true, 2-minute copy, listed in the error log); regional models may be absent outside their area.

### Changed — a city search no longer needs Open-Meteo
- A searched city is found in our own towns first (GeoNames places of 5,000 and more, by any of their names, the most populous first, the nearest when the search came from somewhere; the visitor’s spelling is kept, “Wien” stays “Wien”), then in a 30-day cache of Open-Meteo’s geocoding answers, and only then at Open-Meteo, whose answer is cached and whose ask is logged (scope geocode.upstream). The English name a place is filed under is still Open-Meteo’s, looked up by id and cached 30 days. The geocoder moved to lib/geocode.js. Needs supabase/geocode-cache.sql on dev and production.

### Added — our own count of Open-Meteo requests
- Every request to Open-Meteo is counted per UTC day and hour, weighted the way Open-Meteo counts API calls (one per request; more than 10 variables or more than two weeks count fractionally; every location and every model counted on its own, which their page leaves open). The error log gets an entry at 70 % and 90 % of the free tier’s 10,000 a day. Needs supabase/open-meteo-calls.sql on dev and production; rows are kept 90 days.

### Fixed — a blend thinned by Open-Meteo’s daily limit is kept 15 minutes
- When Open-Meteo answers that its daily limit is used up, its sources stay away until midnight UTC, so a blend missing them keeps the full 15 minutes instead of the 2 minutes a thin blend otherwise gets; refetching every 2 minutes would only hit the limit again and load the other sources. The thin-blend log entry says when the limit was the cause.

### Changed — the rain nowcast is kept 10 minutes
- The next-two-hours rain answer for a place is kept 10 minutes instead of 5, in memory and on the CDN: half the Open-Meteo requests for the same places. The steps are 15 minutes apart, so the picture does not change within that time.

### Added — a run log for the scheduled jobs
- Cleanup, calibration, push dispatch, warnings refresh and the hourly station calibration each write one row per run to job_runs (started, duration, status, error, a summary with the station calibration’s skip reasons), kept 14 days, so a failed night run is visible the next morning. A thin forecast blend is logged too (scope forecast.partial). Needs supabase/job-runs.sql on dev and production.

### Fixed — a thin blend is not kept for long
- When a weather source that was asked fails, or Open-Meteo’s shared model request comes back empty, the forecast is kept for 2 minutes instead of 15, in memory and on the CDN, and carries partial: true; a full blend keeps its 15 minutes. Lienz had shown 10 of its 19 sources for a quarter of an hour. (A first version of this change broke the forecast route for two minutes on 2026-11-09 and was reverted.)

### Fixed — summit forecasts when Open-Meteo is busy
- Summit requests to Open-Meteo go through a gate: at most four in flight per server instance, the rest wait their turn, and visitors asking for the same peak at the same moment share one request. The bursts behind the "Too many concurrent requests" refusals came from parallel summit requests on cache misses.
- When Open-Meteo refuses a summit request with "Too many concurrent requests", the request waits a moment and tries again instead of giving up; the three-model fallback gets the same second try. If nothing comes back at all, the summit API no longer answers with a server error: the peak page shows its retry card, the summit pages are regenerated on the next visit, no plan notification goes out, and the widget says the forecast is unavailable. Until now every such moment was a 502.

### Changed — the beta banner is gone
- The amber "work in progress, early beta" banner on Rankings, Heatmap and Planner, and the matching line on the home page, are replaced by one calm sentence in all 13 languages: forecasts can be wrong, do not rely on them alone for safety-critical decisions. No beta wording anywhere in it.

### Changed — wording
- No em or en dashes in the app’s and website’s texts any more, in all 13 languages: a sentence dash is now a full stop or a comma, a time range a plain hyphen. A test keeps every language pack that way.

## 2026-11-08

### Changed — the moon in lavender
- At night the moon icon is a soft lavender-grey in dark mode; the pale blue-grey read as white next to the rain blue. Light mode shows the same lavender, darker (4.7:1 on its tile), so the moon is one colour family in both.

### Fixed — the peak page stays put (app)
- With the phone's "reduce motion" setting on, the app's peak page could be dragged sideways into empty space. The hour-by-hour row now scrolls only inside its own strip, on every page that has one.
- The summit hours, the summit week and the route stages show the coloured weather icons too; they still showed emoji.

### Added — a phone layout check on every push
- After each push to main is live, GitHub Actions loads 16 pages of metablend.app at phone width, as the website and as the app, with and without reduced motion, and fails if a page scrolls sideways or any text is below 13 px (`scripts/check-phone-layout.mjs`, also run before every merge).
- The check never counts as a visit: it sends its own user agent and loads no analytics (Plausible, Vercel Analytics, Speed Insights). Pushes that only change docs, the changelog or tests skip it.

### Fixed — the app opened on the website layout (iPhone build 3)
- The app showed the website layout without its tab bar once the "sources" fold had ever been opened: the fold read that remembered choice during the browser's first render, which then differed from the server's HTML, and React rebuilt the page without the app and theme marks the boot scripts had set. Remembered fold states now apply after hydration. The app mark and the theme are also put back after any rebuilt page, and a test renders the start page as the server and as a returning app user's browser and requires both to match (not WebKit-specific: the same happened in Chrome with that storage). The temporary diagnostic line and its error hook are removed again.

### Changed — weather in colour (website and app)
- Weather icons are in colour: the sun gold, the moon pale blue-grey, clouds neutral, rain, snow and storms in the rain colour; partly cloudy shows a gold sun beside a neutral cloud. The same everywhere: hour tiles, the temperature at the top, the Today, Tomorrow and Week lists, city and summit pages and the embed widget.
- In the app the weather icons were emoji; it now draws the same icons as the website.
- Every rain chance in the hour tiles is in the rain colour with its drop, at 13 px in the app too; from 20% it is also bold. In light mode it reaches 4.56:1 contrast (AA asks 4.5:1).
- Dark mode's sun glow is five points stronger: 17% at sunrise, 15% by day, 20% at sunset, still none at night. Grey text where it is brightest keeps 6.5:1 or more.

### Changed — 13 px is the smallest text in the app too
- The app shows the website's pages, so it now keeps the website's minimum: tab labels, the times and rain chances in the hour tiles, section labels, table headings, the summit, city and airport pages are all 13 px or larger (they were 10 to 12 px).

### Changed — the forecast page on a desktop
- From 1024 px wide, "right now" is one band: the temperature beside its details (wind, cloud, visibility and the rest), always open. The forecast runs full width below, and Sources and "How's the weather where you are?" sit side by side. Phones and the app are unchanged.

### Changed — the app matches the website
- The app's forecast opens on the website's hero: the temperature, the condition, how far the sources agree and one sentence on their spread. Wind, cloud, visibility and the rest are in the "Current details" row below, as on the website, instead of a dropdown under the hero.
- The app no longer counts down to the next refresh; it still refreshes on its own.
- In the app, the Sources panel, Rankings, the Planner's two charts and the summit pages' day table use the website's layouts.
- The Planner's temperature bars are the brand gold in the app too; in dark mode they were orange. Its rain bars use the same rain colour as the website.

### Fixed — the app's start screen
- When the app opened, its start screen showed the website's layout and ignored light mode. The start page is rendered on the server, and the app's old hero differed from it, so the page was rebuilt without the app's marks. Both now render the same, and a test keeps it that way.

### Fixed — light mode on the start page
- In light mode the start page switched to dark a moment after it loaded. The cached page said "updated 5 min ago" while the browser counted 15, the page was rebuilt over that one line, and the rebuild lost the light theme (in the app also its app layout). Clock text may now differ and corrects itself within a second; a test keeps it that way.

### Changed — hour by hour, easier to read (website and app)
- Every hour has its own small tile, a shade lighter than the card in dark mode and a shade darker in light mode, evenly spaced.
- The temperature leads each tile: largest, bold and in ink. The time above it is clearer, the weather icon a little larger.
- The current hour's tile has a fine gold edge, so "now" is clear at a glance.
- Rain chances below 20% stay quiet; from 20% they turn the rain colour and a little bolder. Every text in the strip reaches AA contrast in both themes (a tester's feedback).

### Changed — dark mode by day
- The gold sheen at the top of the page by day is twice as strong (10%), so it shows on a phone; text under it still reaches AA contrast.

### Fixed — Recent places
- A place typed into the search on the "page not found" or error screen (Los Angeles, for example) now goes into Recent like any other search. Links someone sent, widgets and notifications still stay out of it.

### Security
- A failed summit, outlook, rain-nowcast, route or route-weather request no longer tells the visitor which upstream service last failed and what it answered (that detail was the server's last failure from anyone's request); it still goes to the error log. Test: lib/public-errors.test.js.
- supabase/enable_rls.sql also takes every table grant away from the public anon and authenticated roles (RLS already denied them every row); ran on dev and production on 2026-11-08.
- Feedback lessons are capped at 24 per region per day in the database (supabase/feedback-lessons.sql, the owner runs it on dev and production), on top of one per city per half hour; until it has run, the route falls back to the old function.
- Preference cookies carry the Secure flag.
- A report-only Content Security Policy on every page: nothing is blocked yet, violations show in the browser console.
- The error log drops the phone's position from a failed request's address and rounds other coordinates to about 10 km.
- WeatherAPI's values are kept only until the next hourly calibration has scored them, within its 60-minute caching limit; the daily scoring jobs no longer see them.
- MET Norway is asked with four-decimal coordinates, as its terms require.
- Next 16.4.5, the November security release: seven moderate advisories (cache leaks and poisoning in `use cache`, an SVG rejection bypass in image optimisation, HttpOnly cookie exposure on Edge routes).

### Safety — summit window
- An hour whose rain or wind value is missing no longer counts as favourable: it ends the window with "no complete forecast" (fail closed); the route planner judges its stages by the same rule.
- Polar day: a day without a sunset (Open-Meteo marks it as a next-day 00:00 sunset) counts as daylight all day, so Kebnekaise in June gets a window instead of "no daylight"; polar night stays dark.

### Legal and privacy — pending review by a lawyer friend
- /privacy, German first and all 13 languages, add-only: the legal basis for weather feedback, notifications, the tester list and the analytics tools; the transfer basis for Apple and Google push and for the mail forwarders ImprovMX and Gmail; the error log keeps a failed request's address 30 days without any position.
- /terms: a notice of our own for the WeatherAPI.com data in the blend, covering the points its terms require, stands with the attribution.
- The ImprovMX sentence in /privacy describes receipt in the EU (France) and partial forwarding through servers in the USA; the standard contractual clauses of its data processing agreement follow on branch legal/improvmx-scc once the agreement is countersigned.
- Store compliance sheet: the tester e-mail address is declared for the App Store privacy labels and Play Data safety.
- LICENSE names the current data providers instead of the retired ones.

### App
- iPhone: Release builds sign with aps-environment production (AppRelease.entitlements); Debug keeps development. Ships with the next native build.
- Launch checklist: App Review notes listing the native features for Apple's guideline 4.2.
- Temporary diagnostic: inside a native shell that shows the website layout, a line at the top shows what the app detection saw at first paint (user agent, cookies, verdict) next to the page's state now; also on any page with ?debug=1. Goes once the iPhone cause is fixed.

## 2026-11-07

### Changed — dark mode
- Dark mode is a calm slate grey instead of the navy-to-purple sky, with a faint gold glow at the top where the sun is at the place you're looking at: east around sunrise, a light sheen by day, warmer in the west around sunset, none at night. Text stays readable everywhere, under the glow too.
- Cards have a fine edge; the cookie notice, the app's tab bar, the city suggestions, the language list and code boxes match the new grey.
- The band behind the forecast line is a neutral grey instead of a gold tint that read brown; the line itself stays gold.
- Buttons are a quiet grey with a fine edge and gold text or a gold icon instead of bright white blocks: the search buttons, the cookie notice's OK, Copy, Turn on notifications and the rest.
- The browser bar and the installed web app use the same slate; the app's launch background follows with the next app build (listed in the launch checklist with the other native changes waiting for it).
- Tests: the Android project check reads `.gitignore` with either line ending, so it passes on a fresh Windows checkout.

### Fixed — empty page, tiles, air quality
- A page with no city of its own (the logo after removing your last place or Clear all, a broken shared link) shows the Vienna example with its note instead of an empty page.
- One tile everywhere: the same surface and edge as the cards around it, real padding, equal heights; two per row on a phone, one row on a wide screen, and a tile without data leaves no gap.
- Air quality uses the words of the European index its number comes from: 42 is "Moderate", no longer "Unhealthy for Sensitive Groups" (a US index label). All 13 languages.

### Changed — the first visit
- A first visit on the website opens on the normal forecast page for Vienna, with a slim note under the header ("Example: Vienna · search your place below") and "Use my location". The search sits where it always does, so nothing jumps after the first search. How it works, the mountain block and a line about who builds MetaBlend follow further down.
- The same page in every other language at its own address (/de, /fr, /ja …), each with its own title, description and share image. Returning visitors and shared links go straight to their city.
- Dark mode has one fixed, calm background; the tint that followed the weather and the time of day is gone.
- "6 of 19 sources report rain right now" only shows when most sources do, so it can't contradict "dry today". In the evening the chart labels every hour and keeps its rain bars narrow.
### Added
- Recent places: each one has an × to remove it, and "Clear all" ends the list. With none left, the next visit starts as a first one. Keyboard and screen readers included, all 13 languages. Asked for by a user.
- A logo for email signatures at /email/logo.png.

### Changed — safety, credits and data
- Summit window: an hour also counts as too cold when the wind chill from the summit wind is −20° or colder, the window closes 3 h before sunset (4 h on alpine grades and peaks from 3,000 m) to leave daylight for the way down, and a window under an hour isn't shown. Mountain pages, the hiking view and hike alerts follow; the route planner gets the cold check.
- Credits: each data provider is named in its own words with a link, in the footer, under the Sources panel and on the app's More screen. /terms and /privacy are complete.
- Visual Crossing still counts in the blend, but its own readings are no longer shown or passed on: the Sources panel names it with its weight.
- Rankings: a regional source only appears, and only counts, in the region it covers (NWS only in North America; MET Nordic, SMHI, GeoSphere, DWD Bright Sky and Europe's high-resolution models only in Europe).

### Fixed — forecast page
- One source count everywhere: Visual Crossing still counts in the sentence under the temperature and in the landing example, and its row says "Value not shown (licence)".
- "What is consensus forecasting?" opens from anywhere on its row, like the other rows; so do the region rows of the hiking directory.
- Tiles show the number in the text colour; the status colour is only on the status word.
- Recent places: on touch screens each × and "Clear all" has a 44 px target; the icon is unchanged.

### Fixed — wording
- Czech "all sources agree" used a Polish verb form. French and Italian now use the usual term for a model run.

### Changed — sources and wording
- Rankings opens on your own region and no longer has the "Global" tab, which had stopped updating. Sources we no longer use are gone from the list and from each region's total. The Uptime column is gone from the website, and behind the scenes a source that fails to answer now counts as a failure.
- GeoSphere Austria now reads the nearest point of its newer INCA-v2 analysis, ahead of the old data set shutting down at the end of the year.
- Plainer claims. The tagline is "One forecast from up to 20 sources", the forecast sentence says what the sources agree on without calling the forecast reliable, and the explanation no longer says MetaBlend is steadier than any single app. Listings and captions say 195 peaks.

### Behind the scenes
- The weighting shadow run now also compares against official Austrian town stations and five summit stations, from 12:17 UTC. Its dates, and the GeoSphere switch that splits that source's data, are in docs/shadow-run.md.

### Fixed
- The page header no longer flashes English and °C before switching to your language and unit, and its language menu shows a language picked on the home page.
- Map popups show your °C or °F. The page-not-found screen has one logo instead of two. Hong Kong's city page says "Hong Kong".
- In the app, short pages no longer lose space at the bottom to the website's hidden header.

## 2026-11-06

### Changed — follow-ups across the website
- Every page now has the same header as the home page: Rankings, Heatmap, Planner, Hiking, Aviation, plus unit, theme and language. The "Back" links are gone from the website. The app keeps its tab bar and its Back links.
- The mountain and city pages are now in all 13 languages, at the same addresses, and the 54 listed cities show their local names ("Wetter in Wien"). Temperatures there follow your °C or °F setting. The aviation pages stay in English, as is usual in aviation, with the translated header.
- Hiking and summit pages say "Beta on iPhone & Android" instead of "Coming soon".
- The summit 7-day table fits a phone without sideways scrolling.
- Planner: temperature and rainy days are two charts, each with its own axis, so a cold month reads as cold.
- Rankings: one line explains Score and Reports, and "Recalibrate weights" is gone from the website and the app.
- Legal page titles have their missing spaces: "Terms & Copyright", "Privacy Notice". The text below them is unchanged.

### Changed — the light theme, website and app
- A new light theme replaces the lavender and blue one: a near-white sky, white cards with a soft edge, and the gold as the only accent, dark enough to read on white. Status colours are darkened just enough for AA contrast, the chart band is a light neutral, and the search and other filled buttons are a pale gold. The sky no longer changes with the weather in light. The app has the same colours and keeps its layout and sizes. The Android widget's light colours follow with the next app build.
- With the next app build, the Android notification tint and the Retry button on the app's no-connection page turn from the old green to the gold.

### Changed — the whole website
- Every page now follows the home page's design: one type scale, one card style, the page width, plain section titles, and gold as the only accent. Legal texts are word for word as before. The app keeps its own design.
- Rankings: one row per source with the same numbers, rank numbers instead of medals, and no emoji in the region buttons. The app keeps its cards.
- Planner: temperature bars in gold and rain in the rain colour, with labels in plain text.
- City and summit pages: whole degrees and drawn weather icons. The embedded widget has drawn icons too, and compare mode shows whole degrees on the website.
- On a phone, search suggestions use the whole row instead of a narrow column.

### Added
- Styled "page not found" and error pages in all 13 languages: what happened, a search, and a link back to the forecast.
- Behind the scenes: the hourly check also stores each source's raw temperature error, kept for 30 days, so a better weighting formula can be tried on all sources. Besides airports it uses official Austrian stations in town and on five summits. The forecast and the weights are unchanged.

### Fixed
- The search button in the planner and in compare mode now has a translated label for screen readers.
- "Trusted most right now" no longer shows five sources at the same percentage as if that ranked them. Most good sources tie on the same weight, so the list now ranks by how close each has been lately, best first, without percentages. The forecast itself is unchanged.
- Changing language no longer loses or swaps your city. A name saved in one language could find nothing in the next ("リエンツ" in English: "could not load the forecast") or another town ("Wien" in English: Wien, Missouri). The site and app now remember each translated name's English one and ask by that in any other language.

### Changed — the website's home page
- One sentence under "% agree" says how far the sources agree, following the same value: from 70% "reliable", 45 to 69% "fairly reliable", below 45% the whole range and "expect changes". With one source, a few sources, or all within 1°, it says that instead, and a range never shows the same number twice. The dots left the hero, and the countdown left the website's hero.
- The arrow on the hero is gone from the website. Wind, cloud cover, visibility, precipitation, snowfall, ground temperature and the comparison with yesterday are a new "Current details" row below the tiles, collapsed at first, in one colour and whole degrees. The app keeps its arrow.
- The dots in the Sources panel are one quiet row with a gold tick and "MetaBlend 3°", nothing stacked. Below them, one row per source replaces the cards: name, whole degrees, how far it sits from MetaBlend, and a gold weight bar. The latency badges are gone from the website, and the status colour marks only a source 5° or more off. The app keeps its chart and cards.
- The chart's hint reads "Shaded band: where most sources sit", in all 13 languages. The app keeps its wording.
- 13 px is now the smallest text on every page of the website, chart labels and tiles included. The app keeps its sizes.

## 2026-11-05

### Changed — the website's home page
- The home page opens on a real forecast: your last city, or Lienz on a first visit. The explanation sits below it, with the sources trusted most in that region right now.
- A concrete line replaces the tagline; drawn icons replace emoji; the feature grid, sparkle, banner and badge are gone, with one quiet beta note left. Left-aligned, one card style, an 8 px grid. The app's Forecast tab is unchanged.


### Added
- Impressum at `/impressum` in all 13 languages, linked in the footer and under More.
- Disclaimer as the first section of the terms, linked from the hiking and aviation notes.
- Privacy notice: controller, hosting and server logs, email contact, your rights.
- iPhone: swipe from the left edge to go back (ships with the next iPhone build).

### Changed
- Privacy notice: also names RainViewer, unpkg, Vercel Web Analytics, Apple and Google as notification carriers, and ImprovMX and Gmail for email; says which preferences reach the server as cookies, and that a rounded position is sent with "my location".
- Privacy notice: states the data processing agreement with Vercel.
- The 90-day clean-up of phones is described as it works: neither opened nor sent an alert.
- Under the hood, nothing you can see: the blend math now has its own tested file (`lib/consensus.js`), and the duplicate distance formula and no-store helper are one each.
- Disclaimer: new liability paragraph in all 13 languages. The exclusion covers slight negligence; liability exists only under the statutory provisions for intent, gross negligence, and culpable harm to life, body or health.
- The terms now open with the same note as the privacy notice: in every translation, the German version applies.
- Wording: a summit window, start time or day is now "favourable", not "safe", in the app, push alerts, widgets, store listings and page descriptions, in all 13 languages. Warnings keep their words. The full list is in `docs/wording-audit-2026-11.md`.
- For contributors: a project skill at `.claude/skills/metablend/SKILL.md` with the ground rules, release steps, places refresh and legal pages.
- Store listings link the privacy notice, terms and legal notice in all languages. The store privacy answers now also name Vercel Web Analytics and the rounded position sent with "my location", matching the privacy notice. Screenshots 4 and 5 regenerated with the new wording.
- For the launch: `docs/launch-checklist.md`, with both stores targeted for 2026-12-15.
- The German privacy notice and terms address the reader as "Sie" throughout.
- The Spanish, Italian, Dutch, Polish, Slovene, Chinese and Korean privacy notice and terms address the reader formally too, like their legal paragraphs.
- Every translated privacy notice now opens with a note that the German version applies. Eight named English, four had no note.
- The terms now exist in all 13 languages (they had 5). The blanket "not liable" sentence is gone: the new disclaimer limits the exclusion to what the law permits.

## 2026-11-01

### Fixed — from a full code audit
- Security: Next.js 16.4.3 (16.3.8 was inside the range of three published
  advisories; this site used none of the affected features, but the image
  endpoint exists on every Next.js site).
- The source weights and MetaBlend Local learned from the wrong forecasts:
  the daily and hourly scoring read only the first 1000 stored forecasts of a
  day (one database request stops there), which a day with widgets passes by
  noon — so it compared night-time forecasts with daily values, and many
  cities were never scored. Every row is read now; a community report is
  compared with the newest forecast of each source.
- Push alerts can no longer repeat on every run when the database can't
  save the send log (it is all that stops a repeat): nothing is sent until
  it is saved. A send that fails for a moment is still tried again.
- Phones that read their alerts without opening the app were deleted after
  90 days, settings and planned hikes included. Every delivered alert now
  counts as "seen".
- Returning visitors could see last week's summit window or "right now"
  as today's: the offline cache also kept the pages' data. It keeps only
  the app's build files and offline pages now.
- The nightly backup stopped at 1000 rows per table without an error, so the
  newest community reports were missing from it. It reads every row now
  (reports newest first, up to 20,000).
- A local run can no longer write to the production database because of a
  `VERCEL=1` line that `vercel env pull` puts into a local env file: only a
  real Vercel deployment (production or preview) writes there.
- "Use my location" and a picked suggestion open the place you meant, not
  the biggest one of that name: Vienna, Virginia no longer shows Vienna,
  Austria, and Portland, Maine no longer shows Portland, Oregon. The phone
  remembers it, so refreshes, Recent and the app's next start keep the right
  place, and such a town learns on its own ("Vienna, Virginia") instead of
  sharing the bigger town's forecasts, reports and local bias.
- iPhone alerts: switching between a test build and the TestFlight build no
  longer deletes the phone's alert settings and planned hikes.
- Hiking: a moment when OpenStreetMap was slow no longer leaves a peak
  showing "no marked routes" for a week; routes found only in part are looked
  up again the next day, and never replace a fuller list found before.
- The leaderboard's Recalibrate button answered with an error (after doing
  its work) since this morning's clean-up.
- Hiking search and "Near you": a short database hiccup no longer leaves
  the thinner outside results in place for a day (5 minutes now).
- City pages: the 7-day table fits a phone screen (the conditions show as
  their icon there); before, the rain and wind columns ran off the edge.
- Battery: the "refreshes in m:ss" countdown no longer redraws the whole
  forecast page every second, only itself.
- Route weather: switching the day or pace reuses the forecast fetched a
  moment ago (15 minutes) instead of downloading it again.

### Fixed — 2026-11-02, the audit's remaining findings
- MetaBlend Local learns its correction against the consensus it is added
  to (it learned against a median, or a plain average, of the sources), and
  a source never scored in a region counts like an average one instead of
  about five times as much.
- Error messages appear in your language ("not found", "too many searches")
  instead of the server's English text or the browser's "Failed to fetch".
- The climate planner shows °F to °F users.
- City pages: "Most trusted here" names only sources that answered; the
  Retry button on a failed outlook can no longer paint the old city's
  outlook onto a city opened meanwhile; a shared link's preview without
  weather isn't kept for 30 minutes.
- Hiking: one request with a wrong summit height can no longer set it for
  everyone's routes, and heights are looked up only for the part of a trail
  that is kept.
- The daily calibration and the nightly station check can't score the same
  day twice when a scheduled run arrives twice.
- Maps: the map library from the CDN is checked against its published
  fingerprint before it runs.

### Changed — 2026-11-02
- Faster first forecasts: UV, air quality and the other extras load
  alongside the weather sources instead of after them.
- Less server work: the embeddable widget is built once per city and served
  from the CDN; Compare shares the main search's cached copy; the city pages
  share the app's English outlook; old route and place-search cache rows are
  cleaned out nightly.
- Brand: a second profile picture with bigger letters
  (`store/social/profile-letters-*.png`).

### Fixed — 2026-11-02
- A burst of community reports sent at the same moment can no longer steer
  the blend: a city's weights and local bias learn from at most one report
  per half hour, checked and recorded in one database step, and the
  once-an-hour limit per person is claimed the moment it is checked. (Tested:
  20 reports at once moved the weights once.)

### Changed — the site and app answer your finger like an iPhone app
(nothing looks different at rest)
- List rows (search results, More, the week's days, suggestions) light up
  while held; cards press in a little, chips and buttons with the usual
  spring.
- In the app, holding a button or link no longer selects its label or opens
  the link menu; text in the content stays selectable.
- Tapping the tab you're on scrolls back to the top (an open peak still goes
  back to the peak list).
- Haptics only where they confirm something: a tick when switching Today,
  Tomorrow and Week and on the notification switches, a success tap when a
  hike is planned.

### Removed
- Leftovers for database setups older than the current one (every table and
  column they guarded is there in production), an unused animation
  component, a re-export file and the unused `@plausible-analytics/tracker`
  package. Two hand-written paging loops use the shared helper now.

## 2026-10-30

### Added — The summits, huts and towns refresh themselves twice a year
- A GitHub Actions workflow (2 January and 2 July, or by hand) rebuilds them
  from OpenStreetMap and GeoNames, loads them into the dev database, checks
  the search and Near you on it (matterhron, cervino, zermatt, hà nội, the
  Jungfrau region, Sa Pa) and opens an issue with row counts, size, changed
  rows and the results. The extracts are streamed, never stored (Europe alone
  is 35 GB): about 150 GB flow through per run, and the runner's disk never
  holds more than about 1 GB. Each region runs in a job of its own, three at a
  time — Geofabrik gave 5–68 MB/s, and the first run, all in one job, took
  3 h 28 min; per region the longest (Europe) took 73 min, far from GitHub's
  6 h limit per job.
- Production stays one command on the owner's PC — its keys are never in
  GitHub: `node scripts/places/load.mjs --production --run=<run id>` loads
  the data that run built.

### Changed — Hiking search and "Near you" from our own summits, huts and towns
- Search, "Near you" and "around a town" no longer depend on public
  OpenStreetMap services (Photon and Overpass were down for days; Nominatim
  forbids search-as-you-type). They read our own copy: 544 000 named summits
  and volcanoes (with a height or a Wikidata item) and 24 000 huts from
  OpenStreetMap, with their names in our 13 languages, and 70 000 towns of
  5 000+ people from GeoNames with their names in other languages and scripts
  — "Hà Nội", "ha noi", "Hanoi", "Wien", "Vienna", "ウィーン" all find the town.
- Typing searches peaks and huts again, with typos and accents forgiven
  ("matterhron", "phan xi pang"), names in any of our languages ("Cervino",
  "富士"), nearer matches first when you share your position. Each query
  takes 1–18 ms in the database.
- A town's name shows what "Near you" would show standing there — the
  notable summits spread over the area and its nearest huts, within 25 km,
  nearest first ("zermatt": Matterhorn, Weisshorn, Dom, Monte Rosa,
  Hörnlihütte) — instead of guesses that only look like it ("hanoi" isn't
  Hanover Mountain). A village too small for our towns (Grindelwald,
  Saas-Fee) gets the same when you send the search: the geocoder says where
  it is, the summits come from our data.
- Heights written with a thousands comma ("4,600") are read as such, not as
  4.6 m.
- Nominatim is now only the fallback for a search you send that our data
  can't answer, through the same shared gate and cache. Featured peaks,
  grades and routes are unchanged. "© OpenStreetMap contributors" and
  "GeoNames" are credited under the results and in the terms.
- 226 MB in the database (free tier: 500 MB). Rebuilt every few months on a
  PC from Geofabrik's extracts (`scripts/places`, see the README). A reload
  writes only what changed and stops before deleting more than a tenth of a
  table; until a first load has finished, the outside services answer as
  before.

## 2026-10-29

### Changed — OpenStreetMap's Nominatim used within its usage policy
- Typing in the hiking search no longer asks Nominatim: while you type you
  get our featured peaks and the geocoder's mountains; peaks, huts and towns
  from OpenStreetMap come when you send the search (Enter, or "Search peaks,
  huts and places for …"). The search field says it finds towns too.
- One request a second for the whole app, however many servers run: each
  request takes a slot from a gate in the database. Answers are kept 30 days
  and shared; the request identifies MetaBlend with a contact address; "©
  OpenStreetMap contributors" shows under the summits and huts.
- Needs `supabase/nominatim.sql` once in the production database; until then
  each server spaces its own requests, as before. Checked in production: one
  search took three slots, a repeat came from the cache, a burst of three
  searches went out one at a time. Slots are now 1.25 s apart (room for each
  server's own latency) and every cached answer records when its request
  went out — run the updated `supabase/nominatim.sql` again for both.

### Fixed — Hiking and notifications (tester feedback round 2: thank you to our tester in Vietnam, Red Magic 8S Pro, Android 15)
- "Near you" works again, everywhere: it spun for 14 seconds and then said
  summits couldn't be loaded — not only in Vietnam, Vienna too. The public
  OpenStreetMap geocoder it asked (Photon) stopped accepting connections, and
  so did the backup (Overpass). Summits now come from OpenStreetMap's
  Nominatim (in about two seconds, heights and notability included), Photon
  only as a fallback.
- Nothing near you no longer means an empty section: "No summits found
  within 50 km" — or, when the lookup fails, a clear error with Retry — and
  under it the nearest summits we feature, with their distance.
- Searching for a city or town finds the summits and huts around it, nearest
  first, with the distance ("hanoi", "Hà Nội", "sa pa", "zermatt"); peaks
  and huts by name still come first. Name search uses Nominatim too.
- The search field's focus edge is a thin border again, like every other
  field — not a thick double ring.
- More → Notifications → "Open settings" opens the app's notification
  settings on Android (or its app info screen where a phone has none) — it
  did nothing before. Needs the new Android app build; older builds show the
  path to the settings instead of a button that can't work. iOS already
  opened the app's settings page.

### Fixed — no blank Hiking page in the app
- Should the website's hiking teaser ever reach the app twice (it's hidden
  there), the page no longer stays blank: a "Loading…" line shows, a refresh
  is tried, and two seconds later the app view is loaded directly.

### Changed — long days are timed again
- Routes of 10 to 14 hours' walking are no longer "multi-day": they're
  labelled "long day — may be done with an overnight stay" and get their
  start window and stage times like any day walk (in short autumn days that
  can honestly be "not enough daylight"). Only routes over 14 hours are
  multi-day now, without a single start time.

### Changed — "up to 20 weather sources at once", three unreliable sources gone
- Everywhere the app talks about itself — site, social preview, store
  listings and screenshot captions in all languages, README — "26 sources"
  is now "up to 20 weather sources at once": that's what a place really gets
  (20 in Austria and Bavaria, 19 in the Alps, 16 in the US, 14 everywhere).
- Retired: NASA POWER (its hourly data runs about 7 days behind, so it never
  had a value for "now"), World Weather Online (its key is over the daily
  limit and there's no free plan left) and Tomorrow.io (the free plan's 500
  calls a day already missed one forecast in six). Credits, privacy notice
  and terms no longer list them; old leaderboard rows keep their names.
- "N sources" on the forecast card, the share text and the widget counts
  the weather sources that answered — not MetaBlend Local, which is made
  from them.

### Added — a separate dev database; production is written only on purpose
- Local development gets its own Supabase project: `supabase/dev-schema.sql`
  is the whole schema in one script (built from `supabase/*.sql`, without the
  scheduled jobs that call the live site, checked on a real Postgres in the
  tests), `node scripts/dev-db.mjs check` confirms `.env.local` points at it.
- A local server, script or test that still points at production can read it
  but can't write: every write is refused before it's sent. Only the deployed
  site writes there — and admin scripts, which take production's keys from a
  separate git-ignored file and go on only after you type the project ref.

## 2026-10-27

### Changed — faster, steadier tabs in the app (first external tester)
- Switching between Forecast, Hiking and More no longer waits for the server
  or starts over: the Forecast tab comes back with its city at once (no start
  screen, no loader; it refreshes quietly when due), Hiking comes back on the
  peak or route you had open, and Hiking and More are fetched ahead.
- Hiking: "Near you" no longer shows "looking…" and then disappears when no
  well-known summit is close — it says so in one line instead. Summits, routes
  and nearby peaks seen once show at once on the next visit.
- The website's hiking teaser can no longer appear inside the app, not even
  for a frame.
- No more English (or °C) frame when a tab or page opens in the app: every
  page now starts in your language and unit from its first frame — German,
  Japanese, °F and "System" checked on Hiking, peak pages, More and Forecast.

### Fixed — honest walking times on routes (tester feedback)
- 35 of 69 stored routes (on 23 featured peaks — Kilimanjaro, Mount Fuji,
  Mount Whitney, Brocken, Hoher Sonnblick and more) had lost their heights:
  one refused height request emptied a whole route. They were timed as if
  flat, far too short — Lemosho on Kilimanjaro "21 h" instead of about 47 h,
  which also moved the suggested start and the stage times. That's a safety
  issue, not cosmetics.
- Heights come from the terrain model again (a refused request is tried once
  more). Ascent and times from the terrain model are marked as approximate (≈).
- Every stored route was repaired and re-timed at once, not when next opened:
  all 74 routes on 33 peaks have new times (56 moved by more than 10%), the
  31 without heights have them again, none is left without. Planned hikes
  with a route: none stored right now — alerts are timed when they're sent,
  so they use the new heights and rules anyway.
- Ascent and walking times are no longer inflated by the terrain model's
  noise. On steep slopes it reads the 90 m cells above and below a path in
  turn (±40 m from point to point), and every jump counted as climbing: Mount
  Whitney Trail said ↑4030 m and 27 h (real: 1830 m, about 15 h), Mount
  Fuji's Yoshida trail 12 h 57 (now 9 h 34) and so "multi-day". The height
  profile is now averaged over 200 m before ascent and time are counted; the
  start and the end (trailhead and summit) keep their real heights, and the
  heights shown are unchanged. Climbing is timed in stretches, as the rule
  intends, not per 20 m leg.
- Routes saved to "My routes" (GPX imports and saved copies) live on the
  phone: the app fills any still without heights once, in the background, the
  next time it starts — a route saved or removed meanwhile is left as it is.
- A route whose heights can't be found at all shows no walking time, start
  window or stage times, and says why — never a wrong number. Planned-hike
  alerts say the same.
- Multi-day routes (more than 12 hours of walking, e.g. Lemosho or Northern
  Circuit on Kilimanjaro) are labelled "multi-day" and get no single start
  window or stage times — those would assume one continuous walk, and nobody
  walks 47 hours in one go. The screen says why; planned-hike alerts for such
  a route name no start time either.

### Changed — a calmer forecast page and a clear first step (tester feedback)
- The source cards are folded to one line, e.g. "20 sources · 86% agree";
  open or closed is remembered. "What is consensus forecasting?" starts
  collapsed — the title stays visible, a tap opens it.
- The app's first start (no city yet) shows a "Use my location" card above
  the search field. The phone asks for location only when it's tapped,
  never by itself.

### Changed — summit pages after sunset
- When no summit window is possible for the rest of today, a peak opens on
  Tomorrow. Today then shows one line — "No daylight left today · Summit
  window tomorrow 07:00–11:00" — that opens Tomorrow when tapped.

## 2026-10-26

### Added — sign up for the Android test by email
- /testers: leave the Gmail address of the Google account on your phone's
  Play Store (and, if you like, your phone model and country) and you're added
  to the closed test's email list and sent the link — no Google Group to join.
  The group stays as the other way in. Three tips under it: open the link with
  that same account, the app can take minutes to hours to show up in Play,
  and the test runs 14 days. All 13 languages.
- The privacy notice says what the sign-up stores, why, for how long (until
  the test ends) and how to have it deleted.
- For the owner: `node scripts/testers.mjs export` (the list for Play Console —
  upload it to an email list kept only for these sign-ups, because an upload
  replaces that list), then `mark-added` (exactly the new ones in that file,
  with their addresses for the opt-in mail); also `new`, `status`, `delete`,
  `delete-all`. Needs `supabase/tester-signups.sql`.

### Added — what the numbers mean
- Every kind of number now carries the same small icon wherever it shows: a
  droplet for the chance of rain, wind for wind, a snowflake for the freezing
  level. Each card ends with one line naming them (in all 13 languages), next
  to the existing storm-risk and "sources agree" keys. In the week list, the
  hour strips, the summit hours and week, and the route stages.
- Route stages on a phone: the place name gets its own line above the values
  (it was squeezed to nothing between six columns). Summit week: wind and
  freezing level on two short lines, so the freezing level is no longer cut off.

## 2026-10-25

### Changed — less server CPU (same forecasts, same alerts)
- City and summit pages are cached: each one is built on its first visit and
  then served from the cache for 15 (cities) or 30 (summits) minutes, as
  intended. Before, every visit rebuilt the page.
- Official warnings: once `supabase/warnings-trim.sql`,
  `supabase/warnings-feeds.sql` and the new cron job are applied (in that
  order; each refuses to run before the one it needs), the database downloads
  the 22 warning feeds every 15 minutes, skips the unchanged ones and keeps
  only what can still show (3.6 MB instead of 19.4 MB). The site then only
  reads the feeds that changed, about 16 ms of work instead of about 560 ms,
  and is only called when something changed. A feed the database can't get
  for 40 minutes is downloaded by the site itself and logged, so warnings
  (and the severe-weather alerts that rely on them) never stop quietly. Until
  the SQL is applied the site downloads every feed itself, as before.
- City pages: a listed city never gets a cached "not found" page because the
  place lookup failed for a moment; the last good page stays instead.
- All server routes share one function again (no per-route time limits), so
  a warm instance serves every route and fewer requests start cold.
- Faster cold starts: the database client is only the part we use (−30 ms),
  and push alerts load the warning and avalanche region maps (3.2 MB) only
  when a lookup needs them. Cold start of /api/forecast 156 → 124 ms,
  /api/push/dispatch 234 → 125 ms (measured locally).

## 2026-10-20

### Added — summit weather pages on the website
- metablend.app/mountains and a page per featured peak (195), e.g.
  /mountains/grossglockner: today's and tomorrow's summit window, a 7-day
  summit table (low / high, summit wind, rain, freezing level, storm risk) and
  the avalanche danger in winter, in crawlable HTML with a link to the app.
  In the sitemap, the footer ("Mountains") and under the hiking teaser.
- City weather pages now name the weather as most sources report it (as the
  app does), and their 7-day table can be scrolled with the keyboard.

### Added — avalanche danger (winter hiking)
- Peak pages show the official avalanche danger for the summit's area — today
  and, once the evening bulletin is out, tomorrow — as the level (1–5), its
  word (low … very high, in all 13 languages) and the standard colour. From
  the bulletins of Europe's avalanche warning services (EAWS, via
  avalanche.report); nothing shows out of season or outside avalanche regions.
- Planned-hike alerts name the avalanche danger for that day.

### Added — official warnings in 5 more countries (22)
- Estonia, Israel, Norway, Slovenia and Sweden: their warnings come with the
  issuer's own outline instead of region codes, so each one is stored with
  its (simplified) outline and found by whether your spot lies inside it.
  Same card, strip and alerts as the other 17 countries.

### Added — Pirate Weather, ready when a key is
- An optional extra source; it stays off until `PIRATE_WEATHER_KEY` is set.

### Added — 10 more weather models (26 sources)
- Five more global models: UK Met Office, Canada GEM, JMA (Japan), CMA GRAPES
  (China) and ECMWF's AI model AIFS — and five regional ones that only show
  inside their own area: MeteoSwiss ICON-CH and ItaliaMeteo ICON-2I (the Alps),
  KNMI and DMI HARMONIE (central and northern Europe) and NOAA NBM (US). All
  free and keyless through Open-Meteo, in one shared request. Lienz now blends
  about 21 sources instead of 12.
- New sources start with a low weight and now actually get calibrated: a
  source scored for the first time joins the weights (before, sources added
  after the first setup — like Météo-France — stayed at the starting weight).
- The site says 26 sources; the store listings and screenshots still say 16
  until the next store update.

## 2026-10-19

### Changed — Météo-France instead of Weatherstack
- Weatherstack's free plan only works over plain http, with our key in the
  address. It is replaced by Météo-France's models (ARPEGE worldwide, AROME at
  1.3 km over France and the Alps) through Open-Meteo — encrypted, no key —
  so every request the app makes or makes for you is now over https, and it
  is still 16 sources. Old Weatherstack rows on the leaderboard keep its name.

## 2026-10-14

### Fixed — the weather now says what most sources say
- The condition next to the temperature ("Rain", "Partly cloudy") was one
  source's view (Open-Meteo's), so it could say "Rain" above "Dry for the
  next 2 hours" and "Dry tonight". It is now what most sources report — wet
  or dry by majority, then the most common kind — with Open-Meteo deciding
  ties. The same on the home-screen widgets, the embeddable widget and in
  the stored history; MetaBlend Local no longer copies Open-Meteo's word.

## 2026-10-09

### Fixed — Near you, again
- Near you now lists the summits OpenStreetMap marks as notable (a Wikipedia
  article, a Wikidata item, a summit cross), nearest first, picked from where
  you are: around Lienz that is Spitzkofel, Schleinitz, Große Sandspitze and
  Böses Weibele instead of only the 3000 m Schober peaks further north. One
  per mountain (the more notable top wins), never a bump on the valley floor.
- While the summits load it says so, and if they can't be loaded it offers a
  retry — no more far-off featured peaks (Großglockner, Drei Zinnen) standing
  in as "near you".
- The summit lookup is gentler on OpenStreetMap's geocoder (requests a moment
  apart, a pause before a retry), so fewer answers come back with gaps.

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
