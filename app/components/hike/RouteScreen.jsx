'use client'

import { useEffect, useState } from 'react'
import { t } from '@/lib/i18n'
import { routesApiPath } from '@/lib/hike/params'
import { routeLabel } from '@/lib/route/osm'
import { knownRouteList } from '@/lib/route/list-cache'
import { getRoute, saveRoute } from '@/lib/route-store'
import { highestIndex } from '@/lib/route/geometry'
import { isNative } from '@/lib/native'
import { localToday } from '@/lib/app-widget-sync'
import RouteView from './RouteView'
import PlanHike from './PlanHike'

// Resolves ?route= into a route: 'osm-<id>' from the peak's route list (CDN
// cached), anything else from the phone's saved routes.
const osmRoute = (r, routeId, lang) => r && { id: routeId, name: routeLabel(r) ?? t(lang, 'routeUnnamed'), source: 'osm', roundTrip: r.roundTrip, points: r.points }

export default function RouteScreen({ routeId, peak, lang, unit, onBack }) {
  // plain values: a peak from URL parameters is a new object on every render
  const lat = peak?.lat, lon = peak?.lon, elev = peak?.elev, peakName = peak?.name ?? ''
  const osmId = routeId.startsWith('osm-') && lat != null ? Number(routeId.slice(4)) : null
  const listUrl = osmId != null ? routesApiPath({ lat, lon, elev, name: peakName }) : null
  // opened from the peak's list: the list kept in memory has the route, so its screen shows at once (UX review P5)
  const [state, setState] = useState(() => ({ route: osmRoute(listUrl && knownRouteList(listUrl)?.find(x => x.id === osmId), routeId, lang) ?? null, missing: false, saved: false }))

  useEffect(() => {
    let off = false
    const done = (route, saved) => { if (!off) setState({ route, missing: !route, saved }) }
    if (listUrl) {
      const known = knownRouteList(listUrl)?.find(x => x.id === osmId)
      // known: only whether it is saved; the route object stays, so its forecast is not asked twice
      if (known) getRoute(routeId).then(r => { if (!off) setState(st => ({ ...st, saved: !!r })) }, () => {})
      else {
        fetch(listUrl)
          .then(r => (r.ok ? r.json() : { routes: [] }))
          .then(async ({ routes }) => {
            const route = osmRoute((routes ?? []).find(x => x.id === osmId), routeId, lang)
            done(route, !!(route && (await getRoute(routeId))))
          }, () => done(null, false))
      }
    } else {
      getRoute(routeId).then(r => done(r, !!r), () => done(null, false))
    }
    return () => { off = true }
  }, [routeId, listUrl, osmId, lang])

  if (state.missing) return <p className="text-sm text-zinc-500">{t(lang, 'routesUnavailable')}</p>
  if (!state.route) return <p className="text-sm text-zinc-500">{t(lang, 'routesLoading')}</p>
  const canSave = state.route.source === 'osm'
  // the plan's peak is the route's highest point (the alert names the route)
  const pts = state.route.points
  const top = pts[highestIndex(pts.map(p => ({ lat: p[0], lon: p[1], ele: p[2] })))]
  const planPeak = { name: state.route.name.slice(0, 80) || peakName || '—', lat: top[0], lon: top[1], elev: Math.max(0, Math.round(top[2] ?? elev ?? 0)) }
  return (
    <RouteView route={state.route} lang={lang} unit={unit} onBack={onBack} backLabel={peak?.name || t(lang, 'hiking')}
      saved={state.saved} onSave={canSave ? () => saveRoute({ ...state.route, savedAt: Date.now() }).then(() => setState(s => ({ ...s, saved: true }))) : undefined}>
      {isNative() ? ({ pace }) => <PlanHike peak={planPeak} lang={lang} unit={unit} todayLocal={localToday()} route={state.route} pace={pace} /> : null}
    </RouteView>
  )
}
