// City-local time, approximated from the longitude (15° ≈ 1 h solar time).
// No timezone database on purpose: "is it night there" and "which calendar
// day is it there" are all the app asks, and solar time answers both well
// enough. Pure — safe to import from client components and `node --test`.

const offsetMs = lon => (typeof lon === 'number' ? lon / 15 : 0) * 3600 * 1000

// Hour of day (fractional, 0 ≤ h < 24) at the given longitude.
export function localHourAt(lon, now = new Date()) {
  const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60
  return (((utcHour + (typeof lon === 'number' ? lon / 15 : 0)) % 24) + 24) % 24
}

// Night = 21:00–06:00 city-local. Shared by the feedback sunny-at-night guard,
// the feedback form's condition options and MetaBlend Local's bias buckets.
export function isNightAt(lon, now = new Date()) {
  const local = localHourAt(lon, now)
  return local >= 21 || local < 6
}

// The date (YYYY-MM-DD) it currently is at the given longitude. Forecast rows
// are tagged with the CITY's day, not the server's UTC day — otherwise evening
// searches in Asia/Pacific land on the wrong date and daily calibration
// compares against the wrong day's mean.
export function localDateForLon(lon, now = Date.now()) {
  return new Date(now + offsetMs(lon)).toISOString().split('T')[0]
}

// The instant the city's current calendar day began — not the server's
// midnight, which on a UTC host is hours off for anywhere far from Greenwich.
export function localMidnightUtc(lon, now = Date.now()) {
  return new Date(Date.parse(`${localDateForLon(lon, now)}T00:00:00Z`) - offsetMs(lon))
}

// Format a YYYY-MM-DD calendar date for display. `new Date('2026-09-30')`
// is UTC midnight, which the viewer's timezone then shifts: anyone west of
// UTC saw every date one day early. Formatting in UTC keeps the date as-is.
export function formatCalendarDate(dateStr, lang, opts) {
  return new Date(dateStr).toLocaleDateString(lang, { ...opts, timeZone: 'UTC' })
}
