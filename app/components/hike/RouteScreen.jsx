'use client'

import { useEffect, useState } from 'react'
import { t } from '@/lib/i18n'
import { routeLabel } from '@/lib/route/osm'
import { getRoute, saveRoute } from '@/lib/route-store'
import { highestIndex } from '@/lib/route/geometry'
import { isNative } from '@/lib/native'
import { localToday } from '@/lib/app-widget-sync'
import RouteView from './RouteView'
import PlanHike from './PlanHike'

// Resolves ?route= into a route: 'osm-<id>' from the peak's route list (CDN
// cached), anything else from the phone's saved routes.
export default function RouteScreen({ routeId, peak, lang, unit, onBack }) {
  const [state, setState] = useState({ route: null, missing: false, saved: false })
  // plain values: a peak from URL parameters is a new object on every render
  const lat = peak?.lat, lon = peak?.lon, elev = peak?.elev, peakName = peak?.name ?? ''

  useEffect(() => {
    let off = false
    const done = (route, saved) => { if (!off) setState({ route, missing: !route, saved }) }
    if (routeId.startsWith('osm-') && lat != null) {
      const id = Number(routeId.slice(4))
      fetch(`/api/routes?lat=${lat}&lon=${lon}&elev=${Math.round(elev)}&name=${encodeURIComponent(peakName)}`)
        .then(r => (r.ok ? r.json() : { routes: [] }))
        .then(async ({ routes }) => {
          const r = (routes ?? []).find(x => x.id === id)
          const route = r && { id: routeId, name: routeLabel(r) ?? t(lang, 'routeUnnamed'), source: 'osm', roundTrip: r.roundTrip, points: r.points }
          done(route, !!(route && (await getRoute(routeId))))
        }, () => done(null, false))
    } else {
      getRoute(routeId).then(r => done(r, !!r), () => done(null, false))
    }
    return () => { off = true }
  }, [routeId, lat, lon, elev, peakName, lang])

  if (state.missing) return <p className="text-sm text-zinc-500">{t(lang, 'routesUnavailable')}</p>
  if (!state.route) return <p className="text-sm text-zinc-500">{t(lang, 'routesLoading')}</p>
  const canSave = state.route.source === 'osm'
  // the plan's peak is the route's highest point (the alert names the route)
  const pts = state.route.points
  const top = pts[highestIndex(pts.map(p => ({ lat: p[0], lon: p[1], ele: p[2] })))]
  const planPeak = { name: state.route.name.slice(0, 80) || peakName || '—', lat: top[0], lon: top[1], elev: Math.max(0, Math.round(top[2] ?? elev ?? 0)) }
  return (
    <RouteView route={state.route} lang={lang} unit={unit} onBack={onBack}
      saved={state.saved} onSave={canSave ? () => saveRoute({ ...state.route, savedAt: Date.now() }).then(() => setState(s => ({ ...s, saved: true }))) : undefined}>
      {isNative() ? ({ pace }) => <PlanHike peak={planPeak} lang={lang} unit={unit} todayLocal={localToday()} route={state.route} pace={pace} /> : null}
    </RouteView>
  )
}
