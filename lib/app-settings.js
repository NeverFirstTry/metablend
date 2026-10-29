// More → Notifications → "Open settings" (the decision is pure — unit
// tested). iOS opens the app's page in Settings by its URL; Android needs the
// app's own AppSettings plugin (app builds from 2026-10-29: notification
// settings, else the app details screen) — a link from the web view can't
// open system settings there (a tester's report, Android 15). An older
// Android build gets no button, only the path spelled out.
export function settingsRoute(cap) {
  const p = cap?.getPlatform?.()
  if (p === 'ios') return 'ios'
  if (p === 'android' && cap.isPluginAvailable?.('AppSettings')) return 'android'
  return null
}

export const canOpenSettings = () => typeof window !== 'undefined' && settingsRoute(window.Capacitor) !== null

export async function openSettings() {
  try {
    const route = settingsRoute(window.Capacitor)
    if (route === 'ios') {
      await (await import('@capacitor/app-launcher')).AppLauncher.openUrl({ url: 'app-settings:' })
      return true
    }
    if (route === 'android') {
      const { registerPlugin } = await import('@capacitor/core')
      await registerPlugin('AppSettings').openNotifications() // the proxy is used at once, never resolved from a promise
      return true
    }
  } catch { /* nothing opened: the path stays on screen */ }
  return false
}
