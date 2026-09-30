// Summit heights (pure — unit tested): OpenStreetMap's surveyed `ele` tag
// first, the 90 m terrain model only as the fallback — the terrain model
// reads sharp summits 50–200 m low (Großglockner 3617 m instead of 3798 m).

// '2076', '2076 m', '2076.5', '2076,5', '6800 ft' → metres; anything else → null.
export function parseEle(v) {
  if (typeof v !== 'string') return null
  const m = v.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*(m|ft|feet)?$/i)
  if (!m) return null
  let n = Number(m[1].replace(',', '.'))
  if (/^f/i.test(m[2] ?? '')) n *= 0.3048
  return n >= 0 && n <= 9000 ? Math.round(n) : null
}

// OpenStreetMap elements (the API and Overpass answer in the same shape) →
// { N123: 2076, … } for elements with a usable height.
export function parseOverpassEle(json) {
  if (!Array.isArray(json?.elements)) return null
  const out = {}
  for (const e of json.elements) {
    const ele = parseEle(e?.tags?.ele)
    if (ele != null && typeof e.type === 'string' && e.id != null) out[`${e.type[0].toUpperCase()}${e.id}`] = ele
  }
  return out
}

// The elevation API's heights, aligned with the points asked for — or null.
export function parseElevations(json, n) {
  const a = json?.elevation
  if (!Array.isArray(a) || a.length !== n) return null
  return a.map(v => (typeof v === 'number' && Number.isFinite(v) ? v : null))
}

const OSM_ID = /^osm-([NWR])(\d+)$/
const osmKey = p => OSM_ID.exec(p.id)?.slice(1).join('') ?? null

// [['node', ['1', '3']], ['way', ['2']]] — the OpenStreetMap hits by type.
function osmIdsByType(peaks) {
  const ids = { node: [], way: [], relation: [] }
  const type = { N: 'node', W: 'way', R: 'relation' }
  for (const p of peaks) {
    const m = OSM_ID.exec(p.id)
    if (m) ids[type[m[1]]].push(m[2])
  }
  return Object.entries(ids).filter(([, a]) => a.length)
}

// The OpenStreetMap API's multi-fetch URLs (one per element type) — a plain
// lookup by id, the primary source for heights.
export function osmApiUrls(peaks) {
  return osmIdsByType(peaks).map(([t, a]) => `https://api.openstreetmap.org/api/0.6/${t}s.json?${t}s=${a.join(',')}`)
}

// One Overpass request for the same tags (the backup), or null when none of
// the hits came from OpenStreetMap.
export function overpassQuery(peaks) {
  const parts = osmIdsByType(peaks).map(([t, a]) => `${t}(id:${a.join(',')});`)
  return parts.length ? `[out:json][timeout:8];(${parts.join('')});out tags;` : null
}

// Heights for search hits, best source first: OpenStreetMap, then the
// terrain model (flagged elevApprox) only for hits OSM had no height for.
// osmEle(peaks) → { N123: m } | null; demEle(peaks) → (number|null)[] | null.
export async function resolveHeights(found, { osmEle, demEle }) {
  const osm = found.length ? await osmEle(found) : {}
  const need = found.filter(p => p.elev == null && osm?.[osmKey(p)] == null)
  const dem = need.length ? await demEle(need) : []
  const demById = new Map(need.map((p, i) => [p.id, dem?.[i]]))
  const peaks = found.map(p => {
    if (p.elev != null) return p
    const o = osm?.[osmKey(p)]
    if (o != null) return { ...p, elev: o }
    const d = demById.get(p.id)
    return typeof d === 'number' ? { ...p, elev: Math.round(d), elevApprox: true } : { ...p, elev: null }
  })
  return { peaks, osmDown: osm === null, demDown: need.length > 0 && dem === null }
}
