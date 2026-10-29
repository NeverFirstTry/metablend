// Every request to Nominatim, OpenStreetMap's geocoder (pure apart from what
// it's given — unit tested). Its usage policy: at most one request a second
// for the whole application, results cached on our side, a User-Agent that
// identifies the app. So: the shared 30-day cache first (nominatim_cache),
// else a slot from the database gate (supabase/nominatim.sql), which hands
// out one every 1.1 s across all server instances; a full queue gives up
// rather than wait, a database error asks nothing. Only while the gate isn't
// set up yet (that SQL not run) or in a local run, which may not write to
// production, does an instance space its own requests instead.
import { spaced } from './spaced.js'

export const NOMINATIM_UA = 'MetaBlend/1.0 (https://metablend.app; info@metablend.app)'
const OWN_SPACING = e => e?.code === 'PGRST202' || /Refused: a local run/.test(e?.message ?? '')

export function makeNominatim({ db, fetchJson, sleep, base }) {
  const ownSlot = spaced(1100, { sleep })
  return async params => {
    const cached = await db.cacheGet(params).catch(() => null)
    if (cached) return cached
    const ask = () => fetchJson(`${base}&${params}`, { headers: { 'User-Agent': NOMINATIM_UA } })
    const { data: wait, error } = await db.slot()
    let body
    if (!error) {
      if (wait == null) return null
      if (wait > 0) await sleep(wait)
      body = await ask()
    } else if (OWN_SPACING(error)) {
      body = await ownSlot(ask)
    } else {
      return null
    }
    if (body) await db.cachePut(params, body).catch(() => {})
    return body
  }
}

// The database side: the cache table and the gate function.
export const CACHE_DAYS = 30
export function supabaseNominatimStore(supabase) {
  return {
    cacheGet: async key => {
      const since = new Date(Date.now() - CACHE_DAYS * 864e5).toISOString()
      const { data } = await supabase.from('nominatim_cache').select('body').eq('key', key).gte('fetched_at', since).maybeSingle()
      return data?.body ?? null
    },
    // async: a PostgREST builder can be awaited but has no .catch
    cachePut: async (key, body) => { await supabase.from('nominatim_cache').upsert({ key, body, fetched_at: new Date().toISOString() }, { onConflict: 'key' }) },
    slot: async () => supabase.rpc('nominatim_slot', { max_wait_ms: 4000 }),
  }
}
