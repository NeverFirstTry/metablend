// Assembles the /api/hike payload from the raw summit response (pure — the
// route fetches, this does the rest, so it's unit tested). windows.today /
// windows.tomorrow are the headline data the UI and push alerts phrase.
import { parseSummitMulti } from './parse.js'
import { blendSummitHourly, summitDays } from './blend.js'
import { summitWindow, descentReserve } from './window.js'
import { addDays, localHourIso } from '../localtime.js'
import { sourceName } from '../sources.js'

export function buildHike({ peak, region, multi, weights = {}, now = Date.now() }) {
  const parsed = parseSummitMulti(multi)
  const utcOffsetSec = parsed?.utcOffsetSec ?? Math.round(peak.lon / 15) * 3600
  const series = parsed?.series ?? []
  const nowLocal = localHourIso(utcOffsetSec, now)
  const todayLocal = nowLocal.slice(0, 10)
  const tomorrow = addDays(todayLocal, 1)
  const sun = parsed?.sun ?? { sunrise: null, sunset: null }
  const hourly = blendSummitHourly(series, weights, { nowLocal, elev: peak.elev, hours: 168 })
  const reserveH = descentReserve(peak) // daylight left for the way down

  const notes = []
  if (series.length < 2) notes.push('fewer_sources')
  if (hourly.length && hourly.every(h => h.storm == null)) notes.push('no_storm_data')

  // one day's calendar hours only: the outlook's evening "tonight" stretch
  // would join tomorrow's first light onto tonight's last into one run
  const hoursOn = date => hourly.filter(h => h.t.startsWith(date))
  const windowOn = date => summitWindow(hoursOn(date), parsed?.sunByDate?.[date] ?? sun, { reserveH })
  const days = summitDays(hourly)
  // The week (the peak's Week tab): the window of every day the forecast covers to its evening, under
  // its date, the same answer `today` and `tomorrow` are. A last day whose hours stop early has no entry:
  // a cut-off forecast is not a verdict. stormUnknown: an hour of the window has no storm value, so the
  // day must not be shown as favourable without saying so (a week out, fewer models report it; `notes`
  // flags only an answer without any). n: the fewest models behind an hour of the window.
  const week = days.filter((d, i) => i === 0 || !d.partial).map(({ date }) => {
    const w = windowOn(date)
    const inside = w?.window ? hoursOn(date).filter(h => h.t >= w.window.from && h.t < w.window.to) : []
    return { date, w, stormUnknown: inside.some(h => h.storm == null), n: inside.length ? Math.min(...inside.map(h => h.n)) : null }
  })

  return {
    peak: { name: peak.name ?? null, lat: peak.lat, lon: peak.lon, elev: peak.elev },
    region, generatedAt: new Date(now).toISOString(), utcOffsetSec, nowLocal, sun,
    sources: series.map(s => ({ id: s.id, name: sourceName(s.id) })),
    notes,
    hourly,
    days,
    windows: { today: windowOn(todayLocal), tomorrow: windowOn(tomorrow), days: week },
  }
}
