// A place's climate reference (lib/outlook/climate.js, climateTable), kept in the database for a year.
// The 10-year archive request behind it weighs about 104 Open-Meteo calls and its answer changes once a
// year, so it is asked once per place and year, not once a day: the outlook's normals and the planner's
// months both read the kept table. The archive host is not part of Open-Meteo's Standard plan, which is
// the other reason to ask it rarely. Without the table or the database every call asks upstream, with
// Next's day-long copy in front as before.
import { supabase } from './supabase.js'
import { getJson } from './outlook/http.js'
import { climateTable } from './outlook/climate.js'

const YEAR_MS = 365 * 86_400_000
// coordinates to 0.01 degree, like the request: the archive adjusts temperatures to the place's height
export const climateKey = (lat, lon) => `${lat.toFixed(2)},${lon.toFixed(2)}`
export function climateUrl(lat, lon, now = new Date()) {
  const end = now.getUTCFullYear() - 1, start = end - 9
  return `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&start_date=${start}-01-01&end_date=${end}-12-31&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum&timezone=auto`
}

export async function loadClimate(lat, lon, { db = supabase, fetchJson = getJson, now = Date.now() } = {}) {
  const key = climateKey(lat, lon)
  let kept = null
  try { kept = (await db.from('place_climate').select('data, fetched_at').eq('key', key).limit(1)).data?.[0] ?? null } catch { /* no database: ask upstream */ }
  if (kept?.data?.v && now - Date.parse(kept.fetched_at) < YEAR_MS) return kept.data
  const table = climateTable(await fetchJson(climateUrl(lat, lon, new Date(now)), { ms: 20000, kind: 'climate', next: { revalidate: 86400 } }))
  if (!table) return kept?.data ?? null // upstream failed: last year's table is still a good reference
  try { await db.from('place_climate').upsert({ key, data: table, fetched_at: new Date(now).toISOString() }) } catch { /* not kept: asked again next time */ }
  return table
}
