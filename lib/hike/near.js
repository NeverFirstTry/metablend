// "Near you" on the Hiking screen: the notable summits around a position
// (pure — unit tested; /api/peaks/near does the fetching). OpenStreetMap is
// full of small named hills, so it isn't the nearest ten — it's the notable
// summits around you, then the highest within reach, shown nearest first.
import { haversineKm } from '../geo.js'

const finite = v => typeof v === 'number' && Number.isFinite(v)

// A ~5 km grid: everyone in the same cell shares one cached answer.
export function nearCell(lat, lon) {
  if (!finite(lat) || !finite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  const snap = v => +(Math.round(v * 20) / 20).toFixed(2)
  return { lat: snap(lat), lon: snap(lon) }
}

// n points `km` away from the centre, evenly around it — where to sample
// OpenStreetMap so a dense area (50 summits within a few km) is covered out
// to the edge of the radius, not just around the centre.
export function ringPoints({ lat, lon }, km, n) {
  const R = 6371, d = km / R, la = lat * Math.PI / 180, lo = lon * Math.PI / 180
  return Array.from({ length: n }, (_, i) => {
    const b = (2 * Math.PI * i) / n
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b))
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2))
    return { lat: +(la2 * 180 / Math.PI).toFixed(4), lon: +(((lo2 * 180 / Math.PI + 540) % 360) - 180).toFixed(4) }
  })
}

// The list to show: featured peaks in range always (as themselves — their
// page, grade and region); then the summits OpenStreetMap marks as notable
// (a Wikipedia article, a Wikidata item, a summit cross — `notability`) that
// are at least as high as the middle of the summits around (not a bump on
// the valley floor), nearest first; then the highest of the rest, up to n.
// One per mountain: of tops within sepKm of each other only the most notable,
// then highest, counts — the rest are shoulders — so the list spreads across
// the area instead of naming one ridge ten times. All sorted by distance.
// Within radiusKm; where that holds fewer than minCount summits (flat
// country), within wideKm.
export function pickNearPeaks(found, featured, pos, { radiusKm = 20, wideKm = 50, n = 10, minCount = 3, sepKm = 3 } = {}) {
  const km = p => haversineKm(pos.lat, pos.lon, p.lat, p.lon)
  const feat = featured.map(f => ({
    id: f.id, name: f.name, lat: f.lat, lon: f.lon, elev: f.elev, kind: f.kind ?? 'peak',
    country: f.country ?? null, grade: f.grade ?? null, region: f.region ?? null, featured: true, km: km(f),
  }))
  // a hit within 1 km of a featured peak is that peak
  const osm = found
    .filter(p => p?.name && finite(p.elev) && !feat.some(f => haversineKm(f.lat, f.lon, p.lat, p.lon) < 1))
    .map(p => ({ ...p, km: km(p) }))
  const pool = [...feat, ...osm]
  let inRange = pool.filter(p => p.km <= radiusKm)
  if (inRange.length < minCount) inRange = pool.filter(p => p.km <= wideKm)
  const picked = inRange.filter(p => p.featured).sort((a, b) => a.km - b.km).slice(0, n)
  const near = (a, b) => haversineKm(a.lat, a.lon, b.lat, b.lon) < sepKm
  const free = p => !picked.some(q => near(q, p))
  const rest = inRange.filter(p => !p.featured)
  const middle = rest.map(p => p.elev).sort((a, b) => a - b)[Math.floor(rest.length / 2)] ?? 0
  const tops = []
  for (const p of rest.filter(q => q.notability > 0 && q.elev >= middle).sort((a, b) => b.notability - a.notability || b.elev - a.elev)) {
    if (!tops.some(q => near(q, p))) tops.push(p)
  }
  for (const p of tops.sort((a, b) => a.km - b.km)) {
    if (picked.length >= n) break
    if (free(p)) picked.push(p)
  }
  for (const p of rest.filter(q => !tops.includes(q)).sort((a, b) => b.elev - a.elev)) {
    if (picked.length >= n) break
    if (free(p)) picked.push(p)
  }
  return picked.sort((a, b) => a.km - b.km).map(({ featured: _, ...p }) => p)
}

// Ask every sample point, a moment apart, and once more after a pause each one
// that fails — OpenStreetMap's public geocoder refuses part of a burst (503),
// and an answer with a gap is only cached for minutes. `ask(point, i)` → its
// summits, or null.
const pause = ms => new Promise(r => setTimeout(r, ms))
export function samplePoints(points, ask, { gapMs = 150, retryMs = 700, sleep = pause } = {}) {
  return Promise.all(points.map(async (p, i) => {
    await sleep(i * gapMs)
    const first = await ask(p, i)
    if (first) return first
    await sleep(retryMs)
    return ask(p, i)
  }))
}

// What Near you shows for a cell: its summits once they are in (possibly
// none), else whether they are still coming or failed.
export function nearView(summits, failedKey, key) {
  if (!key) return { status: 'none', peaks: [] }
  if (summits?.key === key) return summits.peaks.length ? { status: 'ready', peaks: summits.peaks } : { status: 'empty', peaks: [] }
  return { status: failedKey === key ? 'failed' : 'loading', peaks: [] }
}
