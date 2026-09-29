// National forecast services for the outlook. Independence was measured
// against the Open-Meteo models (spec §3): NWS, SMHI and DWD MOSMIX (Bright
// Sky) add real information; MET Norway's locationforecast duplicates MET
// Nordic / ECMWF and is only the fallback when Open-Meteo is down.
// Parsers are pure (fixture-tested); fetchers never throw.

import { getJson } from './http.js'
import { BOXES, inBox } from './models.js'
import { dailyFromHourly, num } from './parse.js'

// UTC instant → the city's wall-clock hour string
export const toLocalHour = (utcMs, utcOffsetSec) =>
  new Date(utcMs + utcOffsetSec * 1000).toISOString().slice(0, 13) + ':00'
const kmh = ms => (typeof ms === 'number' ? Math.round(ms * 3.6) : null)

// Keep the first point per hour (national feeds occasionally repeat a step).
function uniqueHours(points) {
  const seen = new Set()
  return points.filter(p => (seen.has(p.t) ? false : seen.add(p.t)))
}

export function parseNws(json) {
  const periods = json?.properties?.periods
  if (!Array.isArray(periods)) return null
  const hourly = uniqueHours(periods
    .filter(p => typeof p.temperature === 'number' && typeof p.startTime === 'string')
    .map(p => {
      const c = p.temperatureUnit === 'F' ? (p.temperature - 32) * 5 / 9 : p.temperature
      return {
        // startTime carries the gridpoint's own local offset → already city-local
        t: p.startTime.slice(0, 13) + ':00',
        temp: Math.round(c * 10) / 10,
        pop: num(p.probabilityOfPrecipitation?.value),
        precip: null,
        wind: Math.round((parseFloat(p.windSpeed) || 0) * 1.60934), // "12 mph" / "10 to 15 mph"
        code: null,
      }
    }))
  return hourly.length ? { id: 'nws', hourly, daily: dailyFromHourly(hourly) } : null
}

export function parseSmhi(json, utcOffsetSec) {
  const ts = json?.timeSeries
  if (!Array.isArray(ts)) return null
  const hourly = uniqueHours(ts
    .map(e => ({ ms: Date.parse(e.time ?? e.validTime), d: e.data ?? {} }))
    .filter(({ ms, d }) => Number.isFinite(ms) && typeof d.air_temperature === 'number')
    .map(({ ms, d }) => ({
      t: toLocalHour(ms, utcOffsetSec),
      temp: d.air_temperature,
      pop: num(d.probability_of_precipitation),
      precip: num(d.precipitation_amount_mean),
      wind: kmh(d.wind_speed),
      code: null,
    })))
  return hourly.length ? { id: 'smhi', hourly, daily: dailyFromHourly(hourly) } : null
}

export function parseBrightSky(json, utcOffsetSec) {
  if (!Array.isArray(json?.weather)) return null
  const type = new Map((json.sources ?? []).map(s => [s.id, s.observation_type]))
  const hourly = uniqueHours(json.weather
    .filter(w => type.get(w.source_id) === 'forecast' && typeof w.temperature === 'number')
    .map(w => ({
      t: toLocalHour(Date.parse(w.timestamp), utcOffsetSec),
      temp: w.temperature,
      pop: num(w.precipitation_probability),
      precip: num(w.precipitation),
      wind: typeof w.wind_speed === 'number' ? Math.round(w.wind_speed) : null, // already km/h
      code: null,
    })))
  return hourly.length ? { id: 'brightsky', hourly, daily: dailyFromHourly(hourly) } : null
}

export function parseMetNorway(json, utcOffsetSec) {
  const ts = json?.properties?.timeseries
  if (!Array.isArray(ts)) return null
  const hourly = uniqueHours(ts
    .filter(e => typeof e.data?.instant?.details?.air_temperature === 'number')
    .map(e => ({
      t: toLocalHour(Date.parse(e.time), utcOffsetSec),
      temp: e.data.instant.details.air_temperature,
      pop: num(e.data.next_1_hours?.details?.probability_of_precipitation),
      precip: num(e.data.next_1_hours?.details?.precipitation_amount),
      wind: kmh(e.data.instant.details.wind_speed),
      code: null,
    })))
  // fallback only: its 6-hourly tail still yields coarse days (≥ 4 samples)
  return hourly.length ? { id: 'met-norway', hourly, daily: dailyFromHourly(hourly, 4) } : null
}

export function parseNational(raw, utcOffsetSec) {
  return [
    raw?.nws && parseNws(raw.nws),
    raw?.smhi && parseSmhi(raw.smhi, utcOffsetSec),
    raw?.brightsky && parseBrightSky(raw.brightsky, utcOffsetSec),
  ].filter(Boolean)
}

// Raw JSON of every national service that covers the point (parsed later,
// once the city's UTC offset is known from the Open-Meteo response).
export async function fetchNationalRaw(lat, lon) {
  const jobs = {}
  if (inBox(BOXES.conus, lat, lon)) {
    jobs.nws = getJson(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`)
      .then(p => (p?.properties?.forecastHourly ? getJson(p.properties.forecastHourly) : null))
  }
  if (inBox(BOXES.nordic, lat, lon)) {
    jobs.smhi = getJson(`https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${lon.toFixed(4)}/lat/${lat.toFixed(4)}/data.json`)
  }
  if (inBox(BOXES.germany, lat, lon)) {
    const today = new Date().toISOString().slice(0, 10)
    const last = new Date(Date.now() + 8 * 864e5).toISOString().slice(0, 10)
    jobs.brightsky = getJson(`https://api.brightsky.dev/weather?lat=${lat}&lon=${lon}&date=${today}&last_date=${last}`)
  }
  const entries = await Promise.all(Object.entries(jobs).map(async ([k, p]) => [k, await p]))
  return Object.fromEntries(entries)
}

export function fetchMetNorwayRaw(lat, lon) {
  return getJson(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`)
}
