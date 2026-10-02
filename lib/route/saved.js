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
