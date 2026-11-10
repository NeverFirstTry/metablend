// The city geocoder. Open-Meteo is asked only when nothing of ours answers (the quota card of
// 2026-11-09: every city search cost one or two Open-Meteo requests):
//   1. our towns (lib/places: GeoNames places of 5,000 and more) by exact name, any of their names, the
//      most populous first (town_lookup, supabase/geocode-cache.sql);
//   2. Open-Meteo's cached answer for this name from the last 30 days (geocode_cache);
//   3. Open-Meteo, its answer cached (an empty one too) and the ask logged (error_log, scope geocode.upstream).
// The English name a place is filed under still comes from Open-Meteo's id lookup, cached the same way:
// our towns' main name is not always English (Köln, not Cologne), and the stored history is keyed by it.
// Server only: this talks to the database, so it lives apart from lib/weather.js, which the peak view
// bundles for the browser. Until the SQL has run, every lookup falls through to Open-Meteo as before.
import { supabase } from './supabase.js'
import { logError } from './log.js'
import { pickPlace, placeKey, tfetch } from './weather.js'
import { fetchNominatimPlaceRaw } from './hike/sources.js'

const CACHE_DAYS = 30

const regionName = (() => {
  try { const names = new Intl.DisplayNames(['en'], { type: 'region' }); return cc => { try { return names.of(cc) ?? cc } catch { return cc } } } catch { return cc => cc }
})()

// one of our towns as the geocoder would answer it
export const townResult = t => ({ id: t.id, name: t.name, alt: t.alt ?? '', latitude: t.lat, longitude: t.lon, country: regionName(t.country), country_code: t.country, admin1: t.region ?? null, population: t.population ?? 0 })
// the visitor's spelling when it is one of the town's names ("Wien" stays "Wien"), else the main name
export const shownName = (t, query) => { const q = placeKey(query); return [t.name, ...String(t.alt ?? '').split(' | ')].find(n => n && placeKey(n) === q) ?? t.name }

async function remembered(db, key) {
  try {
    const { data } = await db.from('geocode_cache').select('results, fetched_at').eq('key', key).limit(1)
    const row = data?.[0]
    return row && Date.now() - Date.parse(row.fetched_at) < CACHE_DAYS * 86_400_000 ? row.results : undefined
  } catch { return undefined }
}
const remember = (db, key, results) => Promise.resolve(db.from('geocode_cache').upsert({ key, results, fetched_at: new Date().toISOString() })).catch(() => {})

// Open-Meteo asked, the ask logged first (a failed one too); null when the call failed
async function upstream(url, log, meta) {
  log('geocode.upstream', new Error('geocoder asked upstream'), meta)
  try {
    const res = await tfetch(url)
    return res.ok ? await res.json() : null
  } catch { return null }
}

const place = (r, alt) => ({ id: r.id, lat: r.latitude, lon: r.longitude, name: r.name, country: r.country, cc: r.country_code ?? null, admin1: r.admin1 ?? null, alt })

export async function geocodeCity(city, lang = 'en', near = null, { db = supabase, log = logError } = {}) {
  let towns = null
  try { towns = (await db.rpc('town_lookup', { q: city, lim: 20 })).data } catch { /* no towns: Open-Meteo answers */ }
  if (towns?.length) {
    const results = towns.map(townResult)
    const r = pickPlace(results, city, near)
    // alt: found by where the search came from, not the place the name alone gives
    return { ...place(r, !!near && r !== pickPlace(results, city)), name: shownName(r, city), town: true }
  }
  // a small town of a big name can be far down Open-Meteo's list: a search from somewhere asks for 100
  const wide = !!near, key = `${lang}|${wide ? 'w|' : ''}${placeKey(city)}`
  let results = await remembered(db, key)
  if (!Array.isArray(results)) {
    const data = await upstream(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=${wide ? 100 : 10}&language=${encodeURIComponent(lang)}`, log, { query: city, lang, wide })
    if (!data) return null
    results = Array.isArray(data.results) ? data.results : []
    remember(db, key, results)
  }
  if (!results.length) return null
  const r = pickPlace(results, city, near)
  return place(r, !!near && r !== pickPlace(results, city))
}

// a place's name and region by its GeoNames id, in a language (English: what a place is filed under)
async function namedPlace(id, lang, db, log) {
  if (id == null) return null
  const key = lang === 'en' ? `get:${id}` : `get:${id}:${lang}`
  const kept = await remembered(db, key)
  if (kept?.name) return kept
  const data = await upstream(`https://geocoding-api.open-meteo.com/v1/get?id=${encodeURIComponent(id)}&language=${encodeURIComponent(lang)}`, log, lang === 'en' ? { id } : { id, lang })
  if (typeof data?.name !== 'string') return null
  const named = { name: data.name, admin1: data.admin1 ?? null }
  remember(db, key, named)
  return named
}
const englishPlace = (id, db, log) => namedPlace(id, 'en', db, log)

// "My location": the place at a position the phone has rounded to 0.1°, about 10 km (lib/geo.js placeAt;
// the exact position never leaves the device). One of our towns when one is within 10 km (town_near,
// supabase/town-near.sql), named in the visitor's language like a picked suggestion; else the
// municipality OpenStreetMap's Nominatim has at the rounded position (gated, kept 30 days,
// lib/hike/nominatim.js). null: no place there, or nothing answered.
export async function placeNear(near, lang = 'en', { db = supabase, log = logError, reverse = fetchNominatimPlaceRaw } = {}) {
  let town = null
  try { town = (await db.rpc('town_near', { lat: near.lat, lon: near.lon })).data?.[0] ?? null } catch { /* no towns: Nominatim answers */ }
  if (town) return { name: (await namedPlace(town.id, lang, db, log))?.name ?? town.name }
  const found = await reverse(near.lat, near.lon, lang)
  const name = found?.address?.city ?? found?.address?.town ?? found?.address?.village ?? found?.address?.municipality ?? found?.name
  return name ? { name } : null
}

// What everything learned about a place is filed under (forecasts, bias, reports, snapshots): its English
// name, so "Wien" and "Vienna" stay one city; a town picked by position over a bigger one of that name gets
// its region too ("Vienna, Virginia"), so the two never share data. null when the English name can't be
// looked up (the caller decides). Open-Meteo's answer in English is itself; one of our towns, or another
// language, is looked up by id.
export async function learnName(geo, lang, { db = supabase, log = logError } = {}) {
  const en = lang === 'en' && !geo.town ? geo : await englishPlace(geo.id, db, log)
  if (!en) return null
  return geo.alt ? [en.name, en.admin1 ?? geo.cc].filter(Boolean).join(', ') : en.name
}
