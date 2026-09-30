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
