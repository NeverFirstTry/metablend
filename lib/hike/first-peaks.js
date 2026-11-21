// The Hiking tab for a first-time user (UX review H1, owner 2026-11-21): three peaks a first-time user in the
// Alps recognises, each with the window of its stored summit forecast (the summit pages' own copy, models=core,
// kept six hours), read in the browser only while the phone has no saved or recent peak (Fable's review: not on
// the server for every visit). Featured peaks only: only
// they have a summit page and with it a stored forecast. Hochstein near Lienz has none; the Drei Zinnen are the
// best-known summit within an hour of Lienz after the Großglockner.
import { seenOf } from '../peak-shelf.js'

export const FIRST_PEAKS = ['grossglockner', 'zugspitze', 'tre-cime']

// answers: the stored forecasts in FIRST_PEAKS order (null where none came); rows as My peaks shows them
export function firstPeakRows(featured, answers, now = Date.now()) {
  return FIRST_PEAKS.map((id, i) => {
    const p = featured.find(x => x.id === id)
    return p && { id: p.id, name: p.name, lat: p.lat, lon: p.lon, elev: p.elev, country: p.country ?? null, elevApprox: !!p.elevApprox, seen: seenOf(answers[i], now) }
  }).filter(Boolean)
}
