// Which app icons the picker in More offers (pure — unit tested): the designs in
// scripts/brand/icons.mjs, Slate the default, Sky the icon until 2026-11-10. The
// same list on iPhone (each with its own dark and tinted look) and Android, where
// switching can take the app off the home screen, so it asks first.
const ICONS = ['slate', 'glow', 'gold', 'light', 'butter', 'summit', 'weather', 'dots', 'mono', 'winter', 'sky']
const PLATFORMS = ['ios', 'android']

// The icons this build of the app can switch to: the ones its native code lists. The pages come from the
// website, so they also reach builds from before 2026-11-10, which list none (they knew Automatic, Light,
// Dark and Sky): those get no picker until they update.
export const iconChoices = (platform, offered) =>
  PLATFORMS.includes(platform) && Array.isArray(offered) ? ICONS.filter(id => offered.includes(id)) : []

// what the phone reports, else the default
export function selectedIcon(platform, name, offered) {
  const choices = iconChoices(platform, offered)
  return choices.includes(name) ? name : choices[0] ?? null
}

export const switchNeedsWarning = platform => platform === 'android'
