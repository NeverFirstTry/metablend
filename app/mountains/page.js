import Link from 'next/link'
import featured from '@/lib/hike/featured.json'
import { byRegion } from '@/lib/hike/featured-list'
import { t } from '@/lib/i18n'
import Footer from '../components/Footer'

// Crawlable hub for the summit weather pages: every featured peak by region.
export const metadata = {
  title: 'Mountain Weather — Summit Forecasts for 200 Peaks',
  description:
    'Summit weather for 200 mountains worldwide: the safe summit window, wind up top, freezing level ' +
    'and thunderstorm risk for 7 days, blended from up to 9 weather models.',
  alternates: { canonical: '/mountains' },
}

export default function MountainIndex() {
  const groups = byRegion(featured.filter(p => p.kind !== 'hut'))
  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <nav className="text-zinc-500 text-xs mb-6 flex gap-2">
          <Link href="/" className="hover:text-emerald-400">MetaBlend</Link>
          <span>/</span>
          <span className="text-zinc-400">Mountains</span>
        </nav>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-1">Mountain <span className="text-emerald-400">Weather</span></h1>
        <p className="text-zinc-500 text-sm mb-8 tracking-widest uppercase">Summit forecasts for {groups.reduce((n, g) => n + g.peaks.length, 0)} peaks</p>
        {groups.map(g => (
          <section key={g.region} className="mb-8">
            <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-3">{t('en', `region_${g.region}`)}</h2>
            <ul className="flex flex-wrap gap-2 text-sm">
              {g.peaks.map(p => (
                <li key={p.id}><Link href={`/mountains/${p.id}`} className="inline-block rounded-lg border border-zinc-800 px-3 py-1.5 hover:border-emerald-400">{p.name} <span className="text-zinc-500">{p.elev} m</span></Link></li>
              ))}
            </ul>
          </section>
        ))}
        <Footer />
      </div>
    </main>
  )
}
