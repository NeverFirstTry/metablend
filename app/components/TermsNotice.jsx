'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { t } from '@/lib/i18n'
import { setCookie } from '@/lib/prefs'
import { TERMS_VERSION, termsDue, termsChanged, passedVersion, keepPassed, linkedParts } from '@/lib/terms'

// Passed on this start although the phone could not keep it (storage off or full).
let passedThisStart = false

// The app's first start, and once more whenever the terms change: "By using MetaBlend you accept the
// Terms of Use", the privacy notice as information, and one button. App only (AppChrome renders it).
// Until it is passed the rest of the app is out of sight and out of reach (globals.css,
// html[data-terms-due]); the terms, the privacy notice and the imprint stay readable, since the notice
// links to them. What the phone keeps is the version of the terms, in its own storage (lib/terms.js).
export default function TermsNotice({ lang, path }) {
  const [notice, setNotice] = useState(null) // null: nothing to show | { changed }
  const box = useRef(null)

  useEffect(() => {
    const html = document.documentElement
    const stored = passedThisStart ? TERMS_VERSION : passedVersion(window.localStorage)
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
    if (!keepPassed(window.localStorage)) passedThisStart = true
    setCookie('metablend_consent', '1') // the notice stands in for the cookie line of the home page
    delete document.documentElement.dataset.termsDue
    setNotice(null)
  }
  const sentence = (key, href) => {
    const [before, label, after] = linkedParts(t(lang, key))
    return <>{before}{label && <Link href={href} className="text-emerald-400 underline underline-offset-4">{label}</Link>}{after}</>
  }
  return (
    <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t(lang, 'footerTerms')}
      className="terms-notice fixed inset-0 z-[60] overflow-y-auto outline-none" style={{ background: 'var(--background)' }}>
      <div className="min-h-full max-w-md mx-auto px-6 flex flex-col justify-center gap-5"
        style={{ paddingTop: 'calc(2rem + var(--sa-top))', paddingBottom: 'calc(2rem + var(--sa-bottom))' }}>
        <p className="text-2xl font-bold tracking-tight">Meta<span className="text-emerald-400">Blend</span></p>
        {notice.changed && <p className="font-semibold">{t(lang, 'termsNoticeChanged')}</p>}
        <p>{sentence('termsNoticeAccept', '/terms')}</p>
        <p className="text-zinc-400">{sentence('termsNoticePrivacy', '/privacy')}</p>
        <button onClick={go} className="press mt-3 w-full bg-emerald-400 text-black font-semibold rounded-full px-6 py-3 hover:bg-emerald-300">
          {t(lang, 'termsNoticeContinue')}
        </button>
      </div>
    </div>
  )
}
