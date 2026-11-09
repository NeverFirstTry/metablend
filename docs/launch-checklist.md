# Launch checklist: both stores live by 2026-12-15

**Before any monetisation:** Open-Meteo's and RainViewer's free tiers are non-commercial. Subscriptions or ads count as commercial use for Open-Meteo, and RainViewer's free API is for small-scale community use. Move to their paid plans first.

**For a lawyer's review** (attribution went live 2026-11-07; these points could not be checked against the providers' own pages):
- DWD: /terms says "Datenbasis: Deutscher Wetterdienst, eigene Bearbeitung: mit anderen Quellen gemittelt". The form comes from a secondary summary of DWD's templates; check it against DWD's own page.
- WeatherAPI.com: the free plan's credit "Powered by WeatherAPI.com" with a link is in. Their terms (read 2026-11-08) require an end-user disclaimer that at minimum conveys four points; a conforming text is on /terms with the attribution since 2026-11-08. Whether it must also stand next to the data itself (Sources panel) is for the lawyer. Update 2026-11-09, terms read in full: the notice is on /terms in their own words with a German version, and the Sources panel shows one linked line whenever WeatherAPI data is in the blend. Caching: WeatherAPI feeds only current conditions (no forecast values stored); the 60-minute cap is met by the hourly purge with a daily backstop. Their data processing agreement is signed in the dashboard (DPA2026-0007); /privacy names WeatherAPI as a processor. Its clause 9.6: requests from outside Europe may reach BunnyCDN points of presence without an adequacy decision or SCCs; WeatherAPI offers an EU-only API hostname on request. Checked 2026-11-09: the production deployment's functions ran in Vercel's iad1 (US), so every WeatherAPI call (visitor forecasts, the hourly station calibration via pg_cron, the daily crons) originated outside the EU; the owner switched the project's function region to fra1 (Frankfurt) at 00:24 UTC the same day, which applied to the running deployment at once (X-Vercel-Id fra1::fra1). All WeatherAPI calls now originate in Europe, so the EU-only hostname is not needed; the code reads WEATHERAPI_HOST should that change (default api.weatherapi.com).
- ECMWF: /terms has the credit sentence, CC BY 4.0, the source and the note that blended data are changed. ECMWF's liability sentence ("ECMWF does not accept any liability whatsoever for any error or omission in the data, their availability, or for any loss or damage arising from their use") sits on a separate ECMWF page and is not quoted; decide whether /terms needs it.
- Visual Crossing: its raw values are no longer public (2026-11-07). The owner is asking them in writing whether the Sources panel may show them again.
- ImprovMX (mail forwarding to info@metablend.app): its GDPR page says inbound mail is stored transiently in France (AWS Paris) and outbound delivery runs on servers in France and the USA; the standard contractual clauses sit in its data processing agreement, which has to be countersigned (requested 2026-11-08). The agreement is countersigned by both sides (2026-11-09, version of 9 September 2026 with Annexes I–III); the /privacy sentence names its standard contractual clauses and that ImprovMX keeps only basic mail metadata (log level Minimum) for 7 days.

State as of 2026-11-05. **Done** = finished and in the repo. **Open** = Claude can do it. **Needs you** = your account, device or decision.

"Done" for a listing item means the text or image is ready in the repo. Anything already pasted into a store console is out of date until you upload it again.

## Dates

| By | What |
|---|---|
| 2026-11-09 | Closed test reaches 14 days: apply for Android production |
| 2026-11-15 | New iPhone build uploaded to TestFlight |
| 2026-11-22 | Device and accessibility checks finished on both platforms |
| 2026-12-01 | App Store submission sent, leaving two weeks for a rejection and a resubmission |
| 2026-12-15 | Both live; press Release on iOS |

Google's production review has no fixed length and can come back with questions, so the Android date has the least control. Apply on the first possible day.

## Both stores

| Item | State | Note |
|---|---|---|
| Listings say "up to 20 sources", all locales | Done | Checked in every `description.txt` and `full_description.txt` |
| Task 1 wording in listings and captions ("favourable", not "safe") | Done | `lib/wording.test.js` guards it; list in `docs/wording-audit-2026-11.md` |
| Screenshots with the new wording | Done | Shots 4 and 5 regenerated 2026-11-05; 1 to 3 don't show the changed text |
| Legal pages linked in every listing | Done | New lines at the end of each description; a test checks them |
| Legal pages reachable inside the app | Done | Footer and More link privacy, terms and legal notice |
| Store privacy answers match the privacy notice | Done | `store/compliance.md` updated for Web Analytics, the rounded "my location" position and (2026-11-08) the tester e-mail address |
| Lawyer's read of the disclaimer and privacy translations | Needs you | Not a store requirement, but recommended: the 12 translations are mine |
| Business registration and the Impressum block | Needs you | Prepared as a comment in `app/impressum/content.js`; tell me when it's registered |
| Trader status (EU Digital Services Act) | Needs you | `store/app-store-release.md` says "Not a trader". If you register the business, this probably changes, on both stores. Decide before submitting |
| Store badges on the website point to the live listings | Open | Once the listing URLs exist |
| Release announcement for the newspaper | Needs you | |
| Countersign the ImprovMX data processing agreement | Done | Countersigned by both sides 2026-11-09 (version of 9 September 2026 with SCC Annexes I–III); the /privacy sentence names the clauses and the 7-day retention of basic mail metadata (log level Minimum) |
| Sign the WeatherAPI.com data processing agreement | Done | Signed in the WeatherAPI dashboard 2026-11-09; /privacy names WeatherAPI as a processor for the coordinates we send (Art. 28 GDPR) |
| WeatherAPI EU-only API hostname (DPA clause 9.6) | Done | Not needed: since 2026-11-09 (00:24 UTC) every server function, the hourly calibration and the daily crons run in Vercel's fra1 (Frankfurt), so all WeatherAPI calls originate in Europe and the clause's non-adequacy case (BunnyCDN points of presence outside Europe) does not apply. WEATHERAPI_HOST stays supported should the region ever change (default api.weatherapi.com) |
| Run `supabase/feedback-lessons.sql` on dev, then production | Needs you | The regional feedback cap; `enable_rls.sql` ran on both on 2026-11-08 |

## Android production

| Item | State | Note |
|---|---|---|
| Closed test running, 30 testers opted in | Done | Started 2026-10-26 |
| 12 or more testers opted in for 14 days in a row | Needs you | Check Play Console on 2026-11-09 |
| Production access answers drafted | Done | `docs/play-production-access.md` |
| Fill in the bracketed numbers, then apply | Needs you | Play Console → Dashboard, from 2026-11-09 |
| App build | Done | The pages load live. Native changes since 1.0.1 (versionCode 2) wait for the next build: see "Ships with the next native build". The closed-test build can be promoted, assuming that's the build on the track |
| Device check on the A52 | Needs you | `mobile/README.md` → Device checklist |
| Accessibility check with TalkBack and largest font | Needs you | `mobile/README.md` → Accessibility |
| Upload listing text in all 13 languages | Needs you | `fastlane/metadata/android/<locale>/`: description changed today |
| Upload screenshots 4 and 5 in all 13 languages | Needs you | `.../images/phoneScreenshots/` |
| Data safety form | Needs you | Re-check against `store/compliance.md`: two rows changed |
| Content rating, target audience, ads, app access | Needs you | Confirm they're filled in; answers in `store/compliance.md` |
| Roll out to production | Needs you | After Google's approval |

## App Store

| Item | State | Note |
|---|---|---|
| Swipe-back | Done | In `AppDelegate.swift`. Not compiled yet: first Xcode build is the test |
| New iPhone build, version and build number | Needs you | Raise Build above your last upload on both App and MetaBlendWidgets. The repo says 1.0 (1), the README says build 2, so use your last upload as the reference |
| TestFlight check on a real iPhone | Needs you | Swipe-back, haptics, press feel, hiking search, widgets, push |
| Accessibility check, then tick the labels | Needs you | `mobile/README.md` → Accessibility; tick only what passed |
| Subtitle, category, content rights, age rating | Needs you | `store/app-store-release.md`, part 1 |
| Price and availability | Needs you | Free, all countries |
| App Privacy answers | Needs you | `store/compliance.md`, App Store section (two lines changed) |
| Screenshots, promotional text, description, keywords, URLs per language | Needs you | `fastlane/screenshots/<language>/`, `fastlane/metadata/<language>/`: 12 languages, as App Store has no Slovene folder here |
| Release notes | Done | "First release", in each `release_notes.txt` |
| Copyright line | Needs you | `2026 <your full name>` |
| App Review notes and contact phone | Needs you | Text in `store/app-store-release.md`, part 5 |
| Version release: "Manually release this version" | Needs you | Set it before submitting; you press Release |
| Submit for review | Needs you | By 2026-12-01 |

## Ships with the next native build

The pages load live, so web changes reach the apps at once. These native parts are in the repo but in no store build yet (Android's last is 1.0.1, versionCode 2):

- iPhone: swipe from the left edge goes back (`34729a2`).
- Android: the home-screen widget's light colours follow the new palette (`69363a5`).
- Android: the notification tint and the Retry button on the no-connection page in gold (`8439450`).
- Both: app launch background Slate #0f151b, matching dark mode (`mobile/capacitor.config.json`, `mobile/www/index.html`; needs `npx cap sync`).
- iPhone: Release builds sign with `aps-environment` production (`mobile/ios/App/App/AppRelease.entitlements`, set in the project's Release configuration); Debug keeps development. Check the archive's entitlements once in Xcode's organizer.

## App Review notes (Apple guideline 4.2, minimum functionality)

The pages load from metablend.app, so a reviewer may ask what the app does that Safari cannot. Paste this with the review notes (`store/app-store-release.md`, part 5):

- Home-screen widgets (WidgetKit extension `MetaBlendWidgets`): the current forecast with the next hours or days, and a planned-hike widget with its summit window; both configurable, both updated from the app's own feed.
- Push notifications (APNs): rain starting within the hour, storm risk, official severe-weather warnings, heat, a morning briefing at the chosen hour, and alerts for planned hikes the evening before and the morning of. All opt-in, per alert type.
- Hiking: summits near the user from the device location, GPX import, routes and planned hikes stored natively on the device, hike alerts.
- Native share sheet for forecasts; haptics; alternate app icons; Larger Text follows the system font scale; a shortcut into the system notification settings.
- Deep links from widgets and notifications (`metablend://open?path=…`) and swipe-back navigation.
- The last forecast is cached on the device, so the app opens offline.

## Rotating the admin secret

`CALIBRATE_SECRET` is one value in five places, and pg_cron calls with it every hour, so rotate in this order within one hour:

1. Vercel → Settings → Environment Variables: the new value for Production (and Preview), then redeploy. From now on the old value gets 401 everywhere.
2. Supabase → Vault: update the secret `calibrate_secret`. The jobs `station-calibrate-hourly`, `push-dispatch-hourly`, `push-dispatch-nowcast` and `warnings-refresh` read it at run time (`supabase/cron.sql`), no SQL change.
3. GitHub → repository secrets: `CALIBRATE_SECRET` (`backup.yml` nightly, `station-calibrate.yml`).
4. `.env.production-admin` on this machine (`scripts/testers.mjs` and the admin scripts read it).
5. Nothing else: the server's own internal fetches read the Vercel value. `CRON_SECRET` is Vercel's own and is rotated in the Vercel UI alone.

Check: the next hourly run at :00 appears in `cron.job_run_details` with status succeeded, and `/api/station-calibrate` without the header still answers 401.

Not in this list: the app's Beta badge, removed for launch (2026-11-08). It lives in the web code, not in anything native, so it disappears from the app as soon as that change merges; no build needed for it.

## Uploading with fastlane

The repo has the metadata and screenshots in fastlane's layout, but no `Fastfile` or `Appfile`, and fastlane isn't installed. It could upload the texts and images, saving the per-language pasting. I haven't run it.

To set it up, you'd need:

- **App Store:** an App Store Connect API key (Users and Access → Integrations): the issuer ID, key ID and `.p8` file, with the App Manager role.
- **Google Play:** a Google Cloud service account JSON key, invited in Play Console with permission to edit listings.
- **On the machine:** Ruby and `gem install fastlane`.

Keep the keys in files git ignores, never in chat. The commands would be `fastlane deliver --skip_binary_upload --submit_for_review false --automatic_release false` and `fastlane supply --metadata_path fastlane/metadata/android --skip_upload_aab`. `fastlane/metadata/` also holds `android/` and `review/`, so `deliver` may need `--ignore_language_directory_validation`. Try it on one language first.

Builds, the App Privacy form, Data safety and the production application stay manual either way.
