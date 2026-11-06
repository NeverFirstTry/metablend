// Great-circle distance in km (mean Earth radius).
export function haversineKm(lat1, lon1, lat2, lon2) {
  const rad = d => (d * Math.PI) / 180
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(a)))
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

// Where each place was found, by name (lowercase), as the phone remembers it:
// a new pick of the same name replaces the old one; the newest 20 are kept.
export function withNear(map, name, near, max = 20) {
  const key = name.trim().toLowerCase()
  const { [key]: _, ...rest } = map
  return Object.fromEntries([...Object.entries(rest), [key, near]].slice(-max))
}

// A name belongs to the language that gave it: "リエンツ" finds nothing in
// English, and "Wien" finds a town in Missouri. So the phone keeps each
// translated name's English one (the forecast's learnCity; a region added to
// tell same-name towns apart is left out, near keeps the town) and asks by it
// in any other language. shortcut: someone who saw "Vienne" in French, then
// types it in English without picking a suggestion, gets Vienna, not the French town
export function rememberName(map, name, english, lang) {
  const en = english?.split(',')[0].trim()
  if (!en || en.toLowerCase() === name.trim().toLowerCase()) return map
  return withNear(map, name, { en, lang })
}

export function askName(map, q, lang) {
  const known = map[q.trim().toLowerCase()]
  return known && known.lang !== lang ? known.en : q
}
