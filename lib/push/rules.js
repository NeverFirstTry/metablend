// Push rules (pure — unit tested): what a phone gets told, and when.
// cityEvents() reads one city's outlook once (device-independent);
// decide() applies one phone's switches, quiet hours, the daily cap and the
// send log; decideHike() handles a planned hike's evening and morning slots.
// All times are the city's own clock, from the payload's utcOffsetSec.
import { headlineToday, bestTimeOutside } from '../outlook/headlines.js'
import { addDays, addHours } from '../localtime.js'
import { nowcastRain } from '../nowcast.js'

export const RULES = {
  rainPct: 60, dryPct: 40, dryHours: 2, rainLead: [30, 120], rainGapH: 3,
  stormLead: [60, 240], severeLead: [60, 360], spellGapH: 6, severeWindKmh: 60,
  heatC: 30, heatHours: [7, 12],
  quietFrom: 22, quietTo: 7, cap: 3, briefingLateH: 2,
  warnLeadH: 12, // official warnings: alert once one is on or starts within this many hours
}
const SEVERE_CODE = { 65: 'heavy_rain', 82: 'heavy_rain', 67: 'freezing_rain', 75: 'heavy_snow', 86: 'heavy_snow' }
const PRIORITY = { warning: -1, severe: 0, storm: 1, rain: 2, heat: 3 }
const WEATHER = new Set(['rain', 'storm', 'severe', 'heat', 'warning'])

const isStorm = c => typeof c === 'number' && c >= 95 && c <= 99
const utcOf = (localIso, off) => Date.parse(`${localIso}:00Z`) - off * 1000
const gapH = (a, b) => Math.abs(Date.parse(`${a}:00Z`) - Date.parse(`${b}:00Z`)) / 3600e3
const within = (m, [lo, hi]) => m >= lo && m <= hi

export function localParts(now, off) {
  const iso = new Date(now + off * 1000).toISOString()
  return { date: iso.slice(0, 10), hour: Number(iso.slice(11, 13)), iso: iso.slice(0, 16) }
}

export function cityEvents(outlook, now, nowcast = null, warnings = null) {
  const off = outlook?.utcOffsetSec ?? 0
  const local = localParts(now, off)
  // the current hour onward — a cached outlook can start an hour or two back
  const hours = (outlook?.hourly ?? []).filter(h => utcOf(h.t, off) + 3600e3 > now)
  const lead = h => (utcOf(h.t, off) - now) / 60000
  const ev = { city: outlook?.city ?? null, off, local, rain: null, storm: null, severe: [], heat: null, briefing: null }

  const si = hours.findIndex(h => isStorm(h.code) && within(lead(h), RULES.stormLead))
  if (si >= 0) {
    let j = si
    while (j + 1 < hours.length && isStorm(hours[j + 1].code)) j++
    ev.storm = { from: hours[si].t, to: addHours(hours[j].t, 1) }
  }

  // rain: the 15-minute nowcast where short-range models cover the city;
  // the hourly rule only where they don't (or the nowcast is missing)
  const nr = nowcastRain(nowcast, now)
  if (nr !== undefined) ev.rain = nr
  else {
    const ri = hours.findIndex(h => typeof h.rainPct === 'number' && h.rainPct >= RULES.rainPct)
    if (ri >= 0 && within(lead(hours[ri]), RULES.rainLead)) {
      const before = hours.slice(Math.max(0, ri - RULES.dryHours), ri)
      if (before.length && before.every(h => typeof h.rainPct === 'number' && h.rainPct < RULES.dryPct)) {
        ev.rain = { from: hours[ri].t, pct: hours[ri].rainPct }
      }
    }
  }
  for (const h of hours) {
    if (!within(lead(h), RULES.severeLead)) continue
    const type = SEVERE_CODE[h.code] ?? (typeof h.windKmh === 'number' && h.windKmh >= RULES.severeWindKmh ? 'wind' : null)
    if (type && !ev.severe.some(s => s.type === type)) ev.severe.push({ type, from: h.t })
  }

  const today = outlook?.days?.find(d => d.date === local.date)
  if (typeof today?.tempMax === 'number' && today.tempMax >= RULES.heatC) ev.heat = { max: today.tempMax, date: local.date }
  if (today) {
    const todays = hours.filter(h => h.t.startsWith(local.date))
    ev.briefing = {
      date: local.date, min: today.tempMin, max: today.tempMax,
      headline: headlineToday(hours, { todayLocal: local.date }),
      best: bestTimeOutside(todays, outlook.sun)?.t ?? null,
    }
  }
  // official warnings (MeteoAlarm): null = the city is outside coverage. Where
  // covered they replace the model-based severe guesses, even when silent.
  ev.official = Array.isArray(warnings)
  ev.warnings = (warnings ?? [])
    .filter(w => w.level >= 3 && Date.parse(w.expires) > now && Date.parse(w.onset) - now <= RULES.warnLeadH * 3600e3)
    .sort((a, b) => b.level - a.level)
  if (ev.official) ev.severe = []
  return ev
}

export function decide(device, ev, log = []) {
  const { local, off } = ev
  const seen = (kind, match) => log.some(e => e.kind === kind && match(e))
  const quiet = local.hour >= RULES.quietFrom || local.hour < RULES.quietTo
  const want = []

  if (device.alert_severe) {
    const sentLevel = e => Number(e.ref.slice(e.ref.lastIndexOf('@') + 1))
    // when the quiet hours end (07:00 local, tomorrow's if it is evening)
    const morning = Date.parse(`${local.hour >= RULES.quietFrom ? addDays(local.date, 1) : local.date}T${String(RULES.quietTo).padStart(2, '0')}:00:00Z`) - off * 1000
    for (const w of ev.warnings ?? []) {
      // at night only a red warning that is on or starts before morning wakes you; the rest wait for 07:00
      if (quiet && (w.level < 4 || Date.parse(w.onset) >= morning)) continue
      const thread = w.thread ?? w.id // an Update keeps its warning's thread
      if (seen('warning', e => e.ref.startsWith(`${thread}@`) && sentLevel(e) >= w.level)) continue
      want.push({ kind: 'warning', ref: `${thread}@${w.level}`, vars: { city: ev.city, level: w.level, type: w.type, onset: w.onset, expires: w.expires, todayLocal: local.date } })
    }
    for (const s of ev.severe) {
      const dup = seen('severe', e => e.ref.startsWith(`${s.type}@`) && gapH(e.ref.split('@')[1], s.from) < RULES.spellGapH)
      if (!dup) want.push({ kind: 'severe', ref: `${s.type}@${s.from}`, vars: { city: ev.city, what: s.type, from: s.from } })
    }
  }
  if (device.alert_storm && ev.storm && !quiet && !seen('storm', e => gapH(e.ref, ev.storm.from) < RULES.spellGapH)) {
    want.push({ kind: 'storm', ref: ev.storm.from, vars: { city: ev.city, ...ev.storm } })
  }
  // the storm message covers rain that starts before or during it — but only
  // for a phone that gets (or already got) that message
  const stormCovers = !!(ev.storm && ev.rain && ev.rain.from < ev.storm.to) &&
    (want.some(m => m.kind === 'storm') || seen('storm', e => gapH(e.ref, ev.storm.from) < RULES.spellGapH))
  if (device.alert_rain && ev.rain && !quiet && !stormCovers && !seen('rain', e => gapH(e.ref, ev.rain.from) < RULES.rainGapH)) {
    want.push({ kind: 'rain', ref: ev.rain.from, vars: { city: ev.city, ...ev.rain } })
  }
  if (device.alert_heat && ev.heat && !device.briefing && within(local.hour, [RULES.heatHours[0], RULES.heatHours[1] - 1]) && !seen('heat', e => e.ref === local.date)) {
    want.push({ kind: 'heat', ref: local.date, vars: { city: ev.city, max: ev.heat.max } })
  }

  const usedToday = log.filter(e => WEATHER.has(e.kind) && localParts(e.sent_at, off).date === local.date).length
  want.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])
  // a red warning always goes; everything else shares the daily cap
  const isRed = m => m.kind === 'warning' && m.vars.level === 4
  const out = [...want.filter(isRed), ...want.filter(m => !isRed(m)).slice(0, Math.max(0, RULES.cap - usedToday))]

  const h = device.briefing_hour
  if (device.briefing && ev.briefing && within(local.hour, [h, h + RULES.briefingLateH]) && !seen('briefing', e => e.ref === local.date)) {
    out.push({ kind: 'briefing', ref: local.date, vars: { city: ev.city, ...ev.briefing, heat: !!(device.alert_heat && ev.heat) } })
  }
  return out
}

export function windowChanged(prev, cur) {
  const a = prev?.window ?? null, b = cur?.window ?? null
  if (!a || !b) return !a !== !b
  return gapH(a.from, b.from) >= 1 || gapH(a.to, b.to) >= 1
}

export function decideHike(plan, hike, now) {
  if (!hike) return null
  const local = localParts(now, hike.utcOffsetSec ?? 0)
  const hikeToday = hike.nowLocal?.slice(0, 10) ?? local.date
  const w = plan.date === hikeToday ? hike.windows?.today
    : plan.date === addDays(hikeToday, 1) ? hike.windows?.tomorrow : undefined
  if (w === undefined) return null
  const base = { window: w, stormUnknown: !!hike.notes?.includes('no_storm_data'), todayLocal: local.date }
  if (!plan.sent_evening && plan.date === addDays(local.date, 1) && within(local.hour, [18, 20])) {
    return { slot: 'evening', send: true, ...base }
  }
  // morning: an update if the window moved — or the window itself when the
  // plan came too late for the evening slot
  if (!plan.sent_morning && plan.date === local.date && within(local.hour, [6, 8])) {
    return { slot: 'morning', send: !plan.sent_evening || windowChanged(plan.last_window, w), ...base }
  }
  return null
}

const hm = s => (typeof s === 'string' ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)) : null)

// the suggested start moved enough (or the day flipped) to send the morning update
export function startChanged(prev, next) {
  if (!prev) return true
  if (!!prev.none !== !!next.none) return true
  if (next.none) return false
  return Math.abs(hm(prev.start) - hm(next.start)) >= 30
}

// A planned hike on a route: the same evening / morning slots as
// decideHike, with the suggested start in place of the summit window.
export function decideHikeRoute(plan, rw, now) {
  if (!rw?.suggestion) return null
  const local = localParts(now, rw.utcOffsetSec ?? 0)
  const s = rw.suggestion
  const window = s.none ? { none: true, reason: s.reason } : { start: s.start, latest: s.latest }
  const base = { window, todayLocal: local.date }
  if (!plan.sent_evening && plan.date === addDays(local.date, 1) && within(local.hour, [18, 20])) return { slot: 'evening', send: true, ...base }
  if (!plan.sent_morning && plan.date === local.date && within(local.hour, [6, 8])) {
    return { slot: 'morning', send: !plan.sent_evening || startChanged(plan.last_window, window), ...base }
  }
  return null
}
