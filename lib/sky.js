// The living sky (pure — unit tested): which sky the page wears, from the
// current weather code (WMO) and the city's own sunrise / sunset. The page's
// background gradient is this answer, so it is data, not decoration.

// Top → middle → horizon of each sky (also the CSS values in globals.css).
export const SKIES = {
  night: ['#060a1c', '#101d45', '#27366b'],
  dawn: ['#1a2553', '#3e3256', '#4f3124'],
  day: ['#0e3a6e', '#173b61', '#283a49'],
  cloudy: ['#2a3a4e', '#2e3947', '#323840'],
  rain: ['#18222e', '#2a3a4c', '#2d3a47'],
  storm: ['#110f1b', '#27213d', '#3d3354'],
  snow: ['#2c394d', '#303844', '#34383d'],
  dusk: ['#141c3d', '#462f57', '#542f25'],
}

const minutes = hm => (typeof hm === 'string' && /^\d\d:\d\d$/.test(hm) ? Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3)) : null)

function weather(code) {
  if (typeof code !== 'number') return 'clear'
  if (code >= 95) return 'storm'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if (code === 3 || code === 45 || code === 48) return 'cloudy'
  return 'clear'
}

// nowLocal: 'YYYY-MM-DDTHH:MM' city time; sun: { sunrise, sunset } 'HH:MM'.
export function skyFor({ code = null, nowLocal = null, sun = null } = {}) {
  const w = weather(code)
  if (w === 'storm' || w === 'rain' || w === 'snow') return w
  const m = minutes(nowLocal?.slice(11, 16))
  if (m == null) return 'night'
  const rise = minutes(sun?.sunrise) ?? 6 * 60 + 30
  const set = minutes(sun?.sunset) ?? 19 * 60
  if (m < rise - 40 || m > set + 40) return 'night'
  if (m < rise + 50) return 'dawn'
  if (m > set - 60) return 'dusk'
  return w === 'cloudy' ? 'cloudy' : 'day'
}

// Is it dark at this city time ('HH:MM')? null when the sun times are unknown.
export function isDark(hhmm, sun) {
  const m = minutes(hhmm), rise = minutes(sun?.sunrise), set = minutes(sun?.sunset)
  if (m == null || rise == null || set == null) return null
  return m < rise || m >= set
}

// An hour's icon after dark: the sun gives way to the moon.
export function nightIcon(icon) {
  if (icon === '☀️' || icon === '🌤') return '🌙'
  if (icon === '⛅') return '☁️'
  return icon
}
