import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Footer from '../components/Footer'
import IcaoSearch from './search'
import { AIRPORT_COUNT, RULES_COLOR, flightRules, parseVisibility } from '@/lib/aviation'
import { skyInfo } from '@/lib/metar'

export const revalidate = 600

export const metadata = {
  title: 'Aviation Weather — METAR, TAF, Crosswind & Density Altitude',
  description:
    'Decoded METAR and TAF, flight rules, runway crosswind components and density ' +
    'altitude for 12,000+ ICAO airports. Free, no key, no account.',
  alternates: { canonical: '/aviation' },
}

// The live category board: like the flight-category maps in every FBO, but as
// linkable chips. Grouped geographically; roughly the fields pilots actually
// look up plus the local Austrian ones.
const BOARD = [
  ['Europe', ['LOWW', 'LOWI', 'LOWS', 'EDDM', 'EDDF', 'EGLL', 'LFPG', 'EHAM', 'LIRF', 'LSZH', 'LEMD', 'LIMC']],
  ['Americas', ['KJFK', 'KLAX', 'KORD', 'KMIA', 'KSFO', 'KATL', 'KDEN', 'CYYZ', 'SBGR', 'MMMX']],
  ['Asia-Pacific & Middle East', ['RJTT', 'VHHH', 'WSSS', 'ZBAA', 'VIDP', 'OMDB', 'YSSY', 'NZAA']],
]

// One batch call for the whole board. Same category gate as the airport
// pages: unreported visibility or cloud heights yield no category, not VFR.
async function fetchCategories(ids) {
  try {
    const res = await fetch(
      `https://aviationweather.gov/api/data/metar?ids=${ids.join(',')}&format=json`,
      { headers: { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' }, next: { revalidate: 600 } },
    )
    if (!res.ok) return {}
    const arr = await res.json()
    const out = {}
    for (const m of Array.isArray(arr) ? arr : []) {
      const vis = parseVisibility(m.visib)
      const sky = skyInfo(m.clouds)
      out[m.icaoId] = vis != null && sky.known && !sky.unknownBase ? flightRules(vis, sky.ceilingFt) : null
    }
    return out
  } catch {
    return {}
  }
}

export default async function AviationHub() {
  const cats = await fetchCategories(BOARD.flatMap(([, ids]) => ids))

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5">
            <ArrowLeft size={15} aria-hidden /> Back
          </Link>
          <nav className="text-zinc-500 text-xs">
            <Link href="/" className="hover:text-emerald-400">MetaBlend</Link>
            <span className="mx-2">/</span>
            <span className="text-zinc-400">Aviation</span>
          </nav>
        </div>

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

        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-zinc-500 text-xs tracking-widest uppercase">Flight categories now</h2>
          <span className="text-zinc-600 text-[10px] tracking-wider">live METAR · refreshes ~10 min</span>
        </div>
        {BOARD.map(([region, ids]) => (
          <div key={region} className="mb-5">
            <h3 className="text-zinc-600 text-[10px] tracking-widest uppercase mb-2">{region}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ids.map(icao => {
                const cat = cats[icao] ?? null
                return (
                  <Link
                    key={icao}
                    href={`/aviation/${icao.toLowerCase()}`}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 flex items-center justify-between text-sm hover:border-emerald-400 transition-colors"
                  >
                    <span className="tracking-widest text-zinc-200">{icao}</span>
                    {cat ? (
                      <span className="text-[10px] font-bold tracking-wider" style={{ color: RULES_COLOR[cat] }}>● {cat}</span>
                    ) : (
                      <span className="text-[10px] text-zinc-600 tracking-wider">–</span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
        <p className="text-zinc-600 text-[10px] mb-10">
          VFR <span style={{ color: RULES_COLOR.VFR }}>●</span> · MVFR <span style={{ color: RULES_COLOR.MVFR }}>●</span> ·
          IFR <span style={{ color: RULES_COLOR.IFR }}>●</span> · LIFR <span style={{ color: RULES_COLOR.LIFR }}>●</span> ·
          – means the METAR didn’t report enough to classify
        </p>

        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8">
          <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">What you get per airport</h2>
          <ul className="text-sm text-zinc-300 space-y-2 leading-relaxed">
            <li>· Current METAR, decoded and raw, with VFR / MVFR / IFR / LIFR flight rules</li>
            <li>· TAF with forecast periods and live TAF-vs-METAR divergence</li>
            <li>· Head- and crosswind components for every runway, from live wind</li>
            <li>· Pressure and density altitude from the current altimeter setting</li>
          </ul>
        </section>

        <Footer />
      </div>
    </main>
  )
}
