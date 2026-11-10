// The outlook as of the hour it is read in. An answer of /api/outlook is kept up to two and a half
// hours (the CDN's copy); the forecast in it stays right that long, but "now" moves on. So every reader
// that shows the hours ahead passes the answer through atNow(): the hours already past are dropped,
// "now" and "today" are the reader's own, and what is read off them (best time outside, the
// headlines, the week against normal) is worked out again by the same code that built it. Pure, and
// light enough for the browser (no parsing or blending is imported here).
import { todayHours, headlineToday, headlineTomorrow, headline7, bestTimeOutside } from './headlines.js'
import { anomalies } from './climate.js'
import { addDays, localHourIso } from '../localtime.js'

// the parts of the payload that depend on the hour and the day: built here for a fresh answer
// (lib/outlook/build.js) and again for one read later
export function timedParts({ hourly, days, normals, sun, todayLocal }) {
  const tomorrow = addDays(todayLocal, 1)
  return {
    bestTime: {
      today: bestTimeOutside(todayHours(hourly, todayLocal).hours, sun),
      tomorrow: bestTimeOutside(hourly.filter(h => h.t.startsWith(tomorrow)), sun),
    },
    vsNormal: anomalies(days, normals),
    headlines: {
      today: headlineToday(hourly, { todayLocal }),
      tomorrow: headlineTomorrow(hourly, days, normals, { todayLocal }),
      d7: headline7(days),
    },
  }
}

// A clock more than this past the build is not believed (a device set to the wrong day would empty
// the page): the answer is then read as if it were that old.
const OLDEST = 6 * 3600e3

export function atNow(p, now = Date.now()) {
  if (!p?.nowLocal || p.utcOffsetSec == null || !Array.isArray(p.hourly) || !Array.isArray(p.days)) return p
  const built = Date.parse(p.generatedAt)
  const nowLocal = localHourIso(p.utcOffsetSec, Number.isFinite(built) ? Math.min(now, built + OLDEST) : now)
  if (nowLocal <= p.nowLocal) return p // read in the hour it was built for (or by a clock that runs behind)
  const hourly = p.hourly.filter(h => h.t >= nowLocal)
  if (!hourly.length) return p
  const todayLocal = nowLocal.slice(0, 10)
  // past midnight the first day is yesterday: the days, and the normals that go with them, start today
  const gone = p.days.filter(d => d.date < todayLocal).length
  const days = gone ? p.days.slice(gone).map(d => ({ ...d, lead: d.lead - gone })) : p.days // lead 0 is today
  const normals = (p.normals ?? []).filter(n => n.date >= todayLocal)
  return {
    ...p, nowLocal, hourly, days, normals,
    ...timedParts({ hourly, days, normals, sun: p.sun, todayLocal }),
    // the normal count of rainy days was worked out for the days as built
    rainyDays: gone ? { forecast: days.filter(d => d.rainPct != null && d.rainPct >= 50).length, of: days.length, normal: null } : p.rainyDays,
  }
}
