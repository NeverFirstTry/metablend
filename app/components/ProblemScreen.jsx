'use client'

import Link from 'next/link'
import { RotateCw, Search } from 'lucide-react'
import { t } from '@/lib/i18n'
import { useLang } from '@/lib/useLang'

// What a visitor sees when a page is missing or breaks: what happened, and the
// way on. The search is a plain form, so it works even if the page's script didn't load.
export default function ProblemScreen({ titleKey, textKey, onRetry = null }) {
  const lang = useLang()
  return (
    <main className="site-col px-4 pt-16 pb-24">
      <Link href="/" className="text-2xl font-bold tracking-tight">Meta<span className="text-emerald-400">Blend</span></Link>
      <h1 className="text-2xl font-semibold tracking-tight mt-12 mb-3">{t(lang, titleKey)}</h1>
      <p className="text-zinc-400 max-w-prose mb-8">{t(lang, textKey)}</p>
      <form action="/" method="get" role="search" className="flex gap-2 max-w-xl">
        <input
          name="city"
          required
          aria-label={t(lang, 'placeholder')}
          placeholder={t(lang, 'placeholder')}
          className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-base focus:outline-none focus:border-emerald-400"
        />
        <button type="submit" aria-label={t(lang, 'a11ySearch')} className="press bg-emerald-400 text-black rounded-lg px-5 flex items-center justify-center hover:bg-emerald-300">
          <Search size={18} aria-hidden />
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-8 text-sm">
        {onRetry && (
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 text-emerald-400 hover:underline">
            <RotateCw size={14} aria-hidden /> {t(lang, 'retry')}
          </button>
        )}
        <Link href="/" className="text-emerald-400 hover:underline">{t(lang, 'backToForecast')}</Link>
      </div>
    </main>
  )
}
