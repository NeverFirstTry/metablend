'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

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

export default function Leaderboard() {
  const [regions, setRegions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [active, setActive] = useState('global')

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setRegions(d.regions ?? [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const current = regions?.find(r => r.region === active)

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors">
            ← Back
          </Link>
          <Link href="/heatmap" className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors">
            Heatmap →
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-1">
          API<span className="text-emerald-400">Leaderboard</span>
        </h1>
        <p className="text-zinc-500 text-sm mb-8 tracking-widest uppercase">
          Accuracy per region · weighted by community feedback
        </p>

        {loading && <div className="text-zinc-500 text-sm">Loading leaderboard…</div>}

        {error && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
            ⚠ {error}
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
                  className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
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
                    <div key={api.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className={`text-lg font-bold ${medalColor}`}>{medal}</span>
                          <div>
                            <div className="font-bold text-base">{name(api.id, api.name)}</div>
                            <div className="text-zinc-600 text-xs">{api.id}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-emerald-400 font-bold text-lg">{weightPct}%</div>
                          <div className="text-zinc-600 text-xs">Weight</div>
                        </div>
                      </div>

                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-4">
                        <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${weightPct}%` }} />
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <div className="text-sm font-bold">{api.score ?? 0}</div>
                          <div className="text-zinc-500 text-xs uppercase tracking-wider">Score</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold">{api.reports ?? 0}</div>
                          <div className="text-zinc-500 text-xs uppercase tracking-wider">Reports</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold">{avgScore}</div>
                          <div className="text-zinc-500 text-xs uppercase tracking-wider">Ø Score</div>
                        </div>
                      </div>
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

      </div>
    </main>
  )
}
