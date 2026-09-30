// Native features inside the Capacitor app. Plugin JS is dynamic-imported
// only when running natively, so web visitors never download it; every
// helper falls back quietly (false / null) when a call fails.
export function isNative(win = globalThis.window) {
  return !!win?.Capacitor?.isNativePlatform?.()
}

// A share error that only means "the user closed the sheet".
export const isShareCancel = err => /cancel/i.test(err?.message ?? '')

// true = the native sheet handled it (shared or cancelled); false = fall
// back (not in the app, plugin missing, chunk failed to load).
export async function nativeShare({ title, text, url }) {
  if (!isNative()) return false
  try {
    const { Share } = await import('@capacitor/share')
    await Share.share({ title, text, url })
    return true
  } catch (err) {
    return isShareCancel(err)
  }
}

// Status bar icons to match the page: light theme → dark icons.
export async function setStatusBarStyle(light) {
  if (!isNative()) return
  try {
    const { SystemBars, SystemBarsStyle } = await import('@capacitor/core')
    await SystemBars.setStyle({ style: light ? SystemBarsStyle.Light : SystemBarsStyle.Dark })
  } catch { /* older shell — keep the configured style */ }
}

export async function nativePosition() {
  if (!isNative()) return null
  try {
    const { Geolocation } = await import('@capacitor/geolocation')
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 })
    return { lat: p.coords.latitude, lon: p.coords.longitude }
  } catch {
    return null
  }
}

export async function tapHaptic() {
  if (!isNative()) return
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch { /* no haptics — fine */ }
}

// Android hardware back: go back in the web history, or leave the app on
// the first screen. Returns an unsubscribe function.
export async function onBackButton(handler) {
  if (!isNative()) return () => {}
  try {
    const { App } = await import('@capacitor/app')
    const sub = await App.addListener('backButton', ({ canGoBack }) => handler({ canGoBack, exit: () => App.exitApp() }))
    return () => sub.remove()
  } catch {
    return () => {}
  }
}
