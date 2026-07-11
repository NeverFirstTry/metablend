import Link from 'next/link'
import Footer from '../components/Footer'
import IcaoSearch from './search'
import { AIRPORT_COUNT } from '@/lib/aviation'

export const metadata = {
  title: 'Aviation Weather — METAR, TAF, Crosswind & Density Altitude',
  description:
    'Decoded METAR and TAF, flight rules, runway crosswind components and density ' +
    'altitude for 12,000+ ICAO airports. Free, no key, no account.',
  alternates: { canonical: '/aviation' },
}

const FEATURED = [
  'LOWW', 'LOWI', 'LOWS', 'EDDM', 'EDDF', 'EGLL',
  'LFPG', 'EHAM', 'LIRF', 'LSZH', 'KJFK', 'KLAX',
  'KORD', 'RJTT', 'YSSY', 'OMDB',
]

export default function AviationHub() {
  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <nav className="text-zinc-500 text-xs mb-6">
          <Link href="/" className="hover:text-emerald-400">MetaBlend</Link>
          <span className="mx-2">/</span>
          <span className="text-zinc-400">Aviation</span>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-1">
          MetaBlend <span className="text-emerald-400">Aviation</span>
        </h1>
        <p className="text-zinc-500 text-sm mb-6 tracking-widest uppercase">
          METAR · TAF · crosswind · density altitude — {AIRPORT_COUNT.toLocaleString('en')} airports
        </p>

        <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3 text-red-200 text-xs mb-8 leading-relaxed">
          <strong>Not for flight planning.</strong> This is supplementary situational awareness built on
          public NOAA data. Always obtain an official preflight briefing from your national aviation
          weather provider before any flight.
        </div>

        <div className="mb-10">
          <IcaoSearch />
        </div>

        <h2 className="text-zinc-500 text-xs tracking-widest uppercase mb-3">Popular airports</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-10">
          {FEATURED.map(icao => (
            <Link
              key={icao}
              href={`/aviation/${icao.toLowerCase()}`}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-300 hover:border-emerald-400 hover:text-emerald-400 text-center tracking-widest"
            >
              {icao}
            </Link>
          ))}
        </div>

        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8">
          <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">What you get per airport</h2>
          <ul className="text-sm text-zinc-300 space-y-2 leading-relaxed">
            <li>· Current METAR, decoded and raw, with VFR / MVFR / IFR / LIFR flight rules</li>
            <li>· TAF with forecast periods</li>
            <li>· Head- and crosswind components for every runway, from live wind</li>
            <li>· Pressure and density altitude from the current altimeter setting</li>
          </ul>
        </section>

        <Footer />
      </div>
    </main>
  )
}
