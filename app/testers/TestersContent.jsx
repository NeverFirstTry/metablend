'use client'

import Link from 'next/link'
import { ArrowLeft, Play, Apple, ExternalLink } from 'lucide-react'
import { t } from '@/lib/i18n'
import { useLang } from '@/lib/useLang'
import { TESTERS, channelOpen } from '@/lib/testers'
import Footer from '../components/Footer'

const button = 'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold bg-emerald-400 text-black hover:bg-emerald-300'

function Channel({ icon: Icon, title, open, lang, children }) {
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
      <h2 className="text-lg font-semibold inline-flex items-center gap-2"><Icon size={18} className="text-emerald-400" aria-hidden /> {title}</h2>
      {open ? children : <p className="text-sm text-zinc-500">{t(lang, 'testersSoon')}</p>}
    </section>
  )
}

const Out = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={button}>{children} <ExternalLink size={14} aria-hidden /></a>
)

// Become a tester: how to join the Play closed test (Google Group + opt-in
// link) and TestFlight, what to try, and the 14 days Google asks for.
export default function TestersContent() {
  const lang = useLang()
  return (
    <main className="max-w-2xl mx-auto w-full px-4 py-8 sm:py-12 space-y-6">
      <Link href="/" className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5">
        <ArrowLeft size={15} aria-hidden /> {t(lang, 'back')}
      </Link>
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t(lang, 'testersTitle')}</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">{t(lang, 'testersIntro')}</p>
      </div>

      <Channel icon={Play} title={t(lang, 'testersAndroid')} open={channelOpen(TESTERS, 'android')} lang={lang}>
        <ol className="list-decimal pl-5 space-y-3 text-sm text-zinc-300">
          <li className="space-y-2"><p>{t(lang, 'testersAndroidStep1')}</p><Out href={TESTERS.androidGroup}>{t(lang, 'testersJoinGroup')}</Out></li>
          <li className="space-y-2"><p>{t(lang, 'testersAndroidStep2')}</p><Out href={TESTERS.androidOptIn}>{t(lang, 'testersOptIn')}</Out></li>
          <li>{t(lang, 'testersAndroidStep3')}</li>
        </ol>
      </Channel>

      <Channel icon={Apple} title={t(lang, 'testersIphone')} open={channelOpen(TESTERS, 'ios')} lang={lang}>
        <p className="text-sm text-zinc-300">{t(lang, 'testersIphoneStep')}</p>
        <Out href={TESTERS.testflight}>{t(lang, 'testersOpenTestflight')}</Out>
      </Channel>

      <p className="text-sm text-zinc-300 leading-relaxed">{t(lang, 'testersStay')}</p>

      <section className="space-y-2">
        <h2 className="text-emerald-400 text-xs uppercase tracking-widest">{t(lang, 'testersTryTitle')}</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-zinc-300">
          {[1, 2, 3, 4, 5].map(n => <li key={n}>{t(lang, `testersTry${n}`)}</li>)}
        </ul>
      </section>

      <p className="text-sm text-zinc-500">{t(lang, 'testersFeedback')}</p>
      <Footer lang={lang} />
    </main>
  )
}
