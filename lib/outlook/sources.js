// Open-Meteo requests for the outlook (network; never throws — see http.js).

import { getJson } from './http.js'
import { OM_MODELS } from './models.js'

const HOURLY = 'temperature_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code'
const DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code,sunrise,sunset'

// One request, every model: hourly + daily for 16 days in city-local time.
export function fetchOpenMeteoMultiRaw(lat, lon) {
  const models = OM_MODELS.map(m => m.model).join(',')
  return getJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${HOURLY}&daily=${DAILY}&models=${models}&forecast_days=16&timezone=auto`, { cache: 'no-store' })
}

// ECMWF ENS (51 members) + NOAA GEFS (31): the honest week-2 spread.
export function fetchEnsembleRaw(lat, lon) {
  return getJson(`https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&models=ecmwf_ifs025,gfs025&forecast_days=16&timezone=auto`, { cache: 'no-store' })
}

// 10 years of daily history for normals and records. Climate doesn't change
// within a day: cached 24 h by Next's fetch cache, coordinates rounded so
// nearby lookups share an entry.
export function fetchClimateRaw(lat, lon, now = new Date()) {
  const end = now.getUTCFullYear() - 1, start = end - 9
  return getJson(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&start_date=${start}-01-01&end_date=${end}-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`, { next: { revalidate: 86400 }, ms: 15000 })
}
