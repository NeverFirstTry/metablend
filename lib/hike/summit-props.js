// What a summit page shows of a summit forecast (/api/hike), shared by the server (the stored copy the
// page is built from, app/mountains/[peak]/page.js) and the browser (the live forecast its button
// fetches, SummitPage.jsx): only these parts go into the page, not the whole forecast. Pure.
import { formatCalendarDate, addDays } from '../localtime.js'

export function summitProps(d) {
  return {
    days: d.days?.map(({ date, icon, tempMin, tempMax, windMax, rainPct, freezingMin, freezingMax, storm, precip }) => ({ date, icon, tempMin, tempMax, windMax, rainPct, freezingMin, freezingMax, storm, ...(precip ? { precip } : {}) })),
    windows: d.windows ? { today: d.windows.today, tomorrow: d.windows.tomorrow } : null,
    todayLocal: d.nowLocal?.slice(0, 10),
    tomorrowLocal: d.days?.[1]?.date,
    stormUnknown: !!d.notes?.includes('no_storm_data'),
    sources: d.sources?.map(s => s.name),
    // when the server fetched this forecast, to the minute, in the summit's own time: the page says so.
    // (nowLocal is the forecast's current hour, the top of the hour, and would show a live forecast
    // fetched at 01:52 as made at 01:00.)
    // the peak's last good answer from before an outage (lib/last-answer.js): not a live forecast
    kept: !!d.kept,
    madeAt: d.generatedAt && d.utcOffsetSec != null ? new Date(Date.parse(d.generatedAt) + d.utcOffsetSec * 1000).toISOString().slice(0, 16) : d.nowLocal?.slice(0, 16),
    // the summit's offset from UTC: with it a reader's clock gives the day at the summit (summitDay)
    utcOffsetSec: d.utcOffsetSec ?? null,
  }
}

// the calendar day at the summit at a moment, from the forecast's own offset
export const summitDay = (utcOffsetSec, now = Date.now()) => new Date(now + utcOffsetSec * 1000).toISOString().slice(0, 10)

// What a reader sees of a copy made earlier. A stored page is read hours after it was built, and what the
// copy calls today can be yesterday by then: until 2026-11-17 a page stored in the evening and read at
// 05:00 called yesterday "Today", with yesterday's favourable window and avalanche danger. `today` is the
// reader's day at the summit, or null while no clock has been read (the server's render and the browser's
// first one): then no day is called today, each stands with its date, and "no daylight left today" is
// not said. Returns the days from the reader's day on, and the windows and avalanche danger the copy has
// for those days as [{ date, w }] and [{ date, level }]. A clock past every day of the copy is not
// believed (a device set to the wrong day would empty the page): the copy is then shown as it is.
export function summitOn(p, ava, today) {
  const left = today ? (p.days ?? []).filter(d => d.date >= today) : []
  const known = left.length > 0
  const dated = (a, b) => [[p.todayLocal, a], [p.tomorrowLocal, b]].filter(([date]) => date && (!known || date >= today))
  return {
    todayLocal: known ? today : null,
    days: known ? left : p.days,
    windows: dated(p.windows?.today, p.windows?.tomorrow).filter(([, w]) => w !== undefined && (known || w !== null)).map(([date, w]) => ({ date, w })),
    ava: dated(ava?.today, ava?.tomorrow).filter(([, level]) => level).map(([date, level]) => ({ date, level })),
  }
}

// The avalanche danger as the browser reads it when the page opens (/api/avalanche): not kept with the
// page, so a page stored for hours never shows an old level. The answer carries its own days (`dates`),
// and those date it, not the stored forecast's. [] while nothing has come or when the read failed.
export const freshAva = (p, a, today) => (a?.dates ? summitOn({ ...p, todayLocal: a.dates.today, tomorrowLocal: a.dates.tomorrow }, a, today).ava : [])

// The hiking page's teaser reads the same stored copy on the server at every request: the window of the
// reader's day at the summit (after dark tomorrow's: "no daylight left" says nothing), or null when the
// copy has none for that day. A copy without the offset is read as its own day.
export function teaserWindow(d, now = Date.now()) {
  const stored = d.nowLocal?.slice(0, 10)
  const today = d.utcOffsetSec != null ? summitDay(d.utcOffsetSec, now) : stored
  if (today === stored) {
    const late = !d.windows?.today
    return { w: late ? d.windows?.tomorrow : d.windows.today, date: late ? addDays(stored, 1) : stored, todayLocal: stored }
  }
  return today === addDays(stored, 1) && d.windows?.tomorrow ? { w: d.windows.tomorrow, date: today, todayLocal: today } : null
}

// the stored copy's request: the three core models. The page built from it is kept six hours (the pages
// are asked mostly by crawlers); the request itself is kept an hour like every summit forecast, so the
// six hours do not stack on top of each other.
export const STORED_SECONDS = 6 * 3600
// a page built from the peak's last good answer during an Open-Meteo outage is built again after 30 minutes
// (lib/hike/summit-fetch.js): the six hours are for normal pages only (owner, 2026-11-20)
export const KEPT_SECONDS = 30 * 60
export const storedPath = path => `${path}&models=core`
// the summit pages' kept copy and nothing else: /api/hike answers it from the database or 404, never asking
// Open-Meteo (the first-time peaks' shelf, owner 2026-11-22)
export const keptOnlyPath = path => `${storedPath(path)}&stored=only`

// The page's live button names itself to the route in this header, so its Open-Meteo requests are counted
// on their own (summit-live). The address stays the shared one, and with it the CDN's hourly copy.
export const LIVE_HEADER = 'x-summit-live'

// "12. Nov., 14:00": the summit's wall time as it stands in the forecast, the same on the server and in
// every browser whatever its time zone
export const madeAtText = (madeAt, lang) => (madeAt ? `${formatCalendarDate(madeAt.slice(0, 10), lang, { month: 'short', day: 'numeric' })}, ${madeAt.slice(11, 16)}` : '')
