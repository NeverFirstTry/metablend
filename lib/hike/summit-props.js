// What a summit page shows of a summit forecast (/api/hike), shared by the server (the stored copy the
// page is built from, app/mountains/[peak]/page.js) and the browser (the live forecast its button
// fetches, SummitPage.jsx): only these parts go into the page, not the whole forecast. Pure.
import { formatCalendarDate } from '../localtime.js'

export function summitProps(d) {
  return {
    days: d.days?.map(({ date, icon, tempMin, tempMax, windMax, rainPct, freezingMin, freezingMax, storm }) => ({ date, icon, tempMin, tempMax, windMax, rainPct, freezingMin, freezingMax, storm })),
    windows: d.windows ? { today: d.windows.today, tomorrow: d.windows.tomorrow } : null,
    todayLocal: d.nowLocal?.slice(0, 10),
    tomorrowLocal: d.days?.[1]?.date,
    stormUnknown: !!d.notes?.includes('no_storm_data'),
    sources: d.sources?.map(s => s.name),
    // when the server fetched this forecast, to the minute, in the summit's own time: the page says so.
    // (nowLocal is the forecast's current hour, the top of the hour, and would show a live forecast
    // fetched at 01:52 as made at 01:00.)
    madeAt: d.generatedAt && d.utcOffsetSec != null ? new Date(Date.parse(d.generatedAt) + d.utcOffsetSec * 1000).toISOString().slice(0, 16) : d.nowLocal?.slice(0, 16),
  }
}

// the stored copy's request: the three core models. The page built from it is kept six hours (the pages
// are asked mostly by crawlers); the request itself is kept an hour like every summit forecast, so the
// six hours do not stack on top of each other.
export const STORED_SECONDS = 6 * 3600
export const storedPath = path => `${path}&models=core`

// The page's live button names itself to the route in this header, so its Open-Meteo requests are counted
// on their own (summit-live). The address stays the shared one, and with it the CDN's hourly copy.
export const LIVE_HEADER = 'x-summit-live'

// "12. Nov., 14:00": the summit's wall time as it stands in the forecast, the same on the server and in
// every browser whatever its time zone
export const madeAtText = (madeAt, lang) => (madeAt ? `${formatCalendarDate(madeAt.slice(0, 10), lang, { month: 'short', day: 'numeric' })}, ${madeAt.slice(11, 16)}` : '')
