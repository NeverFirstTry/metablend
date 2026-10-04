// "Near you" on the Hiking screen: the notable summits around a position
// (pure — unit tested; /api/peaks/near does the fetching). OpenStreetMap is
// full of small named hills, so it isn't the nearest ten — it's the ten
// highest within reach, shown nearest first.
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
// page, grade and region), then the highest of the OpenStreetMap summits with
// a name and a height up to n — one per cluster: a top within sepKm of a
// higher pick is a shoulder of the same mountain, skipped so the list spreads
// across the area instead of naming one ridge ten times. All sorted by
// distance. Within radiusKm; where that holds fewer than minCount summits
// (flat country), within wideKm.
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
  for (const p of inRange.filter(q => !q.featured).sort((a, b) => b.elev - a.elev)) {
    if (picked.length >= n) break
    if (!picked.some(q => haversineKm(q.lat, q.lon, p.lat, p.lon) < sepKm)) picked.push(p)
  }
  return picked.sort((a, b) => a.km - b.km).map(({ featured: _, ...p }) => p)
}
