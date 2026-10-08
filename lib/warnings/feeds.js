// MeteoAlarm's open country feeds (no key) for the countries the region map
// covers. Switzerland, the UK and Ukraine have feeds but no outlines in
// lib/warnings/regions.json, so they are left out (see the spec).
export const FEEDS = [
  ['austria', 'AT'], ['belgium', 'BE'], ['bosnia-herzegovina', 'BA'], ['bulgaria', 'BG'], ['croatia', 'HR'],
  ['cyprus', 'CY'], ['czechia', 'CZ'], ['denmark', 'DK'], ['estonia', 'EE'], ['finland', 'FI'],
  ['france', 'FR'], ['germany', 'DE'], ['greece', 'GR'], ['hungary', 'HU'], ['iceland', 'IS'],
  ['ireland', 'IE'], ['israel', 'IL'], ['italy', 'IT'], ['latvia', 'LV'], ['lithuania', 'LT'],
  ['luxembourg', 'LU'], ['malta', 'MT'], ['moldova', 'MD'], ['montenegro', 'ME'], ['netherlands', 'NL'],
  ['norway', 'NO'], ['poland', 'PL'], ['portugal', 'PT'], ['republic-of-north-macedonia', 'MK'], ['romania', 'RO'],
  ['serbia', 'RS'], ['slovakia', 'SK'], ['slovenia', 'SI'], ['spain', 'ES'], ['sweden', 'SE'],
]
export const feedUrl = slug => `https://feeds.meteoalarm.org/api/v1/warnings/feeds-${slug}`
