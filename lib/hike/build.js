// Assembles the /api/hike payload from the raw summit response (pure — the
// route fetches, this does the rest, so it's unit tested). windows.today /
// windows.tomorrow are the headline data the UI and push alerts phrase.
import { parseSummitMulti } from './parse.js'
import { blendSummitHourly, summitDays } from './blend.js'
import { summitWindow } from './window.js'
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

  const notes = []
  if (series.length < 2) notes.push('fewer_sources')
  if (hourly.length && hourly.every(h => h.storm == null)) notes.push('no_storm_data')

  return {
    peak: { name: peak.name ?? null, lat: peak.lat, lon: peak.lon, elev: peak.elev },
    region, generatedAt: new Date(now).toISOString(), utcOffsetSec, nowLocal, sun,
    sources: series.map(s => ({ id: s.id, name: sourceName(s.id) })),
    notes,
    hourly,
    days: summitDays(hourly),
    windows: {
      // today's calendar hours only: the outlook's evening "tonight" stretch
      // would join tomorrow's first light onto tonight's last into one run
      today: summitWindow(hourly.filter(h => h.t.startsWith(todayLocal)), parsed?.sunByDate?.[todayLocal] ?? sun),
      tomorrow: summitWindow(hourly.filter(h => h.t.startsWith(tomorrow)), parsed?.sunByDate?.[tomorrow] ?? sun),
    },
  }
}
