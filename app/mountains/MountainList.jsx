'use client'

import Link from 'next/link'
import { t } from '@/lib/i18n'
import { fill } from '@/lib/outlook/text'
import { useLang } from '@/lib/useLang'
import Footer from '../components/Footer'

// The summit list in the visitor's language. The server renders it in English for
// search engines; the URL stays the same in every language.
export default function MountainList({ groups, total }) {
  const lang = useLang()
  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <nav className="text-zinc-500 text-xs mb-6 flex gap-2">
          <Link href="/" className="hover:text-emerald-400">MetaBlend</Link>
          <span>/</span>
          <span className="text-zinc-400">{t(lang, 'footerMountains')}</span>
        </nav>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-1">{t(lang, 'hikeTitle')}</h1>
        <p className="text-zinc-500 text-sm mb-8 tracking-widest uppercase">{fill(t(lang, 'hikeWebForecasts'), { n: total })}</p>
        {groups.map(g => (
          <section key={g.region} className="mb-8">
            <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-3">{t(lang, `region_${g.region}`)}</h2>
            <ul className="flex flex-wrap gap-2 text-sm">
              {g.peaks.map(p => (
                <li key={p.id}><Link href={`/mountains/${p.id}`} className="press inline-block rounded-lg border border-zinc-800 px-3 py-1.5 hover:border-emerald-400">{p.name} <span className="text-zinc-500">{p.elev} m</span></Link></li>
              ))}
            </ul>
          </section>
        ))}
        <Footer lang={lang} />
      </div>
    </main>
  )
}
