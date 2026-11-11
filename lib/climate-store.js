// A place's climate reference (lib/outlook/climate.js, climateTable), kept in the database for a year.
// The 10-year archive request behind it weighs about 104 Open-Meteo calls and its answer changes once a
// year, so it is asked once per place and year, not once a day: the outlook's normals and the planner's
// months both read the kept table. The archive host is not part of Open-Meteo's Standard plan, which is
// the other reason to ask it rarely: a place the archive gives nothing for borrows the table of the
// nearest kept place, when one lies within 25 km and 300 m of height (nearClimate). Without the table or
// the database every call asks upstream, with Next's day-long copy in front as before.
import { supabase } from './supabase.js'
import { getJson } from './outlook/http.js'
import { climateTable, TABLE_VERSION } from './outlook/climate.js'
import { haversineKm } from './geo.js'
import { fetchElevations } from './hike/sources.js'

const YEAR_MS = 365 * 86_400_000
export const NEAR_KM = 25, NEAR_M = 300
// coordinates to 0.01 degree, like the request: the archive adjusts temperatures to the place's height
export const climateKey = (lat, lon) => `${lat.toFixed(2)},${lon.toFixed(2)}`
export function climateUrl(lat, lon, now = new Date()) {
  const end = now.getUTCFullYear() - 1, start = end - 9
  return `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&start_date=${start}-01-01&end_date=${end}-12-31&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum&timezone=auto`
}
const heightAt = async (lat, lon) => (await fetchElevations([{ lat, lon }]))?.[0] ?? null

export async function loadClimate(lat, lon, { db = supabase, fetchJson = getJson, heightOf = heightAt, now = Date.now() } = {}) {
  const key = climateKey(lat, lon)
  let kept = null
  try { kept = (await db.from('place_climate').select('data, fetched_at').eq('key', key).limit(1)).data?.[0] ?? null } catch { /* no database: ask upstream */ }
  if (kept?.data?.v === TABLE_VERSION && now - Date.parse(kept.fetched_at) < YEAR_MS) return kept.data
  const table = climateTable(await fetchJson(climateUrl(lat, lon, new Date(now)), { ms: 20000, kind: 'climate', next: { revalidate: 86400 } }))
  if (table) {
    try { await db.from('place_climate').upsert({ key, data: table, fetched_at: new Date(now).toISOString() }) } catch { /* not kept: asked again next time */ }
    return table
  }
  // the archive gave nothing: the place's own older table still is a good reference, else a neighbour's
  return kept?.data?.v ? kept.data : nearClimate(lat, lon, { db, heightOf })
}

// The table of the nearest kept place within NEAR_KM whose height differs by at most NEAR_M: normals
// change little over that. null when none is near, or when a height is not known (a valley town must
// not borrow from the slope above it). Nothing is copied: the place keeps borrowing until it has its own.
export async function nearClimate(lat, lon, { db = supabase, heightOf = heightAt } = {}) {
  try {
    // keys start with the latitude: the rows of the band around this one, then the distance decides
    const bands = [...new Set([-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3].map(d => (lat + d).toFixed(1)))]
    const { data } = await db.from('place_climate').select('key, elev:data->elev').or(bands.map(b => `key.like."${b}*"`).join(','))
    const near = (data ?? []).map(r => { const [la, lo] = r.key.split(',').map(Number); return { ...r, km: haversineKm(lat, lon, la, lo) } })
      .filter(r => r.km <= NEAR_KM && typeof r.elev === 'number').sort((a, b) => a.km - b.km)
    if (!near.length) return null
    const here = await heightOf(lat, lon)
    const pick = typeof here === 'number' ? near.find(r => Math.abs(r.elev - here) <= NEAR_M) : null
    return pick ? (await db.from('place_climate').select('data').eq('key', pick.key).limit(1)).data?.[0]?.data ?? null : null
  } catch { return null }
}
