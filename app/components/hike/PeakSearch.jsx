'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Search, LocateFixed, Loader2 } from 'lucide-react'
import { t } from '@/lib/i18n'
import { isNative, nativePosition } from '@/lib/native'

// Debounced peak search. The query is trimmed + lower-cased and the location
// bias rounded to 0.1° so equal searches share one CDN entry. "Near me" also
// reports the position so the featured list can sort by distance.
export default function PeakSearch({ lang, hrefFor, onLocate }) {
  const [text, setText] = useState('')
  const [bias, setBias] = useState(null)
  const [res, setRes] = useState({ query: '', peaks: null, error: false, loading: false })
  const seq = useRef(0)
  const query = text.trim().toLowerCase()
  const active = query.length >= 2

  useEffect(() => {
    if (!active) return
    const id = ++seq.current
    const timer = setTimeout(async () => {
      setRes(r => ({ ...r, loading: true }))
      try {
        const b = bias ? `&lat=${bias.lat}&lon=${bias.lon}` : ''
        const r = await fetch(`/api/peaks?q=${encodeURIComponent(query)}${b}`)
        const json = await r.json()
        if (id === seq.current) setRes({ query, peaks: r.ok ? json.peaks : null, error: !r.ok, loading: false })
      } catch {
        if (id === seq.current) setRes({ query, peaks: null, error: true, loading: false })
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [query, active, bias])

  // Inside the app only the native location — falling back to the browser API
  // there would show Android's permission prompt a second time after a denial.
  async function nearMe() {
    const done = c => {
      const p = { lat: Math.round(c.lat * 10) / 10, lon: Math.round(c.lon * 10) / 10 }
      setBias(p)
      onLocate?.(p)
    }
    if (isNative()) {
      const native = await nativePosition()
      if (native) done(native)
      return
    }
    navigator.geolocation?.getCurrentPosition(pos => done({ lat: pos.coords.latitude, lon: pos.coords.longitude }), () => {}, { maximumAge: 600000, timeout: 10000 })
  }

  const shown = active && res.query === query
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <label className="flex-1 flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 focus-within:border-emerald-400">
          <Search size={16} className="text-zinc-500 shrink-0" aria-hidden />
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={t(lang, 'hikeSearch')}
            aria-label={t(lang, 'hikeSearch')}
            maxLength={80}
            className="w-full bg-transparent py-3 text-sm outline-none"
          />
          {active && res.loading && <Loader2 size={16} className="animate-spin-slow text-zinc-500 shrink-0" aria-hidden />}
        </label>
        <button onClick={nearMe} aria-label={t(lang, 'hikeNearMe')} className="press shrink-0 inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-xs text-zinc-300 hover:border-emerald-400">
          <LocateFixed size={15} aria-hidden /> <span className="hidden sm:inline">{t(lang, 'hikeNearMe')}</span>
        </button>
      </div>
      {shown && res.error && <p className="text-sm" style={{ color: 'var(--warn)' }}>{t(lang, 'hikeSearchDown')}</p>}
      {shown && res.peaks?.length === 0 && <p className="text-sm text-zinc-500">{t(lang, 'hikeNoResults')}</p>}
      {shown && res.peaks?.length > 0 && (
        <ul className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
          {res.peaks.map(p => (
            <li key={p.id}>
              <Link href={hrefFor(p)} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:text-emerald-400">
                <span className="min-w-0 truncate">{p.name}<span className="text-zinc-500">{p.region ? ` · ${p.region}` : ''}{p.country ? ` · ${p.country}` : ''}</span></span>
                <span className="text-zinc-500 text-xs tabular-nums shrink-0" title={p.elevApprox ? t(lang, 'elevApprox') : undefined}>{p.elevApprox ? '≈' : ''}{p.elev} m</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
