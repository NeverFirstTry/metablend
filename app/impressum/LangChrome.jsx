'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { t } from '@/lib/i18n'
import { useLang } from '@/lib/useLang'
import Footer from '../components/Footer'

// The language-dependent parts around the Impressum (app/impressum/page.js).
// English in the server's HTML, the visitor's after hydration; LocaleReady hides
// the page until then, as on the other pages.
export function VisibleLang() {
  return <style>{`[data-legal]:not([lang=${useLang()}]){display:none}`}</style>
}

export function BackLink() {
  const lang = useLang()
  return (
    <Link href="/" className="app-only text-zinc-500 text-sm hover:text-emerald-400 transition-colors mb-6 inline-flex items-center gap-1.5">
      <ArrowLeft size={15} aria-hidden /> {t(lang, 'back')}
    </Link>
  )
}

export function LangFooter() {
  return <Footer lang={useLang()} />
}
