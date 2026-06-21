'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  RefreshCw,
  Search, Navigation, ArrowLeftRight, Star, Share2, Code2, Download,
  Trophy, Map as MapIcon, CalendarDays, AlertTriangle, WifiOff, Loader2,
  CheckCircle2, Send, Wind, Droplets, Gauge, Eye, CloudFog, Snowflake,
  Thermometer, Sun, Flower2, CloudRain, Clock, TrendingUp, Layers,
  Sparkles, Copy, Sunrise, Sunset, Globe,
} from 'lucide-react'
import { t, LANGUAGES, getWeatherOptions, detectLang, translateCondition, uvText, aqiText, pollenText } from '@/lib/i18n'
import RainRadar from './components/RainRadar'
import BetaBanner from './components/BetaBanner'
import Footer from './components/Footer'
import CountUp from './components/CountUp'

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

// ── Favorite cities (localStorage) ────────────────────────────────────────────
function getFavorites() {
  if (typeof localStorage === 'undefined') return []
  try { return JSON.parse(localStorage.getItem('mb_favorites') ?? '[]') } catch { return [] }
}
function toggleFavorite(city) {
  if (!city) return getFavorites()
  const cur = getFavorites()
  const has = cur.some(c => c.toLowerCase() === city.toLowerCase())
  const list = has
    ? cur.filter(c => c.toLowerCase() !== city.toLowerCase())
    : [city, ...cur].slice(0, 8)
  try { localStorage.setItem('mb_favorites', JSON.stringify(list)) } catch {}
  return list
}
function isFavorite(list, city) {
  return !!city && list.some(c => c.toLowerCase() === city.toLowerCase())
}

// ── Temperature units ─────────────────────────────────────────────────────────
const cToF = c => c * 9 / 5 + 32
const fToC = f => (f - 32) * 5 / 9

// Several section-title strings still carry a leading emoji (e.g. "📅 7-Day
// Forecast"). Now that headings render a lucide icon, strip that emoji so we
// don't show two icons. Only removes a leading pictographic glyph — letters,
// digits and accented characters are left intact.
const heading = s => s.replace(/^\p{Extended_Pictographic}[️⃣]*\s*/u, '')

// detail-row color coding
function cloudColor(v) { return v == null ? '#71717a' : v < 30 ? '#34d399' : v < 70 ? '#fbbf24' : '#f87171' }
function visColor(v)   { return v == null ? '#71717a' : v >= 10 ? '#34d399' : v >= 4 ? '#fbbf24' : '#f87171' }

// ── Extra-metric color coding (green / yellow / red) ──────────────────────────
const GREEN = '#34d399', YELLOW = '#fbbf24', RED = '#f87171'
function uvColor(v)     { return v == null ? '#71717a' : v < 3 ? GREEN : v < 6 ? YELLOW : RED }
function aqiColor(v)    { return v == null ? '#71717a' : v <= 40 ? GREEN : v <= 80 ? YELLOW : RED }
function pollenColor(v) { return v == null ? '#71717a' : v < 20 ? GREEN : v < 50 ? YELLOW : RED }
// uvText / aqiText / pollenText now come from lib/i18n (translated, lang-aware)

function MetricCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-zinc-800/60 border border-zinc-800 rounded-xl px-4 py-3 flex-1 min-w-[90px] transition-colors duration-200 hover:border-zinc-700">
      <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon size={13} className="shrink-0" aria-hidden />}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold leading-none tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color }}>{sub}</div>}
    </div>
  )
}

// Section heading shared by every results card — icon + uppercase label, so the
// typographic hierarchy is identical everywhere instead of ad-hoc per section.
function SectionTitle({ icon: Icon, children, className = '' }) {
  return (
    <div className={`text-emerald-400 text-xs tracking-widest uppercase flex items-center gap-2 ${className}`}>
      {Icon && <Icon size={14} className="shrink-0" aria-hidden />}
      <span>{children}</span>
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
// Uses the shared `.skeleton` shimmer (globals.css). The shapes mirror the real
// forecast layout below so there's no jarring reflow when data lands.
function Sk({ className }) {
  return <div className={`skeleton ${className}`} />
}
function ForecastSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* rain-answer block */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 sm:p-8 flex flex-col items-center">
        <Sk className="h-12 w-12 rounded-full mb-3" />
        <Sk className="h-7 w-48 mb-2" />
        <Sk className="h-3 w-24" />
      </div>
      {/* consensus hero */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
        <Sk className="h-3 w-52 mb-6" />
        <div className="flex flex-wrap items-start gap-6">
          <div>
            <Sk className="h-16 w-36 mb-2" />
            <Sk className="h-3 w-24" />
          </div>
          <div className="flex gap-6 pt-2"><Sk className="h-8 w-14" /><Sk className="h-8 w-20" /><Sk className="h-8 w-12" /></div>
        </div>
      </div>
      {/* 7-day */}
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
      {/* source cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <Sk className="h-4 w-28 mb-4" /><Sk className="h-10 w-20 mb-2" />
            <Sk className="h-3 w-40 mb-5" /><Sk className="h-1.5 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Welcome / empty state ────────────────────────────────────────────────────
// Shown before any city is searched, so a first-time visitor sees a real
// product landing rather than a bare search box.
const SAMPLE_CITIES = ['Vienna', 'Berlin', 'London', 'New York', 'Tokyo']
function WelcomeState({ lang, onPick }) {
  const features = [
    { icon: Layers, title: t(lang, 'welcomeF1Title'), sub: t(lang, 'welcomeF1Sub') },
    { icon: Gauge, title: t(lang, 'welcomeF2Title'), sub: t(lang, 'welcomeF2Sub') },
    { icon: CloudRain, title: t(lang, 'welcomeF3Title'), sub: t(lang, 'welcomeF3Sub') },
  ]
  return (
    <div className="animate-fade-in-up text-center py-2 sm:py-4">
      <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-400/10 border border-emerald-400/30 mb-5">
        <Sparkles className="text-emerald-400" size={28} aria-hidden />
      </div>
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3 text-balance">
        {t(lang, 'welcomeTitle')}
      </h2>
      <p className="text-zinc-400 text-sm sm:text-base max-w-md mx-auto leading-relaxed mb-8">
        {t(lang, 'welcomeSub')}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 text-left">
        {features.map((f, i) => (
          <div
            key={f.title}
            className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 animate-fade-in-up"
            style={{ animationDelay: `${120 + i * 90}ms` }}
          >
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-400/10 text-emerald-400 mb-3">
              <f.icon size={18} aria-hidden />
            </div>
            <div className="font-bold text-sm mb-1">{f.title}</div>
            <div className="text-zinc-500 text-xs leading-relaxed">{f.sub}</div>
          </div>
        ))}
      </div>

      <div className="text-zinc-600 text-xs uppercase tracking-widest mb-3">{t(lang, 'welcomeTry')}</div>
      <div className="flex gap-2 flex-wrap justify-center">
        {SAMPLE_CITIES.map(c => (
          <button
            key={c}
            onClick={() => onPick(c)}
            className="press bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 text-xs text-zinc-300 hover:border-emerald-400 hover:text-emerald-400"
          >
            {c}
          </button>
        ))}
      </div>
      <p className="text-zinc-600 text-xs mt-6">{t(lang, 'welcomeHint')}</p>
    </div>
  )
}

// How often a loaded forecast silently re-fetches itself in the background.
const AUTO_REFRESH_MS = 15 * 60 * 1000

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
  const [favorites, setFavorites] = useState([])
  const [installPrompt, setInstallPrompt] = useState(null)
  const [toast, setToast] = useState(null)
  const [showEmbed, setShowEmbed] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [compareCity, setCompareCity] = useState('')
  const [compareData, setCompareData] = useState(null)
  // Refresh / auto-refresh
  const [refreshing, setRefreshing] = useState(false)      // silent background re-fetch
  const [lastUpdated, setLastUpdated] = useState(null)      // ms timestamp of last success
  const [nextRefreshAt, setNextRefreshAt] = useState(null) // ms timestamp of next auto-refresh
  const [justUpdated, setJustUpdated] = useState(false)    // drives the "Updated just now" flash
  const [nowTick, setNowTick] = useState(() => Date.now()) // re-renders the countdown each second
  const autoRefreshRef = useRef(() => {})

  // mount: language, unit, consent, recent cities, service worker, online/offline
  useEffect(() => {
    const savedLang = getCookie('metablend_lang')
    const detectedLang = savedLang ?? detectLang(navigator.language)
    setLang(detectedLang)
    setUnit(getCookie('metablend_unit') === 'F' ? 'F' : 'C')
    setConsentGiven(!!getCookie('metablend_consent'))
    setRecent(getRecent())
    setFavorites(getFavorites())

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    setOffline(!navigator.onLine)
    const goOnline = () => setOffline(false)
    const goOffline = () => setOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    // PWA install: stash the prompt event so we can offer an Install button
    const onInstallable = (e) => { e.preventDefault(); setInstallPrompt(e) }
    const onInstalled = () => setInstallPrompt(null)
    window.addEventListener('beforeinstallprompt', onInstallable)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('beforeinstallprompt', onInstallable)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function installApp() {
    if (!installPrompt) return
    installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null) // can only be used once
  }

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

  // `silent` = background auto-refresh / manual refresh of the city already on
  // screen: keep the current data visible (no skeleton), just spin the icon and
  // flash "Updated just now" on success.
  async function loadForecast(targetCity, { silent = false } = {}) {
    const q = targetCity ?? city
    if (!q.trim()) return
    if (silent) setRefreshing(true)
    else { setLoading(true); setError(null) }
    try {
      const res = await fetch(`/api/forecast?city=${encodeURIComponent(q)}&lang=${lang}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      setOffline(false)
      setError(null)
      cacheForecast(json.city ?? q, json)
      setRecent(pushRecent(json.city ?? q))
      // Reset the auto-refresh clock on every successful load (manual, search,
      // or auto), so the countdown always restarts from a full 15 minutes.
      setLastUpdated(Date.now())
      setNextRefreshAt(Date.now() + AUTO_REFRESH_MS)
      if (silent) {
        setJustUpdated(true)
        setTimeout(() => setJustUpdated(false), 2500)
      }
    } catch (e) {
      // A failed request doesn't mean we're offline — it could be a server or
      // data error while the device is perfectly online. Only treat it as
      // offline when the browser actually reports no connectivity.
      const genuinelyOffline = !navigator.onLine
      const cached = readCachedForecast(q)
      if (genuinelyOffline && cached) {
        // no internet: fall back to the last forecast we stashed for this city
        setData(cached)
        setOffline(true)
        setError(null)
      } else if (silent) {
        // Background refresh failed while online: keep the old data on screen
        // and just try again in a minute rather than the full 15.
        setNextRefreshAt(Date.now() + 60_000)
      } else {
        // online but the request failed: surface the error, stay "online"
        setOffline(false)
        setError(e.message)
      }
    } finally {
      if (silent) setRefreshing(false)
      else setLoading(false)
    }
  }

  function manualRefresh() {
    if (!data || loading || refreshing) return
    loadForecast(data.city, { silent: true })
  }

  // Keep the auto-refresh trigger in a ref so the 1-second ticker always sees
  // the latest state without having to resubscribe the interval each render.
  useEffect(() => {
    autoRefreshRef.current = () => {
      if (!data || offline || loading || refreshing || !nextRefreshAt) return
      if (Date.now() >= nextRefreshAt) loadForecast(data.city, { silent: true })
    }
  })

  // 1-second ticker: drives the countdown display and fires the silent refresh
  // when it reaches zero. Only runs while a forecast is on screen.
  useEffect(() => {
    if (!data) return
    const id = setInterval(() => {
      setNowTick(Date.now())
      autoRefreshRef.current()
    }, 1000)
    return () => clearInterval(id)
  }, [data])

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

  // Countdown to the next auto-refresh, formatted mm:ss (recomputed each tick).
  const remainingMs = nextRefreshAt ? Math.max(0, nextRefreshAt - nowTick) : 0
  const countdownStr = `${Math.floor(remainingMs / 60000)}:${String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, '0')}`
  const lastUpdatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-1">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight flex items-center gap-2">
            Meta<span className="text-emerald-400">Blend</span>
            <span className="text-[10px] font-bold tracking-widest uppercase bg-amber-400/15 text-amber-300 border border-amber-400/40 rounded px-1.5 py-0.5 self-center">
              Beta
            </span>
          </h1>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Unit toggle */}
            <div className="flex rounded-lg overflow-hidden border border-zinc-800 shrink-0">
              {['C', 'F'].map(u => (
                <button
                  key={u}
                  onClick={() => changeUnit(u)}
                  className={`w-9 py-1 text-xs leading-none text-center transition-colors ${
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
            <Link href="/leaderboard" className="text-zinc-500 text-xs hover:text-emerald-400 transition-colors tracking-widest uppercase inline-flex items-center gap-1.5">
              <Trophy size={13} aria-hidden /> {t(lang, 'leaderboard')}
            </Link>
            <Link href="/heatmap" className="text-zinc-500 text-xs hover:text-emerald-400 transition-colors tracking-widest uppercase inline-flex items-center gap-1.5">
              <MapIcon size={13} aria-hidden /> {t(lang, 'heatmap')}
            </Link>
            <Link href="/planner" className="text-zinc-500 text-xs hover:text-emerald-400 transition-colors tracking-widest uppercase inline-flex items-center gap-1.5">
              <CalendarDays size={13} aria-hidden /> {t(lang, 'planner')}
            </Link>
            {installPrompt && (
              <button
                onClick={installApp}
                className="press text-emerald-400 text-xs border border-emerald-400/40 rounded-lg px-2 py-1 hover:bg-emerald-400/10 tracking-widest uppercase inline-flex items-center gap-1.5"
              >
                <Download size={13} aria-hidden /> {t(lang, 'installApp')}
              </button>
            )}
          </div>
        </div>
        <p className="text-zinc-500 text-sm mb-4 tracking-widest uppercase">
          {t(lang, 'tagline')}
        </p>

        {/* In-development disclaimer */}
        <BetaBanner lang={lang} className="mb-8" />

        {/* Search */}
        <div className="relative flex gap-2 mb-8">
          <button
            onClick={handleLocation}
            disabled={locating || loading}
            title="Use current location"
            aria-label="Use current location"
            className="press bg-zinc-800 border border-zinc-700 rounded-lg px-3 flex items-center justify-center hover:border-emerald-400 disabled:opacity-40 shrink-0"
          >
            {locating
              ? <Loader2 size={18} className="text-zinc-400 animate-spin-slow" aria-hidden />
              : <Navigation size={18} className="text-zinc-300" aria-hidden />}
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
            aria-label="Search"
            className="press bg-emerald-400 text-black font-bold px-5 rounded-lg text-sm hover:bg-emerald-300 disabled:opacity-40 shrink-0 flex items-center justify-center"
          >
            {loading
              ? <Loader2 size={18} className="animate-spin-slow" aria-hidden />
              : <Search size={18} aria-hidden />}
          </button>
          <button
            onClick={() => { setCompareMode(m => !m); setCompareData(null) }}
            title="Compare two cities"
            className={`press px-3 rounded-lg text-xs shrink-0 border inline-flex items-center gap-1.5 ${
              compareMode ? 'bg-emerald-400 text-black border-emerald-400 font-bold' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-emerald-400'
            }`}
          >
            <ArrowLeftRight size={14} aria-hidden /> <span className="hidden sm:inline">{t(lang, 'compareBtn')}</span>
          </button>
          {data && (
            <button
              onClick={() => setFavorites(toggleFavorite(data.city))}
              title={isFavorite(favorites, data.city) ? t(lang, 'unsaveCity') : t(lang, 'saveCity')}
              className={`press px-3 rounded-lg text-sm shrink-0 border flex items-center justify-center ${
                isFavorite(favorites, data.city)
                  ? 'bg-amber-400 text-black border-amber-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-amber-400'
              }`}
            >
              <Star size={16} fill={isFavorite(favorites, data.city) ? 'currentColor' : 'none'} aria-hidden />
            </button>
          )}
        </div>

        {/* Favorite city chips */}
        {favorites.length > 0 && !compareMode && (
          <div className="flex gap-2 flex-wrap -mt-4 mb-4">
            <span className="text-amber-500/70 text-xs uppercase tracking-wider self-center inline-flex items-center gap-1"><Star size={11} fill="currentColor" aria-hidden /> {t(lang, 'favoritesTitle')}:</span>
            {favorites.map(c => (
              <button
                key={c}
                onClick={() => { setCity(c); loadForecast(c) }}
                className="press bg-amber-900/20 border border-amber-500/30 rounded-full px-3 py-1 text-xs text-amber-200 hover:border-amber-400 inline-flex items-center gap-1"
              >
                <Star size={11} fill="currentColor" aria-hidden /> {c}
              </button>
            ))}
          </div>
        )}

        {/* Recent city chips */}
        {recent.length > 0 && !compareMode && (
          <div className={`flex gap-2 flex-wrap mb-6 ${favorites.length ? '' : '-mt-4'}`}>
            <span className="text-zinc-600 text-xs uppercase tracking-wider self-center">{t(lang, 'recentTitle')}:</span>
            {recent.map(c => (
              <button
                key={c}
                onClick={() => { setCity(c); loadForecast(c) }}
                className="press bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1 text-xs text-zinc-300 hover:border-emerald-400 hover:text-emerald-400"
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
              aria-label="Compare"
              className="press bg-emerald-400 text-black font-bold px-5 rounded-lg text-sm hover:bg-emerald-300 shrink-0 flex items-center justify-center"
            >
              <Search size={18} aria-hidden />
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
          <div className="animate-scale-in bg-red-900/30 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm mb-6 flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" aria-hidden /> {error}
          </div>
        )}

        {/* Skeleton */}
        {loading && !data && <ForecastSkeleton />}

        {/* Welcome / empty state — before any city has been searched */}
        {!data && !loading && !error && !compareMode && (
          <WelcomeState lang={lang} onPick={c => { setCity(c); loadForecast(c) }} />
        )}

        {/* Offline banner */}
        {offline && data && (
          <div className="animate-scale-in bg-amber-900/30 border border-amber-500/40 rounded-lg p-3 text-amber-300 text-sm mb-6 flex items-center gap-2">
            <WifiOff size={16} className="shrink-0" aria-hidden /> {t(lang, 'offlineBanner')}
          </div>
        )}

        {/* Results */}
        {data && (
          <div className="space-y-6 animate-fade-in-up">

            {/* Severe-weather warning */}
            {data.warning?.active && (
              <div className="bg-red-600/20 border-2 border-red-500 rounded-2xl p-5 sm:p-6 animate-pulse">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{data.warning.type === 'thunderstorm' ? '⛈' : '🌧'}</span>
                  <div>
                    <div className="text-red-400 font-bold text-lg uppercase tracking-wide flex items-center gap-2">
                      <AlertTriangle size={18} className="shrink-0" aria-hidden /> {t(lang, 'warningTitle')}
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
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SectionTitle icon={Layers}>
                      {t(lang, 'consensusTitle')} · {data.city}, {data.country}
                    </SectionTitle>
                    <button
                      onClick={manualRefresh}
                      disabled={refreshing || loading}
                      title={t(lang, 'refreshNow')}
                      aria-label={t(lang, 'refreshNow')}
                      className="press inline-flex items-center justify-center w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-emerald-400 hover:text-emerald-400 disabled:opacity-60"
                    >
                      <RefreshCw size={13} className={refreshing || loading ? 'animate-spin-slow' : ''} aria-hidden />
                    </button>
                    {!offline && nextRefreshAt && (
                      <span className="text-zinc-600 text-[11px] tabular-nums">
                        {t(lang, 'refreshesIn')} {countdownStr}
                      </span>
                    )}
                  </div>
                  {lastUpdatedStr && (
                    <div className="text-[11px] mt-1 tabular-nums">
                      {justUpdated ? (
                        <span className="text-emerald-400 inline-flex items-center gap-1 animate-fade-in">
                          <CheckCircle2 size={12} aria-hidden /> {t(lang, 'updatedJustNow')}
                        </span>
                      ) : (
                        <span className="text-zinc-600">{t(lang, 'lastUpdated')} {lastUpdatedStr}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={shareForecast}
                    className="press inline-flex items-center gap-1.5 leading-none bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:border-emerald-400 hover:text-emerald-400"
                  >
                    <Share2 size={13} aria-hidden /> {t(lang, 'shareBtn')}
                  </button>
                  <button
                    onClick={() => setShowEmbed(s => !s)}
                    className="press inline-flex items-center gap-1.5 leading-none bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:border-emerald-400 hover:text-emerald-400"
                  >
                    <Code2 size={13} aria-hidden /> {t(lang, 'embedBtn')}
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
                    className="press inline-flex items-center gap-1.5 bg-emerald-400 text-black text-xs font-bold px-3 py-1 rounded hover:bg-emerald-300"
                  >
                    <Copy size={13} aria-hidden /> {t(lang, 'copied').replace('!', '')}
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-start gap-6 mb-5">
                <div>
                  <div className="text-5xl sm:text-8xl font-bold leading-none tabular-nums tracking-tight">
                    <CountUp
                      value={unit === 'F' ? cToF(data.consensus.temp) : data.consensus.temp}
                      decimals={unit === 'F' ? 0 : 1}
                      suffix={`°${unit}`}
                    />
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
                      <div className="text-lg tabular-nums"><CountUp value={data.consensus.rainPct} suffix="%" /></div>
                      <div className="text-zinc-500 text-xs uppercase tracking-wider flex items-center gap-1"><Droplets size={11} aria-hidden /> {t(lang, 'rainLabel')}</div>
                    </div>
                    <div>
                      <div className="text-lg tabular-nums"><CountUp value={data.consensus.windKmh} /> km/h</div>
                      <div className="text-zinc-500 text-xs uppercase tracking-wider flex items-center gap-1"><Wind size={11} aria-hidden /> {t(lang, 'windLabel')}</div>
                    </div>
                    <div>
                      <div className="text-lg tabular-nums" style={{
                        color: data.consensus.confidencePct >= 70 ? '#34d399'
                             : data.consensus.confidencePct >= 45 ? '#fbbf24'
                             : '#f87171'
                      }}>
                        <CountUp value={data.consensus.confidencePct} suffix="%" />
                      </div>
                      <div className="text-zinc-500 text-xs uppercase tracking-wider flex items-center gap-1"><Gauge size={11} aria-hidden /> {t(lang, 'consensusLabel')}</div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Extra metrics: UV, air quality, pollen */}
              {data.extras && (data.extras.uvIndex != null || data.extras.aqi != null || data.extras.pollen != null) && (
                <div className="border-t border-zinc-800 pt-4 mb-4 flex flex-wrap gap-3">
                  <MetricCard
                    icon={Sun}
                    label={t(lang, 'uvLabel')}
                    value={data.extras.uvIndex ?? '–'}
                    sub={uvText(lang, data.extras.uvIndex)}
                    color={uvColor(data.extras.uvIndex)}
                  />
                  <MetricCard
                    icon={Wind}
                    label={t(lang, 'aqiLabel')}
                    value={data.extras.aqi ?? '–'}
                    sub={aqiText(lang, data.extras.aqi)}
                    color={aqiColor(data.extras.aqi)}
                  />
                  <MetricCard
                    icon={Flower2}
                    label={t(lang, 'pollenLabel')}
                    value={data.extras.pollen ?? '–'}
                    sub={pollenText(lang, data.extras.pollen)}
                    color={pollenColor(data.extras.pollen)}
                  />
                </div>
              )}
              {(data.sunrise || data.sunset) && (
                <div className="border-t border-zinc-800 pt-4 flex gap-6 text-sm">
                  <span className="text-zinc-400 inline-flex items-center gap-1.5"><Sunrise size={15} className="text-amber-400" aria-hidden /> {data.sunrise}</span>
                  <span className="text-zinc-400 inline-flex items-center gap-1.5"><Sunset size={15} className="text-orange-400" aria-hidden /> {data.sunset}</span>
                </div>
              )}
            </div>

            {/* Intraday consensus trend */}
            {data.historyToday && data.historyToday.length >= 2 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
                <SectionTitle icon={TrendingUp} className="mb-4">{heading(t(lang, 'consensusTrendTitle'))}</SectionTitle>
                <Sparkline points={data.historyToday} transform={v => unit === 'F' ? cToF(v) : v} unit={unit} />
              </div>
            )}

            {/* Details */}
            {data.details && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
                <SectionTitle icon={Layers} className="mb-4">{heading(t(lang, 'detailsTitle'))}</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <MetricCard icon={CloudFog} label={t(lang, 'cloudLabel')}
                    value={data.details.cloudCover != null ? `${data.details.cloudCover}%` : '–'}
                    color={cloudColor(data.details.cloudCover)} />
                  <MetricCard icon={Eye} label={t(lang, 'visibilityLabel')}
                    value={data.details.visibilityKm != null ? `${data.details.visibilityKm} km` : '–'}
                    color={visColor(data.details.visibilityKm)} />
                  <MetricCard icon={Droplets} label={t(lang, 'precipLabel')}
                    value={data.details.precipMm != null ? `${data.details.precipMm} mm` : '–'}
                    color={data.details.precipMm > 0 ? '#60a5fa' : '#34d399'} />
                  <MetricCard icon={Snowflake} label={t(lang, 'snowfallLabel')}
                    value={data.details.snowfallMm != null ? `${data.details.snowfallMm} mm` : '–'}
                    color={data.details.snowfallMm > 0 ? '#93c5fd' : '#71717a'} />
                  <MetricCard icon={Thermometer} label={t(lang, 'groundTempLabel')}
                    value={data.details.groundTemp != null ? `${showT(data.details.groundTemp)}°${unit}` : '–'}
                    color="#a1a1aa" />
                </div>
              </div>
            )}

            {/* 7-Day Forecast */}
            {data.forecast7 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-8">
                <div className="flex items-center justify-between gap-3 mb-6">
                  <SectionTitle icon={CalendarDays}>{heading(t(lang, 'forecastTitle'))}</SectionTitle>
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
                  <SectionTitle icon={Globe} className="mb-4">{heading(t(lang, 'climateTitle'))}</SectionTitle>
                  <div className="flex flex-wrap gap-3 mb-4">
                    <MetricCard icon={Thermometer} label={t(lang, 'climateAvgLabel')} value={`${showT(data.climate.avgTemp)}°${unit}`} color="#a1a1aa" />
                    <MetricCard icon={CloudRain} label={t(lang, 'climateRainyLabel')} value={data.climate.avgRainyDays ?? '–'} color="#60a5fa" />
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
                  <SectionTitle icon={Trophy} className="mb-4">{heading(t(lang, 'recordsTitle'))}</SectionTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {r.hottest && (
                      <div className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4">
                        <div className="text-orange-400 text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5"><Thermometer size={13} aria-hidden /> {t(lang, 'recordHottest')}</div>
                        <div className="text-2xl font-bold tabular-nums">{showT(r.hottest.temp)}°{unit}</div>
                        <div className="text-zinc-600 text-xs mt-1">{fmtDate(r.hottest.date)}</div>
                      </div>
                    )}
                    {r.coldest && (
                      <div className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4">
                        <div className="text-blue-400 text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5"><Snowflake size={13} aria-hidden /> {t(lang, 'recordColdest')}</div>
                        <div className="text-2xl font-bold tabular-nums">{showT(r.coldest.temp)}°{unit}</div>
                        <div className="text-zinc-600 text-xs mt-1">{fmtDate(r.coldest.date)}</div>
                      </div>
                    )}
                    {r.wettest && (
                      <div className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4">
                        <div className="text-cyan-400 text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5"><CloudRain size={13} aria-hidden /> {t(lang, 'recordWettest')}</div>
                        <div className="text-2xl font-bold tabular-nums">{r.wettest.mm} mm</div>
                        <div className="text-zinc-600 text-xs mt-1">{fmtDate(r.wettest.date)}</div>
                      </div>
                    )}
                  </div>
                  {near && (
                    <div className="mt-4 text-sm text-orange-300 flex items-center gap-1.5"><AlertTriangle size={14} aria-hidden /> {t(lang, 'recordNear')}</div>
                  )}
                </div>
              )
            })()}

            {/* Best time of day */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
              <SectionTitle icon={Clock} className="mb-2">{heading(t(lang, 'bestTimeTitle'))}</SectionTitle>
              <p className="text-zinc-500 text-sm mb-5">{t(lang, 'bestTimeSub')}</p>
              {data.bestTime ? (
                <div className="flex items-center gap-5">
                  <div className="text-5xl">{data.bestTime.icon}</div>
                  <div>
                    <div className="text-3xl font-bold tabular-nums">
                      {String(data.bestTime.hour).padStart(2, '0')}:00
                    </div>
                    <div className="text-zinc-400 text-sm mt-1 flex items-center gap-2 flex-wrap tabular-nums">
                      <span>{showT(data.bestTime.temp)}°{unit}</span>
                      <span className="text-zinc-600">·</span>
                      <span className="inline-flex items-center gap-1"><Droplets size={13} aria-hidden /> {data.bestTime.rainPct}%</span>
                      <span className="text-zinc-600">·</span>
                      <span className="inline-flex items-center gap-1"><Wind size={13} aria-hidden /> {data.bestTime.windKmh} km/h</span>
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
              <div className="text-zinc-500 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                <Layers size={14} aria-hidden /> {t(lang, 'sourcesTitle')}
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
                      <div className="text-4xl font-bold mb-1 tabular-nums">{showT(src.temp)}°{unit}</div>
                      {src.feelsLike !== undefined && (
                        <div className="text-zinc-600 text-xs mb-1">{t(lang, 'feelsLike')} {showT(src.feelsLike)}°{unit}</div>
                      )}
                      <div className="text-zinc-500 text-sm mb-4">{translateCondition(lang, src.condition)} · {src.rainPct}%</div>
                      <div className="flex items-center gap-2">
                        <div className="text-zinc-600 text-xs">{t(lang, 'weightLabel')}</div>
                        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full transition-[width] duration-700 ease-out" style={{ width: `${weight * 100}%` }} />
                        </div>
                        <div className="text-emerald-400 text-xs tabular-nums">{(weight * 100).toFixed(0)}%</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Feedback */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
              <SectionTitle icon={CloudRain} className="mb-2">{heading(t(lang, 'feedbackTitle'))}</SectionTitle>
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
                className="press w-full bg-emerald-400 text-black font-bold py-3 rounded-lg text-sm hover:bg-emerald-300 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {fbLoading
                  ? <Loader2 size={16} className="animate-spin-slow" aria-hidden />
                  : <Send size={16} aria-hidden />}
                {(fbLoading ? t(lang, 'submittingBtn') : t(lang, 'submitBtn')).replace(/^[^\p{L}]+\s*/u, '')}
              </button>
              {fbStatus && (
                <div className={`animate-scale-in mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${fbStatus.ok
                  ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-900/30 text-red-400 border border-red-500/30'}`}>
                  {fbStatus.ok
                    ? <CheckCircle2 size={16} className="shrink-0" aria-hidden />
                    : <AlertTriangle size={16} className="shrink-0" aria-hidden />}
                  <span>{fbStatus.msg}</span>
                </div>
              )}
            </div>

          </div>
        )}

        <Footer />
      </div>

      {/* Toast */}
      {toast && (
        <div className="animate-scale-in fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-400 text-black text-sm font-bold px-4 py-2 rounded-lg shadow-lg shadow-emerald-400/20 z-[60] inline-flex items-center gap-2">
          <CheckCircle2 size={15} aria-hidden /> {toast}
        </div>
      )}

      {/* Cookie consent banner */}
      {!consentGiven && (
        <div className="animate-fade-in-up fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 px-4 py-3 flex items-center justify-between gap-4 z-50">
          <p className="text-zinc-400 text-xs">{t(lang, 'cookieText')}</p>
          <button
            onClick={giveConsent}
            className="press bg-emerald-400 text-black text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-300 shrink-0"
          >
            {t(lang, 'cookieOk')}
          </button>
        </div>
      )}
    </main>
  )
}
