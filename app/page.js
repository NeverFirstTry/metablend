'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Home() {
  const [city, setCity] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState(null)
  const [feedback, setFeedback] = useState({ temp: '', cond: '' })
  const [fbStatus, setFbStatus] = useState(null)
  const [fbLoading, setFbLoading] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  function getWeatherOptions() {
    const hour = new Date().getHours()
    const isNight = hour < 6 || hour >= 21
    if (isNight) return [
      { value: 'Klar',           label: '🌙 Klar' },
      { value: 'Leicht bewölkt', label: '🌤 Leicht bewölkt' },
      { value: 'Bewölkt',        label: '⛅ Bewölkt' },
      { value: 'Bedeckt',        label: '☁️ Bedeckt' },
      { value: 'Regen',          label: '🌧 Regen' },
      { value: 'Gewitter',       label: '⛈ Gewitter' },
      { value: 'Schnee',         label: '🌨 Schnee' },
    ]
    return [
      { value: 'Sonnig',         label: '☀️ Sonnig' },
      { value: 'Leicht bewölkt', label: '🌤 Leicht bewölkt' },
      { value: 'Bewölkt',        label: '⛅ Bewölkt' },
      { value: 'Bedeckt',        label: '☁️ Bedeckt' },
      { value: 'Regen',          label: '🌧 Regen' },
      { value: 'Gewitter',       label: '⛈ Gewitter' },
      { value: 'Schnee',         label: '🌨 Schnee' },
    ]
  }

  async function fetchSuggestions(value) {
    if (value.length < 2) { setSuggestions([]); return }
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(value)}&count=5&language=de`)
    const data = await res.json()
    setSuggestions(data.results ?? [])
    setShowSuggestions(true)
  }

  async function loadForecast(targetCity) {
    const q = targetCity ?? city
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/forecast?city=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation wird von deinem Browser nicht unterstützt.')
      return
    }
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=de`
          )
          const geo = await res.json()
          const name = geo.city || geo.locality || geo.principalSubdivision
          if (!name) throw new Error('Standort konnte nicht erkannt werden.')
          setCity(name)
          await loadForecast(name)
        } catch (e) {
          setError(e.message)
        } finally {
          setLocating(false)
        }
      },
      () => {
        setError('Standort nicht verfügbar. Bitte Zugriff erlauben.')
        setLocating(false)
      }
    )
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
      if (res.status === 429) {
        setFbStatus({ ok: false, msg: json.error })
      } else if (json.error) {
        setFbStatus({ ok: false, msg: json.error })
      } else {
        setFbStatus({ ok: true, msg: json.message })
        loadForecast()
      }
    } catch {
      setFbStatus({ ok: false, msg: 'Fehler beim Senden' })
    } finally {
      setFbLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-baseline justify-between mb-1">
          <h1 className="text-4xl font-bold">
            Meta<span className="text-emerald-400">Blend</span>
          </h1>
          <Link href="/leaderboard" className="text-zinc-500 text-xs hover:text-emerald-400 transition-colors tracking-widest uppercase">
            Rangliste →
          </Link>
        </div>
        <p className="text-zinc-500 text-sm mb-8 tracking-widest uppercase">
          Wetterwahrheit durch Konsensus
        </p>

        {/* Search */}
        <div className="relative flex gap-2 mb-10">
          <button
            onClick={handleLocation}
            disabled={locating || loading}
            title="Aktuellen Standort verwenden"
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-lg hover:border-emerald-400 transition-colors disabled:opacity-40 shrink-0"
          >
            {locating ? <span className="text-xs text-zinc-400">…</span> : '📍'}
          </button>
          <div className="relative flex-1">
            <input
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-colors"
              placeholder="Stadt eingeben… z.B. Wien, Berlin, Zürich"
              value={city}
              onChange={e => { setCity(e.target.value); fetchSuggestions(e.target.value) }}
              onKeyDown={e => { if (e.key === 'Enter') { setShowSuggestions(false); loadForecast() } }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden z-50">
                {suggestions.map(s => (
                  <button
                    key={s.id}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-800 transition-colors flex justify-between items-center"
                    onMouseDown={() => {
                      setCity(s.name)
                      setShowSuggestions(false)
                      setTimeout(() => loadForecast(s.name), 50)
                    }}
                  >
                    <span>{s.name}</span>
                    <span className="text-zinc-500 text-xs">{s.admin1 ? `${s.admin1}, ` : ''}{s.country}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => { setShowSuggestions(false); loadForecast() }}
            disabled={loading}
            className="bg-emerald-400 text-black font-bold px-5 rounded-lg text-sm hover:bg-emerald-300 transition-colors disabled:opacity-40 shrink-0"
          >
            {loading ? '↻' : '▶'}
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
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
              <div className="text-emerald-400 text-xs tracking-widest uppercase mb-4">
                ⊕ Gewichteter Konsensus · {data.city}, {data.country}
              </div>
              <div className="flex flex-wrap items-start gap-6 mb-5">
                <div>
                  <div className="text-5xl sm:text-8xl font-bold leading-none">
                    {data.consensus.temp}°
                  </div>
                  {data.consensus.feelsLike !== undefined && (
                    <div className="text-zinc-500 text-sm mt-1">
                      Gefühlt {data.consensus.feelsLike}°
                    </div>
                  )}
                </div>
                <div className="pt-1 sm:pt-2">
                  <div className="flex gap-4 sm:gap-6 flex-wrap">
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
              {(data.sunrise || data.sunset) && (
                <div className="border-t border-zinc-800 pt-4 flex gap-6 text-sm">
                  <span className="text-zinc-400">🌅 {data.sunrise}</span>
                  <span className="text-zinc-400">🌇 {data.sunset}</span>
                </div>
              )}
            </div>

            {/* 7-Tage Vorhersage */}
            {data.forecast7 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-8">
                <div className="text-emerald-400 text-xs tracking-widest uppercase mb-6">
                  📅 7-Tage Vorhersage
                </div>
                <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                  <div className="grid grid-cols-7 gap-1 min-w-[360px]">
                    {data.forecast7.map((day, i) => {
                      const date = new Date(day.date)
                      const label = i === 0 ? 'Heute'
                        : date.toLocaleDateString('de', { weekday: 'short' })
                      return (
                        <div key={day.date} className={`flex flex-col items-center gap-2 p-2 rounded-xl ${i === 0 ? 'bg-zinc-800 border border-emerald-400/30' : 'hover:bg-zinc-800 transition-colors'}`}>
                          <div className={`text-xs uppercase tracking-wider ${i === 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                            {label}
                          </div>
                          <div className="text-xl">{day.icon}</div>
                          <div className="text-sm font-bold">{day.tempMax}°</div>
                          <div className="text-xs text-zinc-500">{day.tempMin}°</div>
                          <div className="text-xs text-blue-400">{day.rainPct}%</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

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
                        <div className="font-bold">{src.displayName ?? src.apiId}</div>
                        <div className={`text-xs ${diffColor}`}>
                          {diff <= 1 ? '≈ Konsens' : `±${diff.toFixed(1)}°`}
                        </div>
                      </div>
                      <div className="text-4xl font-bold mb-1">{src.temp}°</div>
                      {src.feelsLike !== undefined && (
                        <div className="text-zinc-600 text-xs mb-1">Gefühlt {src.feelsLike}°</div>
                      )}
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
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
              <div className="text-emerald-400 text-xs tracking-widest uppercase mb-2">
                📍 Wie ist das Wetter gerade bei dir?
              </div>
              <p className="text-zinc-500 text-sm mb-6">
                Dein Feedback wird mit der aktuellen Stunden-Prognose verglichen.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
                    {getWeatherOptions().map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
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
