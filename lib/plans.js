// Planned hikes, read once per app run and kept in memory, so the Mountains tab and the peak show them without
// asking again (UX review N2). Two kinds side by side: the server's for this phone (GET /api/push/plans, only with
// notifications on, they bring the alerts) and the ones kept only on the phone (planned without notifications, owner
// 2026-11-22: they show in the tab and the "Next hike" widget, no alerts). Pure: the permission check, the API call
// and the phone's storage come in (lib/plans-client.js wires the real ones).
// shortcut: at most 30 plans kept on the phone (the earliest days drop first); raise it if someone plans more.
const LOCAL_MAX = 30
const isLocal = id => typeof id === 'string' && id.startsWith('local-')

export function makePlansStore({ permission, api, local = { read: async () => [], write: async list => list } }) {
  let known = null, asking = null, alerts = false
  const subs = new Set()
  const tell = () => subs.forEach(f => f(known))
  const set = list => { known = list; tell() }
  const byDate = list => [...list].sort((a, b) => a.date.localeCompare(b.date))
  const keepLocal = () => local.write((known ?? []).filter(p => p.local))
  return {
    get: () => known,
    set,
    subscribe(f) { subs.add(f); return () => subs.delete(f) },
    // whether the server knows this phone, so plans get their alerts (false until it answered)
    alertsOn: () => alerts,
    load() {
      if (known) return Promise.resolve(known)
      asking ??= (async () => {
        const mine = await local.read().catch(() => [])
        let theirs = []
        try {
          if ((await permission()) === 'granted') {
            const r = await api('plans')
            if (r.status === 200 && Array.isArray(r.json?.plans)) { theirs = r.json.plans; alerts = true }
          }
        } catch { /* offline: the server's plans show at the next start, the phone's at once */ }
        return byDate([...theirs, ...mine])
      })().then(list => { asking = null; if (!known) set(list); return known })
      return asking
    },
    add(plan) { alerts = true; set(byDate([...(known ?? []), plan])) },
    // a plan without notifications: kept on the phone with what the server would need later (promote)
    async addLocal(body) {
      const plan = { id: `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, local: true, name: body.name, lat: body.lat, lon: body.lon, elev: body.elev ?? null, date: body.date, route_name: body.route?.name ?? null, body }
      const others = (known ?? []).filter(p => !p.local), mine = byDate([...(known ?? []).filter(p => p.local), plan]).slice(-LOCAL_MAX)
      set(byDate([...others, ...mine]))
      await keepLocal()
      return plan
    },
    async cancel(id) {
      if (isLocal(id)) { set((known ?? []).filter(p => p.id !== id)); await keepLocal(); return true }
      const r = await api(`plans?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => ({ status: 0 }))
      if (r.status !== 200) return false
      set((known ?? []).filter(p => p.id !== id))
      return true
    },
    // notifications just turned on: the phone's plans go to the server, so they get their alerts; the count moved
    async promote() {
      alerts = true
      let moved = 0, list = [...(known ?? [])]
      for (const p of list.filter(x => x.local)) {
        const r = await api('plans', { method: 'POST', body: p.body }).catch(() => ({ status: 0 }))
        if (r.status === 200 && r.json?.plan) { list = list.map(x => (x.id === p.id ? r.json.plan : x)); moved++ }
      }
      set(byDate(list))
      await keepLocal()
      return moved
    },
  }
}

const near = (a, b) => Math.abs(a - b) < 1e-4
// a peak's own plans (no route), or one route's on it, matched by its name as the plan keeps it (80 characters)
export const plansAt = (list, { lat, lon }, routeName = null) => (list ?? []).filter(p =>
  near(p.lat, lat) && near(p.lon, lon) && (routeName ? p.route_name === routeName.slice(0, 80) : !p.route_name))
// the server keeps yesterday's (UTC) too; the phone shows today's and later ones
export const upcoming = (list, todayLocal) => (list ?? []).filter(p => p.date >= todayLocal)
