// The last good answer per place (supabase/last-answers.sql), for the hours our own Open-Meteo server
// gives nothing and the public service may not be asked. A route keeps every good answer it builds
// (only requests the CDN could not answer reach a route) and reads the kept one only when a build
// fails. Order when a build fails (owner, 2026-11-12): the last good answer with its time, else a
// live answer from another source where there is one (the outlook's MET Norway), else the error.
// The key is the place alone, never text from the request, and a route takes the request's own
// fields out before keeping (a peak's name) and puts the current request's in when serving: one
// request must not set what another one reads.
import { gzipSync, gunzipSync } from 'node:zlib'
import { supabase } from './supabase.js'
import { clientIp, isInternal } from './auth.js'
import { forgetExpired } from './ratelimit.js'

// how old a kept answer may be when it is served. The forecast's blend ("right now") only 2 hours, and
// only when every Open-Meteo source failed (app/api/forecast/route.js)
export const KEEP_MS = { outlook: 24 * 3600_000, summit: 24 * 3600_000, rain: 3600_000, forecast: 2 * 3600_000 }
// the CDN keeps a served kept answer this long, so a recovered server shows within minutes
export const KEPT_TTL = 300

export const placeKey = (lat, lon, decimals = 3) => `${lat.toFixed(decimals)},${lon.toFixed(decimals)}`

// One visitor address may add this many new places an hour, per kind (and per warm instance, like every
// limit here). Beyond that its requests are answered as always and a place already kept is still
// renewed, but no new row is made. Without it one client could write a room full of made-up places and,
// by asking for each again half an hour later, have them count as "in use" (review of 2026-11-14).
// Whoever wants a room now needs many addresses.
export const NEW_PER_HOUR = 10
const added = new Map() // `${kind}|${address}` → { n, until }
forgetExpired(now => { for (const [k, v] of added) if (now >= v.until) added.delete(k) }) // an address leaves memory when its hour is over
export const addedCount = () => added.size // the tests
// who asked, for that count: the visitor's address, kept in memory for the hour and nowhere else (the
// privacy notice, "Technische Daten", says so since this change); our
// own jobs and pages (the widget, the share card, the push run) share one count
export const asker = request => (isInternal(request) ? 'own' : addressGroup(clientIp(request)))
// An IPv6 line is a whole block of addresses (a /64) and its owner can ask from any of them, so they
// count as one (review of 2026-11-14: counted singly, the limit meant nothing to anyone with IPv6).
// An IPv4 address written the IPv6 way (::ffff:203.0.113.7) is that IPv4 address.
export function addressGroup(ip) {
  if (!ip.includes(':')) return ip
  const v4 = ip.match(/:(\d+\.\d+\.\d+\.\d+)$/)
  if (v4) return v4[1]
  const [head, tail] = ip.split('::')
  const h = head ? head.split(':') : [], t = tail ? tail.split(':') : []
  const groups = tail === undefined ? h : [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t]
  return `${groups.slice(0, 4).map(g => g.toLowerCase().replace(/^0+(?=.)/, '')).join(':')}::/64`
}

// never throws: an answer that is not kept is simply kept next time. How many places a kind may hold,
// and which one gives way when its room is full, is the database function's alone (the rain and summit
// addresses take any coordinates: a place asked for only once goes before one visitors came back to)
export async function keepAnswer(kind, place, body, { db = supabase, by = null, now = Date.now() } = {}) {
  const key = by && `${kind}|${by}`
  let c = key ? added.get(key) : null
  if (key && !(c && now < c.until)) added.set(key, c = { n: 0, until: now + 3600_000 })
  // Its place is taken before the database is asked and given back when no new row came of it: counted
  // only afterwards, forty requests of one moment all saw "none yet" and all got a row (review, 2026-11-14)
  const room = !c || c.n < NEW_PER_HOUR
  if (c && room) c.n++
  let isNew = false
  try {
    const res = await db.rpc('keep_last_answer', { p_kind: kind, p_place: place, p_body: gzipSync(JSON.stringify(body)).toString('base64'), ...(room ? {} : { p_max: 0 }) })
    isNew = res?.data === true
  } catch { /* no database */ }
  if (c && room && !isNew) c.n-- // renewed, or not kept
}

// { body, madeAt } or null: nothing kept for the place, too old, unreadable, or no table yet
export async function lastAnswer(kind, place, { db = supabase, now = Date.now() } = {}) {
  try {
    const { data } = await db.from('last_answers').select('body, made_at').eq('kind', kind).eq('place', place)
      .gte('made_at', new Date(now - KEEP_MS[kind]).toISOString()).limit(1)
    const row = data?.[0]
    return row ? { body: JSON.parse(gunzipSync(Buffer.from(row.body, 'base64')).toString()), madeAt: row.made_at } : null
  } catch {
    return null
  }
}

// the response for a kept answer: marked with when it was made (`kept`), and cached only briefly
export const keptResponse = (body, madeAt) => Response.json({ ...body, kept: madeAt }, { headers: { 'Cache-Control': `public, s-maxage=${KEPT_TTL}` } })
