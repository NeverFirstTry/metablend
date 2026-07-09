import Link from 'next/link'
import { CITIES } from '@/lib/cities'
import Footer from '../components/Footer'

// Crawlable hub for the per-city pages. Any city works at /weather/<slug>;
// this lists the curated set that the sitemap advertises.
export const metadata = {
  title: 'City Weather — Consensus Forecasts for 50+ Cities',
  description:
    'Consensus forecasts for 54 cities worldwide, blended from 16 weather sources: ' +
    'current conditions, rain probability and 7-day outlook.',
  alternates: { canonical: '/weather' },
}

export default function CityIndex() {
  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <nav className="text-zinc-500 text-xs mb-6">
          <Link href="/" className="hover:text-emerald-400">MetaBlend</Link>
          <span className="mx-2">/</span>
          <span className="text-zinc-400">Cities</span>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-1">
          City <span className="text-emerald-400">Weather</span>
        </h1>
        <p className="text-zinc-500 text-sm mb-8 tracking-widest uppercase">
          One consensus forecast per city, from 16 sources
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-10">
          {CITIES.map(c => (
            <Link
              key={c.slug}
              href={`/weather/${c.slug}`}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-300 hover:border-emerald-400 hover:text-emerald-400"
            >
              {c.name}
            </Link>
          ))}
        </div>

        <p className="text-zinc-500 text-sm">
          Missing your city? Search it in the{' '}
          <Link href="/" className="text-emerald-400 hover:underline">live app</Link> — every city
          in the world works there, and the forecast learns from every search.
        </p>

        <Footer />
      </div>
    </main>
  )
}
