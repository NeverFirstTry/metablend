'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Route as RouteIcon, ChevronRight } from 'lucide-react'
import { t } from '@/lib/i18n'
import { routeLabel, sacGrade } from '@/lib/route/osm'
import { SectionTitle } from '../ui'

const duration = m => `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}`

// Peak page → the marked routes up it (OpenStreetMap). A tap opens the route
// with this peak's parameters kept, so back returns here.
export default function RouteList({ peak, lang }) {
  const router = useRouter()
  const [state, setState] = useState({ routes: null, error: false })

  useEffect(() => {
    let off = false
    fetch(`/api/routes?lat=${peak.lat}&lon=${peak.lon}&elev=${Math.round(peak.elev)}&name=${encodeURIComponent(peak.name ?? '')}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(d => { if (!off) setState({ routes: d.routes ?? [], error: false }) }, () => { if (!off) setState({ routes: [], error: true }) })
    return () => { off = true }
  }, [peak.lat, peak.lon, peak.elev, peak.name])

  const open = id => {
    const sp = new URLSearchParams(window.location.search)
    sp.set('route', `osm-${id}`)
    router.push(`/hike?${sp}`)
  }

  return (
    <section className="space-y-2">
      <SectionTitle icon={RouteIcon}>{t(lang, 'routesTitle')}</SectionTitle>
      {state.routes == null ? (
        <p className="text-sm text-zinc-500">{t(lang, 'routesLoading')}</p>
      ) : state.error ? (
        <p className="text-sm text-zinc-500">{t(lang, 'routesUnavailable')}</p>
      ) : !state.routes.length ? (
        <p className="text-sm text-zinc-500">{t(lang, 'routesNone')}</p>
      ) : (
        <ul className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
          {state.routes.map(r => (
            <li key={r.id}>
              <button onClick={() => open(r.id)} className="press w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-zinc-800/50">
                <span className="flex-1 min-w-0">
                  <span className="block font-medium truncate">{routeLabel(r) ?? t(lang, 'routeUnnamed')}</span>
                  <span className="block text-xs text-zinc-500">
                    {[sacGrade(r.difficulty), `${r.distanceKm} km`].filter(Boolean).join(' · ')} · ↑{r.ascentM} m · ~{duration(r.minutes)}{r.roundTrip ? ` · ${t(lang, 'routeRoundTrip')}` : ''}
                  </span>
                </span>
                <ChevronRight size={16} className="text-zinc-500" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
