'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Star, MountainSnow } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fill } from '@/lib/outlook/text'
import { madeAtText, storedPath } from '@/lib/hike/summit-props'
import { hikeApiPath } from '@/lib/hike/params'
import { FIRST_PEAKS, firstPeakRows } from '@/lib/hike/first-peaks'
import featured from '@/lib/hike/featured.json'
import { readShelf, isSaved, rowView } from '@/lib/peak-shelf'
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
  const { now } = shelf
  // nothing kept yet: three well-known peaks with their stored window instead (UX review H1)
  if (!shelf.saved.length && !recent.length) return <FirstPeaks lang={lang} hrefFor={hrefFor} now={now} />
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

// a first-time user's three peaks (lib/hike/first-peaks.js): read in the browser, and only here, where the shelf is
// empty. It asks the summit forecast's address, whose CDN copy lives 1 h plus 30 min stale; a cold copy costs 5.1
// weighted Open-Meteo calls a peak (see lib/hike/first-peaks.js). The names stand at once, the windows follow.
function FirstPeaks({ lang, hrefFor, now }) {
  const [answers, setAnswers] = useState([])
  useEffect(() => {
    const ask = new AbortController()
    Promise.all(FIRST_PEAKS.map(id => fetch(storedPath(hikeApiPath(featured.find(p => p.id === id))), { signal: ask.signal })
      .then(r => (r.ok ? r.json() : null), () => null))).then(setAnswers, () => {})
    return () => ask.abort()
  }, [])
  return <FirstPeakRows lang={lang} rows={firstPeakRows(featured, answers, now)} hrefFor={hrefFor} now={now} />
}

export function FirstPeakRows({ lang, rows, hrefFor, now }) {
  if (!rows?.length) return null
  return (
    <section className="space-y-3">
      <SectionTitle icon={MountainSnow}>{t(lang, 'peaksToStart')}</SectionTitle>
      <ul className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
        {rows.map(p => <PeakRow key={p.id} p={p} lang={lang} href={hrefFor(p)} now={now} />)}
      </ul>
    </section>
  )
}

function PeakRow({ p, lang, href, now }) {
  const v = rowView(lang, p, now)
  // when the forecast was made, at the summit, as a summit page says it
  const madeAt = v ? new Date(p.seen.at + (p.seen.utcOffsetSec ?? 0) * 1000).toISOString().slice(0, 16) : null
  return (
    <li>
      <Link href={href} className="press flex flex-col justify-center min-h-11 px-4 py-2.5 hover:text-emerald-400">
        <span><span className="font-semibold">{p.name}</span> <span className="text-sm text-zinc-500">{p.elevApprox ? '≈' : ''}{p.elev} m</span></span>
        {/* the accent for a favourable window only, the warning colour without storm data (Fable's review) */}
        {v && <span className={`text-sm ${v.tone === 'ok' ? 'text-emerald-400' : 'text-zinc-300'}`} style={v.tone === 'warn' ? { color: 'var(--warn)' } : undefined}>{v.title}</span>}
        {v?.sub && <span className="text-xs text-zinc-400">{v.sub}</span>}
        {v && <span className="text-xs text-zinc-500">{fill(t(lang, 'mtnAsOf'), { when: madeAtText(madeAt, lang) })}</span>}
      </Link>
    </li>
  )
}
