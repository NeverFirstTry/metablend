// What of a failed request's URL goes into error_log (pure — unit tested).
// `near` is the phone's own position (rounded to 0.1°), so it is dropped;
// other coordinates (a peak, a city, the "near you" cell) are kept to one
// decimal, about 10 km. The log keeps a row for 14 days (/api/cleanup).
const POSITION = ['near']
const COORDS = ['lat', 'lon']

export function loggedUrl(url) {
  let u
  try { u = new URL(url) } catch { return null }
  for (const k of POSITION) u.searchParams.delete(k)
  for (const k of COORDS) {
    if (!u.searchParams.has(k)) continue
    const v = Number(u.searchParams.get(k))
    u.searchParams.set(k, Number.isFinite(v) ? v.toFixed(1) : '')
  }
  return u.toString()
}
