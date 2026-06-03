// Open-Meteo – kostenlos, kein API Key nötig
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

// OpenWeatherMap – Free Tier, API Key nötig
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

export async function fetchWeatherAPI(lat, lon) {
  const key = process.env.WEATHERAPI_KEY
  if (!key) return null
  const url = `https://api.weatherapi.com/v1/current.json?key=${key}&q=${lat},${lon}&lang=de`
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

// Stadtname → Koordinaten (Open-Meteo Geocoding, kostenlos)
export async function geocodeCity(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=de`
  const res = await fetch(url)
  const data = await res.json()
  if (!data.results?.length) return null
  const r = data.results[0]
  return { lat: r.latitude, lon: r.longitude, name: r.name, country: r.country }
}

// WMO Wettercodes → lesbarer Text
export function decodeWeatherCode(code) {
  if (code === 0) return 'Sonnig'
  if (code <= 2) return 'Leicht bewölkt'
  if (code <= 3) return 'Bewölkt'
  if (code <= 48) return 'Neblig'
  if (code <= 55) return 'Nieselregen'
  if (code <= 67) return 'Regen'
  if (code <= 77) return 'Schnee'
  if (code <= 82) return 'Regenschauer'
  if (code <= 99) return 'Gewitter'
  return 'Unbekannt'
}

export async function fetchOpenMeteoForecast(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,weathercode,sunrise,sunset&timezone=auto&forecast_days=7`
  const res = await fetch(url)
  const data = await res.json()

  const days = data.daily.time.map((date, i) => ({
    date,
    tempMax: data.daily.temperature_2m_max[i],
    tempMin: data.daily.temperature_2m_min[i],
    rainPct: data.daily.precipitation_probability_max[i],
    windKmh: Math.round(data.daily.windspeed_10m_max[i]),
    condition: decodeWeatherCode(data.daily.weathercode[i]),
    icon: weatherIcon(data.daily.weathercode[i]),
  }))

  const fmtTime = iso => iso?.slice(11, 16) ?? '–'

  return {
    days,
    sunrise: fmtTime(data.daily.sunrise?.[0]),
    sunset:  fmtTime(data.daily.sunset?.[0]),
  }
}

function weatherIcon(code) {
  if (code === 0) return '☀️'
  if (code <= 2) return '🌤'
  if (code <= 3) return '⛅'
  if (code <= 48) return '🌫'
  if (code <= 55) return '🌦'
  if (code <= 67) return '🌧'
  if (code <= 77) return '🌨'
  if (code <= 82) return '🌦'
  if (code <= 99) return '⛈'
  return '🌡'
}
