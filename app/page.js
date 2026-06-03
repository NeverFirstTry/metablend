'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { t, LANGUAGES, getWeatherOptions, detectLang } from '@/lib/i18n'

// ── Cookie helpers ────────────────────────────────────────────────────────────
function getCookie(name) {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}
function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Sk({ className }) {
  return <div className={`bg-zinc-800 animate-pulse rounded-lg ${className}`} />
}
function ForecastSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
        <Sk className="h-3 w-52 mb-6" />
        <Sk className="h-16 w-36 mb-2" />
        <Sk className="h-3 w-24 mb-6" />
        <div className="flex gap-6"><Sk className="h-8 w-14" /><Sk className="h-8 w-20" /><Sk className="h-8 w-12" /></div>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-8">
        <Sk className="h-3 w-36 mb-6" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 p-2">
              <Sk className="h-3 w-8" /><Sk className="h-7 w-7 rounded-full" />
              <Sk className="h-4 w-8" /><Sk className="h-3 w-6" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <Sk className="h-4 w-28 mb-4" /><Sk className="h-10 w-20 mb-2" />
            <Sk className="h-3 w-40 mb-5" /><Sk className="h-1.5 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
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
  const [lang, setLang] = useState('en')
  const [consentGiven, setConsentGiven] = useState(true)

  // Language + consent detection on mount
  useEffect(() => {
    const savedLang = getCookie('metablend_lang')
    const detectedLang = savedLang ?? detectLang(navigator.language)
    setLang(detectedLang)
    setConsentGiven(!!getCookie('metablend_consent'))
  }, [])

  function changeLang(code) {
    setLang(code)
    setCookie('metablend_lang', code)
  }

  function giveConsent() {
    setCookie('metablend_consent', '1')
    setConsentGiven(true)
  }

  const isNight = (() => { const h = new Date().getHours(); return h < 6 || h >= 21 })()

  async function fetchSuggestions(value) {
    if (value.length < 2) { setSuggestions([]); return }
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(value)}&count=5&language=${lang}`)
    const d = await res.json()
    setSuggestions(d.results ?? [])
    setShowSuggestions(true)
  }

  async function loadForecast(targetCity) {
    const q = targetCity ?? city
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/forecast?city=${encodeURIComponent(q)}&lang=${lang}`)
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
    if (!navigator.geolocation) { setError(t(lang, 'geolocationUnsupported')); return }
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=${lang}`)
          const geo = await res.json()
          const name = geo.city || geo.locality || geo.principalSubdivision
          if (!name) throw new Error(t(lang, 'locationNotDetected'))
          setCity(name)
          await loadForecast(name)
        } catch (e) {
          setError(e.message)
        } finally {
          setLocating(false)
        }
      },
      () => { setError(t(lang, 'locationUnavailable')); setLocating(false) }
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
          region: data.region ?? 'global',
        }),
      })
      const json = await res.json()
      if (res.status === 429 || json.error) {
        setFbStatus({ ok: false, msg: json.error })
      } else {
        setFbStatus({ ok: true, msg: json.message })
        loadForecast()
      }
    } catch {
      setFbStatus({ ok: false, msg: 'Error sending feedback.' })
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
          <div className="flex items-center gap-3">
            {/* Language switcher */}
            <select
              value={lang}
              onChange={e => changeLang(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-400 outline-none focus:border-emerald-400 transition-colors cursor-pointer"
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <Link href="/leaderboard" className="text-zinc-500 text-xs hover:text-emerald-400 transition-colors tracking-widest uppercase">
              {t(lang, 'leaderboard')}
            </Link>
          </div>
        </div>
        <p className="text-zinc-500 text-sm mb-8 tracking-widest uppercase">
          {t(lang, 'tagline')}
        </p>

        {/* Search */}
        <div className="relative flex gap-2 mb-10">
          <button
            onClick={handleLocation}
            disabled={locating || loading}
            title="Use current location"
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-lg hover:border-emerald-400 transition-colors disabled:opacity-40 shrink-0"
          >
            {locating ? <span className="text-xs text-zinc-400">…</span> : '📍'}
          </button>
          <div className="relative flex-1">
            <input
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-colors"
              placeholder={t(lang, 'placeholder')}
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
                    onMouseDown={() => { setCity(s.name); setShowSuggestions(false); setTimeout(() => loadForecast(s.name), 50) }}
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

        {/* Skeleton */}
        {loading && !data && <ForecastSkeleton />}

        {/* Results */}
        {data && (
          <div className="space-y-6">

            {/* Consensus Hero */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
              <div className="text-emerald-400 text-xs tracking-widest uppercase mb-4">
                ⊕ {t(lang, 'consensusTitle')} · {data.city}, {data.country}
              </div>
              <div className="flex flex-wrap items-start gap-6 mb-5">
                <div>
                  <div className="text-5xl sm:text-8xl font-bold leading-none">
                    {data.consensus.temp}°
                  </div>
                  {data.consensus.feelsLike !== undefined && (
                    <div className="text-zinc-500 text-sm mt-1">
                      {t(lang, 'feelsLike')} {data.consensus.feelsLike}°
                    </div>
                  )}
                </div>
                <div className="pt-1 sm:pt-2">
                  <div className="flex gap-4 sm:gap-6 flex-wrap">
                    <div>
                      <div className="text-lg">{data.consensus.rainPct}%</div>
                      <div className="text-zinc-500 text-xs uppercase tracking-wider">{t(lang, 'rainLabel')}</div>
                    </div>
                    <div>
                      <div className="text-lg">{data.consensus.windKmh} km/h</div>
                      <div className="text-zinc-500 text-xs uppercase tracking-wider">{t(lang, 'windLabel')}</div>
                    </div>
                    <div>
                      <div className="text-lg" style={{
                        color: data.consensus.confidencePct >= 70 ? '#34d399'
                             : data.consensus.confidencePct >= 45 ? '#fbbf24'
                             : '#f87171'
                      }}>
                        {data.consensus.confidencePct}%
                      </div>
                      <div className="text-zinc-500 text-xs uppercase tracking-wider">{t(lang, 'consensusLabel')}</div>
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

            {/* 7-Day Forecast */}
            {data.forecast7 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-8">
                <div className="text-emerald-400 text-xs tracking-widest uppercase mb-6">
                  {t(lang, 'forecastTitle')}
                </div>
                <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                  <div className="grid grid-cols-7 gap-1 min-w-[360px]">
                    {data.forecast7.map((day, i) => {
                      const date = new Date(day.date)
                      const label = i === 0 ? t(lang, 'todayLabel')
                        : date.toLocaleDateString(lang, { weekday: 'short' })
                      return (
                        <div key={day.date} className={`flex flex-col items-center gap-2 p-2 rounded-xl ${i === 0 ? 'bg-zinc-800 border border-emerald-400/30' : 'hover:bg-zinc-800 transition-colors'}`}>
                          <div className={`text-xs uppercase tracking-wider ${i === 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>{label}</div>
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
                {t(lang, 'sourcesTitle')}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.sources.map(src => {
                  const weight = data.weights[src.apiId] ?? 0.25
                  const diff = Math.abs(src.temp - data.consensus.temp)
                  const diffColor = diff <= 1 ? 'text-emerald-400' : diff <= 2.5 ? 'text-yellow-400' : 'text-red-400'
                  return (
                    <div key={src.apiId} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div className="font-bold">{src.displayName ?? src.apiId}</div>
                        <div className={`text-xs ${diffColor}`}>
                          {diff <= 1 ? t(lang, 'equalsConsensus') : `±${diff.toFixed(1)}°`}
                        </div>
                      </div>
                      <div className="text-4xl font-bold mb-1">{src.temp}°</div>
                      {src.feelsLike !== undefined && (
                        <div className="text-zinc-600 text-xs mb-1">{t(lang, 'feelsLike')} {src.feelsLike}°</div>
                      )}
                      <div className="text-zinc-500 text-sm mb-4">{src.condition} · {src.rainPct}%</div>
                      <div className="flex items-center gap-2">
                        <div className="text-zinc-600 text-xs">{t(lang, 'weightLabel')}</div>
                        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${weight * 100}%` }} />
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
                {t(lang, 'feedbackTitle')}
              </div>
              <p className="text-zinc-500 text-sm mb-6">{t(lang, 'feedbackSub')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-2">
                    {t(lang, 'tempInputLabel')}
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 14"
                    value={feedback.temp}
                    onChange={e => setFeedback(f => ({ ...f, temp: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-2">
                    {t(lang, 'conditionLabel')}
                  </label>
                  <select
                    value={feedback.cond}
                    onChange={e => setFeedback(f => ({ ...f, cond: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-colors"
                  >
                    <option value="">{t(lang, 'conditionPlaceholder')}</option>
                    {getWeatherOptions(lang, isNight).map(o => (
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
                {fbLoading ? t(lang, 'submittingBtn') : t(lang, 'submitBtn')}
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

      {/* Cookie consent banner */}
      {!consentGiven && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 px-4 py-3 flex items-center justify-between gap-4 z-50">
          <p className="text-zinc-400 text-xs">{t(lang, 'cookieText')}</p>
          <button
            onClick={giveConsent}
            className="bg-emerald-400 text-black text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-300 transition-colors shrink-0"
          >
            {t(lang, 'cookieOk')}
          </button>
        </div>
      )}
    </main>
  )
}
