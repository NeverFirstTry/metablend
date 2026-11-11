// What a summit page shows of a summit forecast (/api/hike), shared by the server (the page's stored
// copy, app/mountains/[peak]/page.js) and the browser (the live forecast a visitor gets a moment later,
// SummitPage.jsx): only these parts go into the page, not the whole forecast. Pure.
export function summitProps(d) {
  return {
    days: d.days?.map(({ date, icon, tempMin, tempMax, windMax, rainPct, freezingMin, freezingMax, storm }) => ({ date, icon, tempMin, tempMax, windMax, rainPct, freezingMin, freezingMax, storm })),
    windows: d.windows ? { today: d.windows.today, tomorrow: d.windows.tomorrow } : null,
    todayLocal: d.nowLocal?.slice(0, 10),
    tomorrowLocal: d.days?.[1]?.date,
    stormUnknown: !!d.notes?.includes('no_storm_data'),
    sources: d.sources?.map(s => s.name),
  }
}

// the stored copy's request: the three core models, kept six hours (the pages are asked mostly by crawlers)
export const STORED_SECONDS = 6 * 3600
export const storedPath = path => `${path}&models=core`
