'use client'

import { useState } from 'react'

export default function Home() {
  const [city, setCity] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [feedback, setFeedback] = useState({ temp: '', cond: '' })
  const [fbStatus, setFbStatus] = useState(null)
  const [fbLoading, setFbLoading] = useState(false)

  async function loadForecast() {
    if (!city.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/forecast?city=${encodeURIComponent(city)}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitFeedback() {
    if (!feedback.temp || !feedback.cond || !data) return
    setFbLoading(true)
    setFbStatus(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: data.city,
          actualTemp: parseFloat(feedback.temp),
          actualCond: feedback.cond,
        })
      })
      const json = await res.json()
      setFbStatus({ ok: true, msg: json.message })
      loadForecast()
    } catch {
      setFbStatus({ ok: false, msg: 'Fehler beim Senden' })
    } finally {
      setFbLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <h1 className="text-4xl font-bold mb-1">
          Meta<span className="text-emerald-400">Blend</span>
        </h1>
        <p className="text-zinc-500 text-sm mb-8 tracking-widest uppercase">
          Wetterwahrheit durch Konsensus
        </p>

        {/* Search */}
        <div className="flex gap-3 mb-10">
          <input
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-colors"
            placeholder="Stadt eingeben… z.B. Wien, Berlin, Zürich"
            value={city}
            onChange={e => setCity(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadForecast()}
          />
          <button
            onClick={loadForecast}
            disabled={loading}
            className="bg-emerald-400 text-black font-bold px-6 rounded-lg text-sm hover:bg-emerald-300 transition-colors disabled:opacity-40"
          >
            {loading ? '↻ Lädt…' : '▶ Abrufen'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm mb-6">
            ⚠ {error}
          </div>
        )}

        {/* Results */}
        {data && (
          <div className="space-y-6">

            {/* Consensus Hero */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
              <div className="text-emerald-400 text-xs tracking-widest uppercase mb-4">
                ⊕ Gewichteter Konsensus · {data.city}, {data.country}
              </div>
              <div className="flex items-start gap-8">
                <div className="text-8xl font-bold leading-none">
                  {data.consensus.temp}°
                </div>
                <div className="pt-2">
                  <div className="flex gap-6">
                    <div>
                      <div className="text-lg">{data.consensus.rainPct}%</div>
                      <div className="text-zinc-500 text-xs uppercase tracking-wider">Regen-WSK</div>
                    </div>
                    <div>
                      <div className="text-lg">{data.consensus.windKmh} km/h</div>
                      <div className="text-zinc-500 text-xs uppercase tracking-wider">Wind</div>
                    </div>
                    <div>
                      <div className="text-lg" style={{
                        color: data.consensus.confidencePct >= 70 ? '#34d399'
                             : data.consensus.confidencePct >= 45 ? '#fbbf24'
                             : '#f87171'
                      }}>
                        {data.consensus.confidencePct}%
                      </div>
                      <div className="text-zinc-500 text-xs uppercase tracking-wider">Konsens</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Source Cards */}
            <div>
              <div className="text-zinc-500 text-xs uppercase tracking-widest mb-3">
                Einzelne Quellen
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.sources.map(src => {
                  const weight = data.weights[src.apiId] ?? 0.25
                  const diff = Math.abs(src.temp - data.consensus.temp)
                  const diffColor = diff <= 1 ? 'text-emerald-400'
                                  : diff <= 2.5 ? 'text-yellow-400'
                                  : 'text-red-400'
                  return (
                    <div key={src.apiId} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div className="font-bold">{src.apiId}</div>
                        <div className={`text-xs ${diffColor}`}>
                          {diff <= 1 ? '≈ Konsens' : `±${diff.toFixed(1)}°`}
                        </div>
                      </div>
                      <div className="text-4xl font-bold mb-1">{src.temp}°</div>
                      <div className="text-zinc-500 text-sm mb-4">{src.condition} · Regen {src.rainPct}%</div>
                      <div className="flex items-center gap-2">
                        <div className="text-zinc-600 text-xs">Gewicht</div>
                        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: `${weight * 100}%` }}
                          />
                        </div>
                        <div className="text-emerald-400 text-xs">{(weight * 100).toFixed(0)}%</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Feedback */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
              <div className="text-emerald-400 text-xs tracking-widest uppercase mb-2">
                📝 Wie war das Wetter wirklich?
              </div>
              <p className="text-zinc-500 text-sm mb-6">
                Dein Feedback passt die API-Gewichtungen automatisch an.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-2">
                    Tatsächliche Temperatur
                  </label>
                  <input
                    type="number"
                    placeholder="z.B. 14"
                    value={feedback.temp}
                    onChange={e => setFeedback(f => ({ ...f, temp: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-2">
                    Wetterlage
                  </label>
                  <select
                    value={feedback.cond}
                    onChange={e => setFeedback(f => ({ ...f, cond: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-colors"
                  >
                    <option value="">Wählen…</option>
                    <option value="Sonnig">☀️ Sonnig</option>
                    <option value="Leicht bewölkt">🌤 Leicht bewölkt</option>
                    <option value="Bewölkt">⛅ Bewölkt</option>
                    <option value="Regen">🌧 Regen</option>
                    <option value="Gewitter">⛈ Gewitter</option>
                    <option value="Schnee">🌨 Schnee</option>
                  </select>
                </div>
              </div>
              <button
                onClick={submitFeedback}
                disabled={fbLoading || !feedback.temp || !feedback.cond}
                className="w-full bg-emerald-400 text-black font-bold py-3 rounded-lg text-sm hover:bg-emerald-300 transition-colors disabled:opacity-40"
              >
                {fbLoading ? '↻ Wird gesendet…' : '✓ Feedback einreichen'}
              </button>
              {fbStatus && (
                <div className={`mt-4 p-3 rounded-lg text-sm ${fbStatus.ok
                  ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-900/30 text-red-400 border border-red-500/30'}`}>
                  {fbStatus.ok ? '✅' : '⚠'} {fbStatus.msg}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </main>
  )
}