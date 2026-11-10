'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { t } from '@/lib/i18n'
import { getCookie, clearCookie } from '@/lib/prefs'
import { isAppView } from '@/lib/app-client'
import { TERMS_VERSION, termsDue, termsChanged, passedVersion, keepPassed, linkedParts } from '@/lib/terms'

// Passed on this start although the device could not keep it (storage off or full).
let passedThisStart = false
const kept = () => (passedThisStart ? TERMS_VERSION : passedVersion(window.localStorage))
// "Continue": the device keeps the version of the terms. The cookie of the old cookie line
// (metablend_consent, until 2026-11-10) has no reader any more and goes with it.
function pass() {
  if (!keepPassed(window.localStorage)) passedThisStart = true
  if (getCookie('metablend_consent')) clearCookie('metablend_consent')
}

// The notice's words, shared by the app's screen and the website's bar: the terms are accepted, the
// privacy notice is pointed to (nobody agrees to it: its basis is legitimate interest); after a change
// of the terms a line says so first. In the app the terms are accepted with "Continue"; the website
// works without a click, so its bar says "by using MetaBlend" (acceptKey) and the terms page says the
// same. The link is the bracketed part of each sentence.
function TermsText({ lang, changed, lineClass = '', acceptKey = 'termsNoticeAccept' }) {
  const sentence = (key, href) => {
    const [before, label, after] = linkedParts(t(lang, key))
    return <>{before}{label && <Link href={href} className="text-emerald-400 underline underline-offset-4">{label}</Link>}{after}</>
  }
  return (
    <>
      {changed && <p className={`font-semibold ${lineClass}`}>{t(lang, 'termsNoticeChanged')}</p>}
      <p className={lineClass}>{sentence(acceptKey, '/terms')}</p>
      <p className={`text-zinc-400 ${lineClass}`}>{sentence('termsNoticePrivacy', '/privacy')}</p>
    </>
  )
}

// The app's first start, and once more whenever the terms change: the notice alone on the screen.
// App only (AppChrome renders it). Until it is passed the rest of the app is out of sight and out of
// reach (globals.css, html[data-terms-due]); the terms, the privacy notice and the imprint stay
// readable, since the notice links to them. What the phone keeps is the version of the terms, in its
// own storage (lib/terms.js).
export default function TermsNotice({ lang, path }) {
  const [notice, setNotice] = useState(null) // null: nothing to show | { changed }
  const box = useRef(null)

  useEffect(() => {
    const html = document.documentElement
    const stored = kept()
    const due = termsDue(stored, path)
    // the boot script set the mark before first paint; here it follows the page that is open
    if (due) { html.dataset.termsDue = '1'; html.dataset.termsShown = '1' } else delete html.dataset.termsDue
    // eslint-disable-next-line react-hooks/set-state-in-effect -- what the phone kept is only known after mount
    setNotice(due ? { changed: termsChanged(stored) } : null)
  }, [path])
  // a screen reader starts at the notice, not somewhere in the page behind it
  useEffect(() => { if (notice) box.current?.focus() }, [notice])

  if (!notice) return null
  const go = () => {
    pass()
    delete document.documentElement.dataset.termsDue
    setNotice(null)
  }
  return (
    <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t(lang, 'footerTerms')}
      className="terms-notice fixed inset-0 z-[60] overflow-y-auto outline-none" style={{ background: 'var(--background)' }}>
      <div className="min-h-full max-w-md mx-auto px-6 flex flex-col justify-center gap-5"
        style={{ paddingTop: 'calc(2rem + var(--sa-top))', paddingBottom: 'calc(2rem + var(--sa-bottom))' }}>
        <p className="text-2xl font-bold tracking-tight">Meta<span className="text-emerald-400">Blend</span></p>
        <TermsText lang={lang} changed={notice.changed} />
        {/* the imprint has to be reachable at all times (Austria), so also from here, before the More tab is */}
        <p className="text-sm"><Link href="/impressum" className="text-emerald-400 underline underline-offset-4">{t(lang, 'footerImpressum')}</Link></p>
        <button onClick={go} className="press mt-3 w-full bg-emerald-400 text-black font-semibold rounded-full px-6 py-3 hover:bg-emerald-300">
          {t(lang, 'termsNoticeContinue')}
        </button>
      </div>
    </div>
  )
}

// The website's one-time bar at the bottom of the forecast page (it was the cookie line until
// 2026-11-10): its own first sentence (use is acceptance, the button only puts the bar away), the
// same privacy sentence and button, and it blocks nothing, so a first visitor and a search engine see
// the page at once. Never in the app, which has the notice above.
export function TermsBar({ lang }) {
  const [bar, setBar] = useState(null) // null: nothing to show | { changed }
  useEffect(() => {
    const stored = kept()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- what the browser kept is only known after mount
    setBar(!isAppView() && termsDue(stored, '/') ? { changed: termsChanged(stored) } : null)
  }, [])
  if (!bar) return null
  return (
    <div role="region" aria-label={t(lang, 'footerTerms')}
      className="terms-bar app-lift mb-edge animate-fade-in-up fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 px-4 py-3 flex items-center justify-between gap-4 z-50">
      <div className="min-w-0 space-y-1"><TermsText lang={lang} changed={bar.changed} lineClass="text-[0.8125rem]" acceptKey="termsBarAccept" /></div>
      <button onClick={() => { pass(); setBar(null) }} className="press bg-emerald-400 text-black text-[0.8125rem] font-bold px-4 py-2 rounded-lg hover:bg-emerald-300 shrink-0">
        {t(lang, 'termsNoticeContinue')}
      </button>
    </div>
  )
}
