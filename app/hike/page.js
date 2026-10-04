import Link from 'next/link'
import { headers, cookies } from 'next/headers'
import { ArrowLeft, MountainSnow } from 'lucide-react'
import featured from '@/lib/hike/featured.json'
import { isAppRequest } from '@/lib/app-client'
import { hikeApiPath } from '@/lib/hike/params'
import { windowText, windowTone } from '@/lib/hike/text'
import { t, detectLang, LANGUAGES } from '@/lib/i18n'
import { addDays } from '@/lib/localtime'
import Footer from '../components/Footer'
import Headline from '../components/outlook/Headline'
import PeakDirectory from '../components/hike/PeakDirectory'
import StoreBadges from '../components/hike/StoreBadges'
import HikeNotes from '../components/hike/HikeNotes'
import HikeApp from '../components/hike/HikeApp'
import AppFlag from './AppFlag'
import LangPack from '../components/LangPack'

export const metadata = {
  title: 'Mountain Weather & Summit Forecasts — MetaBlend App',
  description: 'Summit forecasts for any peak: wind up top, freezing level, thunderstorm risk and the safe summit window. In the MetaBlend app.',
  alternates: { canonical: '/hike' },
}

// Self-fetch through the public domain (like the city pages): the teaser
// shares the peak's CDN entry with every app user looking at it.
const BASE = process.env.VERCEL_ENV ? 'https://metablend.app' : 'http://localhost:3000'
const PEAKS = featured.filter(p => p.kind === 'peak')
// the teaser lists them without links or distances: only what a row shows
// goes to the browser (PeakDirectory is a client component)
const TEASER_PEAKS = featured.map(({ id, name, elev, country, kind, region, grade }) => ({ id, name, elev, country, kind, region, grade }))
// one featured peak per UTC day, the same for everyone that day
const peakOfDay = (now = Date.now()) => PEAKS[Math.floor(now / 864e5) % PEAKS.length]

async function liveWindow(p) {
  try {
    const res = await fetch(`${BASE}${hikeApiPath(p)}`, { next: { revalidate: 1800 } })
    return res.ok ? await res.json() : null
  } catch {
    return null // the teaser renders without the live box
  }
}

const shell = children => (
  <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
    <div className="max-w-3xl mx-auto">{children}</div>
  </main>
)

export default async function HikePage({ searchParams }) {
  const sp = await searchParams
  const h = await headers()
  const appParam = typeof sp?.app === 'string' ? sp.app : null
  if (isAppRequest({ userAgent: h.get('user-agent') ?? '', cookie: h.get('cookie') ?? '', appParam })) {
    return shell(<><AppFlag value={appParam} /><HikeApp featured={featured} /></>)
  }

  const saved = (await cookies()).get('metablend_lang')?.value
  const lang = LANGUAGES.some(l => l.code === saved) ? saved : detectLang(h.get('accept-language') ?? 'en')
  const peak = peakOfDay()
  const data = await liveWindow(peak)
  const todayLocal = data?.nowLocal?.slice(0, 10)
  // after dark "no daylight left" says nothing — show tomorrow's window instead
  const late = data && !data.windows?.today
  const w = late ? data.windows?.tomorrow : data?.windows?.today
  const date = late ? addDays(todayLocal, 1) : todayLocal
  const stormUnknown = !!data?.notes?.includes('no_storm_data')

  return shell(
    <>
      <AppFlag value={appParam} />
      <LangPack lang={lang} />
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5">
          <ArrowLeft size={15} aria-hidden /> {t(lang, 'back')}
        </Link>
      </div>
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3 inline-flex items-center gap-3">
        <MountainSnow size={32} className="text-emerald-400 shrink-0" aria-hidden /> {t(lang, 'hikeTeaserTitle')}
      </h1>
      <p className="text-zinc-400 text-sm leading-relaxed mb-6">{t(lang, 'hikeTeaserSub')}</p>
      <StoreBadges lang={lang} />

      <section className="mt-8 space-y-3">
        <div className="text-emerald-400 text-xs tracking-widest">{peak.name} · {peak.elev} m</div>
        {data
          ? <Headline text={windowText(lang, w, { date, todayLocal, stormUnknown })} tone={windowTone(w, { stormUnknown })} />
          : <p className="text-sm text-zinc-500">{t(lang, 'hikeLiveNone')}</p>}
      </section>

      <section className="mt-8">
        <PeakDirectory peaks={TEASER_PEAKS} lang={lang} />
      </section>

      <div className="mt-8"><HikeNotes lang={lang} /></div>
      <Footer lang={lang} />
    </>,
  )
}
