// Saved routes on the phone (native Preferences, like the device key); in a
// browser with ?app=1 (testing) localStorage instead. Never throws.
import { isNative } from './native'
import { loadPlugin } from './capacitor-plugin'
import { upsertRoute, needsHeights, applyHeights } from './route/saved.js'

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
// Saved routes without heights — saved while the terrain model refused them,
// or a GPX recorded without — get them from /api/route-heights, one route at
// a time in the background at app start (a route with heights is never asked
// again; one the terrain model refuses is tried at the next start). Merged by
// id into a fresh read, so a route saved or removed meanwhile is kept as it is.
export async function repairHeights() {
  const todo = (await read()).filter(needsHeights)
  if (!todo.length) return null
  const fills = new Map()
  for (const r of todo) {
    const json = await fetch('/api/route-heights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ points: r.points }) })
      .then(res => (res.ok ? res.json() : null), () => null)
    if (Array.isArray(json?.points)) fills.set(r.id, { from: r.points, to: json.points })
  }
  if (!fills.size) return null
  const { list, changed } = applyHeights(await read(), fills)
  return changed ? write(list) : null
}
// a hike was planned on this route: keep it (the alert opens it by id), marked
export async function keepPlanned(route) {
  const list = await read()
  const kept = list.some(r => r.id === route.id) ? list : upsertRoute(list, { ...route, savedAt: Date.now() })
  return write(kept.map(r => (r.id === route.id ? { ...r, planned: true } : r)))
}
