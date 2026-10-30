// Our own summits, huts and towns (supabase/places.sql, loaded by
// scripts/places) — the first source for the Hiking search, "Near you" and
// "around a town". ready() is false until the tables exist and hold data;
// every query answers null when the database can't (the caller falls back to
// the outside services, as before). Unit tested with a fake client.
const READY_MS = 10 * 60e3

const shape = r => ({
  id: r.id, name: r.name, names: r.names ?? null, lat: r.lat, lon: r.lon, elev: r.ele, kind: r.kind,
  country: r.country, region: r.region, ...(r.notability ? { notability: r.notability } : {}), ...(r.km != null ? { km: r.km } : {}),
})

export function makePlaces(db, { now = Date.now } = {}) {
  let readyUntil = 0, readyValue = false
  const call = async (fn, args) => {
    try {
      const { data, error } = await db.rpc(fn, args)
      return error ? null : data
    } catch {
      return null
    }
  }
  const rows = async (fn, args) => (await call(fn, args))?.map(shape) ?? null
  return {
    async ready() {
      if (now() < readyUntil) return readyValue
      try {
        const { data, error } = await db.from('summits').select('id').limit(1)
        readyValue = !error && data?.length > 0
      } catch {
        readyValue = false
      }
      readyUntil = now() + READY_MS
      return readyValue
    },
    search: (q, bias) => rows('places_search', { q, near_lat: bias?.lat ?? null, near_lon: bias?.lon ?? null, lim: 10 }),
    towns: q => call('towns_search', { q, lim: 3 }),
    near: (lat, lon, km = 25, lim = 12) => rows('summits_near', { lat, lon, radius_km: km, lim }),
    pool: (lat, lon) => rows('summits_pool', { lat, lon }),
  }
}
