// Great-circle distance in km (mean Earth radius).
export function haversineKm(lat1, lon1, lat2, lon2) {
  const rad = d => (d * Math.PI) / 180
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(a))
}

// Where a search came from (a located phone, a picked suggestion), to one
// decimal — about 10 km: enough to tell same-name towns apart, and few CDN
// cache keys. parseNear: the server's side, null for anything else.
const r1 = v => Math.round(v * 10) / 10
export const nearParam = (lat, lon) => `${r1(lat)},${r1(lon)}`
export function parseNear(value) {
  const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(value ?? '')
  if (!m) return null
  const lat = r1(Number(m[1])), lon = r1(Number(m[2]))
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null
}
