// The Hiking tab for a first-time user (UX review H1, owner 2026-11-21): three peaks a first-time user in the
// Alps recognises, each with the window of its summit forecast (the address the summit pages read, models=core),
// read in the browser only while the phone has no saved or recent peak (Fable's review: not on the server for every
// visit). The browser reaches the CDN copy of that address (1 h, then 30 min stale), not the summit pages' six-hour
// server copy: a cold CDN copy runs the summit forecast, 5.1 weighted Open-Meteo calls a peak (Review, 2026-11-22;
// how it should read is the owner's decision). Featured peaks only: only
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
