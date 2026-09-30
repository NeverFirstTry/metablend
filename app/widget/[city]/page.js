'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { t, translateCondition } from '@/lib/i18n'
import { fill, tempFormatter } from '@/lib/outlook/text'
import { skyFor, isDark, nightIcon } from '@/lib/sky'
import { useSky } from '@/lib/useSky'
import { applyTheme } from '@/lib/theme'
import { SITE, pickLang, pickUnit, pickTheme } from '@/lib/share'
import { heroCondition } from '../../components/outlook/icons'
import SkyLoader from '../../components/SkyLoader'

// The embeddable card (an iframe on other sites): the city's weather right
// now on its sky. ?lang= ?unit=F ?theme=dark|light (default: the visitor's
// device). Compact at 300 × 200, side by side from 440 px wide. The whole
// card opens the full forecast in a new tab.
const fetchJson = url => fetch(url).then(r => r.json()).then(d => (d?.error ? null : d)).catch(() => null)

export default function Widget() {
  const params = useParams()
  const city = decodeURIComponent(params.city ?? '').trim().slice(0, 80)
  const [opts, setOpts] = useState(null) // read from the query after hydration
  const [state, setState] = useState({ now: null, out: null, done: false })

  useEffect(() => {
    // query read after hydration: the first client render must match the server HTML
    const q = new URLSearchParams(window.location.search)
    const theme = pickTheme(q.get('theme'))
    applyTheme(theme === 'auto' ? 'system' : theme)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-hydration sync
    setOpts({ lang: pickLang(q.get('lang')), unit: pickUnit(q.get('unit')) })
  }, [])

  // waits for the query: the language decides the place ("Wien" in English is a
  // town in Missouri); a slower, older answer never overwrites a newer one
  useEffect(() => {
    if (!city || !opts) return
    let stale = false
    const key = encodeURIComponent(city.toLowerCase())
    Promise.all([fetchJson(`/api/forecast?city=${key}&lang=${opts.lang}`), fetchJson(`/api/outlook?city=${key}&lang=${opts.lang}`)])
      .then(([now, out]) => { if (!stale) setState({ now, out, done: true }) })
    return () => { stale = true }
  }, [city, opts])

  const { now, out, done } = state
  useSky(out ? skyFor({ code: out.hourly?.[0]?.code, nowLocal: out.nowLocal, sun: out.sun }) : null)
  const { lang, unit } = opts ?? { lang: 'en', unit: 'C' }
  const fmt = tempFormatter(unit)
  const day = out?.days?.[0]
  const hour = out?.hourly?.[0]
  const dark = out ? isDark(out.nowLocal?.slice(11, 16), out.sun) : false
  const icon = hour?.icon ? (dark ? nightIcon(hour.icon) : hour.icon) : null
  const condition = now ? translateCondition(lang, heroCondition(now) ?? '') : ''
  const href = `${SITE}/?city=${encodeURIComponent(now?.city ?? city)}`
  const sourcesLine = now ? fill(t(lang, 'widgetSources'), { n: now.sources.filter(s => !s.down).length, agree: now.consensus.confidencePct }) : ''
  const brand = <span className="font-semibold text-zinc-300 shrink-0">Meta<span className="text-emerald-400">Blend</span></span>

  if (!done) return <div className="h-screen flex items-center justify-center overflow-hidden"><SkyLoader lang={lang} title={t(lang, 'loadingForecast')} names={[]} mini /></div>
  if (!now) return <div className="h-screen flex items-center justify-center p-4 text-center text-sm text-zinc-400">{fill(t(lang, 'widgetError'), { city })}</div>

  return (
    <a href={href} target="_blank" rel="noopener" aria-label={fill(t(lang, 'shareTitle'), { city: now.city })}
      className="mb-rise h-screen w-full p-4 flex flex-col justify-between min-[440px]:flex-row min-[440px]:items-center min-[440px]:gap-6 min-[440px]:px-6 overflow-hidden">
      <div className="min-w-0 min-[440px]:flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-base font-semibold tracking-tight truncate">{now.city}</div>
            {now.country && <div className="text-xs text-zinc-400 truncate">{now.country}</div>}
          </div>
          {icon && <div className="text-2xl leading-none min-[440px]:hidden" aria-hidden>{icon}</div>}
        </div>
        <div className="hidden min-[440px]:flex flex-col gap-1 mt-3 text-[11px] text-zinc-400">{sourcesLine}{brand}</div>
      </div>
      <div className="flex items-end gap-3 min-[440px]:items-center">
        <span className="text-6xl font-extralight tabular-nums leading-[0.85] tracking-tight">{fmt(now.consensus.temp)}</span>
        <div className="pb-0.5 text-sm min-w-0">
          <div className="flex items-center gap-1.5 truncate">{icon && <span className="hidden min-[440px]:inline" aria-hidden>{icon}</span>}{condition}</div>
          {day && <div className="text-zinc-400 tabular-nums whitespace-nowrap">↑ {fmt(day.tempMax)}  ↓ {fmt(day.tempMin)}</div>}
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-zinc-400 min-[440px]:hidden">
        <span className="truncate">{sourcesLine}</span>
        {brand}
      </div>
    </a>
  )
}
