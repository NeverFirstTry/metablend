// The hourly run (deps injected — unit tested with fakes): read each home
// city's outlook (and its 15-minute nowcast for rain) and each planned peak's
// summit forecast once, decide per phone, send, and record what went out.
// `dry` returns the messages instead.
// only: 'rain' is the quarter-hourly run: rain and official-warning alerts, no plans
import { cityEvents, decide, decideHike, decideHikeRoute } from './rules.js'
import { pushText } from './text.js'
import { hikeApiPath, peakHref } from '../hike/params.js'
import { warningOnDay } from '../warnings/text.js'

const NO_FEATURED = new Set()
const QUICK = new Set(['rain', 'warning'])
// a planned hike's day: its orange / red official warning, if any
const pickWarning = (list, date) => { const w = warningOnDay(list, date); return w ? { level: w.level, type: w.type } : null }

export async function runDispatch({ store, getJson, sender, now = Date.now(), dry = false, base = 'https://metablend.app', routeWeather = null, only = null, warningsAt = null }) {
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
    const wantsRain = ds.some(d => d.alert_rain)
    const nowcast = wantsRain && outlook.lat != null && outlook.lon != null
      ? await getJson(`${base}/api/nowcast?lat=${outlook.lat}&lon=${outlook.lon}`)
      : null
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
    const hike = await getJson(`${base}${path}`)
    const dayWarnings = warningsAt ? await lookUp(ps[0].lat, ps[0].lon) : null
    for (const p of ps) {
      const d = byId.get(p.device_id)
      const r = d && decideHike(p, hike, now)
      if (!r) continue
      // the log backs up the plan flags: a run cut short must not repeat a slot
      if (logOf(d.id).some(e => e.ref === `${p.id}:${r.slot}`)) continue
      const patch = r.slot === 'evening' ? { sent_evening: true, last_window: r.window } : { sent_morning: true, last_window: r.window }
      if (!r.send) { planUpdates.push([p.id, patch]); continue }
      const msg = { kind: `hike_${r.slot}`, ref: `${p.id}:${r.slot}`, vars: { peak: p.name, window: r.window, date: p.date, todayLocal: r.todayLocal, stormUnknown: r.stormUnknown, warning: pickWarning(dayWarnings, p.date) } }
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
    const msg = { kind: `hike_route_${r.slot}`, ref: `${p.id}:${r.slot}`, vars: { peak: p.route.name || p.name, suggestion: rw.suggestion, date: p.date, todayLocal: r.todayLocal, warning: pickWarning(dayWarnings, p.date) } }
    outbox.push({ device: d, msg, url: p.route.id ? `/hike?route=${encodeURIComponent(p.route.id)}` : peakHref(p, NO_FEATURED), plan: [p.id, patch] })
  }

  const text = o => pushText(o.device.lang, o.device.unit, o.msg)
  if (dry) {
    return { dry: true, devices: devices.length, cities: groups.size, peaks: peaks.size, warningErrors, messages: outbox.map(o => ({ device: o.device.id, kind: o.msg.kind, ref: o.msg.ref, url: o.url, ...text(o) })) }
  }

  let sent = 0, failed = 0, removed = 0
  const gone = new Set()
  const errors = []
  for (const o of outbox) {
    if (gone.has(o.device.id)) continue
    const r = await sender.send(o.device, { ...text(o), url: o.url, kind: o.msg.kind })
    if (r.env && r.env !== o.device.apns_env) { await store.setApnsEnv(o.device.id, r.env); o.device.apns_env = r.env }
    if (r.ok) {
      sent++
      await store.logSent(o.device.id, o.msg.kind, o.msg.ref, now)
      if (o.plan) await store.updatePlan(...o.plan) // right away, not after the loop
    } else if (r.gone) {
      removed++; gone.add(o.device.id)
      await store.deleteDevice(o.device.id)
    } else {
      failed++; errors.push(r.error)
    }
  }
  for (const [id, patch] of planUpdates) await store.updatePlan(id, patch)
  return { devices: devices.length, cities: groups.size, peaks: peaks.size, sent, failed, removed, errors: errors.slice(0, 5), warningErrors: warningErrors.slice(0, 5) }
}
