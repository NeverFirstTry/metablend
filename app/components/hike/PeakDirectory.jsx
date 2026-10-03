'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapPin, MountainSnow, ChevronDown } from 'lucide-react'
import { t } from '@/lib/i18n'
import { nearest, byRegion, lastCityPos, isOpen, toggled } from '@/lib/hike/featured-list'
import { grantedPosition } from '@/lib/native'
import { SectionTitle } from '../ui'
import FeaturedList from './FeaturedList'

// The featured peaks: the 10 nearest (the position when already allowed or
// after "Near me", else the last city looked at), then every peak by region
// in collapsible groups — the nearest peak's region open. Without hrefFor
// (the website teaser) plain cards and no Near you block.
// Kept while the app runs: a peak page unmounts the list, and coming back
// must find the same position and the regions the user had open.
const MEMO = { pos: null, open: null }

export default function PeakDirectory({ peaks, lang, hrefFor = null, pos = null }) {
  const linked = !!hrefFor // hrefFor is a new function every render: depend on this
  const [autoPos, setAutoPos] = useState(() => (linked ? MEMO.pos : null))
  const [open, setOpen] = useState(() => (linked ? MEMO.open : null))

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
  const near = useMemo(() => (linked ? nearest(peaks, here, 10) : []), [linked, peaks, here])
  const groups = useMemo(() => byRegion(peaks), [peaks])
  const openRegion = near[0]?.region ?? null
  const toggle = (region, nowOpen) => setOpen(prev => {
    const next = toggled(prev, openRegion, region, nowOpen)
    if (linked) MEMO.open = next
    return next
  })

  return (
    <div className="space-y-6">
      {near.length > 0 && (
        <section className="space-y-3">
          <SectionTitle icon={MapPin}>{t(lang, 'hikeNearYou')}</SectionTitle>
          <FeaturedList peaks={near} hrefFor={hrefFor} />
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
