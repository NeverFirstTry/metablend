'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Route as RouteIcon, Trash2 } from 'lucide-react'
import { t } from '@/lib/i18n'
import { listRoutes, removeRoute } from '@/lib/route-store'
import { pendingRemoval } from '@/lib/pending-removal'
import { SectionTitle } from '../ui'
import ImportGpx from './ImportGpx'

// Hiking → My routes: import a GPX, reopen or remove saved routes.
// The list as last read, kept while the app runs: back on the Hiking tab it
// shows at once instead of popping in (and pushing the peaks down).
const KNOWN = new Map()

export default function MyRoutes({ lang }) {
  const [routes, setRoutes] = useState(() => KNOWN.get('routes') ?? null)
  // a removed route leaves the list at once and goes for good after a pause, unless Undo (UX review G1)
  const [removed, setRemoved] = useState(null)
  const [pending] = useState(() => pendingRemoval(id => removeRoute(id).then(r => {
    KNOWN.set('routes', r); setRoutes(r); setRemoved(x => (x?.id === id ? null : x))
  })))

  useEffect(() => {
    let off = false
    listRoutes().then(r => { KNOWN.set('routes', r); if (!off) setRoutes(r) })
    return () => { off = true; pending.commit() } // leaving the screen makes a waiting removal final
  }, [pending])

  const remove = r => { setRemoved(r); pending.start(r.id) }
  const undo = () => { pending.undo(); setRemoved(null) }
  const shown = routes?.filter(r => r.id !== removed?.id)

  return (
    <section className="space-y-3">
      <SectionTitle icon={RouteIcon}>{t(lang, 'myRoutes')}</SectionTitle>
      <ImportGpx lang={lang} />
      {/* the line's space is kept while the first read runs, so nothing below jumps */}
      {routes === null && <p className="text-sm text-zinc-500 invisible" aria-hidden>{t(lang, 'myRoutesEmpty')}</p>}
      {shown && !shown.length && !removed && <p className="text-sm text-zinc-500">{t(lang, 'myRoutesEmpty')}</p>}
      {removed && (
        <p role="status" className="flex items-center gap-2 text-sm text-zinc-300">
          {t(lang, 'routeRemoved')}
          <button type="button" onClick={undo} className="press min-h-11 px-2 font-semibold underline underline-offset-2 hover:text-emerald-400">{t(lang, 'undo')}</button>
        </p>
      )}
      {shown?.length > 0 && (
        <ul className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
          {shown.map(r => (
            <li key={r.id} className="flex items-center gap-2 pl-4 pr-1">
              <Link href={`/hike?route=${encodeURIComponent(r.id)}`} className="flex-1 min-w-0 truncate py-2.5 hover:text-emerald-400">{r.name}</Link>
              <button onClick={() => remove(r)} aria-label={`${t(lang, 'routeRemove')}: ${r.name}`}
                className="press size-11 inline-flex items-center justify-center text-zinc-500 hover:text-red-300"><Trash2 size={16} aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
