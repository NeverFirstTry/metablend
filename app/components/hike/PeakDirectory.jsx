'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapPin, MountainSnow, ChevronDown } from 'lucide-react'
import { t } from '@/lib/i18n'
import { nearest, byRegion, lastCityPos, isOpen, toggled } from '@/lib/hike/featured-list'
import { nearCell, pickNearPeaks, nearView } from '@/lib/hike/near'
import { grantedPosition } from '@/lib/native'
import { SectionTitle } from '../ui'
import FeaturedList from './FeaturedList'

// Near you: the notable summits around the position (when already allowed or
// after "Near me", else the last city looked at), picked here from the
// summits /api/peaks/near knows around that ~5 km cell — "looking…" until it
// answers, and a retry if it can't (never far-off stand-ins). Then every
// featured peak by region in collapsible groups, the nearest one's region
// open. Without hrefFor (the website teaser) plain cards and no Near you.
// Kept while the app runs: a peak page unmounts the list, and coming back
// must find the same position, summits and the regions the user had open.
const MEMO = { pos: null, open: null, near: null }
const cellKey = p => { const c = p && nearCell(p.lat, p.lon); return c ? `${c.lat},${c.lon}` : null }

export default function PeakDirectory({ peaks, lang, hrefFor = null, pos = null }) {
  const linked = !!hrefFor // hrefFor is a new function every render: depend on this
  const [autoPos, setAutoPos] = useState(() => (linked ? MEMO.pos : null))
  const [open, setOpen] = useState(() => (linked ? MEMO.open : null))
  const [summits, setSummits] = useState(() => (linked ? MEMO.near : null)) // { key, peaks: the cell's summits }
  const [failed, setFailed] = useState(null) // the cell whose lookup failed
  const [attempt, setAttempt] = useState(0)

  // the last city at once, the device position when it comes (only when
  // location was already allowed — no prompt here)
  useEffect(() => {
    if (!linked) return
    let off = false
    const set = p => { if (!off && p) { MEMO.pos = p; setAutoPos(p) } }
    Promise.resolve().then(() => { if (!MEMO.pos) set(lastCityPos(k => localStorage.getItem(k))) })
    grantedPosition().then(set)
    return () => { off = true }
  }, [linked])

  const here = pos ?? autoPos
  const key = linked ? cellKey(here) : null

  // the summits around this ~5 km cell (CDN-cached a day)
  useEffect(() => {
    if (!key || MEMO.near?.key === key) return
    let off = false
    const [lat, lon] = key.split(',')
    fetch(`/api/peaks/near?lat=${lat}&lon=${lon}&v=2`)
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (off) return
        if (!Array.isArray(j?.summits)) { setFailed(key); return }
        MEMO.near = { key, peaks: j.summits }
        setSummits(MEMO.near)
      })
      .catch(() => { if (!off) setFailed(key) })
    return () => { off = true }
  }, [key, attempt])
  const retry = () => { setFailed(null); setAttempt(a => a + 1) }

  const view = nearView(summits, failed, key)
  const arrived = view.status === 'ready' || view.status === 'empty'
  // picked from where you are, not from the cell's centre
  const near = useMemo(() => (arrived && here ? pickNearPeaks(view.peaks, peaks, here) : []), [arrived, view.peaks, peaks, here])
  const groups = useMemo(() => byRegion(peaks), [peaks])
  // the region to open: the nearest featured peak's (summits have no group)
  const openRegion = useMemo(() => (linked ? nearest(peaks, here, 1)[0]?.region ?? null : null), [linked, peaks, here])
  const toggle = (region, nowOpen) => setOpen(prev => {
    const next = toggled(prev, openRegion, region, nowOpen)
    if (linked) MEMO.open = next
    return next
  })

  return (
    <div className="space-y-6">
      {(near.length > 0 || view.status === 'loading' || view.status === 'failed') && (
        <section className="space-y-3">
          <SectionTitle icon={MapPin}>{t(lang, 'hikeNearYou')}</SectionTitle>
          {view.status === 'loading' && <p role="status" className="text-sm text-zinc-400">{t(lang, 'hikeNearLoading')}</p>}
          {view.status === 'failed' && (
            <p className="text-sm text-zinc-400">
              {t(lang, 'hikeNearFailed')}{' '}
              <button onClick={retry} className="press underline hover:text-emerald-400">{t(lang, 'retry')}</button>
            </p>
          )}
          {near.length > 0 && <FeaturedList peaks={near} hrefFor={hrefFor} />}
        </section>
      )}
      <section className="space-y-2">
        <SectionTitle icon={MountainSnow}>{t(lang, 'hikeAllPeaks')}</SectionTitle>
        <div>
          {groups.map(g => (
            <details key={g.region} open={isOpen(g.region, open, openRegion)} onToggle={e => toggle(g.region, e.currentTarget.open)} className="group border-b border-zinc-800 last:border-b-0">
              <summary className="press flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm [&::-webkit-details-marker]:hidden">
                <span className="font-medium min-w-0 truncate">{t(lang, `region_${g.region}`)}</span>
                <span className="inline-flex items-center gap-2 text-xs text-zinc-500 tabular-nums shrink-0">
                  {g.peaks.length}
                  <ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden />
                </span>
              </summary>
              <div className="pb-3"><FeaturedList peaks={g.peaks} hrefFor={hrefFor} /></div>
            </details>
          ))}
        </div>
        <p className="text-xs text-zinc-500 pt-1">{t(lang, 'gradeNote')}</p>
      </section>
    </div>
  )
}
