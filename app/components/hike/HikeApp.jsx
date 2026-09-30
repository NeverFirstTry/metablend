'use client'

import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MountainSnow } from 'lucide-react'
import { t } from '@/lib/i18n'
import { useLang } from '@/lib/useLang'
import { useUnit } from '@/lib/useUnit'
import { haversineKm } from '@/lib/geo'
import { peakFromParams, peakHref } from '@/lib/hike/params'
import { SectionTitle } from '../ui'
import FeaturedList from './FeaturedList'
import PeakSearch from './PeakSearch'
import PeakView from './PeakView'
import HikeNotes from './HikeNotes'

// The app-only hiking section: search + featured peaks, then one peak's
// summit forecast. The peak lives in the URL so the phone's back button and
// deep links work; an unknown peak falls back to the list.
function HikeAppInner({ featured }) {
  const lang = useLang()
  const unit = useUnit()
  const router = useRouter()
  const sp = useSearchParams()
  const [pos, setPos] = useState(null)
  const ids = useMemo(() => new Set(featured.map(p => p.id)), [featured])
  const hrefFor = p => peakHref(p, ids)
  const list = useMemo(() => (pos
    ? [...featured].sort((a, b) => haversineKm(pos.lat, pos.lon, a.lat, a.lon) - haversineKm(pos.lat, pos.lon, b.lat, b.lon))
    : featured), [featured, pos])

  const peak = peakFromParams(sp, featured)
  if (peak) return <PeakView key={peak.id} peak={peak} lang={lang} unit={unit} onBack={() => router.push('/hike')} />

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight inline-flex items-center gap-3">
        <MountainSnow size={28} className="text-emerald-400" aria-hidden /> {t(lang, 'hikeTitle')}
      </h1>
      <PeakSearch lang={lang} hrefFor={hrefFor} onLocate={setPos} />
      <section className="space-y-3">
        <SectionTitle icon={MountainSnow}>{t(lang, 'hikeFeatured')}</SectionTitle>
        <FeaturedList peaks={list} hrefFor={hrefFor} />
      </section>
      <HikeNotes lang={lang} />
    </div>
  )
}

export default function HikeApp(props) {
  return (
    <Suspense fallback={null}>
      <HikeAppInner {...props} />
    </Suspense>
  )
}
