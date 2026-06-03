'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const DISPLAY_NAMES = {
  'open-meteo':  'Open-Meteo',
  'owm':         'OpenWeatherMap',
  'weatherapi':  'WeatherAPI',
}

export default function Leaderboard() {
  const [apis, setApis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setApis(d.apis)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-2xl mx-auto">

        <Link href="/" className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors mb-6 block">
          ← Zurück
        </Link>

        <h1 className="text-3xl font-bold mb-1">
          API<span className="text-emerald-400">Rangliste</span>
        </h1>
        <p className="text-zinc-500 text-sm mb-8 tracking-widest uppercase">
          Gewichtung durch Community-Feedback
        </p>

        {loading && (
          <div className="text-zinc-500 text-sm">Lade Rangliste…</div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
            ⚠ {error}
          </div>
        )}

        {apis && (
          <div className="space-y-3">
            {apis.map((api, i) => {
              const name = DISPLAY_NAMES[api.id] ?? api.name ?? api.id
              const weightPct = (api.weight * 100).toFixed(1)
              const avgScore = api.reports > 0
                ? (api.score / api.reports).toFixed(2)
                : '–'
              const updatedAt = api.updated_at
                ? new Date(api.updated_at).toLocaleDateString('de', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '–'

              const medalColor = i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-zinc-600'
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`

              return (
                <div key={api.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${medalColor}`}>{medal}</span>
                      <div>
                        <div className="font-bold text-base">{name}</div>
                        <div className="text-zinc-600 text-xs">{api.id}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-400 font-bold text-lg">{weightPct}%</div>
                      <div className="text-zinc-600 text-xs">Gewicht</div>
                    </div>
                  </div>

                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all"
                      style={{ width: `${weightPct}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-sm font-bold">{api.score ?? 0}</div>
                      <div className="text-zinc-500 text-xs uppercase tracking-wider">Score</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold">{api.reports ?? 0}</div>
                      <div className="text-zinc-500 text-xs uppercase tracking-wider">Meldungen</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold">{avgScore}</div>
                      <div className="text-zinc-500 text-xs uppercase tracking-wider">Ø Score</div>
                    </div>
                  </div>

                  {api.updated_at && (
                    <div className="text-zinc-700 text-xs mt-3 text-right">
                      Aktualisiert: {updatedAt}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>
    </main>
  )
}
