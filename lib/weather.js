// fetch with a default 5s timeout (callers can pass their own signal)
const FETCH_TIMEOUT = 5000
function tfetch(url, opts = {}) {
  return fetch(url, { ...opts, signal: opts.signal ?? AbortSignal.timeout(FETCH_TIMEOUT) })
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
    rainPct: c.precipitation_probability,
    windKmh: Math.round(c.windspeed_10m),
    condition: decodeWeatherCode(c.weathercode),
  }
}

// ── OpenWeatherMap ────────────────────────────────────────────────────────────
export async function fetchOWM(lat, lon) {
  const key = process.env.OPENWEATHERMAP_API_KEY
  if (!key) return null
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric`
  const res = await tfetch(url)
  const data = await res.json()
  return {
    apiId: 'owm',
    displayName: 'OpenWeatherMap',
    temp: data.main.temp,
    feelsLike: data.main.feels_like,
    rainPct: data.clouds?.all ?? 0,
    windKmh: Math.round(data.wind.speed * 3.6),
    condition: data.weather[0].description,
  }
}

// ── WeatherAPI ────────────────────────────────────────────────────────────────
export async function fetchWeatherAPI(lat, lon) {
  const key = process.env.WEATHERAPI_KEY
  if (!key) return null
  const url = `https://api.weatherapi.com/v1/current.json?key=${key}&q=${lat},${lon}&lang=en`
  const res = await tfetch(url)
  const data = await res.json()
  if (data.error) return null
  return {
    apiId: 'weatherapi',
    displayName: 'WeatherAPI',
    temp: data.current.temp_c,
    feelsLike: data.current.feelslike_c,
    rainPct: data.current.humidity,
    windKmh: Math.round(data.current.wind_kph),
    condition: data.current.condition.text,
  }
}

// ── Tomorrow.io ───────────────────────────────────────────────────────────────
export async function fetchTomorrow(lat, lon) {
  const key = process.env.TOMORROW_KEY ?? process.env.TOMORROW_API_KEY
  if (!key) return null
  const url = `https://api.tomorrow.io/v4/weather/realtime?location=${lat},${lon}&apikey=${key}&units=metric`
  try {
    const res = await tfetch(url)
    const data = await res.json()
    if (data.code || !data.data?.values) return null
    const v = data.data.values
    return {
      apiId: 'tomorrow',
      displayName: 'Tomorrow.io',
      temp: Math.round(v.temperature * 10) / 10,
      feelsLike: Math.round(v.temperatureApparent * 10) / 10,
      rainPct: Math.round(v.precipitationProbability ?? 0),
      windKmh: Math.round((v.windSpeed ?? 0) * 3.6),
      condition: decodeTomorrowCode(v.weatherCode),
    }
  } catch {
    return null
  }
}

function decodeTomorrowCode(code) {
  if (code === 1000) return 'Clear'
  if (code <= 1001) return 'Cloudy'
  if (code <= 1100) return 'Clear'
  if (code <= 1102) return 'Partly cloudy'
  if (code <= 2000) return 'Foggy'
  if (code >= 4000 && code <= 4001) return 'Drizzle'
  if (code >= 4200 && code <= 4201) return 'Rain'
  if (code >= 5000 && code <= 5101) return 'Snow'
  if (code >= 6000 && code <= 6201) return 'Freezing rain'
  if (code >= 7000 && code <= 7102) return 'Ice pellets'
  if (code >= 8000) return 'Thunderstorm'
  return 'Cloudy'
}

// ── MET Norway (free, no key) ─────────────────────────────────────────────────
export async function fetchMETNorway(lat, lon) {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`
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
    return {
      apiId: 'met-norway',
      displayName: 'MET Norway',
      temp: Math.round(instant.air_temperature * 10) / 10,
      feelsLike: Math.round(instant.air_temperature * 10) / 10,
      rainPct: next1h?.details?.probability_of_precipitation
             ?? next6h?.details?.probability_of_precipitation
             ?? 0,
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

// ── World Weather Online ──────────────────────────────────────────────────────
export async function fetchWorldWeatherOnline(lat, lon) {
  const key = process.env.WORLD_WEATHER_KEY
  if (!key) return null
  const url = `https://api.worldweatheronline.com/premium/v1/weather.ashx?key=${key}&q=${lat},${lon}&format=json&num_of_days=1&tp=1`
  try {
    const res = await tfetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const c = data.data?.current_condition?.[0]
    if (!c) return null
    return {
      apiId: 'world-weather-online',
      displayName: 'World Weather Online',
      temp:      parseFloat(c.temp_C),
      feelsLike: parseFloat(c.FeelsLikeC),
      rainPct:   parseInt(c.cloudcover ?? 0),
      windKmh:   parseInt(c.windspeedKmph ?? 0),
      condition: c.weatherDesc?.[0]?.value ?? 'Unknown',
    }
  } catch {
    return null
  }
}

// ── Weatherstack ──────────────────────────────────────────────────────────────
export async function fetchWeatherStack(lat, lon) {
  const key = process.env.WEATHERSTACK_KEY
  if (!key) return null
  // Free plan requires HTTP; paid plans support HTTPS
  const url = `http://api.weatherstack.com/current?access_key=${key}&query=${lat},${lon}&units=m`
  try {
    const res = await tfetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (data.success === false || !data.current) return null
    const c = data.current
    return {
      apiId: 'weatherstack',
      displayName: 'Weatherstack',
      temp:      c.temperature,
      feelsLike: c.feelslike,
      rainPct:   c.cloudcover ?? 0,
      windKmh:   c.wind_speed,          // km/h with units=m
      condition: c.weather_descriptions?.[0] ?? 'Unknown',
    }
  } catch {
    return null
  }
}

// ── NASA POWER ────────────────────────────────────────────────────────────────
export async function fetchNASAPOWER(lat, lon) {
  // POWER data has ~1 h lag; go back 2 h to ensure the hourly slot is populated
  const queryTime = new Date(Date.now() - 2 * 3600 * 1000)
  const dateStr   = queryTime.toISOString().slice(0, 10).replace(/-/g, '')   // YYYYMMDD
  const hour      = String(queryTime.getUTCHours())

  const url = `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=T2M,WS2M,PRECTOTCORR&community=RE&longitude=${lon}&latitude=${lat}&start=${dateStr}&end=${dateStr}&format=JSON`
  try {
    const res = await tfetch(url, { signal: AbortSignal.timeout(12000) })
    if (!res.ok) return null
    const data = await res.json()
    const p = data.properties?.parameter
    if (!p) return null

    const FILL = -999
    const temp = p.T2M?.[dateStr]?.[hour]
    const wind = p.WS2M?.[dateStr]?.[hour]
    const prec = p.PRECTOTCORR?.[dateStr]?.[hour] ?? 0

    if (temp === undefined || temp === FILL) return null

    return {
      apiId: 'nasa-power',
      displayName: 'NASA POWER',
      temp:      Math.round(temp * 10) / 10,
      feelsLike: Math.round(temp * 10) / 10,   // no apparent_temp in POWER
      rainPct:   (prec > 0 && prec !== FILL) ? Math.min(Math.round(prec * 50), 90) : 0,
      windKmh:   (wind !== undefined && wind !== FILL) ? Math.round(wind * 3.6) : 0,
      condition: prec > 1 ? 'Rain' : prec > 0 ? 'Drizzle' : 'Clear',
    }
  } catch {
    return null
  }
}

// ── Visual Crossing ───────────────────────────────────────────────────────────
export async function fetchVisualCrossing(lat, lon) {
  const key = process.env.VISUAL_CROSSING_KEY
  if (!key) return null
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
      rainPct:  Math.round(c.precipprob ?? 0),
      windKmh:  Math.round(c.windspeed  ?? 0),   // already km/h with unitGroup=metric
      condition: c.conditions ?? 'Unknown',
    }
  } catch {
    return null
  }
}

// ── GeoSphere Austria (INCA analysis, free, no key) ───────────────────────────
// 1 km hourly analysis grid. Covers Austria + a thin border margin only (DACH
// edge), so we skip coordinates clearly outside that box — the forecast route
// simply ignores a null source, no "down" penalty.
export async function fetchGeoSphere(lat, lon) {
  if (lat < 46 || lat > 49.2 || lon < 9.3 || lon > 17.3) return null

  const floorHour = ms => { const d = new Date(ms); d.setUTCMinutes(0, 0, 0); return d.toISOString().slice(0, 16) }
  const start = floorHour(Date.now() - 2 * 3600 * 1000)
  const end   = floorHour(Date.now())
  const e = 0.01 // ~1 km bbox around the point
  const bbox = `${(lat - e).toFixed(2)},${(lon - e).toFixed(2)},${(lat + e).toFixed(2)},${(lon + e).toFixed(2)}`
  const url = `https://dataset.api.hub.geosphere.at/v1/grid/historical/inca-v1-1h-1km?parameters=T2M,RR,UU,VV&start=${start}&end=${end}&bbox=${bbox}&output_format=geojson`

  try {
    const res = await tfetch(url)
    if (!res.ok) return null
    const p = (await res.json()).features?.[0]?.properties?.parameters
    const series = p?.T2M?.data
    if (!series?.length) return null

    // most recent slot that actually has a temperature
    let i = series.length - 1
    while (i >= 0 && series[i] == null) i--
    if (i < 0) return null

    const temp = series[i]
    const rr   = p.RR?.data?.[i] ?? 0          // mm in the hour
    const uu   = p.UU?.data?.[i]               // m/s eastward
    const vv   = p.VV?.data?.[i]               // m/s northward
    const windKmh = (uu != null && vv != null) ? Math.round(Math.hypot(uu, vv) * 3.6) : 0

    return {
      apiId: 'geosphere',
      displayName: 'GeoSphere Austria',
      temp:      Math.round(temp * 10) / 10,
      feelsLike: Math.round(temp * 10) / 10,   // INCA has no apparent temp
      // INCA reports precip amount, not probability — approximate like NASA POWER
      rainPct:   rr > 0 ? Math.min(Math.round(rr * 50), 90) : 0,
      windKmh,
      condition: rr > 1 ? 'Rain' : rr > 0 ? 'Drizzle' : 'Clear',
    }
  } catch {
    return null
  }
}

// ── Geocoding ─────────────────────────────────────────────────────────────────
export async function geocodeCity(city, lang = 'en') {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=${lang}`
  try {
    const res = await tfetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.results?.length) return null
    const r = data.results[0]
    return { lat: r.latitude, lon: r.longitude, name: r.name, country: r.country }
  } catch {
    return null
  }
}

// ── WMO weather codes ─────────────────────────────────────────────────────────
export function decodeWeatherCode(code) {
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

// ── 7-day forecast ────────────────────────────────────────────────────────────
export async function fetchOpenMeteoForecast(lat, lon) {
  // Always resolve to a usable shape — a flaky open-meteo (502 / timeout) must
  // not take down the whole forecast route, which destructures `{ days }` here.
  const empty = { days: [], sunrise: '–', sunset: '–' }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,weathercode,sunrise,sunset&timezone=auto&forecast_days=7`
  try {
    const res = await tfetch(url)
    if (!res.ok) return empty
    const data = await res.json()
    if (!data.daily?.time) return empty

    const days = data.daily.time.map((date, i) => ({
      date,
      tempMax:   data.daily.temperature_2m_max[i],
      tempMin:   data.daily.temperature_2m_min[i],
      rainPct:   data.daily.precipitation_probability_max[i],
      windKmh:   Math.round(data.daily.windspeed_10m_max[i]),
      condition: decodeWeatherCode(data.daily.weathercode[i]),
      icon:      weatherIcon(data.daily.weathercode[i]),
    }))

    const fmtTime = iso => iso?.slice(11, 16) ?? '–'
    return {
      days,
      sunrise: fmtTime(data.daily.sunrise?.[0]),
      sunset:  fmtTime(data.daily.sunset?.[0]),
    }
  } catch {
    return empty
  }
}

// UV, air quality and pollen. All keyless — UV rides the forecast endpoint,
// AQI + pollen come from the air-quality one.
export async function fetchOpenMeteoExtras(lat, lon) {
  const out = { uvIndex: null, aqi: null, pollen: null }

  try {
    const uvUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=uv_index&daily=uv_index_max&timezone=auto&forecast_days=1`
    const uvRes = await tfetch(uvUrl)
    if (uvRes.ok) {
      const uvData = await uvRes.json()
      const uv = uvData.current?.uv_index ?? uvData.daily?.uv_index_max?.[0]
      if (uv != null) out.uvIndex = Math.round(uv * 10) / 10
    }
  } catch {}

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

  return out
}

// Pick the nicest hour left today to be outside.
export async function fetchOpenMeteoHourly(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,windspeed_10m,weathercode&timezone=auto&forecast_days=1`
  try {
    const res = await tfetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const h = data.hourly
    if (!h?.time?.length) return null

    const nowHour = new Date().getHours()
    const hours = h.time.map((time, i) => ({
      time,
      hour: new Date(time).getHours(),
      temp: Math.round(h.temperature_2m[i]),
      rainPct: h.precipitation_probability?.[i] ?? 0,
      windKmh: Math.round(h.windspeed_10m?.[i] ?? 0),
      icon: weatherIcon(h.weathercode?.[i] ?? 0),
    }))

    // daytime hours from now on (fall back to the whole day if it's late)
    const rest = hours.filter(x => x.hour >= nowHour && x.hour >= 7 && x.hour <= 21)
    const pool = rest.length ? rest : hours.filter(x => x.hour >= 7 && x.hour <= 21)
    if (!pool.length) return { best: null, hours: [] }

    // lower is better: rain hurts most, then wind, then leaving the 15-25° comfort band
    const score = x => {
      const tempMiss = x.temp < 15 ? 15 - x.temp : x.temp > 25 ? x.temp - 25 : 0
      return x.rainPct + x.windKmh * 0.5 + tempMiss * 2
    }
    const best = [...pool].sort((a, b) => score(a) - score(b))[0]

    return { best, hours: pool }
  } catch {
    return null
  }
}

// Extra current-conditions detail (snow, visibility, cloud, ground temp, precip).
export async function fetchOpenMeteoDetails(lat, lon) {
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
export async function fetchYesterdayTemp(lat, lon) {
  const d = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
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

// 10 years of this-month history → climate normals + (for records) extremes.
export async function fetchMonthHistory(lat, lon) {
  const now = new Date()
  const month = now.getMonth() + 1
  const endYear = now.getFullYear() - 1
  const startYear = endYear - 9
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startYear}-01-01&end_date=${endYear}-12-31&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum&timezone=auto`
  try {
    const res = await tfetch(url)
    if (!res.ok) return null
    const day = (await res.json()).daily
    if (!day?.time) return null

    let tSum = 0, tN = 0
    let hottest = null, coldest = null, wettest = null
    const rainyByYear = {}, yearsSeen = new Set()

    day.time.forEach((d, i) => {
      if (parseInt(d.slice(5, 7)) !== month) return
      const year = d.slice(0, 4)
      yearsSeen.add(year)
      const mean = day.temperature_2m_mean[i]
      const hi = day.temperature_2m_max[i]
      const lo = day.temperature_2m_min[i]
      const p = day.precipitation_sum[i]
      if (mean != null) { tSum += mean; tN++ }
      if (hi != null && (!hottest || hi > hottest.temp)) hottest = { temp: hi, date: d }
      if (lo != null && (!coldest || lo < coldest.temp)) coldest = { temp: lo, date: d }
      if (p != null && (!wettest || p > wettest.mm)) wettest = { mm: Math.round(p), date: d }
      if (p != null && p >= 1) rainyByYear[year] = (rainyByYear[year] || 0) + 1
    })

    const years = yearsSeen.size || 1
    const avgRainyDays = Math.round(
      Object.values(rainyByYear).reduce((s, n) => s + n, 0) / years
    )

    return {
      month,
      years,
      avgTemp: tN ? Math.round(tSum / tN * 10) / 10 : null,
      avgRainyDays,
      records: { hottest, coldest, wettest },
    }
  } catch {
    return null
  }
}

function weatherIcon(code) {
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
