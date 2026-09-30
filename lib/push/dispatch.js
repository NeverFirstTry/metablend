// The hourly run (deps injected — unit tested with fakes): read each home
// city's outlook and each planned peak's summit forecast once, decide per
// phone, send, and record what went out. `dry` returns the messages instead.
import { cityEvents, decide, decideHike } from './rules.js'
import { pushText } from './text.js'
import { hikeApiPath, peakHref } from '../hike/params.js'

const NO_FEATURED = new Set()

export async function runDispatch({ store, getJson, sender, now = Date.now(), dry = false, base = 'https://metablend.app' }) {
  const plans = await store.openPlans(now)
  const devices = await store.devicesForDispatch([...new Set(plans.map(p => p.device_id))])
  const byId = new Map(devices.map(d => [d.id, d]))
  const log = await store.recentLog(devices.map(d => d.id), now - 24 * 3600e3)
  const logOf = id => log.filter(e => e.device_id === id)
  const outbox = []

  const groups = new Map()
  for (const d of devices) {
    const on = d.alert_rain || d.alert_storm || d.alert_severe || d.alert_heat || d.briefing
    if (!on || !d.home_name?.trim()) continue
    const key = `${d.home_name.trim().toLowerCase()}|${d.lang}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(d)
  }
  for (const [key, ds] of groups) {
    const [city, lang] = key.split('|')
    const outlook = await getJson(`${base}/api/outlook?city=${encodeURIComponent(city)}&lang=${lang}`)
    if (!outlook) continue // unknown city or a hiccup: the others still go out
    const ev = cityEvents(outlook, now)
    const url = `/?city=${encodeURIComponent(outlook.city)}`
    for (const d of ds) for (const msg of decide(d, ev, logOf(d.id))) outbox.push({ device: d, msg, url })
  }

  const peaks = new Map()
  for (const p of plans) {
    const path = hikeApiPath(p)
    if (!peaks.has(path)) peaks.set(path, [])
    peaks.get(path).push(p)
  }
  const planUpdates = []
  for (const [path, ps] of peaks) {
    const hike = await getJson(`${base}${path}`)
    for (const p of ps) {
      const d = byId.get(p.device_id)
      const r = d && decideHike(p, hike, now)
      if (!r) continue
      const patch = r.slot === 'evening' ? { sent_evening: true, last_window: r.window } : { sent_morning: true, last_window: r.window }
      if (!r.send) { planUpdates.push([p.id, patch]); continue }
      const msg = { kind: `hike_${r.slot}`, ref: `${p.id}:${r.slot}`, vars: { peak: p.name, window: r.window, date: p.date, todayLocal: r.todayLocal, stormUnknown: r.stormUnknown } }
      outbox.push({ device: d, msg, url: peakHref(p, NO_FEATURED), plan: [p.id, patch] })
    }
  }

  const text = o => pushText(o.device.lang, o.device.unit, o.msg)
  if (dry) {
    return { dry: true, devices: devices.length, cities: groups.size, peaks: peaks.size, messages: outbox.map(o => ({ device: o.device.id, kind: o.msg.kind, ref: o.msg.ref, url: o.url, ...text(o) })) }
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
      if (o.plan) planUpdates.push(o.plan)
    } else if (r.gone) {
      removed++; gone.add(o.device.id)
      await store.deleteDevice(o.device.id)
    } else {
      failed++; errors.push(r.error)
    }
  }
  for (const [id, patch] of planUpdates) await store.updatePlan(id, patch)
  return { devices: devices.length, cities: groups.size, peaks: peaks.size, sent, failed, removed, errors: errors.slice(0, 5) }
}
