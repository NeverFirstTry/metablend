'use client'

import { useEffect, useState } from 'react'
import { CloudRain } from 'lucide-react'
import { t } from '@/lib/i18n'
import { summarize, upcoming, intensity } from '@/lib/nowcast'
import { nowcastSentence } from '@/lib/nowcast-text'
import { SectionTitle } from '../ui'

const OPACITY = { light: 0.45, moderate: 0.75, heavy: 1 }

// Rain in the next 2 hours: one sentence, plus eight quarter-hour bars when
// there is rain to show (a dry forecast is just the sentence). Fetches
// /api/nowcast for the city and again every 5 minutes; hidden when it fails.
export default function NowcastCard({ lat, lon, lang }) {
  const [state, setState] = useState({ nc: null, now: 0 })
  useEffect(() => {
    let off = false
    const load = () => fetch(`/api/nowcast?lat=${lat}&lon=${lon}`)
      .then(r => (r.ok ? r.json() : null), () => null)
      .then(nc => { if (!off) setState({ nc, now: Date.now() }) })
    load()
    const id = setInterval(load, 5 * 60e3)
    return () => { off = true; clearInterval(id) }
  }, [lat, lon])

  const s = state.nc ? summarize(state.nc, state.now) : null
  if (!s) return null
  const steps = upcoming(state.nc, state.now)
  const max = Math.max(1, ...steps.map(x => x.mm ?? 0))
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3" aria-label={t(lang, 'ncTitle')}>
      <SectionTitle icon={CloudRain}>{t(lang, 'ncTitle')}</SectionTitle>
      <p className="text-base font-semibold">{nowcastSentence(lang, s)}</p>
      {s.kind !== 'dry' && <>
      <div className="flex items-end gap-1.5 h-12" aria-hidden>
        {steps.map(x => (
          <div key={x.t} className="flex-1 rounded-sm" style={{
            height: `${x.wet ? Math.max(12, ((x.mm ?? 0) / max) * 100) : 6}%`,
            background: x.wet ? 'var(--info)' : 'var(--muted)',
            opacity: x.wet ? OPACITY[intensity(x.mm ?? 0)] * (x.agree < 0.66 ? 0.5 : 1) : 0.25,
          }} />
        ))}
      </div>
      <div className="flex text-[11px] text-zinc-500 tabular-nums" aria-hidden>
        {steps.map((x, i) => <span key={x.t} className="flex-1">{i % 2 === 0 ? x.t.slice(11, 16) : ''}</span>)}
      </div>
      </>}
      {state.nc.precision === 'rough'
        ? <p className="text-xs text-zinc-500">{t(lang, 'ncRough')}</p>
        : steps.some(x => x.wet && x.agree < 0.66) && <p className="text-xs text-zinc-500">{t(lang, 'ncAgreeHint')}</p>}
    </section>
  )
}
