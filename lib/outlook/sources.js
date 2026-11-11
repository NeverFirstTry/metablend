// Open-Meteo requests for the outlook (network; never throws — see http.js).

import { getJson } from './http.js'
import { withCoreFallback, modelCovers } from './models.js'

const HOURLY = 'temperature_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code'
const DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code,sunrise,sunset'

// One request, every model that covers the place: hourly + daily for 8 days in
// city-local time (a full week ahead from any hour of today).
export function fetchOpenMeteoMultiRaw(lat, lon, get = getJson) {
  return withCoreFallback(models => `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${HOURLY}&daily=${DAILY}&models=${models.filter(m => modelCovers(m, lat, lon)).join(',')}&forecast_days=8&timezone=auto`, get, { kind: 'outlook' })
}

