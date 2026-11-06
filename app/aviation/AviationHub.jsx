'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fill } from '@/lib/outlook/text'
import { RULES_COLOR } from '@/lib/metar'
import { useLang } from '@/lib/useLang'
import Footer from '../components/Footer'
import IcaoSearch from './search'

// The aviation start page in the visitor's language; English in the server's HTML, one
// URL for all. METAR, TAF and the flight categories stay as the international codes they are.
export default function AviationHub({ board, cats, airports }) {
  const lang = useLang()
  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="app-only text-zinc-500 text-sm hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5">
            <ArrowLeft size={15} aria-hidden /> {t(lang, 'back')}
          </Link>
          <nav className="text-zinc-500 text-xs">
            <Link href="/" className="hover:text-emerald-400">MetaBlend</Link>
            <span className="mx-2">/</span>
            <span className="text-zinc-400">{t(lang, 'aviation')}</span>
          </nav>
        </div>

        <h1 className="mb-rise text-3xl sm:text-4xl font-semibold tracking-tight mb-1">MetaBlend {t(lang, 'aviation')}</h1>
        <p className="text-zinc-500 text-sm mb-6 tracking-widest uppercase">{fill(t(lang, 'avSub'), { n: airports.toLocaleString(lang) })}</p>

        <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3 text-red-200 text-xs mb-8 leading-relaxed">
          <strong>{t(lang, 'avNotFor')}</strong> {t(lang, 'avNotForHub')} <Link href="/terms#disclaimer" className="underline">{t(lang, 'legalDisclaimerLink')}</Link>
        </div>

        <div className="mb-10">
          <IcaoSearch lang={lang} />
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-x-4 mb-3">
          <h2 className="text-zinc-500 text-xs tracking-widest uppercase">{t(lang, 'avCategories')}</h2>
          <span className="text-zinc-600 text-[0.625rem] tracking-wider">{t(lang, 'avLive')}</span>
        </div>
        {board.map(([region, ids]) => (
          <div key={region} className="mb-5">
            <h3 className="text-zinc-600 text-[0.625rem] tracking-widest uppercase mb-2">{t(lang, region)}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ids.map(icao => {
                const cat = cats[icao] ?? null
                return (
                  <Link
                    key={icao}
                    href={`/aviation/${icao.toLowerCase()}`}
                    className="press-soft bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 flex items-center justify-between text-sm hover:border-emerald-400 transition-colors"
                  >
                    <span className="tracking-widest text-zinc-200">{icao}</span>
                    {cat ? (
                      <span className="text-[0.625rem] font-bold tracking-wider" style={{ color: RULES_COLOR[cat] }}>● {cat}</span>
                    ) : (
                      <span className="text-[0.625rem] text-zinc-600 tracking-wider">–</span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
        <p className="text-zinc-600 text-[0.625rem] mb-10">
          VFR <span style={{ color: RULES_COLOR.VFR }}>●</span> · MVFR <span style={{ color: RULES_COLOR.MVFR }}>●</span> ·
          IFR <span style={{ color: RULES_COLOR.IFR }}>●</span> · LIFR <span style={{ color: RULES_COLOR.LIFR }}>●</span> · {t(lang, 'avLegendNone')}
        </p>

        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8">
          <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">{t(lang, 'avWhatTitle')}</h2>
          <ul className="text-sm text-zinc-300 space-y-2 leading-relaxed">
            {['avWhat1', 'avWhat2', 'avWhat3', 'avWhat4'].map(k => <li key={k}>· {t(lang, k)}</li>)}
          </ul>
        </section>

        <Footer lang={lang} />
      </div>
    </main>
  )
}
