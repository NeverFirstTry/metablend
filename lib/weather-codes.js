// WMO weather codes as words and icons. No imports, on purpose: the browser uses these (the peak view through
// lib/hike/blend.js), and anything imported here would be sent to it too (lib/client-bundle.test.js).
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
