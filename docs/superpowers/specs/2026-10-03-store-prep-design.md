# Store prep (phase 5) — design

Approved in chat 2026-10-03. Third of the queued sub-projects (more
mountains and more languages shipped).

## Goal

Everything needed to put MetaBlend in front of testers on both stores —
TestFlight (iPhone) and a Google Play closed test — with the listing texts,
screenshots and compliance answers ready for the public release that
follows. The owner does what only an account holder can do; everything else
is in the repo.

Owner's choices: testers first; no Play developer account yet (personal
account → closed test with ≥ 12 testers for 14 days before production);
captioned screenshots; fastlane folder layout.

## Store facts this design relies on

- Apple: TestFlight internal testers need no review; external testers need a
  short Beta App Review (description, feedback email, privacy policy URL).
  No tester minimum. Screenshots are needed only for the App Store listing.
- Google: a closed test needs a complete store listing (icon 512 × 512,
  feature graphic 1024 × 500, ≥ 2 phone screenshots, short + full
  description), content rating, target audience, Data safety, privacy policy
  URL, ads declaration, app access. New personal accounts: ≥ 12 testers
  opted in for 14 days, then a production application.
- App Store Connect has no Slovenian listing language; Play has (`sl`).

## Parts

### 1. Listing texts — `fastlane/metadata/`

fastlane layout, so the owner can paste by hand now and upload with
`fastlane deliver` / `fastlane supply` later.

- iOS: `fastlane/metadata/<locale>/` with `name.txt` (≤ 30), `subtitle.txt`
  (≤ 30), `promotional_text.txt` (≤ 170), `description.txt` (≤ 4000),
  `keywords.txt` (≤ 100, comma separated), `release_notes.txt`,
  `privacy_url.txt`, `support_url.txt`, `marketing_url.txt`. Locales:
  `en-US`, `de-DE`, `fr-FR`, `es-ES`, `it`, `nl-NL`, `pl`, `cs`, `pt-BR`,
  `ja`, `zh-Hans`, `ko` (12; Slovenian iPhone users see English).
- Android: `fastlane/metadata/android/<locale>/` with `title.txt` (≤ 30),
  `short_description.txt` (≤ 80), `full_description.txt` (≤ 4000),
  `changelogs/1.txt` (≤ 500). Locales: `en-US`, `de-DE`, `fr-FR`, `es-ES`,
  `it-IT`, `nl-NL`, `pl-PL`, `cs-CZ`, `sl`, `pt-BR`, `ja-JP`, `zh-CN`,
  `ko-KR` (13).
- `fastlane/metadata/review/` (not uploaded): TestFlight "what to test",
  beta description, feedback email (info@metablend.app).
- Content: what MetaBlend is (consensus of up to 16 sources, learns which to
  trust), summit forecasts and routes, widgets, notifications, 13
  languages, no account, free. Same facts in every language; the privacy
  URL is https://metablend.app/privacy, support and marketing
  https://metablend.app.
- A test checks every file exists for every locale and every length limit.

### 2. Captioned screenshots — `scripts/store-shots.mjs`

- Five screens: forecast (a city), outlook (week), hiking list (Near you +
  regions), a summit window (Großglockner), a route (712 on Großglockner).
- Each image: the sky background, a short caption on top, the real app
  screen below with rounded corners. Captions per screen per language in
  `store/captions.json` (13 languages × 5).
- Sizes: iPhone 6.9″ 1290 × 2796 (`fastlane/screenshots/<ios-locale>/`),
  Android phone 1080 × 1920 (`fastlane/metadata/android/<locale>/images/phoneScreenshots/`).
  Plus the Play feature graphic 1024 × 500 and the 512 × 512 Play icon
  (from the existing brand generator output).
- The script drives a local production build in headless Edge (as the
  visual checks do), renders the app screen at the device's CSS size and
  pixel ratio, then renders the caption template around it. Re-running
  regenerates every language.
- Weather on the shots is live (whatever the forecast says that day).

### 3. Compliance answers — `store/compliance.md`

Copy-paste answers, consistent with the privacy notice:
- Apple App Privacy: coarse location (peak search), device ID (push token),
  other user content (weather feedback), product interaction (Plausible,
  no cookies), performance data (Speed Insights) — all "app
  functionality/analytics", not linked to identity, no tracking.
- Google Data safety: the same data types; encrypted in transit; no sharing
  (service providers only); deletion on request; no account.
- Content rating (IARC): no objectionable content, no user-to-user
  communication → lowest rating. Ads: none. Target audience: 13+.
  App access: no login.
- Export compliance: only standard HTTPS → exempt.

### 4. Project changes

- iOS: `ITSAppUsesNonExemptEncryption = NO` in `App/Info.plist`;
  `TARGETED_DEVICE_FAMILY = 1` (iPhone only; iPads run the iPhone version).
- Android: a `release` signing config reading
  `mobile/android/keystore.properties` (git-ignored: storeFile,
  storePassword, keyAlias, keyPassword); without the file the release
  build stays unsigned as today. `keystore.properties` and `*.jks` in
  `.gitignore`.
- Versions stay 1.0 (1); the checklist says where to raise them.

### 5. Owner checklist — `mobile/README.md` "Store release"

Play: sign up ($25, ID check) → create the app → keystore (exact
`keytool` command) → `keystore.properties` → build the signed AAB in
Android Studio → upload to a closed test → paste the listing / Data safety
/ rating from the repo → invite 12+ testers (Google group or emails) → after
14 days, apply for production.
Apple: App Store Connect → new app (bundle `app.metablend`) → archive and
upload from Xcode → internal testers at once; external testers after the
beta review → paste listing and App Privacy for the later public
submission.

## Tests

- Metadata: every locale has every file, within its length limit, no
  placeholder text.
- Compliance and captions: `captions.json` has all 13 languages × 5.
- Screenshots: the script checks each output's pixel size; a dry run in one
  language is part of the verification.

## Out of scope

Uploading anything (owner); fastlane API keys and lanes; iPad layouts;
store badges on the website (after the public release); paid features.
