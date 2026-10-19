// The official warnings at a spot (deps injected — unit tested): region-code
// countries through the region map, outline countries through the warnings'
// own polygons. covered = MeteoAlarm warnings are fetched for the place, so
// the model-based severe alerts step aside there (even with nothing on).
import { regionsFor } from './regions.js'
import { AREA_FEEDS } from './feeds.js'

const AREA_COUNTRIES = new Set(AREA_FEEDS.map(f => f[1]))

export async function lookupWarnings(lat, lon, cc, { regionData, inRegions, atPoint, now = Date.now() }) {
  const code = cc ? String(cc).toUpperCase() : null
  const ids = regionsFor(regionData, lat, lon, code)
  const areaCountry = code ? AREA_COUNTRIES.has(code) : null
  // outlines: in an outline country, or anywhere when the country is unknown
  const askAreas = areaCountry || !code
  const [byRegion, byArea] = await Promise.all([
    ids.length ? inRegions(ids, now) : [],
    askAreas ? atPoint(lat, lon, now).catch(() => []) : [], // a broken outline lookup never breaks the rest
  ])
  const covered = ids.length > 0 || !!areaCountry || byArea.length > 0
  if (!covered) return { covered: false, warnings: [] }
  const seen = new Set()
  const warnings = [...byRegion, ...byArea].filter(w => !seen.has(w.id) && seen.add(w.id))
  return { covered, warnings }
}
