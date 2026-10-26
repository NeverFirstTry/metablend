'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MountainSnow } from 'lucide-react'
import { t } from '@/lib/i18n'
import { useLang } from '@/lib/useLang'
import { useUnit } from '@/lib/useUnit'
import { peakFromParams, peakHref } from '@/lib/hike/params'
import { recordVisit, backAction } from '@/lib/hike/nav'
import { rememberTabUrl } from '@/lib/app-tabs'
import PeakSearch from './PeakSearch'
import PeakView from './PeakView'
import HikeNotes from './HikeNotes'
import RouteScreen from './RouteScreen'
import MyRoutes from './MyRoutes'
import PeakDirectory from './PeakDirectory'
// in the app's code (downloaded once, cached), not in every visit's page data
import featured from '@/lib/hike/featured.json'

// The app-only hiking section: search + featured peaks, then one peak's
// summit forecast. The peak lives in the URL so the phone's back button and
// deep links work; an unknown peak falls back to the list.
// the hike screens visited while this page is open (lib/hike/nav.js)
const TRAIL = []
const IDS = new Set(featured.map(p => p.id))

function HikeAppInner() {
  const lang = useLang()
  const unit = useUnit()
  const router = useRouter()
  const sp = useSearchParams()
  const [pos, setPos] = useState(null)
  const hrefFor = p => peakHref(p, IDS)

  const qs = sp.toString()
  const href = `/hike${qs ? `?${qs}` : ''}`
  // the Hiking tab reopens here — whether it's left by the tab bar, back or a link
  useEffect(() => { recordVisit(TRAIL, href); rememberTabUrl('/hike', href) }, [href])
  useEffect(() => () => { TRAIL.length = 0 }, [])
  const goBack = parent => (backAction(TRAIL, parent) === 'back' ? router.back() : router.replace(parent))

  const peak = peakFromParams(sp, featured)
  const routeId = sp.get('route')
  if (routeId) {
    const back = () => { const q = new URLSearchParams(sp); q.delete('route'); const rest = q.toString(); goBack(`/hike${rest ? `?${rest}` : ''}`) }
    return <RouteScreen key={routeId} routeId={routeId} peak={peak} lang={lang} unit={unit} onBack={back} />
  }
  if (peak) return <PeakView key={peak.id} peak={peak} lang={lang} unit={unit} onBack={() => goBack('/hike')} />

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight inline-flex items-center gap-3">
        <MountainSnow size={28} className="text-emerald-400" aria-hidden /> {t(lang, 'hikeTitle')}
      </h1>
      <PeakSearch lang={lang} hrefFor={hrefFor} onLocate={setPos} />
      <MyRoutes lang={lang} />
      <PeakDirectory peaks={featured} lang={lang} hrefFor={hrefFor} pos={pos} />
      <HikeNotes lang={lang} />
    </div>
  )
}

export default function HikeApp() {
  return (
    <Suspense fallback={null}>
      <HikeAppInner />
    </Suspense>
  )
}
