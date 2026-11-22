// A row in My routes (UX review G2): the route screen's own figures in one line, "5.9 km · ↑≈997 m · there and
// back", worked out on the phone from the saved points with the function the route screen uses before its
// forecast arrives (walkStats). No request per row: the next favourable day needs a forecast and stays on the
// route screen.
import { t } from '../i18n.js'
import { walkStats } from './heights.js'

const asPoints = list => list.map(([lat, lon, ele]) => ({ lat, lon, ele }))

export function rowLine(lang, route) {
  if (!Array.isArray(route?.points) || route.points.length < 2) return null
  const s = walkStats(asPoints(route.points), 'normal', { roundTrip: !!route.roundTrip })
  // heights from the terrain model (every OpenStreetMap route) are approximate, as on the route screen
  const ap = route.source === 'osm' ? '≈' : ''
  return [`${s.distanceKm} km`, s.ascentM != null ? `↑${ap}${s.ascentM} m` : null, route.roundTrip ? t(lang, 'routeRoundTrip') : null]
    .filter(Boolean).join(' · ')
}
