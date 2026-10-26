'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { t } from '@/lib/i18n'
import { MAX_TEXT } from '@/lib/testers-signup'

// no text colour of its own: it inherits the theme's (like the other inputs), so light mode stays readable
const field = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400'
const button = 'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold bg-emerald-400 text-black hover:bg-emerald-300 disabled:opacity-60'

// The Android sign-up: the address of the Google account on the tester's
// phone (+ optional phone model and country) for the owner to put on the Play
// closed test's email list — no group to join. POST /api/testers/signup.
export default function TesterSignup({ lang }) {
  const id = useId()
  const [state, setState] = useState('idle') // idle | sending | done | error
  const [error, setError] = useState('')
  const [badEmail, setBadEmail] = useState(false)
  const done = useRef(null)
  // the form (and the focused button) is replaced: take focus along, so screen readers read the confirmation
  useEffect(() => { if (state === 'done') done.current?.focus() }, [state])

  async function submit(e) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const text = k => (f.get(k) ?? '').toString() || undefined
    setState('sending')
    try {
      const res = await fetch('/api/testers/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: text('email'), phone: text('phone'), country: text('country'), consent: f.get('consent') === 'on', lang, mb_hp: text('mb_hp') }),
      })
      if (res.ok) return setState('done')
      const body = await res.json().catch(() => ({}))
      setBadEmail(body.field === 'email')
      setError(t(lang, res.status === 429 ? 'testersSignupTooMany' : body.field === 'email' ? 'testersSignupInvalid' : 'testersSignupFailed'))
    } catch {
      setBadEmail(false)
      setError(t(lang, 'testersSignupFailed'))
    }
    setState('error')
  }

  if (state === 'done') {
    return (
      <div ref={done} tabIndex={-1} role="status" className="rounded-xl border p-4 space-y-1.5 text-sm outline-none" style={{ borderColor: 'var(--ok)' }}>
        <p className="font-semibold" style={{ color: 'var(--ok)' }}>{t(lang, 'testersSignupDone')}</p>
        <p className="text-zinc-300">{t(lang, 'testersSignupNext')}</p>
      </div>
    )
  }

  return (
    // method=post: a tap before the script has loaded must not put the address in the URL
    <form onSubmit={submit} method="post" className="space-y-3">
      <h3 className="font-semibold">{t(lang, 'testersSignupTitle')}</h3>
      <p className="text-sm text-zinc-400">{t(lang, 'testersSignupIntro')}</p>
      <div className="space-y-1.5">
        <label htmlFor={`${id}-email`} className="block text-sm text-zinc-200">{t(lang, 'testersEmailLabel')}</label>
        <input id={`${id}-email`} name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email"
          aria-invalid={badEmail || undefined} aria-describedby={badEmail ? `${id}-hint ${id}-error` : `${id}-hint`} className={field} />
        <p id={`${id}-hint`} className="text-xs text-zinc-500">{t(lang, 'testersEmailHint')}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor={`${id}-phone`} className="block text-sm text-zinc-200">{t(lang, 'testersPhoneLabel')}</label>
          <input id={`${id}-phone`} name="phone" maxLength={MAX_TEXT} autoComplete="off" className={field} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-country`} className="block text-sm text-zinc-200">{t(lang, 'testersCountryLabel')}</label>
          <input id={`${id}-country`} name="country" maxLength={MAX_TEXT} autoComplete="country-name" className={field} />
        </div>
      </div>
      {/* honeypot: off-screen, skipped by keyboard and screen readers — only bots fill it */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Leave this field empty <input name="mb_hp" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="flex items-start gap-2.5 text-xs text-zinc-400 leading-relaxed">
        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-400" />
        <span>{t(lang, 'testersConsent')}</span>
      </label>
      {state === 'error' && <p id={`${id}-error`} role="alert" className="text-sm" style={{ color: 'var(--bad)' }}>{error}</p>}
      <button type="submit" disabled={state === 'sending'} className={button}>
        {t(lang, state === 'sending' ? 'testersSignupSending' : 'testersSignupSend')}
      </button>
    </form>
  )
}
