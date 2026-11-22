---
name: metablend
description: "Use for any MetaBlend task: releases, data refresh, legal pages, design, and the project's ground rules."
---

# MetaBlend

## Ground rules

- **Databases:** `.env.local` is the dev project; test against it. Production keys live in `.env.production-admin`. Production is written only by the deployed site, or by an admin script after its ref is confirmed (`./scripts/lib/production.mjs`). The owner runs those scripts. Give the command and stop. Schema changes (new tables, columns) go to the owner as exact SQL for dev, then production; don't run them on either. Code that needs new SQL goes to main only after the owner confirms the SQL ran on dev and on production; code that tolerates the missing object does not lift this. Before that merge, list the `supabase/*.sql` files the branch adds or changes and check production's catalog for their objects, read-only.
- **Production checks:** short and read-only. No load or burst tests. Look at a picture of every page a check opens before calling it passed: a script only finds what it was told to look for. Anything on the live site that a visitor can see and that should not be there goes to the owner at once, in one line with the picture's path, before any diagnosis.
- **Deploys:** a production deploy empties the caches, and the first visits after it ask the weather sources again. Several approved branches go out as one deploy, and never during a store capture.
- **Before every push:** `npm test`, `npx eslint .`, `npx next build`. Then a dated entry in `CHANGELOG.md`, user-facing first, one line per change.
- **13 languages:** en de fr es it nl pl cs sl pt ja zh ko. All user-facing text goes in `lib/i18n/<lang>.js`; `lib/i18n/parity.test.js` checks every pack has every key.
- **German legal texts are the original.** Change German first, then translate; never soften or broaden.
- **Never promise safety.** A window, start time or day is "favourable" (`günstig`), not "safe". Warnings and "not a safety guarantee" keep their words. `lib/wording.test.js` enforces this.
- **Active CPU:** prefer static pages, ISR and CDN caching. A new request per visitor needs a reason.
- **Open-Meteo calls:** cost a request with `callWeight` in `lib/open-meteo.js` (variables times models), never by the number of HTTP requests. Give requests and weighted calls side by side, in the commit and to the owner. A projected saving quotes the counter by kind (`open_meteo_calls`); a figure from request logs is an estimate until a full counted day is in. Count per render, including the renders that crawlers and deploys cause, and count every Open-Meteo host. A section of a request applies to every model in it, so a step only some models need gets its own request; `current` is not split by model, `minutely_15` is.
- **Design:** no sparkle or magic icons, emoji in UI, glows (the sun glow below is the one exception), gradient text, icon-in-a-rounded-square feature grids, vague taglines, cards inside cards, glass on everything, stacks of badges or centred everything. Do use left-aligned layouts, about 5 type sizes, one card style, an 8px grid, generous whitespace and few borders. Show the product first and use real data. Dark mode: solid Slate (#0f151b) with a subtle sun-position gold glow, no purple, no full gradient (the weather no longer tints it). Keep the one fixed near-white sky in light, the gold accent, the system font / Inter, the source dots in the Sources panel and reduced motion. 13 px is the smallest text, on the website and in the app (the app renders the same pages).

## Redesign rules

These stand for every design task; the owner should not have to repeat them. Re-read this list before sending a comparison link.

- **Colour:** gold is the only accent, and on a screen it marks one thing: the main answer (the consensus temperature, the summit window, the favourable start). Selected tabs, toggles and chips get a neutral highlight, never gold (owner, 2026-11-20). On a screen without an answer the one main button keeps gold, since it is that screen's one job (owner, 2026-11-20). Green is for status only.
- **Who it is for:** the weekend hiker first (is my summit on, and when do I start), the day decider second, mainly on the website (owner, 2026-11-20). What is used most comes first on a screen.
- **Website and app:** 13 px minimum, whole degrees, no countdowns.
- **Cards:** no nested cards.
- **Motion:** every animation has its Reduce Motion version: one rule in `app/globals.css` cuts all motion, so the resting state must be the finished picture. Ideas for new motion are listed apart from problems and are not launch work.
- **A review measures:** an answer to a tap within 0.4 s, also on a poor connection; the number of choices on a first screen; target size (44 px) and thumb reach; order by frequency of use. `scripts/ux/walk.mjs` measures them (see Captures).
- **Wording:** no "safe" or "sicher". No em or en dashes in UI copy: full stops and commas, a plain hyphen for ranges (`lib/wording.test.js`). All user-facing text as i18n keys in all 13 languages.
- **Scope:** website only unless stated. Tell the owner before touching a component the app shares.
- **Before any merge:** a before/after comparison page with desktop and phone, dark and light, and a German phone. When the owner explicitly asks for a lean comparison, that scope wins over this default. Check that every image loads before sending the link. Each part on its own branch; no merge until the owner says go. For any change to an API route (`app/api/**`): check the branch's Vercel preview deployment before main, every time (`MSYS_NO_PATHCONV=1 npx vercel curl "/api/..." --deployment <preview url> --scope never-s-projects1 -- -s -D -`, cold and warm); the 2026-11-09 forecast outage passed tests, lint and build.
  - Run `./scripts/check-phone-layout.mjs` (also enforced in CI). Send its output to a file, never through a filter: a pipe holds the output until the run ends, and a long run then looks dead.
  - **Works with the previous app build** (owner, 2026-11-22). The app loads its pages from the website, so a website change reaches every app build in people's hands at once, including TestFlight build 3 (version 1.0, from before 2026-11-10). A website change never removes a working feature from an older build: when the native side does not answer a new call or field, fall back to what that build supports. A change to anything the pages ask the native bridge for needs a test with a bridge that answers like the oldest build in use (`lib/app-icon-legacy.test.js` shows how). On 2026-11-10 the eleven app icons hid build 3's icon picker for twelve days.
- **Captures:** a new folder per run, language pinned by cookie. Stop only processes this session started, by the process ID it got when starting them, never whatever holds a port: another session's server or browser may hold it. A busy port means pick another one. First grep the served CSS for the change (stale: delete `.next/dev`) and re-pin fixtures that expire or that the diff computes. Ready means visible and complete (all sources), not just present.
  - **UX walk:** `node scripts/ux/walk.mjs <config>` walks every screen of a local build (never production) in one configuration (view, width, theme, language) and saves slices and measures; its header has the steps. Before a first-visit capture, ask the start page once and wait for its rebuild: its example forecast is fetched while the page is built. `ONLY=faults` runs the measures against planted faults; do that before a green result counts. `native-*` configurations show the app-only parts through a stand-in for the phone's bridge, so no system dialog is seen. `scripts/ux/report-build.mjs` builds a review (`docs/ux-review.md`) and its page from one data file.

## Tests

- **Faking `fetch`:** start from `lib/test-route-fakes.js` (`answerWith` for the outside service, `seen` for assertions), never from a bare `globalThis.fetch` closure. The database client and the Open-Meteo request counter use the same `fetch`, so a hand-made fake sees their calls too.
- **Golden test** (`lib/forecast-golden.test.js`): before `node ./scripts/record-golden.mjs --rebaseline`, list every difference between the recording and the replay by kind (values, order, missing or new sources, stored rows), and name what the test does not compare (the stats call, logs). The owner accepts that list, not "red by design". Look first for a change that leaves the test green: ask the provider for the same value in the new request. For a refactor meant to change no value, record through the old code with the new request's answer taken at the same moment, replay through the new code, then delete the old answers from the recording and see the test stay green.

## Android release

1. `mobile/android/app/build.gradle`: `versionCode` +1, new `versionName`.
2. Write `fastlane/metadata/android/<locale>/changelogs/<versionCode>.txt`.
3. `cd mobile && npm install && npx cap sync android`
4. Run on the A52 from Android Studio (`npx cap open android`) and walk `mobile/README.md` → Device checklist.
5. Android Studio → Build → Generate Signed App Bundle → release. Signing comes from `mobile/android/keystore.properties` (never in git). Output: `mobile/android/app/release/app-release.aab`.
6. Play Console → Test and release → the track → upload the `.aab`, paste the changelog.

## iOS release (MacBook)

1. `git pull && cd mobile && npm install && npx cap sync ios && npx cap open ios`
2. Target App and target MetaBlendWidgets → General: same Version and Build, Build above the last upload.
3. Run on an iPhone and walk `mobile/README.md` → Device checklist, plus Accessibility before ticking those labels.
4. Scheme App, Any iOS Device → Product → Archive → Distribute App → App Store Connect → Upload.
5. TestFlight: internal first. External needs Beta App Review; texts are in `fastlane/metadata/review/`.
6. App Store: follow `store/app-store-release.md`. Version release is "Manually release this version"; the owner presses Release after approval. Write `fastlane/metadata/<locale>/release_notes.txt`.

## Store screenshots

Captions are in `store/captions.json`. After a change to a screen or caption:
`npx next build`, `SELF_BASE=http://localhost:3123 npx next start -p 3123` (without SELF_BASE the start page fetches localhost:3000 and the forecast screens fail), then `SHOTS=4,5 node ./scripts/store-shots.mjs` (the changed screens) or without `SHOTS` for all. Form answers are in `store/compliance.md`; keep them in step with `app/privacy/content.jsx`.

## Places refresh

`.github/workflows/places-refresh.yml` runs on 2 January and 2 July. It loads the new data into the dev database, runs the checks and opens a GitHub issue. It never touches production.

When the issue appears:
1. **"Ready for production":** check the row counts, the size and that every check is ✅. Try search and Near you on the local server (dev database).
2. **A region failed:** Actions → Places refresh → Run workflow, with `regions` set to that region. To reload a good build, use `data_from_run=<run id>`; the data is kept for 90 days.
3. **Good:** the owner runs `node ./scripts/places/load.mjs --production --run=<run id>`. It asks for the ref. It refuses to delete more than a tenth of a table unless `--allow-shrink` is passed; use that only after explaining why the data shrank.
4. Close the issue with the row counts.

Scheduled workflows pause after 60 days without commits to the repo.

## Legal pages

- `/impressum`: `app/impressum/content.js`. The business-registration block waits there as a comment. No EU ODR link.
- `/terms`: disclaimer in `app/terms/disclaimer.js`, the rest in `app/terms/content.jsx`.
- `/privacy`: `app/privacy/content.jsx`. Merge, never replace or shorten; do not remove services still in use.
- "The German version applies" note: `lib/legal-note.js`, on /privacy and /terms, all 12 translations.
- `lib/legal-pages.test.js` pins the German text word for word.
- **The street address appears only on /impressum and in the privacy controller block.** Never in listings, the README, metadata, OG images, commit messages or the changelog. The test checks tracked files.
- The notice states a data processing agreement with Vercel, which requires the Pro plan or higher.
