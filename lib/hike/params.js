// Query parsing for the hiking routes (pure — unit tested).

const numIn = (v, lo, hi) => {
  if (v == null || v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null
}

// { name, lat, lon, elev }, rounded (3 decimals ≈ 100 m) so equal peaks share
// one cache entry — or null when a coordinate or the height is missing, junk
// or out of range.
export function parsePeakQuery(sp) {
  const lat = numIn(sp.get('lat'), -90, 90), lon = numIn(sp.get('lon'), -180, 180), elev = numIn(sp.get('elev'), 0, 9000)
  if (lat == null || lon == null || elev == null) return null
  const name = (sp.get('name') ?? '').trim().slice(0, 80) || null
  return { name, lat: Math.round(lat * 1e3) / 1e3, lon: Math.round(lon * 1e3) / 1e3, elev: Math.round(elev) }
}

// Search text of 2–80 characters plus an optional location bias (0.1°).
export function parseSearchQuery(sp) {
  const q = (sp.get('q') ?? '').trim()
  if (q.length < 2 || q.length > 80) return null
  const lat = numIn(sp.get('lat'), -90, 90), lon = numIn(sp.get('lon'), -180, 180)
  return { q, bias: lat != null && lon != null ? { lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10 } : null }
}

// The one canonical /api/hike URL for a peak — teaser and app send exactly
// this, so every viewer of a peak shares one CDN entry.
export function hikeApiPath(p) {
  return `/api/hike?lat=${Math.round(p.lat * 1e3) / 1e3}&lon=${Math.round(p.lon * 1e3) / 1e3}&elev=${Math.round(p.elev)}&name=${encodeURIComponent(p.name)}`
}

// The peak a /hike URL points at: ?peak=<featured id> or
// ?lat=&lon=&elev=&name=[&cc=&approx=1]; null for anything else.
export function peakFromParams(sp, featured) {
  const id = sp.get('peak')
  if (id) return featured.find(p => p.id === id) ?? null
  const q = parsePeakQuery(sp)
  if (!q) return null
  return {
    id: `q-${q.lat},${q.lon}`, name: q.name ?? '', lat: q.lat, lon: q.lon, elev: q.elev,
    country: sp.get('cc') || null, elevApprox: sp.get('approx') === '1',
  }
}

// Link to a peak's page: featured peaks by id, search hits by coordinates.
export function peakHref(p, featuredIds) {
  if (featuredIds.has(p.id)) return `/hike?peak=${p.id}`
  const extra = `${p.country ? `&cc=${p.country}` : ''}${p.elevApprox ? '&approx=1' : ''}`
  return `/hike?lat=${p.lat}&lon=${p.lon}&elev=${p.elev}&name=${encodeURIComponent(p.name)}${extra}`
}
