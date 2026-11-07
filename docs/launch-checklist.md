# Launch checklist: both stores live by 2026-12-15

**Before any monetisation:** Open-Meteo's and RainViewer's free tiers are non-commercial. Subscriptions or ads count as commercial use for Open-Meteo, and RainViewer's free API is for small-scale community use. Move to their paid plans first.

**For a lawyer's review** (attribution went live 2026-11-07; these points could not be checked against the providers' own pages):
- DWD: /terms says "Datenbasis: Deutscher Wetterdienst, eigene Bearbeitung: mit anderen Quellen gemittelt". The form comes from a secondary summary of DWD's templates; check it against DWD's own page.
- WeatherAPI.com: the free plan's credit "Powered by WeatherAPI.com" with a link is in. Whether their terms require a set end-user disclaimer, and whether ours covers it, is unchecked.
- ECMWF: /terms has the credit sentence, CC BY 4.0, the source and the note that blended data are changed. ECMWF's liability sentence ("ECMWF does not accept any liability whatsoever for any error or omission in the data, their availability, or for any loss or damage arising from their use") sits on a separate ECMWF page and is not quoted; decide whether /terms needs it.
- Visual Crossing: its raw values are no longer public (2026-11-07). The owner is asking them in writing whether the Sources panel may show them again.

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
| Store privacy answers match the privacy notice | Done | `store/compliance.md` updated for Web Analytics and the rounded "my location" position |
| Lawyer's read of the disclaimer and privacy translations | Needs you | Not a store requirement, but recommended: the 12 translations are mine |
| Business registration and the Impressum block | Needs you | Prepared as a comment in `app/impressum/content.js`; tell me when it's registered |
| Trader status (EU Digital Services Act) | Needs you | `store/app-store-release.md` says "Not a trader". If you register the business, this probably changes, on both stores. Decide before submitting |
| Store badges on the website point to the live listings | Open | Once the listing URLs exist |
| Release announcement for the newspaper | Needs you | |

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

## Uploading with fastlane

The repo has the metadata and screenshots in fastlane's layout, but no `Fastfile` or `Appfile`, and fastlane isn't installed. It could upload the texts and images, saving the per-language pasting. I haven't run it.

To set it up, you'd need:

- **App Store:** an App Store Connect API key (Users and Access → Integrations): the issuer ID, key ID and `.p8` file, with the App Manager role.
- **Google Play:** a Google Cloud service account JSON key, invited in Play Console with permission to edit listings.
- **On the machine:** Ruby and `gem install fastlane`.

Keep the keys in files git ignores, never in chat. The commands would be `fastlane deliver --skip_binary_upload --submit_for_review false --automatic_release false` and `fastlane supply --metadata_path fastlane/metadata/android --skip_upload_aab`. `fastlane/metadata/` also holds `android/` and `review/`, so `deliver` may need `--ignore_language_directory_validation`. Try it on one language first.

Builds, the App Privacy form, Data safety and the production application stay manual either way.
