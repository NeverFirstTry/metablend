// Saved routes on the phone (native Preferences, like the device key); in a
// browser with ?app=1 (testing) localStorage instead. Never throws.
import { isNative } from './native'
import { loadPlugin } from './capacitor-plugin'
import { upsertRoute } from './route/saved.js'

const KEY = 'mb_routes'
const prefs = () => loadPlugin(() => import('@capacitor/preferences'), 'Preferences')

async function read() {
  try {
    const raw = isNative() ? (await (await prefs()).plugin.get({ key: KEY })).value : localStorage.getItem(KEY)
    const v = JSON.parse(raw ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

async function write(list) {
  try {
    const value = JSON.stringify(list)
    if (isNative()) await (await prefs()).plugin.set({ key: KEY, value })
    else localStorage.setItem(KEY, value)
  } catch { /* storage full or blocked: the route just isn't kept */ }
  return list
}

export const listRoutes = read
export const getRoute = async id => (await read()).find(r => r.id === id) ?? null
export const saveRoute = async route => write(upsertRoute(await read(), route))
export const removeRoute = async id => write((await read()).filter(r => r.id !== id))
export const markPlanned = async id => write((await read()).map(r => (r.id === id ? { ...r, planned: true } : r)))
