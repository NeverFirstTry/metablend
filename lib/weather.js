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
  const res = await fetch(url)
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
  const res = await fetch(url)
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
  const res = await fetch(url)
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
  const key = process.env.TOMORROW_API_KEY
  if (!key) return null
  const url = `https://api.tomorrow.io/v4/weather/realtime?location=${lat},${lon}&apikey=${key}&units=metric`
  try {
    const res = await fetch(url)
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
    const res = await fetch(url, {
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

// ── Geocoding ─────────────────────────────────────────────────────────────────
export async function geocodeCity(city, lang = 'en') {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=${lang}`
  const res = await fetch(url)
  const data = await res.json()
  if (!data.results?.length) return null
  const r = data.results[0]
  return { lat: r.latitude, lon: r.longitude, name: r.name, country: r.country }
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
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,weathercode,sunrise,sunset&timezone=auto&forecast_days=7`
  const res = await fetch(url)
  const data = await res.json()

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
