'use client'

import WayBack from '../components/BackLink'
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
    <WayBack href="/more" className="app-only mb-6">{t(lang, 'more')}</WayBack>
  )
}

export function LangFooter() {
  return <Footer lang={useLang()} />
}
