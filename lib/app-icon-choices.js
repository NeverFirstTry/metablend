// Which app icons the picker in More offers (pure — unit tested). iPhone:
// Automatic (follows light / dark / tinted) plus the three fixed icons.
// Android has no dark-mode app icons, so Sky is its default and there is no
// Automatic; switching there can take the app off the home screen, so it
// asks first.
const BY_PLATFORM = { ios: ['auto', 'light', 'dark', 'sky'], android: ['sky', 'light', 'dark'] }

export const iconChoices = platform => BY_PLATFORM[platform] ?? []

export function selectedIcon(platform, name) {
  const choices = iconChoices(platform)
  return choices.includes(name) ? name : choices[0] ?? null
}

export const switchNeedsWarning = platform => platform === 'android'
