// Hike plans kept only on the phone (owner, 2026-11-22): planned without notifications, so the server has no device
// to keep them for. Native Preferences like the saved routes; in a browser with ?app=1 (testing) localStorage.
// They feed the Mountains tab and the "Next hike" widget (lib/plans.js, lib/app-widget-client.js). Never throws.
import { isNative } from './native'
import { loadPlugin } from './capacitor-plugin'

const KEY = 'mb_local_plans'
const prefs = () => loadPlugin(() => import('@capacitor/preferences'), 'Preferences')

export async function readLocalPlans() {
  try {
    const raw = isNative() ? (await (await prefs()).plugin.get({ key: KEY })).value : localStorage.getItem(KEY)
    const v = JSON.parse(raw ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export async function writeLocalPlans(list) {
  try {
    const value = JSON.stringify(list)
    if (isNative()) await (await prefs()).plugin.set({ key: KEY, value })
    else localStorage.setItem(KEY, value)
  } catch { /* storage full or blocked: the plan shows until the app closes */ }
  return list
}
