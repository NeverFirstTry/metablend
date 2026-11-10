import { haversineKm } from './geo.js'
import { isOpenMeteo, openMeteoFetch } from './open-meteo.js'

// fetch with a default 5s timeout (callers can pass their own signal). Open-Meteo goes through its gate
// (lib/open-meteo.js), and its 5 s start when the request leaves the gate's queue; refused there for
// being one too many at that instant (429 "Too many concurrent requests", which clears a moment
// later), it is asked once more after Retry-After, else 300 ms, at most 2 s. Its limits per minute,
// hour and day are not asked again.
const FETCH_TIMEOUT = 5000
export async function tfetch(url, opts = {}) {
  if (!isOpenMeteo(url)) return fetch(url, { ...opts, signal: opts.signal ?? AbortSignal.timeout(FETCH_TIMEOUT) })
  const init = opts.signal ? opts : { ...opts, timeoutMs: FETCH_TIMEOUT }
  const res = await openMeteoFetch(url, init)
  if (res.status !== 429 || !/concurrent/i.test(await res.clone().text().catch(() => ''))) return res
  await new Promise(r => setTimeout(r, Math.min(2000, (Number(res.headers.get('retry-after')) || 0.3) * 1000)))
  return openMeteoFetch(url, init)
}

// ── Region detection ─────────────────────────────────────────────────────────
export function getRegion(lat, lon) {
  if (lat >= 35  && lat <= 70  && lon >= -25  && lon <= 40)  return 'europe'
  if (lat >= 15  && lat <= 72  && lon >= -170 && lon <= -50) return 'north_america'
  if (lat >= -55 && lat <= 15  && lon >= -82  && lon <= -34) return 'south_america'
  if (lat >= 0   && lat <= 75  && lon >= 40   && lon <= 180) return 'asia'
  if (lat >= -35 && lat <= 35  && lon >= -18  && lon <= 52)  return 'africa'
  if (lat >= -50 && lat <= 0   && lon >= 110  && lon <= 180) return 'oceania'
  return 'global'
}

// Every fetcher returns `rainPct` plus `rainIsProb`. Only a true precipitation
// probability sets rainIsProb: cloud cover and humidity are NOT rain
// probabilities (they used to stand in here and skewed the "will it rain"
// consensus toward yes), so sources without one report rainPct: null. MET
// Norway and GeoSphere derive a rough pseudo-probability from measured precip
// amount — usable as a fallback, still not a real probability.

// ── Open-Meteo (free, no key) ─────────────────────────────────────────────────
export async function fetchOpenMeteo(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation_probability,windspeed_10m,weathercode&timezone=auto`
  const res = await tfetch(url)
  if (!res.ok) throw new Error(`open-meteo ${res.status}`) // marked "down" by timedFetch
  const data = await res.json()
  const c = data.current
  return {
    apiId: 'open-meteo',
    displayName: 'Open-Meteo',
    temp: c.temperature_2m,
    feelsLike: c.apparent_temperature,
    rainPct: c.precipitation_probability ?? null,
    rainIsProb: c.precipitation_probability != null,
    windKmh: Math.round(c.windspeed_10m),
    condition: decodeWeatherCode(c.weathercode),
  }
}

// More national and AI models in ONE request (free, no key): the global ones
// answer everywhere, the regional ones only inside their area (elsewhere their
// values are null and the source simply doesn't show — like NWS outside the
// US). Region-only model names on purpose: the "seamless" ones fall back to
// another model outside their area, which would count one model twice. MET
// Nordic is left out: MET Norway's own forecast already uses it.
// "Now" is the current hour of the hourly data — `current` isn't split by model.
export const MORE_MODELS = [
  ['ukmo', 'ukmo_seamless', 'UK Met Office'],
  ['gem', 'gem_seamless', 'Canada GEM'],
  ['jma', 'jma_seamless', 'JMA (Japan)'],
  ['cma', 'cma_grapes_global', 'CMA GRAPES (China)'],
  ['aifs', 'ecmwf_aifs025_single', 'ECMWF AIFS (AI)'],
  ['meteoswiss', 'meteoswiss_icon_ch1', 'MeteoSwiss ICON-CH'],
  ['italiameteo', 'italia_meteo_arpae_icon_2i', 'ItaliaMeteo ICON-2I'],
  ['knmi', 'knmi_harmonie_arome_europe', 'KNMI HARMONIE'],
  ['dmi', 'dmi_harmonie_arome_europe', 'DMI HARMONIE'],
  ['nbm', 'ncep_nbm_conus', 'NOAA NBM (US)'],
]

// the first time step of a multi-model answer: one reading per model that has a value
export function parseOpenMeteoModels(json, step = 'hourly', models = MORE_MODELS) {
  const h = json?.[step]
  if (!h || json.error) return []
  const at = (field, model) => h[`${field}_${model}`]?.[0] ?? null
  return models.flatMap(([apiId, model, displayName]) => {
    const temp = at('temperature_2m', model)
    if (typeof temp !== 'number') return []
    const rainPct = at('precipitation_probability', model)
    return [{
      apiId, displayName, temp,
      feelsLike: at('apparent_temperature', model) ?? temp,
      rainPct, rainIsProb: rainPct != null,
      windKmh: Math.round(at('wind_speed_10m', model) ?? 0),
      condition: decodeWeatherCode(at('weather_code', model)),
    }]
  })
}

// One request for a list of models, its first time step. null when the request was refused, broke or
// answered an error: the blend counts as thin (the route, lib/forecast-cache.js); a list, possibly
// empty, when it answered
async function fetchModels(lat, lon, models, step, steps) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&${step}=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,weather_code&models=${models.map(m => m[1]).join(',')}&${steps}=1&timezone=GMT`
  try {
    const res = await tfetch(url)
    if (!res.ok) return null
    const data = await res.json()
    return data?.[step] ? parseOpenMeteoModels(data, step, models) : null
  } catch {
    return null
  }
}
export const fetchOpenMeteoModels = (lat, lon) => fetchModels(lat, lon, MORE_MODELS, 'hourly', 'forecast_hours')

// The models that answer everywhere; one of them missing from an answer means the blend is thin, where a
// regional model's absence is the normal case outside its area (Vienna, 2026-11-09: 10 of 18 sources for
// 15 minutes, nothing reported as failed).
export const GLOBAL_MODELS = ['ukmo', 'gem', 'jma', 'cma', 'aifs']
// what the shared request did not deliver: the request itself (null), or the global models absent from it
export const missingModels = list => (list == null ? ['open-meteo-models'] : GLOBAL_MODELS.filter(id => !list.some(r => r.apiId === id)))

// One model of a shared request as its own source: (lat, lon) → its reading or null.
// Every model asking about the same spot within a minute shares one request
// (the forecast asks its four side by side, the hourly calibration asks each source separately).
const perSpot = fetchList => {
  const runs = new Map() // "lat,lon" → { at, list }
  return id => async (lat, lon) => {
    const key = `${lat},${lon}`
    let run = runs.get(key)
    if (!run || Date.now() - run.at > 60e3) {
      run = { at: Date.now(), list: fetchList(lat, lon) }
      runs.set(key, run)
      if (runs.size > 200) runs.delete(runs.keys().next().value)
    }
    return ((await run.list) ?? []).find(r => r.apiId === id) ?? null
  }
}
export const modelSource = perSpot(fetchOpenMeteoModels)

// ── Open-Meteo's global model feeds (free, no key) ───────────────────────────
// The default Open-Meteo source uses "best match"; these are one specific global model each, so the
// consensus gets genuine model diversity (ECMWF, NOAA, DWD and Météo-France physics) from a single
// keyless provider. One request for the four (one each until 2026-11-09, quota item 2). `current`
// isn't split by model; minutely_15 is, and its first step is the value `current` gave each model
// alone (compared for Lienz and Perth, all five fields), so their "now" is what it was. Their own
// request, not the hourly one above: Open-Meteo counts variables × models (lib/open-meteo.js
// callWeight), so both steps for all fourteen would cost 14 calls where the two requests cost 5 + 2.
const NOW_MODELS = [
  ['ecmwf', 'ecmwf_ifs025', 'ECMWF IFS'],
  ['gfs', 'gfs_seamless', 'NOAA GFS'],
  ['icon', 'icon_seamless', 'DWD ICON'],
  ['meteofrance', 'meteofrance_seamless', 'Météo-France'], // ARPEGE worldwide, AROME at 1.3 km over France and the Alps
]
const nowModel = perSpot((lat, lon) => fetchModels(lat, lon, NOW_MODELS, 'minutely_15', 'forecast_minutely_15'))
export const fetchECMWF = nowModel('ecmwf')
export const fetchGFS = nowModel('gfs')
export const fetchICON = nowModel('icon')
export const fetchMeteoFrance = nowModel('meteofrance')

// ── NWS / weather.gov (free, no key; US only) ────────────────────────────────
// Two-step: resolve the point to a forecast office grid, then take the first
// hourly period. Real precipitation probability.
export async function fetchNWS(lat, lon) {
  if (lat < 24.5 || lat > 49.5 || lon < -125 || lon > -66.5) return undefined // CONUS
  const headers = { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' }
  try {
    const pRes = await tfetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, { headers })
    if (pRes.status === 404) return undefined // inside the box but not on its grid (Toronto, Vancouver): not covered, not a failure
    if (!pRes.ok) return null
    const hourlyUrl = (await pRes.json()).properties?.forecastHourly
    if (!hourlyUrl) return null
    const hRes = await tfetch(hourlyUrl, { headers })
    if (!hRes.ok) return null
    const per = (await hRes.json()).properties?.periods?.[0]
    if (!per || typeof per.temperature !== 'number') return null
    const tempC = per.temperatureUnit === 'F' ? (per.temperature - 32) * 5 / 9 : per.temperature
    const windMph = parseFloat(per.windSpeed) || 0 // "12 mph" / "10 to 15 mph"
    const pop = per.probabilityOfPrecipitation?.value
    return {
      apiId: 'nws',
      displayName: 'NWS (US)',
      temp: Math.round(tempC * 10) / 10,
      feelsLike: Math.round(tempC * 10) / 10,
      rainPct: pop ?? null,
      rainIsProb: pop != null,
      windKmh: Math.round(windMph * 1.60934),
      condition: per.shortForecast ?? 'Unknown',
    }
  } catch {
    return null
  }
}

// ── Bright Sky / DWD (free, no key; Germany + margin) ────────────────────────
// Station observations, so no rain probability — temperature ground truth.
export async function fetchBrightSky(lat, lon) {
  if (lat < 47 || lat > 55.2 || lon < 5.5 || lon > 15.5) return undefined
  try {
    const res = await tfetch(`https://api.brightsky.dev/current_weather?lat=${lat}&lon=${lon}`)
    if (res.status === 404) return undefined // no station of theirs in reach (Prague, Schwanenstadt): not covered, not a failure
    if (!res.ok) return null
    const w = (await res.json()).weather
    if (w?.temperature == null) return null
    return {
      apiId: 'brightsky',
      displayName: 'DWD Bright Sky',
      temp: w.temperature,
      feelsLike: w.temperature,
      rainPct: null, // observation, not a forecast probability
      windKmh: Math.round(w.wind_speed_10 ?? w.wind_speed ?? 0), // already km/h
      condition: decodeBrightSkyIcon(w.icon ?? w.condition ?? ''),
    }
  } catch {
    return null
  }
}

function decodeBrightSkyIcon(icon) {
  if (icon.startsWith('clear')) return 'Clear'
  if (icon.startsWith('partly')) return 'Partly cloudy'
  if (icon === 'fog') return 'Foggy'
  if (icon === 'rain') return 'Rain'
  if (icon === 'sleet' || icon === 'snow' || icon === 'hail') return 'Snow'
  if (icon === 'thunderstorm') return 'Thunderstorm'
  return 'Cloudy' // cloudy, wind, dry, …
}

// ── SMHI (free, no key; Scandinavia + Baltic) ────────────────────────────────
// snow1g point forecast (successor of pmp3g, retired 2026-03). Real PoP.
export async function fetchSMHI(lat, lon) {
  if (lat < 52.5 || lat > 70.7 || lon < 2.5 || lon > 33) return undefined
  const url = `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${lon.toFixed(4)}/lat/${lat.toFixed(4)}/data.json`
  try {
    const res = await tfetch(url)
    if (!res.ok) return null
    const d = (await res.json()).timeSeries?.[0]?.data
    if (d?.air_temperature == null) return null
    return {
      apiId: 'smhi',
      displayName: 'SMHI (Nordics)',
      temp: d.air_temperature,
      feelsLike: d.air_temperature,
      rainPct: d.probability_of_precipitation ?? null,
      rainIsProb: d.probability_of_precipitation != null,
      windKmh: Math.round((d.wind_speed ?? 0) * 3.6),
      condition: decodeSMHISymbol(d.symbol_code),
    }
  } catch {
    return null
  }
}

// Wsymb2-style numeric codes (1–27)
function decodeSMHISymbol(s) {
  if (s == null) return 'Cloudy'
  if (s <= 2) return 'Clear'
  if (s <= 4) return 'Partly cloudy'
  if (s <= 6) return 'Cloudy'
  if (s === 7) return 'Foggy'
  if (s <= 10) return 'Rain showers'
  if (s === 11 || s === 21) return 'Thunderstorm'
  if (s <= 14 || (s >= 22 && s <= 24)) return 'Sleet'
  if (s <= 17 || s >= 25) return 'Snow'
  return 'Rain' // 18-20
}

// ── OpenWeatherMap ────────────────────────────────────────────────────────────
export async function fetchOWM(lat, lon) {
  const key = process.env.OPENWEATHERMAP_API_KEY
  if (!key) return undefined
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric`
  const res = await tfetch(url)
  // invalid/suspended key — treat like "not configured", not "down"
  if (res.status === 401 || res.status === 403) return null
  if (!res.ok) throw new Error(`owm ${res.status}`)
  const data = await res.json()
  return {
    apiId: 'owm',
    displayName: 'OpenWeatherMap',
    temp: data.main.temp,
    feelsLike: data.main.feels_like,
    rainPct: null, // current-weather endpoint has no precip probability
    windKmh: Math.round(data.wind.speed * 3.6),
    condition: data.weather[0].description,
  }
}

// ── WeatherAPI ────────────────────────────────────────────────────────────────
export async function fetchWeatherAPI(lat, lon) {
  const key = process.env.WEATHERAPI_KEY
  if (!key) return undefined
  // WEATHERAPI_HOST: the EU-only hostname WeatherAPI provides on request (its DPA, clause 9.6); the public host otherwise
  const url = `https://${process.env.WEATHERAPI_HOST || 'api.weatherapi.com'}/v1/current.json?key=${key}&q=${lat},${lon}&lang=en`
  const res = await tfetch(url)
  const data = await res.json()
  if (data.error) return null
  return {
    apiId: 'weatherapi',
    displayName: 'WeatherAPI',
    temp: data.current.temp_c,
    feelsLike: data.current.feelslike_c,
    rainPct: null, // current.json has no precip probability
    windKmh: Math.round(data.current.wind_kph),
    condition: data.current.condition.text,
  }
}

// ── Pirate Weather (free tier, key) ──────────────────────────────────────────
// Off until PIRATE_WEATHER_KEY is set in the environment. SI units: °C, m/s;
// a real precipitation probability (0–1); the summary is English text.
export async function fetchPirateWeather(lat, lon) {
  const key = process.env.PIRATE_WEATHER_KEY
  if (!key) return undefined
  const url = `https://api.pirateweather.net/forecast/${encodeURIComponent(key)}/${lat},${lon}?units=si&exclude=minutely,hourly,daily,alerts`
  try {
    const res = await tfetch(url)
    const c = (await res.json())?.currently
    if (typeof c?.temperature !== 'number') return null
    return {
      apiId: 'pirateweather',
      displayName: 'Pirate Weather',
      temp: Math.round(c.temperature * 10) / 10,
      feelsLike: Math.round((c.apparentTemperature ?? c.temperature) * 10) / 10,
      rainPct: typeof c.precipProbability === 'number' ? Math.round(c.precipProbability * 100) : null,
      rainIsProb: typeof c.precipProbability === 'number',
      windKmh: Math.round((c.windSpeed ?? 0) * 3.6),
      condition: c.summary ?? null,
    }
  } catch {
    return null
  }
}

// ── MET Norway (free, no key) ─────────────────────────────────────────────────
export async function fetchMETNorway(lat, lon) {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${+lat.toFixed(4)}&lon=${+lon.toFixed(4)}`
  try {
    const res = await tfetch(url, {
      headers: { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' },
    })
    if (!res.ok) return null
    const data = await res.json()
    const ts = data.properties?.timeseries?.[0]
    if (!ts) return null
    const instant = ts.data.instant.details
    const next1h  = ts.data.next_1_hours
    const next6h  = ts.data.next_6_hours
    // locationforecast reports precipitation AMOUNT; probability_of_precipitation
    // is absent from both compact and complete (verified 2026-08-09 across four
    // continents). The old `?? 0` therefore published a *fabricated* 0 % as a
    // real probability on every single search, dragging the rain consensus
    // toward "no rain" while other sources reported active rain. Amount now
    // becomes a pseudo-probability in the same fallback tier as GeoSphere:
    // usable when nobody real answered, never a vote of its own.
    const det = next1h?.details ?? next6h?.details
    const pop = det?.probability_of_precipitation
    const mm = det?.precipitation_amount
    return {
      apiId: 'met-norway',
      displayName: 'MET Norway',
      temp: Math.round(instant.air_temperature * 10) / 10,
      feelsLike: Math.round(instant.air_temperature * 10) / 10,
      rainPct: pop ?? (typeof mm === 'number' ? Math.min(Math.round(mm * 50), 90) : null),
      rainIsProb: pop != null,
      windKmh: Math.round((instant.wind_speed ?? 0) * 3.6),
      condition: decodeMETSymbol(next1h?.summary?.symbol_code ?? ''),
    }
  } catch {
    return null
  }
}

function decodeMETSymbol(symbol) {
  if (!symbol) return 'Cloudy'
  if (symbol.startsWith('clearsky') || symbol.startsWith('fair')) return 'Clear'
  if (symbol.startsWith('partlycloudy'))                           return 'Partly cloudy'
  if (symbol.startsWith('cloudy'))                                 return 'Cloudy'
  if (symbol.includes('fog'))                                      return 'Foggy'
  if (symbol.includes('thunder') || symbol.includes('storm'))      return 'Thunderstorm'
  if (symbol.includes('snow') || symbol.includes('sleet'))         return 'Snow'
  if (symbol.includes('rain') || symbol.includes('shower'))        return 'Rain'
  return 'Cloudy'
}

// ── Visual Crossing ───────────────────────────────────────────────────────────
export async function fetchVisualCrossing(lat, lon) {
  const key = process.env.VISUAL_CROSSING_KEY
  if (!key) return undefined
  const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${lat},${lon}/today?unitGroup=metric&key=${key}&contentType=json&include=current`
  try {
    const res = await tfetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const c = data.currentConditions
    if (!c) return null
    return {
      apiId: 'visual-crossing',
      displayName: 'Visual Crossing',
      temp:     Math.round(c.temp     * 10) / 10,
      feelsLike: Math.round(c.feelslike * 10) / 10,
      rainPct:  c.precipprob != null ? Math.round(c.precipprob) : null,
      rainIsProb: c.precipprob != null,
      windKmh:  Math.round(c.windspeed  ?? 0),   // already km/h with unitGroup=metric
      condition: c.conditions ?? 'Unknown',
    }
  } catch {
    return null
  }
}

// ── GeoSphere Austria (INCA analysis, free, no key) ───────────────────────────
// 1 km hourly analysis grid. Covers Austria + a thin border margin only (DACH
// edge), so we skip coordinates clearly outside that box. INCA-v2 since v1 shuts
// down at the end of 2026; its point endpoint reads the nearest grid cell.
export function geoSphereUrl(lat, lon, now = Date.now()) {
  const floorHour = ms => { const d = new Date(ms); d.setUTCMinutes(0, 0, 0); return d.toISOString().slice(0, 16) }
  return `https://dataset.api.hub.geosphere.at/v1/timeseries/historical/inca-v2-1h-1km?parameters=2t,tp,10u,10v&start=${floorHour(now - 3 * 3600 * 1000)}&end=${floorHour(now)}&lat_lon=${lat.toFixed(4)},${lon.toFixed(4)}`
}

export async function fetchGeoSphere(lat, lon) {
  if (lat < 46 || lat > 49.2 || lon < 9.3 || lon > 17.3) return undefined

  try {
    const res = await tfetch(geoSphereUrl(lat, lon))
    if (!res.ok) return null
    const p = (await res.json()).features?.[0]?.properties?.parameters
    const series = p?.['2t']?.data
    if (!series?.length) return null

    // most recent slot that actually has a temperature
    let i = series.length - 1
    while (i >= 0 && series[i] == null) i--
    if (i < 0) return null

    const temp = series[i]
    const rr   = p.tp?.data?.[i] ?? 0          // mm in the hour
    const uu   = p['10u']?.data?.[i]               // m/s eastward
    const vv   = p['10v']?.data?.[i]               // m/s northward
    const windKmh = (uu != null && vv != null) ? Math.round(Math.hypot(uu, vv) * 3.6) : 0

    return {
      apiId: 'geosphere',
      displayName: 'GeoSphere Austria',
      temp:      Math.round(temp * 10) / 10,
      feelsLike: Math.round(temp * 10) / 10,   // INCA has no apparent temp
      // INCA reports precip amount, not probability — a pseudo-probability
      // (fallback only, not rainIsProb)
      rainPct:   rr > 0 ? Math.min(Math.round(rr * 50), 90) : 0,
      windKmh,
      condition: rr > 1 ? 'Rain' : rr > 0 ? 'Drizzle' : 'Clear',
    }
  } catch {
    return null
  }
}

// ── Geocoding ─────────────────────────────────────────────────────────────────
export const placeKey = s => s.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase()

// The geocoder also matches airport codes: "Kos" comes back as Sihanoukville
// (airport KOS) ahead of the Greek island. For a short query whose top match
// doesn't even start with it, a populated place of exactly that name wins.
// A prefix ("vie" → Vienna, "gra" → Graz) or a longer query keeps the top match.
// With `near` (where the search came from): the nearest match within 50 km,
// a town of exactly that name first — Vienna, Virginia, not Vienna, Austria.
export function pickPlace(results, query, near = null) {
  const top = results[0]
  const q = placeKey(query)
  const close = near ? results.filter(r => haversineKm(near.lat, near.lon, r.latitude, r.longitude) <= 50) : []
  if (close.length) {
    const named = close.filter(r => placeKey(r.name) === q)
    const km = r => haversineKm(near.lat, near.lon, r.latitude, r.longitude)
    return (named.length ? named : close).reduce((a, b) => (km(b) < km(a) ? b : a))
  }
  if (!top || q.length > 4 || placeKey(top.name).startsWith(q)) return top
  const same = results.filter(r => placeKey(r.name) === q && (r.population ?? 0) > 0)
  return same.length ? same.reduce((a, b) => (b.population > a.population ? b : a)) : top
}

// geocodeCity and learnName live in lib/geocode.js: they talk to the database, and this file is bundled
// for the browser by the peak view.

// ── WMO weather codes ─────────────────────────────────────────────────────────
export function decodeWeatherCode(code) {
  if (code == null) return 'Unknown' // null would pass the <= checks below as 0
  if (code === 0)  return 'Clear'
  if (code <= 2)   return 'Partly cloudy'
  if (code <= 3)   return 'Cloudy'
  if (code <= 48)  return 'Foggy'
  if (code <= 55)  return 'Drizzle'
  if (code <= 67)  return 'Rain'
  if (code <= 77)  return 'Snow'
  if (code <= 82)  return 'Rain showers'
  if (code <= 99)  return 'Thunderstorm'
  return 'Unknown'
}

// UV, air quality, the current-conditions details and yesterday's temperature change slowly: one
// answer per spot per hour, kept in memory (a warm instance lives for hours); a failed answer is
// not kept. Four Open-Meteo requests per forecast miss become four per place per hour (2026-11-09).
const HOUR = 60 * 60 * 1000
const hourly = new Map() // "name:lat,lon" → { at, value }
async function perHour(name, lat, lon, fetchIt, keep = v => v != null) {
  const key = `${name}:${lat},${lon}`
  const kept = hourly.get(key)
  if (kept && Date.now() - kept.at < HOUR) return kept.value
  const value = await fetchIt()
  if (keep(value)) {
    hourly.set(key, { at: Date.now(), value })
    if (hourly.size > 2000) hourly.delete(hourly.keys().next().value)
  }
  return value
}
export const fetchOpenMeteoExtras = (lat, lon) => perHour('extras', lat, lon, () => extrasRaw(lat, lon), v => Object.values(v).some(x => x != null))
export const fetchOpenMeteoDetails = (lat, lon) => perHour('details', lat, lon, () => detailsRaw(lat, lon))
export const fetchYesterdayTemp = (lat, lon) => perHour('yesterday', lat, lon, () => yesterdayRaw(lat, lon))

// UV, air quality and pollen. All keyless — UV rides the forecast endpoint,
// AQI + pollen come from the air-quality one.
async function extrasRaw(lat, lon) {
  const out = { uvIndex: null, aqi: null, pollen: null }

  async function uv() {
    try {
      const uvUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=uv_index&daily=uv_index_max&timezone=auto&forecast_days=1`
      const uvRes = await tfetch(uvUrl)
      if (uvRes.ok) {
        const uvData = await uvRes.json()
        const v = uvData.current?.uv_index ?? uvData.daily?.uv_index_max?.[0]
        if (v != null) out.uvIndex = Math.round(v * 10) / 10
      }
    } catch {}
  }

  async function air() {
    try {
      const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen&timezone=auto`
      const aqRes = await tfetch(aqUrl)
      if (aqRes.ok) {
        const aqData = await aqRes.json()
        const c = aqData.current
        if (c) {
          if (c.european_aqi != null) out.aqi = Math.round(c.european_aqi)
          // sum whatever pollen species came back (grains/m³) into one number
          const pollen = [
            c.alder_pollen, c.birch_pollen, c.grass_pollen,
            c.mugwort_pollen, c.olive_pollen, c.ragweed_pollen,
          ].filter(v => typeof v === 'number')
          if (pollen.length) out.pollen = Math.round(pollen.reduce((s, v) => s + v, 0))
        }
      }
    } catch {}
  }

  await Promise.all([uv(), air()]) // the two requests at once
  return out
}

// Extra current-conditions detail (snow, visibility, cloud, ground temp, precip).
async function detailsRaw(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=snowfall,visibility,cloudcover,soil_temperature_0cm,precipitation&timezone=auto`
  try {
    const res = await tfetch(url)
    if (!res.ok) return null
    const c = (await res.json()).current
    if (!c) return null
    return {
      snowfallMm:   c.snowfall != null ? Math.round(c.snowfall * 10 * 10) / 10 : null, // cm → mm
      visibilityKm: c.visibility != null ? Math.round(c.visibility / 100) / 10 : null,  // m → km
      cloudCover:   c.cloudcover ?? null,
      groundTemp:   c.soil_temperature_0cm ?? null,
      precipMm:     c.precipitation ?? null,
    }
  } catch {
    return null
  }
}

// Yesterday's actual mean temp from the ERA5 archive (for the "vs yesterday" badge).
async function yesterdayRaw(lat, lon) {
  // "yesterday" in the city's timezone, not the server's
  const offsetMs = (typeof lon === 'number' ? lon / 15 : 0) * 3600 * 1000
  const d = new Date(Date.now() + offsetMs - 86_400_000).toISOString().slice(0, 10)
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${d}&end_date=${d}&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
  try {
    const res = await tfetch(url)
    if (!res.ok) return null
    const day = (await res.json()).daily
    const max = day?.temperature_2m_max?.[0]
    const min = day?.temperature_2m_min?.[0]
    if (max == null || min == null) return null
    return Math.round((max + min) / 2 * 10) / 10
  } catch {
    return null
  }
}

export function weatherIcon(code) {
  if (code === 0)  return '☀️'
  if (code <= 2)   return '🌤'
  if (code <= 3)   return '⛅'
  if (code <= 48)  return '🌫'
  if (code <= 55)  return '🌦'
  if (code <= 67)  return '🌧'
  if (code <= 77)  return '🌨'
  if (code <= 82)  return '🌦'
  if (code <= 99)  return '⛈'
  return '🌡'
}

//                   _,.---.---.---.--.._ 
//            _.-' `--.`---.`---'-. _,`--.._
//           /`--._ .'.     `.     `,`-.`-._\
//          ||   \  `.`---.__`__..-`. ,'`-._/
//     _  ,`\ `-._\   \    `.    `_.-`-._,``-.
//  ,`   `-_ \/ `-.`--.\    _\_.-'\__.-`-.`-._`.
// (_.o> ,--. `._/'--.-`,--`  \_.-'       \`-._ \
//  `---'    `._ `---._/__,----`           `-. `-\
//            /_, ,  _..-'                    `-._\
//            \_, \/ ._(
//             \_, \/ ._\
//              `._,\/ ._\
//               `._// ./`-._
//                 `-._-_-_.-'
// secret turtle :)
// 
