'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Route as RouteIcon, Trash2 } from 'lucide-react'
import { t } from '@/lib/i18n'
import { listRoutes, removeRoute } from '@/lib/route-store'
import { SectionTitle } from '../ui'
import ImportGpx from './ImportGpx'

// Hiking → My routes: import a GPX, reopen or remove saved routes.
export default function MyRoutes({ lang }) {
  const [routes, setRoutes] = useState(null)

  useEffect(() => {
    let off = false
    listRoutes().then(r => { if (!off) setRoutes(r) })
    return () => { off = true }
  }, [])

  return (
    <section className="space-y-3">
      <SectionTitle icon={RouteIcon}>{t(lang, 'myRoutes')}</SectionTitle>
      <ImportGpx lang={lang} />
      {routes && !routes.length && <p className="text-sm text-zinc-500">{t(lang, 'myRoutesEmpty')}</p>}
      {routes?.length > 0 && (
        <ul className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
          {routes.map(r => (
            <li key={r.id} className="flex items-center gap-2 px-4 py-2.5">
              <Link href={`/hike?route=${encodeURIComponent(r.id)}`} className="flex-1 min-w-0 truncate hover:text-emerald-400">{r.name}</Link>
              <button onClick={() => removeRoute(r.id).then(setRoutes)} aria-label={`${t(lang, 'routeRemove')}: ${r.name}`}
                className="press p-1.5 text-zinc-500 hover:text-red-300"><Trash2 size={15} aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
