// The Hiking tab for a first-time user (UX review H1, owner 2026-11-21): three peaks a first-time user in the
// Alps recognises, each with the window of its summit forecast (the address the summit pages read, models=core),
// read in the browser only while the phone has no saved or recent peak (Fable's review: not on the server for every
// visit). It reads only the copy the summit pages keep (stored=only, lib/hike/summit-props.js keptOnlyPath): never
// Open-Meteo, and a peak without a kept copy is left out (owner, 2026-11-22, after the Review found that the plain
// address made a cold CDN copy again, 5.1 weighted Open-Meteo calls a peak). Featured peaks only: only
// they have a summit page and with it a stored forecast. Hochstein near Lienz has none; the Drei Zinnen are the
// best-known summit within an hour of Lienz after the Großglockner.
import { seenOf } from '../peak-shelf.js'

export const FIRST_PEAKS = ['grossglockner', 'zugspitze', 'tre-cime']

// answers: the kept forecasts in FIRST_PEAKS order (null: none kept, the peak is left out; not there yet: the name
// stands without a window); rows as My peaks shows them
export function firstPeakRows(featured, answers, now = Date.now()) {
  return FIRST_PEAKS.map((id, i) => {
    const p = featured.find(x => x.id === id)
    return p && answers[i] !== null && { id: p.id, name: p.name, lat: p.lat, lon: p.lon, elev: p.elev, country: p.country ?? null, elevApprox: !!p.elevApprox, seen: seenOf(answers[i], now) }
  }).filter(Boolean)
}
