// Request bodies for the push API (pure — unit tested). The device key is a
// random secret the app keeps in native storage; the server only ever sees
// and stores its SHA-256.
import { createHash } from 'node:crypto'
import { pickLang, pickUnit } from '../share.js'
import { addDays } from '../localtime.js'

const bad = (error, status = 400) => ({ ok: false, status, error })
const isBool = v => typeof v === 'boolean'
const inRange = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi

export function hashDeviceKey(key) {
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(key)) return null
  return createHash('sha256').update(key).digest('hex')
}

export function parseRegister(b) {
  if (!b || typeof b !== 'object') return bad('Invalid body')
  const { token, platform } = b
  if (typeof token !== 'string' || !/^[A-Za-z0-9:_\-.]{20,4096}$/.test(token)) return bad('Invalid token')
  if (platform !== 'ios' && platform !== 'android') return bad('Invalid platform')
  return { ok: true, value: { token, platform, lang: pickLang(b.lang), unit: pickUnit(b.unit) } }
}

const FLAGS = ['alert_rain', 'alert_storm', 'alert_severe', 'alert_heat', 'briefing']

export function parseSettings(b) {
  if (!b || typeof b !== 'object') return bad('Invalid body')
  const patch = {}
  for (const k of FLAGS) {
    if (!(k in b)) continue
    if (!isBool(b[k])) return bad(`${k} must be true or false`)
    patch[k] = b[k]
  }
  if ('briefing_hour' in b) {
    if (!Number.isInteger(b.briefing_hour) || !inRange(b.briefing_hour, 5, 11)) return bad('briefing_hour must be 5–11')
    patch.briefing_hour = b.briefing_hour
  }
  if ('home_name' in b) {
    if (b.home_name === null) patch.home_name = null
    else {
      const name = typeof b.home_name === 'string' ? b.home_name.trim() : ''
      if (!name || name.length > 80) return bad('Invalid home city')
      patch.home_name = name
    }
  }
  if ('lang' in b) patch.lang = pickLang(b.lang)
  if ('unit' in b) patch.unit = pickUnit(b.unit)
  if (!Object.keys(patch).length) return bad('Nothing to change')
  return { ok: true, value: patch }
}

// todayUtc: the server's UTC date. A peak's "today" can still be yesterday in
// UTC (the Americas in the evening), hence one day of slack backwards.
export function parsePlan(b, todayUtc) {
  if (!b || typeof b !== 'object') return bad('Invalid body')
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  if (!name || name.length > 80) return bad('Invalid peak name')
  if (!inRange(b.lat, -90, 90) || !inRange(b.lon, -180, 180)) return bad('Invalid coordinates')
  if (!inRange(b.elev, 0, 9000)) return bad('Invalid elevation')
  if (typeof b.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return bad('Invalid date')
  if (b.date < addDays(todayUtc, -1) || b.date > addDays(todayUtc, 7)) return bad('The day must be within the next week')
  return { ok: true, value: { name, lat: b.lat, lon: b.lon, elev: Math.round(b.elev), date: b.date } }
}

// The home city is looked up in the language it was picked in, not the app's
// current one — "Wien" picked in German stays Vienna after a switch to
// English (where it would be a town in Missouri).
export function withHomeLang(patch, deviceLang) {
  if (!('home_name' in patch)) return patch
  return { ...patch, home_lang: patch.home_name ? (patch.lang ?? deviceLang) : null }
}
