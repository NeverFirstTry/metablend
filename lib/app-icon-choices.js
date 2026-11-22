// Which app icons the picker in More offers (pure — unit tested): the designs in
// scripts/brand/icons.mjs, Slate the default, Sky the icon until 2026-11-10. The
// same list on iPhone (each with its own dark and tinted look) and Android, where
// switching can take the app off the home screen, so it asks first.
const ICONS = ['slate', 'glow', 'gold', 'light', 'butter', 'summit', 'weather', 'dots', 'mono', 'winter', 'sky']
const PLATFORMS = ['ios', 'android']

// Builds from before 2026-11-10 (TestFlight build 3, version 1.0) list no icons: they switch among the ones they
// were built with, under these names, which their native code still takes. A website change must never take a
// working feature from an older app build (owner, 2026-11-22; on 2026-11-10 such builds lost their picker).
const LEGACY = { ios: ['auto', 'light', 'dark', 'sky'], android: ['sky', 'light', 'dark'] }

// The icons this build of the app can switch to: the ones its native code lists, or an older build's own four.
// The pages come from the website, so they reach every app build in use at once.
export const iconChoices = (platform, offered) =>
  !PLATFORMS.includes(platform) ? [] : Array.isArray(offered) ? ICONS.filter(id => offered.includes(id)) : LEGACY[platform]

// What the picker shows for the plugin's answer (lib/app-icon.js currentIcon), or null for none (the website, no
// plugin, nothing to offer). legacy: an older build, whose previews are the icons as that build draws them.
export function pickerState(r) {
  if (!r?.platform) return null
  const choices = iconChoices(r.platform, r.icons)
  return choices.length ? { platform: r.platform, name: selectedIcon(r.platform, r.name, r.icons), choices, legacy: !Array.isArray(r.icons) } : null
}

// what the phone reports, else the default
export function selectedIcon(platform, name, offered) {
  const choices = iconChoices(platform, offered)
  return choices.includes(name) ? name : choices[0] ?? null
}

export const switchNeedsWarning = platform => platform === 'android'
