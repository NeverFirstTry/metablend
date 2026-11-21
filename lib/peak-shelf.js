// Saved and recently opened peaks, kept on the phone (UX review 2026-11-20, H2: a city had Saved and Recent,
// a mountain had neither, and the weekend hiker checks the same ones three times before a tour).
// A row's window is the one from the last forecast this phone fetched for the peak (`seen`), read for the
// reader's day like the hiking teaser (teaserWindow); no new request is made for a row: each would be an
// Open-Meteo request on every visit of the Hiking tab.
import { teaserWindow } from './hike/summit-props.js'
import { windowText, windowTone } from './hike/text.js'

const KEY = 'mb_peaks'
const SAVED_MAX = 12, RECENT_MAX = 5
// a look from the evening before still answers the next morning (the row says when it was made); an older
// one is not shown, its window may have moved since
const SEEN_HOURS = 24

const store = () => (typeof localStorage === 'undefined' ? null : localStorage)
export function readShelf(s = store()) {
  try {
    const x = JSON.parse(s?.getItem(KEY) ?? '{}')
    return { saved: Array.isArray(x.saved) ? x.saved : [], recent: Array.isArray(x.recent) ? x.recent : [] }
  } catch { return { saved: [], recent: [] } }
}
const write = (shelf, s) => { try { s?.setItem(KEY, JSON.stringify(shelf)) } catch { /* private mode or full: kept for this view only */ } return shelf }
// only what a row and its link need
const slim = (p, seen = null) => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, elev: p.elev, country: p.country ?? null, elevApprox: !!p.elevApprox, seen })
const without = (list, id) => list.filter(p => p.id !== id)

export const isSaved = (shelf, id) => shelf.saved.some(p => p.id === id)

export function toggleSaved(peak, s = store()) {
  const shelf = readShelf(s)
  const was = shelf.saved.find(p => p.id === peak.id)
  const seen = was?.seen ?? shelf.recent.find(p => p.id === peak.id)?.seen ?? null
  return write({ ...shelf, saved: was ? without(shelf.saved, peak.id) : [slim(peak, seen), ...shelf.saved].slice(0, SAVED_MAX) }, s)
}

// a peak opened, with the forecast it showed (or null while none came): to the top of Recent; a saved
// peak keeps its place and takes the new look too. `at` is when the forecast was made (a CDN copy is up to
// 90 minutes old, an outage's kept answer up to a day), not when the phone looked (Fable's review,
// 2026-11-20); stormUnknown: the forecast had no storm data, so its window was judged without storms.
// what a row keeps of a forecast (also the first-time peaks' stored forecasts, lib/hike/first-peaks.js)
export const seenOf = (d, now = Date.now()) => (d?.nowLocal ? {
  nowLocal: d.nowLocal, utcOffsetSec: d.utcOffsetSec ?? null,
  windows: { today: d.windows?.today ?? null, tomorrow: d.windows?.tomorrow ?? null },
  at: Date.parse(d.generatedAt) || now, stormUnknown: !!d.notes?.includes('no_storm_data'),
} : null)

export function noteVisit(peak, d, s = store(), now = Date.now()) {
  const shelf = readShelf(s)
  const seen = seenOf(d, now)
    ?? shelf.recent.find(p => p.id === peak.id)?.seen ?? shelf.saved.find(p => p.id === peak.id)?.seen ?? null
  return write({
    saved: shelf.saved.map(p => (p.id === peak.id ? slim(p, seen) : p)),
    recent: [slim(peak, seen), ...without(shelf.recent, peak.id)].slice(0, RECENT_MAX),
  }, s)
}

// the window a row shows: { w, date, todayLocal } as teaserWindow gives it, or null when there is none
// to show (no look yet, too old, or it speaks of days gone by)
export function rowWindow(p, now = Date.now()) {
  if (!p?.seen || now - p.seen.at > SEEN_HOURS * 3600e3) return null
  return teaserWindow(p.seen, now)
}

// what a row says and its tone, as the peak view phrases and colours a window: the accent only for a
// favourable one ('ok'); a window judged without storm data is 'warn' and says so in `sub`
export function rowView(lang, p, now = Date.now()) {
  const w = rowWindow(p, now)
  if (!w) return null
  const stormUnknown = !!p.seen.stormUnknown
  return { ...windowText(lang, w.w, { date: w.date, todayLocal: w.todayLocal, stormUnknown }), tone: windowTone(w.w, { stormUnknown }) }
}
