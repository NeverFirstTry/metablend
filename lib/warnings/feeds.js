// MeteoAlarm's open country feeds (no key) for the countries whose warnings
// name EMMA_ID regions that lib/warnings/regions.json has outlines for
// (checked feed by feed, 2026-10-09). Not yet, for want of matching outlines:
//   own CAP polygons, no region codes: Estonia, Israel, Norway, Slovenia, Sweden
//   NUTS codes: Belgium (mostly), Bulgaria, France, Hungary
//   other codes: Croatia (new county numbers), Czechia (ORP / newer EMMA ids), Ireland (FIPS)
//   no warnings on the day to check: Iceland, Luxembourg, Malta, Moldova, North Macedonia, Romania
// Switzerland, the UK and Ukraine have no outlines at all (see the spec).
export const FEEDS = [
  ['austria', 'AT'], ['bosnia-herzegovina', 'BA'], ['cyprus', 'CY'], ['denmark', 'DK'], ['finland', 'FI'],
  ['germany', 'DE'], ['greece', 'GR'], ['italy', 'IT'], ['latvia', 'LV'], ['lithuania', 'LT'],
  ['montenegro', 'ME'], ['netherlands', 'NL'], ['poland', 'PL'], ['portugal', 'PT'], ['serbia', 'RS'],
  ['slovakia', 'SK'], ['spain', 'ES'],
]
export const feedUrl = slug => `https://feeds.meteoalarm.org/api/v1/warnings/feeds-${slug}`
