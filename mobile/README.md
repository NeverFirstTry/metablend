# MetaBlend app (Capacitor shell)

The native iOS / Android shell around https://metablend.app — see
`docs/superpowers/specs/2026-09-30-hiking-app-design.md` (phase 3). It loads
the live site and appends `MetaBlendApp` to its user agent; the site then
shows the app chrome (bottom tab bar Forecast · Hiking · More, safe areas)
and unlocks the app-only hiking section. `www/index.html` is the offline
screen. Native plugins: App (Android back button), Geolocation ("Near me"),
Share, Haptics; SystemBars (core) styles the status bar and provides
safe-area insets.

Capacitor docs call `server.url` "intended for live reload" — loading the
live site is a deliberate choice (website updates reach the app without a
store release); only native changes need a new build.

## Android (Windows)
1. Install Android Studio (it brings Java, the Android SDK and an emulator).
2. `cd mobile && npm install && npx cap sync android`
3. `npx cap open android` → Run ▶ on the emulator or a USB phone.

## iOS (MacBook)
1. Install Xcode from the App Store (and `xcode-select --install`).
2. `git pull && cd mobile && npm install && npx cap sync ios` (the iOS project
   uses Swift Package Manager — no CocoaPods needed).
3. `npx cap open ios` → pick a simulator → Run ▶.

## Device checklist
- [ ] The app opens metablend.app with the tab bar at the bottom; nothing sits under the status bar or the gesture bar / home indicator.
- [ ] Tabs switch between Forecast, Hiking and More; the active tab is green; a tap gives a light haptic tick (phones with haptics).
- [ ] Hiking shows the full app view (search, popular peaks), not the "lives in the app" teaser.
- [ ] "Near me" asks for location once and then sorts the popular peaks by distance; denying it changes nothing and doesn't crash.
- [ ] Share on the forecast opens the native share sheet.
- [ ] Android back button goes back; on the first screen it closes the app.
- [ ] More: switching °C/°F, dark/light and the language applies everywhere.
- [ ] Airplane mode at launch shows the "No connection" screen; Retry loads the app once online.

## Push notifications

One-time setup (owner — keys never go through chat):
1. Firebase console → new project → add Android app `app.metablend` → download
   `google-services.json` into `mobile/android/app/`.
2. Firebase → Project settings → Service accounts → Generate new private key.
   From the downloaded JSON, copy three values into Vercel env (Production) —
   Vercel's form takes `NAME=value` lines, so this pastes in one go:
   ```
   FIREBASE_PROJECT_ID=<project_id>
   FIREBASE_CLIENT_EMAIL=<client_email>
   FIREBASE_PRIVATE_KEY="<private_key, exactly as in the file, 
 and all>"
   ```
   (`private_key_id` isn't needed. The whole JSON in `FIREBASE_SERVICE_ACCOUNT`
   still works too.)
3. Apple Developer → Certificates, IDs & Profiles → Keys → + → Apple Push
   Notifications service (APNs), environment **Sandbox & Production** (Xcode
   builds use the sandbox, App Store builds production) → download the .p8
   once. Vercel env:
   `APNS_KEY` (the file's contents), `APNS_KEY_ID` (the key's ID),
   `APNS_TEAM_ID` (Membership → Team ID). Redeploy.
4. Xcode (Mac): `git pull && cd mobile && npm install && npx cap sync ios`,
   open the project, target App → Signing & Capabilities → + Capability →
   Push Notifications.

Check on a device / emulator / simulator:
- [ ] More → Notifications → Turn on → the system asks → Allow.
- [ ] "Send a test notification" arrives within seconds.
- [ ] Tapping it opens the app on More.
- [ ] Home city shows the city you look at most; Change → pick another → saved.
- [ ] A peak → Plan a hike → Tomorrow → shows up under Hike alerts.
- [ ] Android: Settings → Apps → MetaBlend → Notifications lists Weather
      alerts, Morning briefing, Hike alerts (in the app's language).
- [ ] Android: the status bar shows the white sun-and-cloud icon, not a grey
      square.
- [ ] With the phone set to German (or another non-English language): turn on,
      restart the app twice — More still shows the alerts in that language and
      the home city unchanged.
- [ ] Open another city, then tap a weather alert (or a dry-run briefing) —
      the app switches to the alert's city.
- [ ] Android 12 or older (emulator image): no registration before "Turn on";
      the soft prompt still appears after 3 forecasts.

Build order matters: without `google-services.json` in `android/app/`, tapping
"Turn on" on Android crashes the app (Firebase isn't initialised). An Android
emulator only gets pushes with a "Google Play" system image (Device Manager
shows the Play Store logo next to it).

## Home-screen widgets

Build order: the website side is live with the deploy; the widgets need a
new app build (Android Studio ▶ Run / Xcode ▶ Run). Open the app once after
installing — it hands the widgets their settings.

Check on a device / emulator / simulator:
- [ ] Add "Weather" small: city, temperature, icon, condition, ↑/↓ — same temperature as the app.
- [ ] Resize / add medium: the next 6 hours; settings → Show: Next days → 5 days.
- [ ] Settings → City: the home city and the recent cities are listed; pick another → it shows that city.
- [ ] Two weather widgets with two different cities side by side.
- [ ] Style: System → plain background in light and dark mode; Living sky → the app's sky.
- [ ] "Next hike" with a hike planned for tomorrow → summit window (green) or "No safe window"; without a plan → "Plan a hike in the app".
- [ ] Tap a weather widget → the app opens on that city; tap the hike widget → that peak.
- [ ] Airplane mode, wait for a refresh → the last data stays with its time.
- [ ] App language German + °F → widgets follow after leaving the app.
- [ ] iOS: tinted / clear home screen (long-press home screen → Edit → Customize) → readable, no sky.
- [ ] Android: `adb shell am start -a android.intent.action.VIEW -d "metablend://open?path=%2Fmore"` → the app opens on More.

## Routes (hiking v2)

New app build needed (the route screens ship with the website, Plan a hike on
a route and the alert tap need the app).

- [ ] Großglockner → Routes lists "Alter Kalser Weg 712" (there and back); opening it shows the map, the profile and a suggestion or "No safe start".
- [ ] Pace Slow / Fast changes the walking time and the suggestion; another day re-checks.
- [ ] Own start time (15-min steps) moves the stages; "Use the suggestion" goes back.
- [ ] Hiking → Import GPX with a Komoot / Outdooractive / Strava file opens it and lists it under My routes; a file without elevations still shows a climb.
- [ ] A broken / huge file shows the message, nothing crashes.
- [ ] Plan this hike on a route (pace Slow) → the route appears under My routes; More → Notifications lists the plan by the route's name.
- [ ] The evening before at 18:00 the alert reads "Start by … — summit ~…"; tapping it opens the route.

## Store release (testers first)

Everything you paste or upload is in the repo: listings in
`fastlane/metadata/`, screenshots in `fastlane/screenshots/` (iPhone) and
`fastlane/metadata/android/<locale>/images/` (Android), form answers in
`store/compliance.md`.

### Google Play — closed test (needed before public release)

- [ ] Sign up at play.google.com/console — personal account, $25 once, ID check (can take a few days).
- [ ] **Create app**: name MetaBlend, app, free, default language English (United States).
- [ ] **Upload key** (once, keep it forever — losing it means a key reset through Google support). In `mobile/android/`:
      `keytool -genkeypair -v -keystore metablend-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`
- [ ] Create `mobile/android/keystore.properties` (git ignores it):
      ```
      storeFile=metablend-upload.jks
      storePassword=…
      keyAlias=upload
      keyPassword=…
      ```
      Back up the `.jks` file and both passwords outside the repo (password manager).
- [ ] Android Studio → Build → Generate Signed App Bundle or APK → Android App Bundle → release → `mobile/android/app/release/app-release.aab`.
- [ ] Play Console → Test and release → Testing → **Closed testing** → create a track → upload the `.aab` (accept Play App Signing).
- [ ] **Store listing** (Grow → Store presence → Main store listing): paste `title`, `short_description`, `full_description` from `fastlane/metadata/android/en-US/`; app icon `images/icon.png`; feature graphic `images/featureGraphic.png`; phone screenshots `images/phoneScreenshots/1–5.png`. Then Translations → add the other 12 languages from their folders.
- [ ] **App content** (Policy → App content), answers in `store/compliance.md`: privacy policy https://metablend.app/privacy, app access, ads, content rating, target audience, data safety.
- [ ] Testers: create a Google Group (groups.google.com, anyone can join) and add it to the closed test; send for review.
- [ ] Put the group link and the opt-in link (https://play.google.com/apps/testing/app.metablend) into `lib/testers.js` — or send them to Claude — and share **metablend.app/testers**.
- [ ] Keep 12+ testers opted in for 14 days in a row, then Dashboard → **Apply for production**.

### Apple — TestFlight

- [ ] App Store Connect → Apps → + → New App: iOS, name **MetaBlend** (if taken: "MetaBlend Weather"), primary language English (U.S.), bundle ID `app.metablend`, SKU `metablend`.
- [ ] Xcode: scheme App, destination Any iOS Device → Product → Archive → Distribute App → App Store Connect → Upload.
- [ ] TestFlight → **Internal testing**: add yourself and up to 100 App Store Connect users — installs at once, no review.
- [ ] **External testing** (friends without an Apple developer role): Test Information from `fastlane/metadata/review/` (beta description, what to test, feedback email) → submit for Beta App Review → share the public link.
- [ ] Put the TestFlight public link into `lib/testers.js` (`testflight`) so metablend.app/testers shows it.
- [ ] For the later public release: App Store tab → listing from `fastlane/metadata/<locale>/`, screenshots from `fastlane/screenshots/<locale>/`, App Privacy from `store/compliance.md`, then Submit for Review.

### Every later update

- [ ] Raise `versionCode` (+1) and `versionName` in `mobile/android/app/build.gradle`, and Version + Build in Xcode (target App → General).
- [ ] Screens changed? Regenerate screenshots: `npx next build`, `npx next start -p 3123`, then `node scripts/store-shots.mjs`.
- [ ] Changelog: `fastlane/metadata/android/<locale>/changelogs/<versionCode>.txt` and `release_notes.txt` for iOS.

## Accessibility (before ticking the App Store labels)

New app build needed: Larger Text uses the TextScale plugin, which lives in the app's own code (`AppDelegate.swift`, `TextScalePlugin.java`) — nothing to install, it ships with the build (version 1.0, build 2).

- [ ] iPhone: Settings → Accessibility → Display & Text Size → Larger Text → largest size: open MetaBlend — text is larger, nothing cut off on the forecast, a peak page and More; change the size while the app is open → it follows.
- [ ] Android: Settings → Display → Font size → largest: same check — back in the app the text has changed without the page reloading (you stay where you were).
- [ ] VoiceOver (iPhone: triple-click the side button if set up, or Settings → Accessibility → VoiceOver): search a city and hear the forecast, the chart summary and an hour card as one sentence; open Hiking → a peak → its summit window and a route; plan a hike; change the language in More. Every button says what it does.
- [ ] TalkBack (Android): the same four tasks.
- [ ] Then App Store Connect → App Accessibility: tick VoiceOver, Larger Text, Dark Interface, Differentiate Without Color Alone, Sufficient Contrast, Reduced Motion (Voice Control if the VoiceOver walk went smoothly).
