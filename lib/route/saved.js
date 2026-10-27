import { hasHeights } from './heights.js'

// The phone's saved routes as a list (pure — unit tested): newest first, the
// same id replaces its old copy, past the limit the oldest route without a
// planned hike is dropped (planned ones stay, even over the limit).
export const MAX_ROUTES = 30

export function upsertRoute(list, route, max = MAX_ROUTES) {
  const out = [{ ...route, savedAt: route.savedAt ?? Date.now() }, ...(list ?? []).filter(x => x.id !== route.id)]
  while (out.length > max) {
    let k = -1
    for (let i = out.length - 1; i > 0; i--) if (!out[i].planned) { k = i; break }
    if (k < 0) break
    out.splice(k, 1)
  }
  return out
}

// Routes saved before the terrain heights were sure (or a GPX without them)
// are filled once on the phone (lib/route-store.js repairHeights).
const asPoints = list => list.map(([lat, lon, ele]) => ({ lat, lon, ele }))
const known = list => list.filter(p => typeof p[2] === 'number').length
export const needsHeights = route => Array.isArray(route?.points) && !hasHeights(asPoints(route.points))

// fills: Map id → { from: the points sent, to: the points with heights }. A
// route changed or removed since it was read is left alone.
export function applyHeights(list, fills) {
  let changed = 0
  const out = list.map(r => {
    const f = fills.get(r.id)
    if (!f || JSON.stringify(r.points) !== JSON.stringify(f.from) || known(f.to) <= known(r.points)) return r
    changed++
    return { ...r, points: f.to }
  })
  return { list: changed ? out : list, changed }
}
