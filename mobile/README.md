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
      alerts, Morning briefing, Hike alerts.
- [ ] With the phone set to German (or another non-English language): turn on,
      restart the app twice — More still shows the alerts in that language and
      the home city unchanged.
- [ ] Open another city, then tap a weather alert (or a dry-run briefing) —
      the app switches to the alert's city.
- [ ] Android 12 or older (emulator image): no registration before "Turn on";
      the soft prompt still appears after 3 forecasts.

Build order matters: without `google-services.json` in `android/app/`, tapping
"Turn on" on Android crashes the app (Firebase isn't initialised).
