// The hourly run (deps injected — unit tested with fakes): read each home
// city's outlook (and its 15-minute nowcast for rain) and each planned peak's
// summit forecast once, decide per phone, send, and record what went out.
// `dry` returns the messages instead.
// only: 'rain' is the quarter-hourly run: rain and official-warning alerts, no plans
import { cityEvents, decide, decideHike, decideHikeRoute, isQuiet, localParts } from './rules.js'
import { pushText } from './text.js'
import { hikeApiPath, peakHref } from '../hike/params.js'
import { warningOnDay } from '../warnings/text.js'

const NO_FEATURED = new Set()

// The rain nowcast costs a request to Open-Meteo per place every quarter hour, so it is asked only
// where it can lead to an alert (2026-11-10: 96 requests a day per home place before): someone there
// wants rain alerts, it is not the place's quiet hours (no rain alert goes out then), and the outlook
// already held shows a chance of rain in the next 3 hours: an hour with 10 % or more, or with any
// source calling rain. An outlook that cannot say (no hours, no rain figure) counts as a chance.
const RAIN_AHEAD_H = 3, RAIN_CHANCE = 10
export function rainAhead(outlook, now) {
  const off = outlook?.utcOffsetSec ?? 0
  const next = (outlook?.hourly ?? []).filter(h => { const t = Date.parse(`${h.t}:00Z`) - off * 1000; return t + 3600e3 > now && t < now + RAIN_AHEAD_H * 3600e3 })
  return !next.length || next.some(h => typeof h.rainPct !== 'number' || h.rainPct >= RAIN_CHANCE || (h.rainVotes ?? 0) > 0)
}
// homes in the same 0.1° cell share one nowcast, asked at the cell's position (up to about 6 km from a home)
const cell = v => Math.round(v * 10) / 10
const QUICK = new Set(['rain', 'warning'])
// a planned hike's day: its orange / red official warning, if any
const pickWarning = (list, date) => { const w = warningOnDay(list, date); return w ? { level: w.level, type: w.type } : null }

export async function runDispatch({ store, getJson, sender, now = Date.now(), dry = false, base = 'https://metablend.app', routeWeather = null, only = null, warningsAt = null, avalancheAt = null }) {
  const plans = only ? [] : await store.openPlans(now)
  const devices = await store.devicesForDispatch([...new Set(plans.map(p => p.device_id))])
  const byId = new Map(devices.map(d => [d.id, d]))
  const ids = devices.map(d => d.id)
  // official warnings can last days: theirs are read over a week so one never repeats
  const weekOfWarnings = (await store.recentLog(ids, now - 7 * 24 * 3600e3, 'warning')).filter(e => e.kind === 'warning')
  const log = [...(await store.recentLog(ids, now - 24 * 3600e3)).filter(e => e.kind !== 'warning'), ...weekOfWarnings]
  const logOf = id => log.filter(e => e.device_id === id)
  const outbox = []
  // official warnings at a spot; a failed lookup counts as not covered (model-based alerts) and is reported
  const warningErrors = []
  const lookUp = (...at) => warningsAt(...at).catch(e => { warningErrors.push(String(e?.message ?? e)); return null })
  // a planned hike's avalanche danger that day (1–5), null where it isn't rated
  const avalancheOn = (lat, lon, date) => (avalancheAt ? avalancheAt(lat, lon, date).catch(() => null) : null)

  const nowcasts = new Map() // cell → the run's one request for it
  const nowcastAt = (lat, lon) => {
    const at = `lat=${cell(lat)}&lon=${cell(lon)}`
    if (!nowcasts.has(at)) nowcasts.set(at, getJson(`${base}/api/nowcast?${at}`))
    return nowcasts.get(at)
  }
  let rainSkipped = 0 // home places where a nowcast could not have led to an alert

  const groups = new Map()
  for (const d of devices) {
    const on = only === 'rain' ? (d.alert_rain || d.alert_severe) : (d.alert_rain || d.alert_storm || d.alert_severe || d.alert_heat || d.briefing)
    if (!on || !d.home_name?.trim()) continue
    // looked up in the language the home was picked in (texts stay in d.lang)
    const key = JSON.stringify([d.home_name.trim().toLowerCase(), d.home_lang ?? d.lang])
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(d)
  }
  for (const [key, ds] of groups) {
    const [city, lang] = JSON.parse(key)
    const outlook = await getJson(`${base}/api/outlook?city=${encodeURIComponent(city)}&lang=${lang}`)
    if (!outlook) continue // unknown city or a hiccup: the others still go out
    const wantsRain = ds.some(d => d.alert_rain) && outlook.lat != null && outlook.lon != null
    const askRain = wantsRain && !isQuiet(localParts(now, outlook.utcOffsetSec ?? 0).hour) && rainAhead(outlook, now)
    if (wantsRain && !askRain) rainSkipped++
    const nowcast = askRain ? await nowcastAt(outlook.lat, outlook.lon) : null
    const wantsWarnings = !!warningsAt && ds.some(d => d.alert_severe) && outlook.lat != null && outlook.lon != null
    const warnings = wantsWarnings ? await lookUp(outlook.lat, outlook.lon, outlook.cc ?? null) : null
    const ev = cityEvents(outlook, now, nowcast, warnings)
    const url = `/?city=${encodeURIComponent(outlook.city)}`
    for (const d of ds) for (const msg of decide(d, ev, logOf(d.id))) {
      if (!only || QUICK.has(msg.kind)) outbox.push({ device: d, msg, url })
    }
  }

  const peaks = new Map()
  for (const p of plans.filter(x => !x.route)) {
    const path = hikeApiPath(p)
    if (!peaks.has(path)) peaks.set(path, [])
    peaks.get(path).push(p)
  }
  const planUpdates = []
  for (const [path, ps] of peaks) {
    const got = await getJson(`${base}${path}`)
    const hike = got?.unavailable ? null : got // no summit forecast right now: no plan message, the next run tries again
    let dayWarnings // looked up once, and only when a message goes out
    for (const p of ps) {
      const d = byId.get(p.device_id)
      const r = d && decideHike(p, hike, now)
      if (!r) continue
      // the log backs up the plan flags: a run cut short must not repeat a slot
      if (logOf(d.id).some(e => e.ref === `${p.id}:${r.slot}`)) continue
      const patch = r.slot === 'evening' ? { sent_evening: true, last_window: r.window } : { sent_morning: true, last_window: r.window }
      if (!r.send) { planUpdates.push([p.id, patch]); continue }
      if (dayWarnings === undefined) dayWarnings = warningsAt ? await lookUp(ps[0].lat, ps[0].lon) : null
      const msg = { kind: `hike_${r.slot}`, ref: `${p.id}:${r.slot}`, vars: { peak: p.name, window: r.window, date: p.date, todayLocal: r.todayLocal, stormUnknown: r.stormUnknown, warning: pickWarning(dayWarnings, p.date), avalanche: await avalancheOn(p.lat, p.lon, p.date) } }
      outbox.push({ device: d, msg, url: peakHref(p, NO_FEATURED), plan: [p.id, patch] })
    }
  }
  // plans on a route: the suggested start along the whole walk
  for (const p of plans.filter(x => x.route?.points?.length >= 2)) {
    const d = byId.get(p.device_id)
    if (!d || !routeWeather) continue
    const rw = await routeWeather({ points: p.route.points.map(([lat, lon, ele]) => ({ lat, lon, ele })), date: p.date, pace: p.route.pace ?? 'normal', roundTrip: !!p.route.roundTrip, now }).catch(() => null)
    const r = decideHikeRoute(p, rw, now)
    if (!r) continue
    if (logOf(d.id).some(e => e.ref === `${p.id}:${r.slot}`)) continue
    const patch = r.slot === 'evening' ? { sent_evening: true, last_window: r.window } : { sent_morning: true, last_window: r.window }
    if (!r.send) { planUpdates.push([p.id, patch]); continue }
    const dayWarnings = warningsAt ? await lookUp(p.route.points[0][0], p.route.points[0][1]) : null
    const msg = { kind: `hike_route_${r.slot}`, ref: `${p.id}:${r.slot}`, vars: { peak: p.route.name || p.name, suggestion: rw.suggestion, date: p.date, todayLocal: r.todayLocal, warning: pickWarning(dayWarnings, p.date), avalanche: await avalancheOn(p.route.points[0][0], p.route.points[0][1], p.date) } }
    outbox.push({ device: d, msg, url: p.route.id ? `/hike?route=${encodeURIComponent(p.route.id)}` : peakHref(p, NO_FEATURED), plan: [p.id, patch] })
  }

  const text = o => pushText(o.device.lang, o.device.unit, o.msg)
  if (dry) {
    return { dry: true, devices: devices.length, cities: groups.size, peaks: peaks.size, nowcasts: nowcasts.size, rainSkipped, warningErrors, messages: outbox.map(o => ({ device: o.device.id, kind: o.msg.kind, ref: o.msg.ref, url: o.url, ...text(o) })) }
  }

  let sent = 0, failed = 0, removed = 0
  const gone = new Set()
  const errors = []
  for (const o of outbox) {
    if (gone.has(o.device.id)) continue
    // logged before it goes out: a log that can't be written stops the run
    // (the store throws) instead of every run sending every alert again
    await store.logSent(o.device.id, o.msg.kind, o.msg.ref, now)
    const r = await sender.send(o.device, { ...text(o), url: o.url, kind: o.msg.kind })
    if (r.env && r.env !== o.device.apns_env) { await store.setApnsEnv(o.device.id, r.env); o.device.apns_env = r.env }
    if (r.ok) {
      sent++
      if (o.plan) await store.updatePlan(...o.plan) // right away, not after the loop
    } else if (r.gone) {
      removed++; gone.add(o.device.id)
      await store.deleteDevice(o.device.id)
    } else {
      failed++; errors.push(r.error)
      await store.unlogSent(o.device.id, o.msg.kind, o.msg.ref, now) // the next run tries again
    }
  }
  for (const [id, patch] of planUpdates) await store.updatePlan(id, patch)
  return { devices: devices.length, cities: groups.size, peaks: peaks.size, nowcasts: nowcasts.size, rainSkipped, sent, failed, removed, errors: errors.slice(0, 5), warningErrors: warningErrors.slice(0, 5) }
}
