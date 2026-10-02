'use client'

import { useEffect, useState } from 'react'
import { t } from '@/lib/i18n'
import { routeLabel } from '@/lib/route/osm'
import { getRoute, saveRoute } from '@/lib/route-store'
import RouteView from './RouteView'

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
  return (
    <RouteView route={state.route} lang={lang} unit={unit} onBack={onBack}
      saved={state.saved} onSave={canSave ? () => saveRoute({ ...state.route, savedAt: Date.now() }).then(() => setState(s => ({ ...s, saved: true }))) : undefined} />
  )
}
