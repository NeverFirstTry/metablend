// What the app hands its home-screen widgets (pure — unit tested): language
// and unit, the home city, the cities looked at most, and the upcoming
// planned hikes. Names and coordinates only — no keys, no ids.
export const WIDGET_BASE = 'https://metablend.app'

export function widgetSettings({ lang, unit, home = null, views = {}, plans = [], today }) {
  const byViews = Object.entries(views ?? {})
    .filter(([city, n]) => city && n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([city]) => city)
  const homeCity = home || byViews[0] || null
  const recent = [...new Set([homeCity, ...byViews].filter(Boolean))].slice(0, 8)
  const hikes = (plans ?? [])
    .filter(p => typeof p?.date === 'string' && p.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)
    .map(({ name, lat, lon, elev, date }) => ({ name, lat, lon, elev, date }))
  return { v: 1, lang, unit, base: WIDGET_BASE, home: homeCity, recent, hikes }
}

// The phone's calendar day (plans are days at the peak, which is the phone's
// region in practice).
export function localToday(d = new Date()) {
  const two = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
}
