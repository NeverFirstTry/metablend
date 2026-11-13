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

// how old a kept answer may be when it is served
export const KEEP_MS = { outlook: 24 * 3600_000, summit: 24 * 3600_000, rain: 3600_000 }
// rows in the table, all kinds together (the function in the SQL file enforces it)
export const MAX_ROWS = 3000
// the CDN keeps a served kept answer this long, so a recovered server shows within minutes
export const KEPT_TTL = 300

export const placeKey = (lat, lon, decimals = 3) => `${lat.toFixed(decimals)},${lon.toFixed(decimals)}`

// never throws: an answer that is not kept is simply kept next time
export async function keepAnswer(kind, place, body, { db = supabase } = {}) {
  try {
    await db.rpc('keep_last_answer', { p_kind: kind, p_place: place, p_body: gzipSync(JSON.stringify(body)).toString('base64'), p_max: MAX_ROWS })
  } catch { /* no database */ }
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
