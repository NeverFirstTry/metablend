// Hands the home-screen widgets their settings through the app's native
// WidgetBridge (app only — a no-op on the website and in app builds without
// the bridge). The server part (home city + hike plans) is read at start and
// again when a screen changed it; views, language and unit are read fresh.
import { isNative } from './native'
import { pushApi, cityViews } from './push-client'
import { getCookie } from './prefs'
import { preferredLang } from './i18n'
import { widgetSettings, localToday } from './app-widget-sync'

let bridge = null // Capacitor plugin proxy: kept in a variable, never resolved from a promise
let lastSent = null
let server = null

async function send(json) {
  const { registerPlugin } = await import('@capacitor/core')
  bridge ??= registerPlugin('WidgetBridge')
  await bridge.sync({ json })
}

async function serverPart() {
  try {
    const r = await pushApi('settings')
    if (r.status === 200) return { home: r.json.settings?.home_name ?? null, plans: r.json.plans ?? [] }
    if (r.status === 404) return { home: null, plans: [] } // notifications never turned on
  } catch { /* offline */ }
  return null
}

export async function syncWidgets({ refresh = false } = {}) {
  if (!isNative()) return
  try {
    if (refresh || !server) server = (await serverPart()) ?? server
    const payload = widgetSettings({
      lang: preferredLang(getCookie('metablend_lang'), navigator.language),
      unit: getCookie('metablend_unit') === 'F' ? 'F' : 'C',
      home: server?.home ?? null,
      views: await cityViews(),
      plans: server?.plans ?? [],
      today: localToday(),
    })
    const json = JSON.stringify(payload)
    if (json === lastSent) return
    await send(json)
    lastSent = json
  } catch { /* an app build without the bridge — the widgets keep what they had */ }
}
