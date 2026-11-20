'use client'

import Link from 'next/link'
import { BellRing } from 'lucide-react'
import { t } from '@/lib/i18n'
import { dayWord } from '@/lib/outlook/text'
import { localToday } from '@/lib/app-widget-sync'
import { usePlans } from '@/lib/plans-client'
import { upcoming } from '@/lib/plans'
import { SectionTitle } from '../ui'

// Hiking tab, at the top: the hikes planned from this phone (UX review N2), each opening its peak, where the plan
// can be cancelled. Nothing when none, and nothing without notifications (then nothing can be planned).
export default function PlannedHikes({ lang, hrefFor, featured, todayLocal = null }) {
  const today = todayLocal ?? localToday()
  const list = upcoming(usePlans(), today)
  if (!list.length) return null
  const near = (a, b) => Math.abs(a - b) < 1e-4
  const peakOf = p => featured.find(f => near(f.lat, p.lat) && near(f.lon, p.lon)) ?? { name: p.name, lat: p.lat, lon: p.lon, elev: p.elev }
  return (
    <section className="space-y-3">
      <SectionTitle icon={BellRing}>{t(lang, 'plannedTitle')}</SectionTitle>
      <ul className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
        {list.map(p => (
          <li key={p.id}>
            <Link href={hrefFor(peakOf(p))} className="block min-h-11 px-4 py-2.5 hover:text-emerald-400">
              <span className="block truncate">{p.route_name ?? p.name}</span>
              <span className="block truncate text-sm text-zinc-500">{[dayWord(lang, p.date, today), p.route_name ? p.name : null].filter(Boolean).join(' · ')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
