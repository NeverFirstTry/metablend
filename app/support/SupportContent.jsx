'use client'

import Link from 'next/link'
import { t } from '@/lib/i18n'
import { useLang } from '@/lib/useLang'
import Footer from '../components/Footer'

const EMAIL = 'info@metablend.app'
const heading = 'text-emerald-400 text-xs uppercase tracking-widest'
const link = 'text-emerald-400 hover:underline'
// a place in the app, named with the app's own labels so the two never drift apart; the arrow stays
// on the line of the label before it
const inApp = (lang, ...keys) => keys.map(k => t(lang, k)).join(' › ')
// the answers that point on to a page
const MORE = { 4: ['/privacy', 'footerPrivacy'], 5: ['/terms#disclaimer', 'legalDisclaimerLink'] }
const LEGAL = [['/privacy', 'footerPrivacy'], ['/terms', 'footerTerms'], ['/impressum', 'footerImpressum']]

// The support page the App Store listing links to: how to reach us, five common questions, the legal pages.
export function SupportBody({ lang }) {
  return (
    <main className="max-w-2xl mx-auto w-full px-4 py-8 sm:py-12 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t(lang, 'footerSupport')}</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">{t(lang, 'supportIntro')}</p>
      </div>

      <section className="space-y-2">
        <h2 className={heading}>{t(lang, 'footerContact')}</h2>
        <p className="text-lg"><a href={`mailto:${EMAIL}`} className={link}>{EMAIL}</a></p>
        <p className="text-sm text-zinc-300 leading-relaxed">{t(lang, 'supportApp').replace('{path}', inApp(lang, 'more', 'feedbackSend'))}</p>
      </section>

      <section className="space-y-4">
        <h2 className={heading}>{t(lang, 'supportFaq')}</h2>
        {[1, 2, 3, 4, 5].map(n => (
          <div key={n} className="space-y-1 text-sm leading-relaxed">
            <h3 className="font-semibold">{t(lang, `supportQ${n}`)}</h3>
            <p className="text-zinc-300">
              {t(lang, `supportA${n}`).replace('{path}', inApp(lang, 'more', 'notifTitle'))}
              {MORE[n] && <> <Link href={MORE[n][0]} className={link}>{t(lang, MORE[n][1])}</Link></>}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className={heading}>{t(lang, 'supportLegal')}</h2>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {LEGAL.map(([href, key]) => <li key={href}><Link href={href} className={link}>{t(lang, key)}</Link></li>)}
        </ul>
      </section>

      <Footer lang={lang} />
    </main>
  )
}

export default function SupportContent() {
  return <SupportBody lang={useLang()} />
}
