'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, Loader2, AlertTriangle, CalendarCheck } from 'lucide-react'
import BetaBanner from '../components/BetaBanner'
import Footer from '../components/Footer'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// score a month for "nice to visit": mild temp (18-26° ideal) and few rainy days
function comfortScore(m) {
  if (m.avgTemp == null) return -Infinity
  const tempMiss = m.avgTemp < 18 ? 18 - m.avgTemp : m.avgTemp > 26 ? m.avgTemp - 26 : 0
  return -(tempMiss * 2 + (m.avgRainDays ?? 0))
}

export default function Planner() {
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
        <Link href="/" className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors mb-6 inline-flex items-center gap-1.5">
          <ArrowLeft size={15} aria-hidden /> Back
        </Link>

        <h1 className="text-3xl font-bold mb-1">
          Travel<span className="text-emerald-400">Planner</span>
        </h1>
        <p className="text-zinc-500 text-sm mb-6 tracking-widest uppercase">
          Best months to visit, from 10 years of climate data
        </p>

        <BetaBanner className="mb-8" />

        <div className="flex gap-2 mb-10">
          <input
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-colors"
            placeholder="Enter city… e.g. Lisbon, Tokyo, Cape Town"
            value={city}
            onChange={e => setCity(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') search() }}
          />
          <button
            onClick={() => search()}
            disabled={loading}
            aria-label="Search"
            className="press bg-emerald-400 text-black font-bold px-5 rounded-lg text-sm hover:bg-emerald-300 disabled:opacity-40 flex items-center justify-center"
          >
            {loading ? <Loader2 size={18} className="animate-spin-slow" aria-hidden /> : <Search size={18} aria-hidden />}
          </button>
        </div>

        {error && (
          <div className="animate-scale-in bg-red-900/30 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm mb-6 flex items-center gap-2"><AlertTriangle size={16} className="shrink-0" aria-hidden /> {error}</div>
        )}

        {data && (
          <div className="animate-fade-in-up">
            <div className="text-emerald-400 text-xs tracking-widest uppercase mb-4">
              {data.city}{data.country ? `, ${data.country}` : ''}
            </div>

            {best.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
                <div className="text-zinc-500 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5"><CalendarCheck size={13} aria-hidden /> Best months to visit</div>
                <div className="flex gap-2 flex-wrap">
                  {best.map(m => (
                    <span key={m} className="bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 rounded-lg px-3 py-1 text-sm">
                      {MONTHS[m - 1]}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 12-month chart */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6">
              <div className="flex gap-4 text-xs mb-5">
                <span className="text-orange-400">■ Avg temperature</span>
                <span className="text-blue-400">■ Rainy days</span>
              </div>
              <div className="grid grid-cols-12 gap-1 items-end h-48">
                {months.map(m => {
                  const tempH = m.avgTemp == null ? 0 : ((m.avgTemp - minT) / (maxT - minT || 1)) * 100
                  const rainH = ((m.avgRainDays ?? 0) / maxRain) * 100
                  const isBest = best.includes(m.month)
                  return (
                    <div key={m.month} className="flex flex-col items-center gap-1 h-full justify-end" title={`${m.avgTemp}°C · ${m.avgRainDays} rainy days`}>
                      <div className="text-[10px] text-orange-300 tabular-nums">{m.avgTemp != null ? Math.round(m.avgTemp) + '°' : ''}</div>
                      <div className="w-full flex gap-px items-end h-full">
                        <div className="flex-1 bg-orange-400/80 rounded-t transition-[height] duration-700 ease-out" style={{ height: `${Math.max(2, tempH)}%` }} />
                        <div className="flex-1 bg-blue-400/70 rounded-t transition-[height] duration-700 ease-out" style={{ height: `${Math.max(2, rainH)}%` }} />
                      </div>
                      <div className={`text-[10px] uppercase ${isBest ? 'text-emerald-400 font-bold' : 'text-zinc-500'}`}>
                        {MONTHS[m.month - 1]}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <Footer />
      </div>
    </main>
  )
}
