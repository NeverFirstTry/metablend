'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { t, LANGUAGES, getWeatherOptions, detectLang, translateCondition, uvText, aqiText, pollenText } from '@/lib/i18n'
import RainRadar from './components/RainRadar'

// ── Offline forecast cache (localStorage, per city) ───────────────────────────
function cacheForecast(city, json) {
  if (typeof localStorage === 'undefined' || !city) return
  try {
    localStorage.setItem(`mb_forecast_${city.toLowerCase()}`, JSON.stringify({ ts: Date.now(), json }))
    localStorage.setItem('mb_forecast_last', city.toLowerCase())
  } catch { /* quota / private mode */ }
}
function readCachedForecast(city) {
  if (typeof localStorage === 'undefined') return null
  try {
    const key = city ? `mb_forecast_${city.toLowerCase()}` : `mb_forecast_${localStorage.getItem('mb_forecast_last')}`
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw).json : null
  } catch {
    return null
  }
}

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

// ── Recent cities (cookie, last 5, deduped) ───────────────────────────────────
function getRecent() {
  try { return JSON.parse(getCookie('metablend_recent') ?? '[]') } catch { return [] }
}
function pushRecent(city) {
  if (!city) return getRecent()
  const list = [city, ...getRecent().filter(c => c.toLowerCase() !== city.toLowerCase())].slice(0, 5)
  setCookie('metablend_recent', JSON.stringify(list))
  return list
}

// ── Temperature units ─────────────────────────────────────────────────────────
const cToF = c => c * 9 / 5 + 32
const fToC = f => (f - 32) * 5 / 9

// detail-row color coding
function cloudColor(v) { return v == null ? '#71717a' : v < 30 ? '#34d399' : v < 70 ? '#fbbf24' : '#f87171' }
function visColor(v)   { return v == null ? '#71717a' : v >= 10 ? '#34d399' : v >= 4 ? '#fbbf24' : '#f87171' }

// ── Extra-metric color coding (green / yellow / red) ──────────────────────────
const GREEN = '#34d399', YELLOW = '#fbbf24', RED = '#f87171'
function uvColor(v)     { return v == null ? '#71717a' : v < 3 ? GREEN : v < 6 ? YELLOW : RED }
function aqiColor(v)    { return v == null ? '#71717a' : v <= 40 ? GREEN : v <= 80 ? YELLOW : RED }
function pollenColor(v) { return v == null ? '#71717a' : v < 20 ? GREEN : v < 50 ? YELLOW : RED }
// uvText / aqiText / pollenText now come from lib/i18n (translated, lang-aware)

function MetricCard({ label, value, sub, color }) {
  return (
    <div className="bg-zinc-800/60 border border-zinc-800 rounded-xl px-4 py-3 flex-1 min-w-[90px]">
      <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-bold leading-none" style={{ color }}>{value}</div>
      <div className="text-xs mt-1" style={{ color }}>{sub}</div>
    </div>
  )
}

// Tiny SVG line chart for the intraday consensus temperature.
function Sparkline({ points, transform = v => v, unit = '' }) {
  if (!points || points.length < 2) return null
  const w = 600, h = 80, pad = 8
  const vals = points.map(p => transform(p.temp))
  const min = Math.min(...vals), max = Math.max(...vals)
  const range = max - min || 1
  const x = i => pad + (i / (points.length - 1)) * (w - 2 * pad)
  const y = v => h - pad - ((v - min) / range) * (h - 2 * pad)
  const path = vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none">
      <path d={path} fill="none" stroke="#34d399" strokeWidth="2" />
      <circle cx={x(vals.length - 1)} cy={y(vals[vals.length - 1])} r="3" fill="#34d399" />
      <text x={x(0)} y={y(vals[0]) - 4} fill="#71717a" fontSize="11">{Math.round(vals[0])}°{unit}</text>
      <text x={x(vals.length - 1)} y={y(vals[vals.length - 1]) - 4} fill="#34d399" fontSize="11" textAnchor="end">
        {Math.round(vals[vals.length - 1])}°{unit}
      </text>
    </svg>
  )
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
  const [unit, setUnit] = useState('C')
  const [consentGiven, setConsentGiven] = useState(true)
  const [offline, setOffline] = useState(false)
  const [recent, setRecent] = useState([])
  const [toast, setToast] = useState(null)
  const [showEmbed, setShowEmbed] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [compareCity, setCompareCity] = useState('')
  const [compareData, setCompareData] = useState(null)

  // mount: language, unit, consent, recent cities, service worker, online/offline
  useEffect(() => {
    const savedLang = getCookie('metablend_lang')
    const detectedLang = savedLang ?? detectLang(navigator.language)
    setLang(detectedLang)
    setUnit(getCookie('metablend_unit') === 'F' ? 'F' : 'C')
    setConsentGiven(!!getCookie('metablend_consent'))
    setRecent(getRecent())

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    setOffline(!navigator.onLine)
    const goOnline = () => setOffline(false)
    const goOffline = () => setOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  function changeLang(code) {
    setLang(code)
    setCookie('metablend_lang', code)
  }

  function changeUnit(u) {
    setUnit(u)
    setCookie('metablend_unit', u)
  }

  // celsius value → number shown in the active unit
  const showT = c => c == null ? '–' : unit === 'F' ? Math.round(cToF(c)) : Math.round(c * 10) / 10
  // a temperature gap, e.g. ±2.5° — scale only, no +32 offset
  const showDelta = d => unit === 'F' ? d * 9 / 5 : d

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
      setOffline(false)
      cacheForecast(json.city ?? q, json)
      setRecent(pushRecent(json.city ?? q))
    } catch (e) {
      // offline? show the last forecast we stashed for this city
      const cached = readCachedForecast(q)
      if (cached) {
        setData(cached)
        setOffline(true)
        setError(null)
      } else {
        setError(e.message)
      }
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
    // APIs all speak Celsius, so convert before sending if the user typed °F
    const entered = parseFloat(feedback.temp)
    const tempC = unit === 'F' ? Math.round(fToC(entered) * 10) / 10 : entered
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: data.city,
          actualTemp: tempC,
          actualCond: feedback.cond,
          region: data.region ?? 'global',
          lat: data.lat ?? null,
          lon: data.lon ?? null,
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

  function flashToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  // Native share on mobile, clipboard copy on desktop
  async function shareForecast() {
    if (!data) return
    const condition = data.sources?.find(s => s.apiId === 'open-meteo')?.condition ?? data.sources?.[0]?.condition ?? ''
    const text = `Weather in ${data.city} via MetaBlend: ${data.consensus.temp}°C, ${condition}, ${data.consensus.confidencePct}% consensus across ${data.sources.length} APIs - metablend-beta.vercel.app`
    if (navigator.share) {
      try { await navigator.share({ title: 'MetaBlend', text }); return } catch { /* cancelled → fall through */ }
    }
    try {
      await navigator.clipboard.writeText(text)
      flashToast(t(lang, 'copied'))
    } catch {
      flashToast(t(lang, 'copyFailed'))
    }
  }

  async function copyEmbed() {
    if (!data) return
    const src = `https://metablend-beta.vercel.app/widget/${encodeURIComponent(data.city)}`
    const code = `<iframe src="${src}" width="300" height="200" frameborder="0" title="MetaBlend ${data.city}"></iframe>`
    try {
      await navigator.clipboard.writeText(code)
      flashToast(t(lang, 'copied'))
    } catch {
      flashToast(t(lang, 'copyFailed'))
    }
  }

  async function loadCompare(targetCity) {
    const q = targetCity ?? compareCity
    if (!q.trim()) return
    try {
      const res = await fetch(`/api/forecast?city=${encodeURIComponent(q)}&lang=${lang}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setCompareData(json)
    } catch (e) {
      setError(e.message)
    }
  }

  // Escape clears the search and closes suggestions
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        setShowSuggestions(false)
        setCity('')
        setSuggestions([])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-baseline justify-between mb-1">
          <h1 className="text-4xl font-bold">
            Meta<span className="text-emerald-400">Blend</span>
          </h1>
          <div className="flex items-center gap-3">
            {/* Unit toggle */}
            <div className="flex rounded-lg overflow-hidden border border-zinc-800">
              {['C', 'F'].map(u => (
                <button
                  key={u}
                  onClick={() => changeUnit(u)}
                  className={`px-2 py-1 text-xs transition-colors ${
                    unit === u ? 'bg-emerald-400 text-black font-bold' : 'bg-zinc-900 text-zinc-400 hover:text-emerald-400'
                  }`}
                >
                  °{u}
                </button>
              ))}
            </div>
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
            <Link href="/heatmap" className="text-zinc-500 text-xs hover:text-emerald-400 transition-colors tracking-widest uppercase">
              {t(lang, 'heatmap')}
            </Link>
            <Link href="/planner" className="text-zinc-500 text-xs hover:text-emerald-400 transition-colors tracking-widest uppercase">
              {t(lang, 'planner')}
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
          <button
            onClick={() => { setCompareMode(m => !m); setCompareData(null) }}
            title="Compare two cities"
            className={`px-3 rounded-lg text-xs shrink-0 border transition-colors ${
              compareMode ? 'bg-emerald-400 text-black border-emerald-400 font-bold' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-emerald-400'
            }`}
          >
            ⇄ {t(lang, 'compareBtn')}
          </button>
        </div>

        {/* Recent city chips */}
        {recent.length > 0 && !compareMode && (
          <div className="flex gap-2 flex-wrap -mt-6 mb-10">
            <span className="text-zinc-600 text-xs uppercase tracking-wider self-center">{t(lang, 'recentTitle')}:</span>
            {recent.map(c => (
              <button
                key={c}
                onClick={() => { setCity(c); loadForecast(c) }}
                className="bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1 text-xs text-zinc-300 hover:border-emerald-400 hover:text-emerald-400 transition-colors"
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Compare second city */}
        {compareMode && (
          <div className="flex gap-2 mb-10 -mt-6">
            <input
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-colors"
              placeholder={t(lang, 'comparePlaceholder')}
              value={compareCity}
              onChange={e => setCompareCity(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') loadCompare() }}
            />
            <button
              onClick={() => loadCompare()}
              className="bg-emerald-400 text-black font-bold px-5 rounded-lg text-sm hover:bg-emerald-300 transition-colors shrink-0"
            >
              ▶
            </button>
          </div>
        )}

        {/* Side-by-side comparison */}
        {compareMode && data && compareData && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[data, compareData].map((d, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5">
                <div className="text-emerald-400 text-xs uppercase tracking-wider mb-2 truncate">{d.city}</div>
                <div className="text-4xl font-bold mb-3">{showT(d.consensus.temp)}°{unit}</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-zinc-500">{t(lang, 'rainLabel')}</span><span>{d.consensus.rainPct}%</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">{t(lang, 'windLabel')}</span><span>{d.consensus.windKmh} km/h</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">{t(lang, 'consensusLabel')}</span><span>{d.consensus.confidencePct}%</span></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm mb-6">
            ⚠ {error}
          </div>
        )}

        {/* Skeleton */}
        {loading && !data && <ForecastSkeleton />}

        {/* Offline banner */}
        {offline && data && (
          <div className="bg-amber-900/30 border border-amber-500/40 rounded-lg p-3 text-amber-300 text-sm mb-6 flex items-center gap-2">
            📡 {t(lang, 'offlineBanner')}
          </div>
        )}

        {/* Results */}
        {data && (
          <div className="space-y-6">

            {/* Severe-weather warning */}
            {data.warning?.active && (
              <div className="bg-red-600/20 border-2 border-red-500 rounded-2xl p-5 sm:p-6 animate-pulse">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{data.warning.type === 'thunderstorm' ? '⛈' : '🌧'}</span>
                  <div>
                    <div className="text-red-400 font-bold text-lg uppercase tracking-wide">
                      ⚠ {t(lang, 'warningTitle')}
                    </div>
                    <div className="text-red-200 text-sm">
                      {data.warning.type === 'thunderstorm' ? t(lang, 'warningStorm') : t(lang, 'warningRain')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Simple rain answer */}
            <div className={`rounded-2xl p-6 sm:p-8 border text-center ${
              data.willRain
                ? 'bg-blue-500/10 border-blue-500/40'
                : 'bg-amber-400/10 border-amber-400/40'
            }`}>
              <div className="text-5xl sm:text-6xl mb-3">
                {data.willRain ? t(lang, 'rainYesEmoji') : t(lang, 'rainNoEmoji')}
              </div>
              <div className={`text-2xl sm:text-3xl font-bold ${data.willRain ? 'text-blue-300' : 'text-amber-300'}`}>
                {data.willRain ? t(lang, 'rainYesTitle') : t(lang, 'rainNoTitle')}
              </div>
              <div className="text-zinc-500 text-sm mt-2">
                {data.consensus.rainPct}% · {data.city}
              </div>
            </div>

            {/* Consensus Hero */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="text-emerald-400 text-xs tracking-widest uppercase">
                  ⊕ {t(lang, 'consensusTitle')} · {data.city}, {data.country}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={shareForecast}
                    className="inline-flex items-center gap-1 leading-none bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:border-emerald-400 hover:text-emerald-400 transition-colors"
                  >
                    <span aria-hidden>↗</span> {t(lang, 'shareBtn')}
                  </button>
                  <button
                    onClick={() => setShowEmbed(s => !s)}
                    className="inline-flex items-center gap-1 leading-none bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:border-emerald-400 hover:text-emerald-400 transition-colors"
                  >
                    <span aria-hidden className="font-mono">{'</>'}</span> {t(lang, 'embedBtn')}
                  </button>
                </div>
              </div>

              {/* Embed code box */}
              {showEmbed && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 mb-5">
                  <div className="text-zinc-500 text-xs uppercase tracking-wider mb-2">{t(lang, 'embedTitle')}</div>
                  <div className="flex justify-center mb-3">
                    <iframe
                      src={`/widget/${encodeURIComponent(data.city)}`}
                      width="300"
                      height="200"
                      title="MetaBlend widget preview"
                      className="rounded-lg border border-zinc-800"
                      style={{ border: 0 }}
                    />
                  </div>
                  <code className="block text-xs text-emerald-300 break-all mb-2">
                    {`<iframe src="https://metablend-beta.vercel.app/widget/${encodeURIComponent(data.city)}" width="300" height="200" frameborder="0"></iframe>`}
                  </code>
                  <button
                    onClick={copyEmbed}
                    className="bg-emerald-400 text-black text-xs font-bold px-3 py-1 rounded hover:bg-emerald-300 transition-colors"
                  >
                    📋 {t(lang, 'copied').replace('!', '')}
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-start gap-6 mb-5">
                <div>
                  <div className="text-5xl sm:text-8xl font-bold leading-none">
                    {showT(data.consensus.temp)}°{unit}
                  </div>
                  {data.consensus.feelsLike !== undefined && (
                    <div className="text-zinc-500 text-sm mt-1">
                      {t(lang, 'feelsLike')} {showT(data.consensus.feelsLike)}°{unit}
                    </div>
                  )}
                  {data.yesterdayTemp != null && (() => {
                    const d = Math.round((data.consensus.temp - data.yesterdayTemp) * 10) / 10
                    if (Math.abs(d) < 0.5) return <div className="text-sm mt-1 text-zinc-500">= {t(lang, 'vsYesterdaySame')}</div>
                    const warmer = d > 0
                    return (
                      <div className="text-sm mt-1" style={{ color: warmer ? '#34d399' : '#60a5fa' }}>
                        {warmer ? '↑' : '↓'} {Math.abs(showDelta(d)).toFixed(1)}°{unit} {warmer ? t(lang, 'vsYesterdayWarmer') : t(lang, 'vsYesterdayColder')}
                      </div>
                    )
                  })()}
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
              {/* Extra metrics: UV, air quality, pollen */}
              {data.extras && (data.extras.uvIndex != null || data.extras.aqi != null || data.extras.pollen != null) && (
                <div className="border-t border-zinc-800 pt-4 mb-4 flex flex-wrap gap-3">
                  <MetricCard
                    label={`☀️ ${t(lang, 'uvLabel')}`}
                    value={data.extras.uvIndex ?? '–'}
                    sub={uvText(lang, data.extras.uvIndex)}
                    color={uvColor(data.extras.uvIndex)}
                  />
                  <MetricCard
                    label={`🌬 ${t(lang, 'aqiLabel')}`}
                    value={data.extras.aqi ?? '–'}
                    sub={aqiText(lang, data.extras.aqi)}
                    color={aqiColor(data.extras.aqi)}
                  />
                  <MetricCard
                    label={`🌸 ${t(lang, 'pollenLabel')}`}
                    value={data.extras.pollen ?? '–'}
                    sub={pollenText(lang, data.extras.pollen)}
                    color={pollenColor(data.extras.pollen)}
                  />
                </div>
              )}
              {(data.sunrise || data.sunset) && (
                <div className="border-t border-zinc-800 pt-4 flex gap-6 text-sm">
                  <span className="text-zinc-400">🌅 {data.sunrise}</span>
                  <span className="text-zinc-400">🌇 {data.sunset}</span>
                </div>
              )}
            </div>

            {/* Intraday consensus trend */}
            {data.historyToday && data.historyToday.length >= 2 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
                <div className="text-emerald-400 text-xs tracking-widest uppercase mb-4">
                  📈 {t(lang, 'consensusTrendTitle')}
                </div>
                <Sparkline points={data.historyToday} transform={v => unit === 'F' ? cToF(v) : v} unit={unit} />
              </div>
            )}

            {/* Details */}
            {data.details && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
                <div className="text-emerald-400 text-xs tracking-widest uppercase mb-4">
                  {t(lang, 'detailsTitle')}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <MetricCard label={`🌫 ${t(lang, 'cloudLabel')}`}
                    value={data.details.cloudCover != null ? `${data.details.cloudCover}%` : '–'}
                    sub="" color={cloudColor(data.details.cloudCover)} />
                  <MetricCard label={`👁 ${t(lang, 'visibilityLabel')}`}
                    value={data.details.visibilityKm != null ? `${data.details.visibilityKm} km` : '–'}
                    sub="" color={visColor(data.details.visibilityKm)} />
                  <MetricCard label={`💧 ${t(lang, 'precipLabel')}`}
                    value={data.details.precipMm != null ? `${data.details.precipMm} mm` : '–'}
                    sub="" color={data.details.precipMm > 0 ? '#60a5fa' : '#34d399'} />
                  <MetricCard label={`🌨 ${t(lang, 'snowfallLabel')}`}
                    value={data.details.snowfallMm != null ? `${data.details.snowfallMm} mm` : '–'}
                    sub="" color={data.details.snowfallMm > 0 ? '#93c5fd' : '#71717a'} />
                  <MetricCard label={`🌡 ${t(lang, 'groundTempLabel')}`}
                    value={data.details.groundTemp != null ? `${showT(data.details.groundTemp)}°${unit}` : '–'}
                    sub="" color="#a1a1aa" />
                </div>
              </div>
            )}

            {/* 7-Day Forecast */}
            {data.forecast7 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-8">
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div className="text-emerald-400 text-xs tracking-widest uppercase">
                    {t(lang, 'forecastTitle')}
                  </div>
                  {data.forecast7.length >= 4 && (() => {
                    const today = data.forecast7[0].tempMax
                    const next3 = data.forecast7.slice(1, 4)
                    const avg = next3.reduce((s, d) => s + d.tempMax, 0) / next3.length
                    const d = avg - today
                    const [label, color] = d > 1.5 ? [t(lang, 'trendWarmer'), '#fb923c']
                      : d < -1.5 ? [t(lang, 'trendColder'), '#60a5fa']
                      : [t(lang, 'trendStable'), '#a1a1aa']
                    return <span className="text-xs" style={{ color }}>{label}</span>
                  })()}
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
                          <div className="text-sm font-bold">{showT(day.tempMax)}°{unit}</div>
                          <div className="text-xs text-zinc-500">{showT(day.tempMin)}°{unit}</div>
                          <div className="text-xs text-blue-400">{day.rainPct}%</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Climate Context */}
            {data.climate && data.climate.avgTemp != null && (() => {
              const diff = Math.round((data.consensus.temp - data.climate.avgTemp) * 10) / 10
              const warmer = diff > 0.5, colder = diff < -0.5
              const word = warmer ? t(lang, 'warmerThanAvg') : colder ? t(lang, 'colderThanAvg') : t(lang, 'likeAvg')
              const color = warmer ? '#fb923c' : colder ? '#60a5fa' : '#a1a1aa'
              return (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
                  <div className="text-emerald-400 text-xs tracking-widest uppercase mb-4">
                    {t(lang, 'climateTitle')}
                  </div>
                  <div className="flex flex-wrap gap-3 mb-4">
                    <MetricCard label={`🌡 ${t(lang, 'climateAvgLabel')}`} value={`${showT(data.climate.avgTemp)}°${unit}`} sub="" color="#a1a1aa" />
                    <MetricCard label={`🌧 ${t(lang, 'climateRainyLabel')}`} value={data.climate.avgRainyDays ?? '–'} sub="" color="#60a5fa" />
                  </div>
                  <p className="text-sm" style={{ color }}>
                    {(warmer || colder) && `${diff > 0 ? '↑' : '↓'} ${Math.abs(showDelta(diff)).toFixed(1)}°${unit} `}{word}
                  </p>
                </div>
              )
            })()}

            {/* Weather Records (last 10 years, this month) */}
            {data.records && (data.records.hottest || data.records.coldest || data.records.wettest) && (() => {
              const r = data.records
              const near = (r.hottest && Math.abs(data.consensus.temp - r.hottest.temp) <= 2) ||
                           (r.coldest && Math.abs(data.consensus.temp - r.coldest.temp) <= 2)
              const fmtDate = d => d ? new Date(d).toLocaleDateString(lang, { day: '2-digit', month: 'short', year: '2-digit' }) : ''
              return (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
                  <div className="text-emerald-400 text-xs tracking-widest uppercase mb-4">
                    {t(lang, 'recordsTitle')}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {r.hottest && (
                      <div className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4">
                        <div className="text-orange-400 text-xs uppercase tracking-wider mb-1">🔥 {t(lang, 'recordHottest')}</div>
                        <div className="text-2xl font-bold">{showT(r.hottest.temp)}°{unit}</div>
                        <div className="text-zinc-600 text-xs mt-1">{fmtDate(r.hottest.date)}</div>
                      </div>
                    )}
                    {r.coldest && (
                      <div className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4">
                        <div className="text-blue-400 text-xs uppercase tracking-wider mb-1">❄️ {t(lang, 'recordColdest')}</div>
                        <div className="text-2xl font-bold">{showT(r.coldest.temp)}°{unit}</div>
                        <div className="text-zinc-600 text-xs mt-1">{fmtDate(r.coldest.date)}</div>
                      </div>
                    )}
                    {r.wettest && (
                      <div className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4">
                        <div className="text-cyan-400 text-xs uppercase tracking-wider mb-1">🌧 {t(lang, 'recordWettest')}</div>
                        <div className="text-2xl font-bold">{r.wettest.mm} mm</div>
                        <div className="text-zinc-600 text-xs mt-1">{fmtDate(r.wettest.date)}</div>
                      </div>
                    )}
                  </div>
                  {near && (
                    <div className="mt-4 text-sm text-orange-300">⚠ {t(lang, 'recordNear')}</div>
                  )}
                </div>
              )
            })()}

            {/* Best time of day */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
              <div className="text-emerald-400 text-xs tracking-widest uppercase mb-2">
                {t(lang, 'bestTimeTitle')}
              </div>
              <p className="text-zinc-500 text-sm mb-5">{t(lang, 'bestTimeSub')}</p>
              {data.bestTime ? (
                <div className="flex items-center gap-5">
                  <div className="text-5xl">{data.bestTime.icon}</div>
                  <div>
                    <div className="text-3xl font-bold">
                      {String(data.bestTime.hour).padStart(2, '0')}:00
                    </div>
                    <div className="text-zinc-400 text-sm mt-1">
                      {showT(data.bestTime.temp)}°{unit} · 🌧 {data.bestTime.rainPct}% · 💨 {data.bestTime.windKmh} km/h
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-zinc-500 text-sm">{t(lang, 'bestTimeNone')}</div>
              )}
            </div>

            {/* Rain radar */}
            {data.lat != null && data.lon != null && (
              <RainRadar lat={data.lat} lon={data.lon} title={t(lang, 'radarTitle')} />
            )}

            {/* Source Cards */}
            <div>
              <div className="text-zinc-500 text-xs uppercase tracking-widest mb-3">
                {t(lang, 'sourcesTitle')}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.sources.map(src => {
                  const weight = data.weights[src.apiId] ?? 0.25

                  // Down source — failed / timed out
                  if (src.down) {
                    return (
                      <div key={src.apiId} className="bg-zinc-900 border border-red-500/30 rounded-xl p-5 opacity-80">
                        <div className="flex justify-between items-start mb-3">
                          <div className="font-bold">{src.displayName ?? src.apiId}</div>
                          <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/40 rounded px-2 py-0.5">● {t(lang, 'sourceDown')}</span>
                        </div>
                        <div className="text-zinc-600 text-sm">{t(lang, 'noResponse')}{src.responseMs ? ` · ${src.responseMs}ms` : ''}</div>
                      </div>
                    )
                  }

                  const diff = Math.abs(src.temp - data.consensus.temp)
                  const diffColor = diff <= 1 ? 'text-emerald-400' : diff <= 2.5 ? 'text-yellow-400' : 'text-red-400'
                  return (
                    <div key={src.apiId} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{src.displayName ?? src.apiId}</span>
                          {src.responseMs != null && (
                            <span className="text-[10px] bg-zinc-800 text-zinc-400 rounded px-1.5 py-0.5">{src.responseMs}ms</span>
                          )}
                        </div>
                        <div className={`text-xs ${diffColor}`}>
                          {diff <= 1 ? t(lang, 'equalsConsensus') : `±${showDelta(diff).toFixed(1)}°${unit}`}
                        </div>
                      </div>
                      <div className="text-4xl font-bold mb-1">{showT(src.temp)}°{unit}</div>
                      {src.feelsLike !== undefined && (
                        <div className="text-zinc-600 text-xs mb-1">{t(lang, 'feelsLike')} {showT(src.feelsLike)}°{unit}</div>
                      )}
                      <div className="text-zinc-500 text-sm mb-4">{translateCondition(lang, src.condition)} · {src.rainPct}%</div>
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
                    {t(lang, 'tempInputLabel')} (°{unit})
                  </label>
                  <input
                    type="number"
                    placeholder={unit === 'F' ? 'e.g. 57' : 'e.g. 14'}
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-400 text-black text-sm font-bold px-4 py-2 rounded-lg shadow-lg z-[60]">
          {toast}
        </div>
      )}

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
