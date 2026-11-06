// The weighting formula's shadow run (supabase/station-errors.sql): which reading each
// source is compared with. Pure, so it runs under plain node --test. Nothing here feeds
// the live weights: those keep using the airports only.
import { haversineKm } from './geo.js'
import { median, rawErrors } from './scoring.js'

// Featured summits with an official GeoSphere station on top: within 300 m and 50 m of height.
export const SUMMITS = [
  { name: 'Patscherkofel', lat: 47.20883, lon: 11.46061, elev: 2246, station: 11126 },
  { name: 'Hoher Sonnblick', lat: 47.0541, lon: 12.95743, elev: 3106, station: 11343 },
  { name: 'Schöckl', lat: 47.19762, lon: 15.46253, elev: 1445, station: 11241 },
  { name: 'Dobratsch', lat: 46.60366, lon: 13.67039, elev: 2166, station: 11265 },
  { name: 'Schmittenhöhe', lat: 47.32936, lon: 12.73762, elev: 1965, station: 11340 },
]

// shortcut: lib/shadow-stations.json leaves out stations above 1500 m so a town isn't checked
// against a mountain top, but has no town heights; truth_km lets the report filter further
export function nearestStation(stations, lat, lon, maxKm = 10) {
  let best = null
  for (const [id, sLat, sLon] of stations) {
    const km = haversineKm(lat, lon, sLat, sLon)
    if (km <= maxKm && (!best || km < best.km)) best = { id, km: Math.round(km * 10) / 10 }
  }
  return best
}

// A station in town says more about the town than an airport up to 60 km away.
export function chooseTruth({ stationTemp, stationKm, metarTemps, metarKm }) {
  if (typeof stationTemp === 'number') return { truth: 'station', actual: stationTemp, km: stationKm }
  if (metarTemps?.length) return { truth: 'metar', actual: median(metarTemps), km: metarKm }
  return null
}

// Each model at the summit, this hour, against the summit's station.
export function summitErrors(parsed, hourIso, actual) {
  const now = (parsed?.series ?? []).flatMap(s => {
    const p = s.hourly.find(h => h.t.startsWith(hourIso))
    return p ? [{ api_id: s.id, temp: p.temp }] : []
  })
  return rawErrors(now, actual)
}

// GeoSphere's answer for several stations at once → Map(station id → latest temperature).
export function stationTemps(body) {
  const temps = new Map()
  for (const f of body?.features ?? []) {
    const reading = f.properties?.parameters?.TL?.data?.findLast(v => v != null)
    if (typeof reading === 'number') temps.set(Number(f.properties.station), reading)
  }
  return temps
}
