---
name: metablend
description: "Use for any MetaBlend task: releases, data refresh, legal pages, design, and the project's ground rules."
---

# MetaBlend

## Ground rules

- **Databases:** `.env.local` is the dev project; test against it. Production keys live in `.env.production-admin`. Production is written only by the deployed site, or by an admin script after its ref is confirmed (`scripts/lib/production.mjs`). The owner runs those scripts. Give the command and stop.
- **Production checks:** short and read-only. No load or burst tests.
- **Before every push:** `npm test`, `npx eslint .`, `npx next build`. Then a dated entry in `CHANGELOG.md`, user-facing first, one line per change.
- **13 languages:** en de fr es it nl pl cs sl pt ja zh ko. All user-facing text goes in `lib/i18n/<lang>.js`; `lib/i18n/parity.test.js` checks every pack has every key.
- **German legal texts are the original.** Change German first, then translate; never soften or broaden.
- **Never promise safety.** A window, start time or day is "favourable" (`günstig`), not "safe". Warnings and "not a safety guarantee" keep their words. `lib/wording.test.js` enforces this.
- **Active CPU:** prefer static pages, ISR and CDN caching. A new request per visitor needs a reason.
- **Design:** no sparkle or magic icons, emoji in UI, glows, gradient text, icon-in-a-rounded-square feature grids, vague taglines, cards inside cards, glass on everything, stacks of badges or centred everything. Do use left-aligned layouts, about 5 type sizes, one card style, an 8px grid, generous whitespace and few borders. Show the product first and use real data. Keep the living sky, the gold accent, the system font / Inter, the source-spread strip and reduced motion.

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
`npx next build`, `npx next start -p 3123`, then `SHOTS=4,5 node scripts/store-shots.mjs` (the changed screens) or without `SHOTS` for all. Form answers are in `store/compliance.md`; keep them in step with `app/privacy/content.jsx`.

## Places refresh

`.github/workflows/places-refresh.yml` runs on 2 January and 2 July. It loads the new data into the dev database, runs the checks and opens a GitHub issue. It never touches production.

When the issue appears:
1. **"Ready for production":** check the row counts, the size and that every check is ✅. Try search and Near you on the local server (dev database).
2. **A region failed:** Actions → Places refresh → Run workflow, with `regions` set to that region. To reload a good build, use `data_from_run=<run id>`; the data is kept for 90 days.
3. **Good:** the owner runs `node scripts/places/load.mjs --production --run=<run id>`. It asks for the ref. It refuses to delete more than a tenth of a table unless `--allow-shrink` is passed; use that only after explaining why the data shrank.
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
