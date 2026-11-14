// Store listings for the MetaBlend app. Off (the default): both null, and every place shows what it showed
// before the launch ("Coming soon", the beta note, the testers link).
// Launch day, 15 December 2026 (owner 2026-11-13), in Vercel and without a merge: set
// NEXT_PUBLIC_STORE_BADGES=on and NEXT_PUBLIC_APP_STORE_URL=<the App Store listing>, then redeploy (both are
// built into the pages). Until the App Store URL is set, only Google Play shows.
export const PLAY_URL = 'https://play.google.com/store/apps/details?id=app.metablend' // mobile/android/app/build.gradle applicationId

const on = process.env.NEXT_PUBLIC_STORE_BADGES === 'on'
export const STORES = {
  ios: on ? process.env.NEXT_PUBLIC_APP_STORE_URL || null : null, // placeholder: empty until the listing exists
  android: on ? PLAY_URL : null,
}
