# MetaBlend app (Capacitor shell)

The native iOS / Android shell around https://metablend.app — see
`docs/superpowers/specs/2026-09-30-hiking-app-design.md` (phase 3). It loads
the live site and appends `MetaBlendApp` to its user agent, which unlocks the
app-only hiking section at `/hike`. `www/index.html` is the offline screen.

## Android (Windows)
1. Install Android Studio (with an Android SDK and an emulator).
2. `cd mobile && npm install && npx cap sync android`
3. `npx cap open android` → Run ▶ on the emulator or a USB phone.

## iOS (MacBook)
1. Install Xcode from the App Store (and `xcode-select --install`).
2. `git pull && cd mobile && npm install && npx cap add ios && npx cap sync ios`
3. `npx cap open ios` → pick a simulator → Run ▶.

Still to do in phase 3 (plan pending): native plugins (push, location, share,
haptics, status bar, splash), the in-app tab bar, app icons.
