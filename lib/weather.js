// Open-Meteo – kostenlos, kein API Key nötig
export async function fetchOpenMeteo(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation_probability,windspeed_10m,weathercode&timezone=auto`
  const res = await fetch(url)
  const data = await res.json()
  const c = data.current

  return {
    apiId: 'open-meteo',
    temp: c.temperature_2m,
    rainPct: c.precipitation_probability,
    windKmh: Math.round(c.windspeed_10m),
    condition: decodeWeatherCode(c.weathercode),
  }
}

// OpenWeatherMap – Free Tier, API Key nötig
export async function fetchOWM(lat, lon) {
  const key = process.env.OPENWEATHERMAP_API_KEY
  console.log('OWM key:', key?.slice(0, 8))
  if (!key) return null
  
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric`
  console.log('OWM url:', url)
  const res = await fetch(url)
  const data = await res.json()
  console.log('OWM response:', data)

  return {
    apiId: 'owm',
    temp: data.main.temp,
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
    temp: data.current.temp_c,
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