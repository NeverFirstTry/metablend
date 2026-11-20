'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fill } from '@/lib/outlook/text'
import { windowText } from '@/lib/hike/text'
import { madeAtText } from '@/lib/hike/summit-props'
import { readShelf, isSaved, rowWindow } from '@/lib/peak-shelf'
import { SectionTitle } from '../ui'

// Hiking → My peaks (starred on a peak) and the peaks opened lately, at the top of the tab (UX review H2).
// Each row: name, height and, from the last forecast this phone fetched for the peak, its next favourable
// window with the time it was made; no request is made for a row. Kept while the app runs, like My routes,
// so the list stands at once when the tab is reopened.
const KNOWN = new Map()

export default function MyPeaks({ lang, hrefFor }) {
  // the shelf and the moment it was read (the rows' windows are read for that moment, not during a render)
  const [shelf, setShelf] = useState(() => KNOWN.get('shelf') ?? null)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the phone's storage, after hydration
  useEffect(() => { const s = { ...readShelf(), now: Date.now() }; KNOWN.set('shelf', s); setShelf(s) }, [])
  if (!shelf) return null
  const recent = shelf.recent.filter(p => !isSaved(shelf, p.id))
  if (!shelf.saved.length && !recent.length) return null
  const { now } = shelf
  const rows = list => (
    <ul className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
      {list.map(p => <PeakRow key={p.id} p={p} lang={lang} href={hrefFor(p)} now={now} />)}
    </ul>
  )
  return (
    <section className="space-y-3">
      {shelf.saved.length > 0 && <><SectionTitle icon={Star}>{t(lang, 'myPeaks')}</SectionTitle>{rows(shelf.saved)}</>}
      {recent.length > 0 && <><h2 className="text-xs uppercase tracking-wider text-zinc-500">{t(lang, 'peaksRecent')}</h2>{rows(recent)}</>}
    </section>
  )
}

function PeakRow({ p, lang, href, now }) {
  const w = rowWindow(p, now)
  const title = w ? windowText(lang, w.w, { date: w.date, todayLocal: w.todayLocal }).title : null
  // the look's time at the summit, as a summit page says it
  const madeAt = w ? new Date(p.seen.at + (p.seen.utcOffsetSec ?? 0) * 1000).toISOString().slice(0, 16) : null
  return (
    <li>
      <Link href={href} className="press flex flex-col justify-center min-h-11 px-4 py-2.5 hover:text-emerald-400">
        <span><span className="font-semibold">{p.name}</span> <span className="text-sm text-zinc-500">{p.elevApprox ? '≈' : ''}{p.elev} m</span></span>
        {title && <span className="text-sm text-emerald-400">{title}</span>}
        {title && <span className="text-xs text-zinc-500">{fill(t(lang, 'mtnAsOf'), { when: madeAtText(madeAt, lang) })}</span>}
      </Link>
    </li>
  )
}
