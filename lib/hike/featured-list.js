// The featured peaks list: the region and grade vocabularies, the build
// script's checker, and what the Hiking screen does with the list.
import { haversineKm } from '../geo.js'

// display order of the "All peaks" groups; names in lib/i18n.js (region_<id>)
export const REGIONS = [
  'eastern-alps', 'western-alps', 'dolomites', 'central-europe', 'pyrenees-iberia',
  'british-isles', 'scandinavia', 'carpathians', 'balkans-greece', 'mediterranean',
  'africa', 'north-america', 'south-america', 'asia', 'oceania',
]

// SAC hiking scale, then the mountaineering scale for glacier / climbing routes
export const GRADES = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'L', 'WS', 'ZS', 'S']

const inRange = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi

// What is wrong with one entry, or null. Remembers the id in `seen`.
export function checkPeak(p, seen) {
  if (typeof p.id !== 'string' || !/^[a-z0-9-]+$/.test(p.id)) return `bad id "${p.id}"`
  if (seen.has(p.id)) return `${p.id}: id repeats`
  seen.add(p.id)
  if (typeof p.name !== 'string' || !p.name.trim()) return `${p.id}: no name`
  if (!inRange(p.lat, -90, 90) || !inRange(p.lon, -180, 180)) return `${p.id}: bad coordinates`
  if (!Number.isInteger(p.elev) || !inRange(p.elev, 0, 9000)) return `${p.id}: no height`
  if (typeof p.country !== 'string' || !/^[A-Z]{2}$/.test(p.country)) return `${p.id}: bad country`
  if (!['peak', 'hut'].includes(p.kind)) return `${p.id}: bad kind`
  if (!REGIONS.includes(p.region)) return `${p.id}: unknown region "${p.region}"`
  if (!GRADES.includes(p.grade)) return `${p.id}: unknown grade "${p.grade}"`
  return null
}

export function nearest(peaks, pos, n = 10) {
  if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lon)) return []
  return peaks
    .map(p => ({ ...p, km: haversineKm(pos.lat, pos.lon, p.lat, p.lon) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n)
}

export function byRegion(peaks) {
  return REGIONS
    .map(region => ({ region, peaks: peaks.filter(p => p.region === region) }))
    .filter(g => g.peaks.length)
}

// The last city looked at on the forecast page, from its cached forecast
// (app/page.js cacheForecast). getItem = key => localStorage.getItem(key).
export function lastCityPos(getItem) {
  try {
    const name = getItem('mb_forecast_last')
    if (!name) return null
    const json = JSON.parse(getItem(`mb_forecast_${name}`) ?? 'null')?.json
    return Number.isFinite(json?.lat) && Number.isFinite(json?.lon) ? { lat: json.lat, lon: json.lon } : null
  } catch {
    return null
  }
}
