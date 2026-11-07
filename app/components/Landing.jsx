import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Search, Navigation, Loader2 } from 'lucide-react'
import { t, translateCondition } from '@/lib/i18n'
import { STORES } from '@/lib/hike/stores'
import { spreadSentence, agreeColor } from '@/lib/spread'
import { fill, tempFormatter } from '@/lib/outlook/text'
import StoreBadges from './hike/StoreBadges'
import SourceDots from './SourceDots'

// What a first-time visitor sees on the website instead of somebody else's forecast.
// The search state and its handlers belong to the page, so a search swaps to the
// forecast without a reload. The form also works before the page's script has loaded.
export default function Landing({ lang, unit, example, peaks, city, onCity, onBlur, onSearch, onLocate, locating, suggestions }) {
  const field = useRef(null)
  // Ready to type on a desktop. On a phone the keyboard would cover the page.
  useEffect(() => {
    if (!field.current?.offsetParent || !window.matchMedia('(min-width: 40rem) and (hover: hover)').matches) return
    const focus = () => field.current?.focus({ preventScroll: true })
    // a hidden field can't take focus: for other languages, wait until LocaleReady shows the page
    const html = document.documentElement
    if (!html.dataset.localizing) return focus()
    const shown = new MutationObserver(() => { if (!html.dataset.localizing) { shown.disconnect(); focus() } })
    shown.observe(html, { attributes: true, attributeFilter: ['data-localizing'] })
    return () => shown.disconnect()
  }, [])
  const fmt = tempFormatter(unit)
  return (
    <div className="landing-view web-only mt-8 sm:mt-14">
      <form action="/" role="search" className="relative flex gap-2 items-stretch" onSubmit={e => { e.preventDefault(); onSearch() }}>
        <input
          ref={field}
          name="city"
          autoComplete="off"
          enterKeyHint="search"
          aria-label={t(lang, 'landingPlaceholder')}
          placeholder={t(lang, 'landingPlaceholder')}
          value={city}
          onChange={e => onCity(e.target.value)}
          onBlur={onBlur}
          className="landing-field flex-1 min-w-0 bg-zinc-900 border border-zinc-700 rounded-xl px-5 outline-none focus:border-emerald-400 transition-colors"
        />
        <button type="submit" aria-label={t(lang, 'a11ySearch')} className="press shrink-0 bg-emerald-400 text-black rounded-xl px-6 sm:px-9 flex items-center justify-center hover:bg-emerald-300">
          <Search size={24} aria-hidden />
        </button>
        {suggestions}
      </form>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 mt-3">
        <button type="button" onClick={onLocate} disabled={locating} className="press inline-flex items-center gap-2 min-h-11 text-emerald-400 font-medium disabled:opacity-60">
          {locating ? <Loader2 size={16} className="animate-spin-slow" aria-hidden /> : <Navigation size={16} aria-hidden />} {t(lang, 'a11yLocate')}
        </button>
        <span className="text-sm text-zinc-400">{t(lang, 'landingFree')}</span>
      </div>

      <h2 className="landing-statement font-semibold tracking-tight mt-10 max-w-3xl">{t(lang, 'homeLead')} {t(lang, 'landingSecond')}</h2>

      <div className="mt-14 grid gap-10 sm:grid-cols-2 sm:gap-16 items-start">
        {example && (
          <section>
            <h2 className="font-semibold tracking-tight mb-3">{t(lang, 'landingExample')}</h2>
            {/* small on purpose, the place above it: nobody should read this as their own weather */}
            <div className="flex items-start gap-4">
              <span className="landing-temp font-light tabular-nums shrink-0">{fmt(example.temp)}</span>
              <span className="min-w-0 text-sm block">
                <span className="block">
                  {example.condition && <>{translateCondition(lang, example.condition)} · </>}
                  <span style={{ color: agreeColor(example.agree) }}>{example.agree}% {t(lang, 'agreeShort')}</span>
                </span>
                <span className="block text-zinc-400 mt-1">{spreadSentence(lang, example.sources, fmt, example.agree)}</span>
              </span>
            </div>
            <div className="mt-4">
              <SourceDots sources={example.sources} consensusC={example.temp} unit={unit} title={t(lang, 'spreadTitle')} hint={t(lang, 'spreadHint')} />
            </div>
          </section>
        )}
        <section>
          <h2 className="font-semibold tracking-tight mb-3">{t(lang, 'hikeTitle')}</h2>
          <p className="text-sm text-zinc-400 mb-3">{fill(t(lang, 'hikeTeaserSub'), { n: peaks })}</p>
          <Link href="/mountains" className="text-emerald-400 text-sm hover:underline">{t(lang, 'landingAllSummits')}</Link>
        </section>
      </div>

      <section className="mt-14">
        <h2 className="font-semibold tracking-tight mb-4">{t(lang, 'homeHowTitle')}</h2>
        <ol className="grid gap-6 sm:grid-cols-3 sm:gap-10">
          {['landingStep1', 'landingStep2', 'landingStep3'].map((key, i) => (
            <li key={key} className="flex gap-3 text-sm text-zinc-400">
              <span className="font-semibold tabular-nums text-emerald-400" aria-hidden>{i + 1}</span>
              <span className="min-w-0">{t(lang, key)}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* waits for both store links (lib/hike/stores.js) */}
      {STORES.ios && STORES.android && (
        <section className="mt-14 flex flex-wrap items-center gap-8">
          {/* eslint-disable-next-line @next/next/no-img-element -- small, and only shown once the apps are out */}
          <img src="/app-preview.png" alt="" width={180} height={320} loading="lazy" className="rounded-2xl" />
          <StoreBadges lang={lang} />
        </section>
      )}

      <p className="mt-14 text-sm text-zinc-400">{t(lang, 'landingPersonal')}</p>
    </div>
  )
}
