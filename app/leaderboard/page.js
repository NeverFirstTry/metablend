'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Map as MapIcon, Scale, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import BetaBanner from '../components/BetaBanner'
import Footer from '../components/Footer'

const DISPLAY_NAMES = {
  'open-meteo':           'Open-Meteo',
  'owm':                  'OpenWeatherMap',
  'weatherapi':           'WeatherAPI',
  'tomorrow':             'Tomorrow.io',
  'met-norway':           'MET Norway',
  'visual-crossing':      'Visual Crossing',
  'world-weather-online': 'World Weather Online',
  'weatherstack':         'Weatherstack',
  'nasa-power':           'NASA POWER',
}

const REGION_LABELS = {
  global:        '🌍 Global',
  europe:        '🇪🇺 Europe',
  north_america: '🌎 North America',
  south_america: '🌎 South America',
  asia:          '🌏 Asia',
  africa:        '🌍 Africa',
  oceania:       '🌏 Oceania',
}

function name(id, fallback) {
  return DISPLAY_NAMES[id] ?? fallback ?? id
}

// Tiny bar sparkline of recent scoring deltas (−2…+2): green = the source was
// close to the truth that report, red = it was off.
function Sparkline({ data }) {
  if (!Array.isArray(data) || data.length < 2) return null
  const recent = data.slice(-24)
  const bw = 4, gap = 1, h = 18, mid = h / 2
  return (
    <svg width={recent.length * (bw + gap)} height={h} className="block">
      {recent.map((d, i) => {
        const c = Math.max(-2, Math.min(2, d))
        const barH = Math.max(1, (Math.abs(c) / 2) * (mid - 1))
        const y = c >= 0 ? mid - barH : mid
        const fill = c > 0 ? '#34d399' : c < 0 ? '#f87171' : '#52525b'
        return <rect key={i} x={i * (bw + gap)} y={y} width={bw} height={barH} fill={fill} rx={0.5} />
      })}
    </svg>
  )
}

export default function Leaderboard() {
  const [regions, setRegions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [active, setActive] = useState('global')
  const [recal, setRecal] = useState(null) // { busy, msg, ok }

  function loadLeaderboard() {
    return fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setRegions(d.regions ?? [])
      })
      .catch(e => setError(e.message))
  }

  useEffect(() => {
    loadLeaderboard().finally(() => setLoading(false))
  }, [])

  // Admin-only: needs the CALIBRATE_SECRET. Anyone without it just gets a 401,
  // so the button is safe to ship publicly.
  async function recalibrate() {
    const key = window.prompt('Admin key to recalibrate weights:')
    if (!key) return
    setRecal({ busy: true, msg: 'Recalibrating against the live consensus…' })
    try {
      const res = await fetch('/api/self-calibrate', { method: 'POST', headers: { 'x-calibrate-key': key } })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`)
      await loadLeaderboard()
      setRecal({ busy: false, ok: true, msg: `Rebalanced ${Object.keys(d.rebalanced ?? {}).length} region(s) from ${d.citiesScored}/${d.citiesProbed} cities · seeded ${d.forecastsSeeded} forecasts.` })
    } catch (e) {
      setRecal({ busy: false, ok: false, msg: e.message })
    }
  }

  const current = regions?.find(r => r.region === active)

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5">
            <ArrowLeft size={15} aria-hidden /> Back
          </Link>
          <Link href="/heatmap" className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5">
            <MapIcon size={15} aria-hidden /> Heatmap
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-1">
          API<span className="text-emerald-400">Leaderboard</span>
        </h1>
        <p className="text-zinc-500 text-sm mb-6 tracking-widest uppercase">
          Accuracy per region · weighted by community feedback
        </p>

        <BetaBanner className="mb-6" />

        <div className="mb-8 flex items-center gap-3 flex-wrap">
          <button
            onClick={recalibrate}
            disabled={recal?.busy}
            className="press text-xs px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-emerald-400 hover:text-emerald-400 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {recal?.busy
              ? <Loader2 size={13} className="animate-spin-slow" aria-hidden />
              : <Scale size={13} aria-hidden />}
            {recal?.busy ? 'Recalibrating…' : 'Recalibrate weights'}
          </button>
          {recal && !recal.busy && (
            <span className={`text-xs inline-flex items-center gap-1.5 ${recal.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {recal.ok ? <CheckCircle2 size={13} aria-hidden /> : <AlertTriangle size={13} aria-hidden />}{recal.msg}
            </span>
          )}
        </div>

        {loading && (
          <div className="text-zinc-500 text-sm flex items-center gap-2">
            <Loader2 size={15} className="animate-spin-slow" aria-hidden /> Loading leaderboard…
          </div>
        )}

        {error && (
          <div className="animate-scale-in bg-red-900/30 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" aria-hidden /> {error}
          </div>
        )}

        {regions && regions.length > 0 && (
          <>
            {/* Region tabs */}
            <div className="flex gap-2 flex-wrap mb-6">
              {regions.map(r => (
                <button
                  key={r.region}
                  onClick={() => setActive(r.region)}
                  className={`press text-xs px-3 py-2 rounded-lg border ${
                    active === r.region
                      ? 'bg-emerald-400 text-black border-emerald-400 font-bold'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-emerald-400'
                  }`}
                >
                  {REGION_LABELS[r.region] ?? r.region}
                </button>
              ))}
            </div>

            {current && (
              <div className="space-y-3">
                {current.apis.map((api, i) => {
                  const weightPct = (api.weight * 100).toFixed(1)
                  const avgScore = api.reports > 0 ? (api.score / api.reports).toFixed(2) : '–'
                  const medalColor = i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-zinc-600'
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`

                  return (
                    <div key={api.id} className="animate-fade-in-up bg-zinc-900 border border-zinc-800 rounded-xl p-5" style={{ animationDelay: `${i * 60}ms` }}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className={`text-lg font-bold tabular-nums ${medalColor}`}>{medal}</span>
                          <div>
                            <div className="font-bold text-base">{name(api.id, api.name)}</div>
                            <div className="text-zinc-600 text-xs">{api.id}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-emerald-400 font-bold text-lg tabular-nums">{weightPct}%</div>
                          <div className="text-zinc-600 text-xs">Weight</div>
                        </div>
                      </div>

                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-4">
                        <div className="h-full bg-emerald-400 rounded-full transition-[width] duration-700 ease-out" style={{ width: `${weightPct}%` }} />
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <div className="text-sm font-bold tabular-nums">{api.score ?? 0}</div>
                          <div className="text-zinc-500 text-xs uppercase tracking-wider">Score</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold tabular-nums">{api.reports ?? 0}</div>
                          <div className="text-zinc-500 text-xs uppercase tracking-wider">Reports</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold tabular-nums">{avgScore}</div>
                          <div className="text-zinc-500 text-xs uppercase tracking-wider">Ø Score</div>
                        </div>
                      </div>

                      {api.delta_history?.length > 1 && (
                        <div className="mt-3 pt-3 border-t border-zinc-800">
                          <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1.5">Recent accuracy</div>
                          <Sparkline data={api.delta_history} />
                        </div>
                      )}

                      {(api.uptime != null || api.avgMs != null) && (
                        <div className="grid grid-cols-2 gap-3 text-center mt-3 pt-3 border-t border-zinc-800">
                          <div>
                            <div className="text-sm font-bold" style={{
                              color: api.uptime == null ? '#a1a1aa' : api.uptime >= 99 ? '#34d399' : api.uptime >= 90 ? '#fbbf24' : '#f87171',
                            }}>
                              {api.uptime != null ? `${api.uptime}%` : '–'}
                            </div>
                            <div className="text-zinc-500 text-xs uppercase tracking-wider">Uptime</div>
                          </div>
                          <div>
                            <div className="text-sm font-bold tabular-nums">{api.avgMs != null ? `${Math.round(api.avgMs)}ms` : '–'}</div>
                            <div className="text-zinc-500 text-xs uppercase tracking-wider">Avg response</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {regions && regions.length === 0 && !error && (
          <p className="text-zinc-600 text-sm">No weight data available yet.</p>
        )}

        <Footer />
      </div>
    </main>
  )
}
