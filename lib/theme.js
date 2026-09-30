// Theme preference: 'system' (the default — follow the device's dark / light
// setting), 'dark' or 'light'. Stored in the `metablend_theme` cookie; the
// CSS keys off <html data-theme="light">, absence means dark.

export const THEME_COOKIE = 'metablend_theme'
const LIGHT_QUERY = '(prefers-color-scheme: light)'

// pure (unit tested): anything but an explicit choice means "follow the device"
export const readThemePref = value => (value === 'light' || value === 'dark' ? value : 'system')
export const resolveTheme = (pref, prefersLight) => (pref === 'system' ? (prefersLight ? 'light' : 'dark') : pref)

// Inline in the layout, before first paint: light users never see a dark flash.
export const THEME_BOOT_SCRIPT = `try{var c=(document.cookie.match(/(?:^|; *)${THEME_COOKIE}=(\\w+)/)||[])[1];if(c==='light'||(c!=='dark'&&matchMedia('${LIGHT_QUERY}').matches))document.documentElement.dataset.theme='light'}catch(e){}`

export const deviceMedia = () => (typeof matchMedia === 'function' ? matchMedia(LIGHT_QUERY) : null)

// Puts a preference on the page; returns the theme it shows.
export function applyTheme(pref) {
  const theme = resolveTheme(pref, !!deviceMedia()?.matches)
  if (theme === 'light') document.documentElement.dataset.theme = 'light'
  else delete document.documentElement.dataset.theme
  return theme
}
