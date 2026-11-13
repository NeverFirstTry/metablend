// The city geocoder: our own towns answer every place name (supabase/place-search.sql; GeoNames places
// of 5,000 and more people everywhere, of 500 and more in AT, DE, CH, IT and SI). Nothing outside is
// asked for a name (owner, 2026-11-12: no Open-Meteo after launch, its geocoder included):
//   1. a town by its exact name, any of its names in our languages and both Chinese scripts, the most
//      populous first (town_lookup);
//   2. else the town the search ranks first when the text is the start of one of its names
//      (towns_search: "Innsbr" finds Innsbruck). A misspelling finds nothing, on purpose: a forecast
//      for the wrong place is worse than "not found".
// A town carries its name in each of our 13 languages (names, only where it differs from the main
// name). The English one is what everything learned about a place is filed under, so "Wien" and
// "Vienna" stay one city; it is the name GeoNames prefers, which is also what Open-Meteo's geocoder
// answered (checked 2026-11-12 against a week of forecasts: no place changes its name).
// Server only: this talks to the database, so it lives apart from lib/weather.js, which the peak view
// bundles for the browser.
import { supabase } from './supabase.js'
import { pickPlace, placeKey } from './weather.js'
import { fetchNominatimPlaceRaw } from './hike/sources.js'
import { CITIES } from './cities.js'
import { cityName } from './city-names.js'
import { placeIn } from './zh-hans.js'

const regionName = (() => {
  try { const names = new Intl.DisplayNames(['en'], { type: 'region' }); return cc => { try { return names.of(cc) ?? cc } catch { return cc } } } catch { return cc => cc }
})()

// one of our towns in the shape the search boxes and pickPlace read
export const townResult = t => ({ id: t.id, name: t.name, alt: t.alt ?? '', names: t.names ?? null, latitude: t.lat, longitude: t.lon, country: regionName(t.country), country_code: t.country, admin1: t.region ?? null, population: t.population ?? 0 })
// the visitor's spelling when it is one of the town's names ("Wien" stays "Wien"), else the main name
export const shownName = (t, query) => { const q = placeKey(query); return [t.name, ...String(t.alt ?? '').split(' | ')].find(n => n && placeKey(n) === q) ?? t.name }
// a town's name for a reader of a language: its own entry, else the main name
export const nameIn = (t, lang) => t.names?.[lang] ?? t.name

// main: the town's own name in the list, which geocodeCity's name (the visitor's spelling) may differ from
const place = (r, alt) => ({ id: r.id, lat: r.latitude, lon: r.longitude, name: r.name, main: r.name, names: r.names ?? null, country: r.country, cc: r.country_code ?? null, admin1: r.admin1 ?? null, alt, town: true })

// lang is not needed to find a town (every language's name is searched); it stays for the callers
export async function geocodeCity(city, lang = 'en', near = null, { db = supabase } = {}) {
  let towns = null
  try { towns = (await db.rpc('town_lookup', { q: city, lim: 20 })).data } catch { /* no database: not found */ }
  if (!towns?.length) {
    try { towns = ((await db.rpc('towns_search', { q: city, lim: 5 })).data ?? []).filter(t => t.exact || t.prefix).slice(0, 1) } catch { towns = null }
  }
  if (!towns?.length) return null
  const results = towns.map(townResult)
  const r = pickPlace(results, city, near)
  // alt: found by where the search came from, not the place the name alone gives
  return { ...place(r, !!near && r !== pickPlace(results, city)), name: shownName(r, city) }
}

// "My location": the place at a position the phone has rounded to 0.1°, about 10 km (lib/geo.js placeAt;
// the exact position never leaves the device). One of our towns when one is within 10 km (town_near,
// supabase/town-near.sql), named in the visitor's language like a picked suggestion; else the
// municipality OpenStreetMap's Nominatim has at the rounded position (gated, kept 30 days,
// lib/hike/nominatim.js). null: no place there, or nothing answered.
export async function placeNear(near, lang = 'en', { db = supabase, reverse = fetchNominatimPlaceRaw } = {}) {
  let town = null
  try { town = (await db.rpc('town_near', { lat: near.lat, lon: near.lon })).data?.[0] ?? null } catch { /* no towns: Nominatim answers */ }
  if (town) {
    let row = null
    try { row = (await db.from('towns').select('name, names').eq('id', town.id).limit(1)).data?.[0] ?? null } catch { /* the main name will do */ }
    return { name: nameIn(row ?? town, lang) }
  }
  const found = await reverse(near.lat, near.lon, lang)
  const name = found?.address?.city ?? found?.address?.town ?? found?.address?.village ?? found?.address?.municipality ?? found?.name
  return name ? { name } : null
}

// What everything learned about a place is filed under (forecasts, bias, reports, snapshots): its English
// name, so "Wien" and "Vienna" stay one city; a town picked by position over a bigger one of that name gets
// its region too ("Vienna, Virginia"), so the two never share data. Never the visitor's spelling: "Wien",
// "Vienne" and "ウィーン" are all filed under "Vienna" (a town has an English entry only where its main name is not English).
const inLang = (geo, lang) => geo.names?.[lang] ?? geo.main ?? geo.name
const filedName = geo => { const en = inLang(geo, 'en'); return geo.alt ? [en, geo.admin1 ?? geo.cc].filter(Boolean).join(', ') : en }
export const learnName = async geo => filedName(geo)

// Both names of a found place at once (the forecast route): what it is filed under and what the visitor
// sees, the town in the visitor's language where it has a name there ("Vienna" asked in German shows
// "Wien"), else its main name.
export const placeNames = async (geo, lang) => ({ learn: filedName(geo), shown: inLang(geo, lang) })

// The name a reader sees, apart from the name the place goes by (placeNames' shown, which the page sends back
// to find the place again). Chinese is simplified Chinese here: a listed city takes its own Chinese name
// (lib/city-names.js), any other place its name in simplified characters.
export function shownIn(lang, shown, learn) {
  if (lang !== 'zh') return shown
  const slug = learn && CITIES.find(c => c.name === learn)?.slug
  return (slug && cityName(slug, lang, null)) || placeIn(lang, shown)
}
