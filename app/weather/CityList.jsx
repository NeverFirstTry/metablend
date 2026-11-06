'use client'

import Link from 'next/link'
import { t } from '@/lib/i18n'
import { useLang } from '@/lib/useLang'
import { cityName } from '@/lib/city-names'
import Footer from '../components/Footer'

// The city list in the visitor's language; English in the server's HTML, one URL for all.
export default function CityList({ cities }) {
  const lang = useLang()
  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <nav className="text-zinc-500 text-xs mb-6">
          <Link href="/" className="hover:text-emerald-400">MetaBlend</Link>
          <span className="mx-2">/</span>
          <span className="text-zinc-400">{t(lang, 'footerCities')}</span>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-1">{t(lang, 'cityIndexTitle')}</h1>
        <p className="text-zinc-500 text-sm mb-8 tracking-widest uppercase">{t(lang, 'cityIndexSub')}</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-10">
          {cities.map(c => (
            <Link
              key={c.slug}
              href={`/weather/${c.slug}`}
              className="press-soft bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-300 hover:border-emerald-400 hover:text-emerald-400"
            >
              {cityName(c.slug, lang, c.name)}
            </Link>
          ))}
        </div>

        <p className="text-zinc-500 text-sm">
          {t(lang, 'cityMissing')}{' '}
          <Link href="/" className="text-emerald-400 hover:underline">{t(lang, 'citySearchIt')}</Link>
        </p>

        <Footer lang={lang} />
      </div>
    </main>
  )
}
