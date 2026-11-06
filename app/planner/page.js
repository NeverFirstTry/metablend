'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, Loader2, AlertTriangle, CalendarCheck } from 'lucide-react'
import { t } from '@/lib/i18n'
import { useLang } from '@/lib/useLang'
import { isAppView } from '@/lib/app-client'
import { useUnit } from '@/lib/useUnit'
import { tempFormatter } from '@/lib/outlook/text'
import BetaBanner from '../components/BetaBanner'
import Footer from '../components/Footer'
import SkyLoader from '../components/SkyLoader'

// localized month name (any non-leap year works as the anchor)
const monthName = (lang, m, month = 'short') => new Date(2001, m - 1, 1).toLocaleDateString(lang, { month })

// score a month for "nice to visit": mild temp (18-26° ideal) and few rainy days
function comfortScore(m) {
  if (m.avgTemp == null) return -Infinity
  const tempMiss = m.avgTemp < 18 ? 18 - m.avgTemp : m.avgTemp > 26 ? m.avgTemp - 26 : 0
  return -(tempMiss * 2 + (m.avgRainDays ?? 0))
}

// The website's chart: one measure with its own axis, so a cold month's bar reads as cold and
// nothing is compared across two scales. Bars grow from zero, down for frost. On a phone the
// axis carries the numbers, because twelve labels don't fit, and the months are single letters.
function MonthChart({ title, rows, format, barClass, best, lang }) {
  const values = rows.map(r => r.value).filter(v => v != null)
  const hi = Math.max(0, ...values)
  const lo = Math.min(0, ...values)
  const top = v => ((hi - v) / ((hi - lo) || 1)) * 100
  const ticks = lo < 0 && hi > 0 ? [hi, 0, lo] : [hi, (hi + lo) / 2, lo]
  const said = rows.filter(r => r.value != null).map(r => `${monthName(lang, r.month, 'long')} ${format(r.value)}`).join(', ')
  return (
    <figure role="img" aria-label={`${title}: ${said}`} className="min-w-0">
      <figcaption className="text-sm mb-6">{title}</figcaption>
      <div className="flex gap-2">
        <div className="relative w-10 h-40 shrink-0 text-xs text-zinc-400 tabular-nums" aria-hidden>
          {ticks.map(v => <span key={v} className="absolute right-0 -translate-y-1/2" style={{ top: `${top(v)}%` }}>{format(v)}</span>)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative h-40">
            {ticks.map(v => <div key={v} className="chart-line absolute left-0 right-0" style={{ top: `${top(v)}%` }} />)}
            <div className="absolute inset-0 grid grid-cols-12 gap-1">
              {rows.map(r => (
                <div key={r.month} className="relative" title={r.value != null ? format(r.value) : ''}>
                  {r.value != null && (
                    <>
                      <div className={`absolute inset-x-0 rounded-sm ${barClass}`} style={{ top: `${Math.min(top(r.value), top(0))}%`, height: `${Math.max(1, Math.abs(top(r.value) - top(0)))}%` }} />
                      <div className="hidden sm:block absolute inset-x-0 -translate-y-full text-center text-xs tabular-nums pb-0.5" style={{ top: `${Math.min(top(r.value), top(0))}%` }}>{format(r.value)}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-12 gap-1 mt-2 text-xs text-center">
            {rows.map(r => (
              <div key={r.month} className={best.includes(r.month) ? 'text-emerald-400 font-bold' : 'text-zinc-400'}>
                <span className="hidden sm:inline">{monthName(lang, r.month)}</span>
                <span className="sm:hidden">{monthName(lang, r.month, 'narrow')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </figure>
  )
}

export default function Planner() {
  const lang = useLang()
  const fmtTemp = tempFormatter(useUnit())
  const [city, setCity] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function search(q = city) {
    if (!q.trim()) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/planner?city=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e) {
      setError(e.message); setData(null)
    } finally {
      setLoading(false)
    }
  }

  const months = data?.months ?? []
  const temps = months.map(m => m.avgTemp).filter(v => v != null)
  const maxRain = Math.max(1, ...months.map(m => m.avgRainDays ?? 0))
  const minT = Math.min(...temps, 0)
  const maxT = Math.max(...temps, 1)
  const best = months.length
    ? [...months].sort((a, b) => comfortScore(b) - comfortScore(a)).slice(0, 3).map(m => m.month)
    : []

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="app-only text-zinc-500 text-sm hover:text-emerald-400 transition-colors mb-6 inline-flex items-center gap-1.5">
          <ArrowLeft size={15} aria-hidden /> {t(lang, 'back')}
        </Link>

        <h1 className="mb-rise text-3xl sm:text-4xl font-semibold tracking-tight mb-1">{t(lang, 'planner')}</h1>
        <p className="text-zinc-500 text-sm mb-6 tracking-widest uppercase">
          {t(lang, 'plSubtitle')}
        </p>

        <BetaBanner lang={lang} className="mb-8" />

        <div className="flex gap-2 mb-10">
          <input
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-colors"
            placeholder={t(lang, 'plPlaceholder')}
            value={city}
            onChange={e => setCity(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') search() }}
          />
          <button
            onClick={() => search()}
            disabled={loading}
            aria-label={t(lang, 'a11ySearch')}
            className="press bg-emerald-400 text-black font-bold px-5 rounded-lg text-sm hover:bg-emerald-300 disabled:opacity-40 flex items-center justify-center"
          >
            {loading ? <Loader2 size={18} className="animate-spin-slow" aria-hidden /> : <Search size={18} aria-hidden />}
          </button>
        </div>

        {error && (
          <div className="animate-scale-in bg-red-900/30 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm mb-6 flex items-center gap-2"><AlertTriangle size={16} className="shrink-0" aria-hidden /> {error}</div>
        )}

        {loading && <SkyLoader lang={lang} title={t(lang, 'loadingClimate')} names={[]} />}

        {data && !loading && (
          <div className="animate-fade-in-up">
            <div className="text-emerald-400 text-xs tracking-widest uppercase mb-4">
              {data.city}{data.country ? `, ${data.country}` : ''}
            </div>

            {best.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
                <div className="text-zinc-500 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5"><CalendarCheck size={13} aria-hidden /> {t(lang, 'plBest')}</div>
                <div className="flex gap-2 flex-wrap">
                  {best.map(m => (
                    <span key={m} className="bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 rounded-lg px-3 py-1 text-sm">
                      {monthName(lang, m)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!isAppView() && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6 grid gap-10 lg:grid-cols-2 lg:gap-12">
                <MonthChart title={t(lang, 'plAvgTemp')} rows={months.map(m => ({ month: m.month, value: m.avgTemp }))} format={fmtTemp} barClass="bg-orange-400/80" best={best} lang={lang} />
                <MonthChart title={t(lang, 'plRainyDays')} rows={months.map(m => ({ month: m.month, value: m.avgRainDays ?? null }))} format={v => String(Math.round(v))} barClass="bg-blue-400/70" best={best} lang={lang} />
              </div>
            )}

            {/* 12-month chart, in the app */}
            {isAppView() && <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6">
              <div className="flex gap-4 text-xs mb-5">
                <span className="text-orange-400">■ <span className="legend-label">{t(lang, 'plAvgTemp')}</span></span>
                <span className="text-blue-400">■ <span className="legend-label">{t(lang, 'plRainyDays')}</span></span>
              </div>
              <div className="grid grid-cols-12 gap-1 items-end h-48">
                {months.map(m => {
                  const tempH = m.avgTemp == null ? 0 : ((m.avgTemp - minT) / (maxT - minT || 1)) * 100
                  const rainH = ((m.avgRainDays ?? 0) / maxRain) * 100
                  const isBest = best.includes(m.month)
                  return (
                    <div key={m.month} className="flex flex-col items-center gap-1 h-full justify-end" title={`${fmtTemp(m.avgTemp)} · ${m.avgRainDays} ${t(lang, 'plRainyDays').toLowerCase()}`}>
                      <div className="legend-label text-[0.625rem] text-orange-300 tabular-nums">{m.avgTemp != null ? fmtTemp(m.avgTemp) : ''}</div>
                      <div className="w-full flex gap-px items-end h-full">
                        <div className="flex-1 bg-orange-400/80 rounded-t transition-[height] duration-700 ease-out" style={{ height: `${Math.max(2, tempH)}%` }} />
                        <div className="flex-1 bg-blue-400/70 rounded-t transition-[height] duration-700 ease-out" style={{ height: `${Math.max(2, rainH)}%` }} />
                      </div>
                      <div className={`text-[0.625rem] uppercase ${isBest ? 'text-emerald-400 font-bold' : 'text-zinc-500'}`}>
                        {monthName(lang, m.month)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>}
          </div>
        )}

        <Footer lang={lang} />
      </div>
    </main>
  )
}
