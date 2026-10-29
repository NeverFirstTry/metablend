'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Search, LocateFixed, Loader2 } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fill } from '@/lib/outlook/text'
import { isNative, nativePosition } from '@/lib/native'
import { applyLocation } from '@/lib/hike/search'
import OsmCredit from './OsmCredit'

// Peak search. While typing (debounced): featured peaks and the geocoder's
// mountains — never OpenStreetMap's Nominatim, whose policy rules out
// search-as-you-type. Enter, or "Search peaks, huts and places", sends the
// query: then OpenStreetMap by name, and when it names a city or town, the
// summits and huts around it, nearest first, with the distance. The query is
// trimmed + lower-cased and the location bias rounded to 0.1° so equal
// searches share one CDN entry. "Near me" also reports the position so the
// featured list can sort by distance.
export default function PeakSearch({ lang, hrefFor, onLocate }) {
  const [text, setText] = useState('')
  const [bias, setBias] = useState(null)
  const [sent, setSent] = useState(null) // the query sent in full; typing on goes back to typed results
  const [res, setRes] = useState({ query: '', full: false, peaks: null, around: null, error: false, loading: false })
  const seq = useRef(0)
  const query = text.trim().toLowerCase()
  const active = query.length >= 2
  const full = active && sent === query

  useEffect(() => {
    if (!active) return
    const id = ++seq.current
    const timer = setTimeout(async () => {
      setRes(r => ({ ...r, loading: true }))
      try {
        const b = bias ? `&lat=${bias.lat}&lon=${bias.lon}` : ''
        const r = await fetch(`/api/peaks?q=${encodeURIComponent(query)}${b}${full ? '&full=1' : ''}`)
        const json = await r.json()
        if (id === seq.current) setRes({ query, full, peaks: r.ok ? json.peaks : null, around: r.ok ? json.around ?? null : null, error: !r.ok, loading: false })
      } catch {
        if (id === seq.current) setRes({ query, full, peaks: null, around: null, error: true, loading: false })
      }
    }, full ? 0 : 350)
    return () => clearTimeout(timer)
  }, [query, active, bias, full])

  // Inside the app only the native location — falling back to the browser API
  // there would show Android's permission prompt a second time after a denial.
  async function nearMe() {
    const done = c => applyLocation(c, { setBias, onLocate })
    if (isNative()) {
      const native = await nativePosition()
      if (native) done(native)
      return
    }
    navigator.geolocation?.getCurrentPosition(pos => done({ lat: pos.coords.latitude, lon: pos.coords.longitude }), () => {}, { maximumAge: 600000, timeout: 10000 })
  }

  const send = e => { e.preventDefault(); if (active) setSent(query) }
  const shown = active && res.query === query && res.full === full
  const around = res.around?.peaks?.length ? res.around : null
  const row = p => (
    <li key={p.id}>
      <Link href={hrefFor(p)} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:text-emerald-400">
        <span className="min-w-0 truncate">{p.name}<span className="text-zinc-500">{p.region ? ` · ${p.region}` : ''}{p.country ? ` · ${p.country}` : ''}</span></span>
        <span className="text-zinc-500 text-xs tabular-nums shrink-0" title={p.elevApprox ? t(lang, 'elevApprox') : undefined}>
          {p.km != null ? `${Math.round(p.km)} km · ` : ''}{p.elevApprox ? '≈' : ''}{p.elev} m
        </span>
      </Link>
    </li>
  )
  return (
    <form role="search" onSubmit={send} className="space-y-2">
      <div className="flex gap-2">
        <label className="flex-1 flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 focus-within:border-emerald-400">
          <Search size={16} className="text-zinc-500 shrink-0" aria-hidden />
          <input
            type="search"
            enterKeyHint="search"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={t(lang, 'hikeSearch')}
            aria-label={t(lang, 'hikeSearch')}
            maxLength={80}
            className="w-full bg-transparent py-3 text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {active && res.loading && <Loader2 size={16} className="animate-spin-slow text-zinc-500 shrink-0" aria-hidden />}
        </label>
        <button type="button" onClick={nearMe} aria-label={t(lang, 'hikeNearMe')} className="press shrink-0 inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-xs text-zinc-300 hover:border-emerald-400">
          <LocateFixed size={15} aria-hidden /> <span className="hidden sm:inline">{t(lang, 'hikeNearMe')}</span>
        </button>
      </div>
      {shown && res.error && <p className="text-sm" style={{ color: 'var(--warn)' }}>{t(lang, 'hikeSearchDown')}</p>}
      {shown && full && res.peaks?.length === 0 && !around && <p className="text-sm text-zinc-500">{t(lang, 'hikeNoResults')}</p>}
      {shown && res.peaks?.length > 0 && (
        <ul className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">{res.peaks.map(row)}</ul>
      )}
      {shown && around && (
        <section className="space-y-1.5 pt-1" aria-label={fill(t(lang, 'hikeSearchAround'), { place: around.place.name })}>
          <p className="text-xs text-zinc-500 px-1">{fill(t(lang, 'hikeSearchAround'), { place: around.place.name })}</p>
          <ul className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">{around.peaks.map(row)}</ul>
        </section>
      )}
      {active && !full && (
        <button type="submit" className="press w-full text-left text-sm text-emerald-400 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 hover:border-emerald-400">
          {fill(t(lang, 'hikeSearchFull'), { q: text.trim() })}
        </button>
      )}
      {shown && full && (res.peaks?.length > 0 || around) && <OsmCredit lang={lang} />}
    </form>
  )
}
