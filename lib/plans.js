// Planned hikes as the server keeps them for this phone (GET /api/push/plans), read once per app run and kept
// in memory, so the Hiking tab and the peak show them without asking again (UX review N2). Only with
// notifications on: without them the phone has no device on the server, so nothing can be planned and nothing
// is asked. Pure: the permission check and the API call come in (lib/plans-client.js wires the real ones).
export function makePlansStore({ permission, api }) {
  let known = null, asking = null
  const subs = new Set()
  const tell = () => subs.forEach(f => f(known))
  const set = list => { known = list; tell() }
  const byDate = list => [...list].sort((a, b) => a.date.localeCompare(b.date))
  return {
    get: () => known,
    set,
    subscribe(f) { subs.add(f); return () => subs.delete(f) },
    load() {
      if (known) return Promise.resolve(known)
      asking ??= (async () => {
        try {
          if ((await permission()) !== 'granted') return []
          const r = await api('plans')
          return r.status === 200 && Array.isArray(r.json?.plans) ? byDate(r.json.plans) : []
        } catch {
          return [] // offline: the plans show at the next start
        }
      })().then(list => { asking = null; if (!known) set(list); return known })
      return asking
    },
    add(plan) { set(byDate([...(known ?? []), plan])) },
    async cancel(id) {
      const r = await api(`plans?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => ({ status: 0 }))
      if (r.status !== 200) return false
      set((known ?? []).filter(p => p.id !== id))
      return true
    },
  }
}

const near = (a, b) => Math.abs(a - b) < 1e-4
// a peak's own plans (no route), or one route's on it, matched by its name as the plan keeps it (80 characters)
export const plansAt = (list, { lat, lon }, routeName = null) => (list ?? []).filter(p =>
  near(p.lat, lat) && near(p.lon, lon) && (routeName ? p.route_name === routeName.slice(0, 80) : !p.route_name))
// the server keeps yesterday's (UTC) too; the phone shows today's and later ones
export const upcoming = (list, todayLocal) => (list ?? []).filter(p => p.date >= todayLocal)
