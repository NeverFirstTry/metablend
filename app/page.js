'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import {
  RefreshCw,
  Search, Navigation, ArrowLeftRight, Star, Share2, Code2, Download,
  Trophy, Map as MapIcon, CalendarDays, AlertTriangle, WifiOff, Loader2,
  CheckCircle2, Send, Gauge, Sun, Moon, CloudRain, Layers,
  Sparkles, Copy, Plane, MountainSnow,
} from 'lucide-react'
import { t, LANGUAGES, detectLang } from '@/lib/i18n'
import { getCookie, setCookie } from '@/lib/prefs'
import { nativeShare } from '@/lib/native'
import { tempFormatter, deltaFormatter, spanFormatter, fill } from '@/lib/outlook/text'
import BetaBanner from './components/BetaBanner'
import Footer from './components/Footer'
import { SectionTitle, Fold } from './components/ui'
import NowLine from './components/outlook/NowLine'
import RangeTabs, { RANGES } from './components/outlook/RangeTabs'
import TabToday from './components/outlook/TabToday'
import TabTomorrow from './components/outlook/TabTomorrow'
import Tab7d from './components/outlook/Tab7d'
import SourcesPanel from './components/outlook/SourcesPanel'
import FeedbackPanel from './components/outlook/FeedbackPanel'
import { OutlookSkeleton, OutlookError } from './components/outlook/Status'
import { heroCondition } from './components/outlook/icons'

// ── Offline cache (localStorage, per city): the last "right now" payload and
// the last outlook, so the page still shows something without a connection.
function cacheForecast(city, json, outlook) {
  if (typeof localStorage === 'undefined' || !city) return
  try {
    localStorage.setItem(`mb_forecast_${city.toLowerCase()}`, JSON.stringify({ ts: Date.now(), json, outlook: outlook ?? null }))
    localStorage.setItem('mb_forecast_last', city.toLowerCase())
  } catch { /* quota / private mode */ }
}
function readCachedForecast(city) {
  if (typeof localStorage === 'undefined') return null
  try {
    const key = city ? `mb_forecast_${city.toLowerCase()}` : `mb_forecast_${localStorage.getItem('mb_forecast_last')}`
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { json, outlook } = JSON.parse(raw)
    return json ? { json, outlook: outlook ?? null } : null
  } catch {
    return null
  }
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

// Both APIs are keyed by the lower-cased city so every visitor of a city
// shares one CDN copy.
const cityKey = q => encodeURIComponent(q.trim().toLowerCase())
const TAB_KEY = 'mb_tab'

// ── Skeleton ─────────────────────────────────────────────────────────────────
// Uses the shared `.skeleton` shimmer (globals.css): now line, tabs, headline,
// chart — the shapes of the real layout, so nothing jumps when data lands.
function Sk({ className }) {
  return <div className={`skeleton ${className}`} />
}
function ForecastSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <Sk className="h-14 w-full rounded-2xl" />
      <Sk className="h-11 w-full rounded-xl" />
      <Sk className="h-20 w-full rounded-2xl" />
      <Sk className="h-56 w-full rounded-2xl" />
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

      <div className="text-zinc-500 text-xs uppercase tracking-widest mb-3">{t(lang, 'welcomeTry')}</div>
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
      <p className="text-zinc-500 text-xs mt-6">{t(lang, 'welcomeHint')}</p>
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
  // The future forecast (today / tomorrow / week) — fetched alongside "right
  // now" and failing independently of it.
  const [outlook, setOutlook] = useState(null)
  const [outlookError, setOutlookError] = useState(null)
  const [tab, setTab] = useState('today')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [lang, setLang] = useState('en')
  const [unit, setUnit] = useState('C')
  const [theme, setTheme] = useState('dark') // dark is the default; light is opt-in
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
  const [nextRefreshAt, setNextRefreshAt] = useState(null) // ms timestamp of next auto-refresh
  const [justUpdated, setJustUpdated] = useState(false)    // drives the "Updated just now" flash
  const [nowTick, setNowTick] = useState(() => Date.now()) // re-renders the countdown each second
  const autoRefreshRef = useRef(() => {})
  const suggestTimer = useRef(null)  // debounce for the geocoding suggestions
  const suggestSeq = useRef(0)       // drops out-of-order suggestion responses

  // mount: language, unit, consent, recent cities, service worker, online/offline
  useEffect(() => {
    // Deliberate one-time sync from cookies/localStorage AFTER hydration: the
    // server renders the defaults, so reading these in a state initializer
    // would make the client's first render differ from the server HTML.
    /* eslint-disable react-hooks/set-state-in-effect */
    const savedLang = getCookie('metablend_lang')
    const detectedLang = savedLang ?? detectLang(navigator.language)
    setLang(detectedLang)
    setUnit(getCookie('metablend_unit') === 'F' ? 'F' : 'C')
    setTheme(getCookie('metablend_theme') === 'light' ? 'light' : 'dark')
    setConsentGiven(!!getCookie('metablend_consent'))
    setRecent(getRecent())
    setFavorites(getFavorites())
    try {
      const savedTab = localStorage.getItem(TAB_KEY)
      if (RANGES.some(([id]) => id === savedTab)) setTab(savedTab)
    } catch { /* private mode */ }
    // Deep link: /?city=Vienna loads that city straight away (used by the
    // per-city SEO pages and the RSS feed links).
    const deepLink = new URLSearchParams(window.location.search).get('city')
    if (deepLink) {
      setCity(deepLink)
      loadForecast(deepLink)
    }
    /* eslint-enable react-hooks/set-state-in-effect */

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
    // mount-only by design; loadForecast is stable enough for the one-shot deep link
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setCookie('metablend_theme', next)
    // the CSS keys off <html data-theme="light">; absence means dark
    if (next === 'light') document.documentElement.dataset.theme = 'light'
    else delete document.documentElement.dataset.theme
  }

  // Logo click: back to the start view (clear the loaded forecast + compare)
  function resetToStart() {
    setData(null)
    setCompareData(null)
    setCompareMode(false)
    setCity('')
    setError(null)
    setOutlook(null)
    setOutlookError(null)
    setNextRefreshAt(null)
  }

  function changeTab(next) {
    setTab(next)
    try { localStorage.setItem(TAB_KEY, next) } catch { /* private mode */ }
  }

  // celsius value → number shown in the active unit
  const showT = c => c == null ? '–' : unit === 'F' ? Math.round(cToF(c)) : Math.round(c * 10) / 10
  // a temperature gap, e.g. ±2.5° — scale only, no +32 offset
  const showDelta = d => unit === 'F' ? d * 9 / 5 : d
  // formatters the outlook tabs and headlines share
  const fmt = useMemo(() => ({ fmtTemp: tempFormatter(unit), fmtDelta: deltaFormatter(unit), fmtSpan: spanFormatter(unit) }), [unit])

  function giveConsent() {
    setCookie('metablend_consent', '1')
    setConsentGiven(true)
  }

  // Feedback returns the re-normalized weights; show them on the source cards
  // now (a re-fetch would only bring back the CDN's cached copy).
  function mergeWeights(forCity, weights) {
    setData(d => (d?.city === forCity ? { ...d, weights: { ...d.weights, ...weights } } : d))
  }

  // Debounced so fast typing doesn't fire a geocoding request per keystroke;
  // the sequence counter drops responses that arrive out of order.
  function fetchSuggestions(value) {
    clearTimeout(suggestTimer.current)
    if (value.length < 2) { setSuggestions([]); return }
    suggestTimer.current = setTimeout(async () => {
      const seq = ++suggestSeq.current
      try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(value)}&count=5&language=${lang}`)
        const d = await res.json()
        if (seq !== suggestSeq.current) return
        setSuggestions(d.results ?? [])
        setShowSuggestions(true)
      } catch { /* geocoding hiccup while typing — just show nothing */ }
    }, 250)
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
      // "right now" and the outlook in parallel; each part fails on its own
      const [nowRes, outRes] = await Promise.allSettled([
        fetch(`/api/forecast?city=${cityKey(q)}&lang=${lang}`).then(r => r.json()),
        fetch(`/api/outlook?city=${cityKey(q)}`).then(r => r.json()),
      ])
      const json = nowRes.status === 'fulfilled' ? nowRes.value : { error: nowRes.reason?.message ?? 'Network error' }
      if (json.error) throw new Error(json.error)
      const out = outRes.status === 'fulfilled' && !outRes.value?.error ? outRes.value : null
      setData(json)
      if (out) { setOutlook(out); setOutlookError(null) }
      else {
        setOutlookError(outRes.status === 'fulfilled' ? outRes.value?.error ?? 'error' : 'network')
        if (!silent) setOutlook(null) // a failed background refresh keeps the last outlook on screen
      }
      setOffline(false)
      setError(null)
      cacheForecast(json.city ?? q, json, out)
      setRecent(pushRecent(json.city ?? q))
      // Reset the auto-refresh clock on every successful load (manual, search,
      // or auto), so the countdown always restarts from a full 15 minutes.
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
        setData(cached.json)
        setOutlook(cached.outlook)
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

  // Re-fetch only the outlook (its error card's retry button)
  async function retryOutlook() {
    if (!data) return
    setOutlookError(null)
    try {
      const out = await fetch(`/api/outlook?city=${cityKey(data.city)}`).then(r => r.json())
      if (out.error) throw new Error(out.error)
      setOutlook(out)
    } catch (e) {
      setOutlookError(e.message)
    }
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

  function flashToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  // Native share on mobile, clipboard copy on desktop
  async function shareForecast() {
    if (!data) return
    const condition = heroCondition(data) ?? ''
    const text = `Weather in ${data.city} via MetaBlend: ${data.consensus.temp}°C, ${condition}, ${data.consensus.confidencePct}% consensus across ${data.sources.length} APIs - metablend.app`
    // inside the app: the native share sheet
    if (await nativeShare({ title: 'MetaBlend', text, url: 'https://metablend.app' })) return
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
    const src = `https://metablend.app/widget/${encodeURIComponent(data.city)}`
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
  // How old the data on screen is — with the CDN in front, a fresh fetch can
  // still return a copy computed up to 30 minutes ago, so show its real age.
  const generatedAt = outlook?.generatedAt ?? data?.generatedAt
  const ageMin = generatedAt ? Math.max(0, Math.floor((nowTick - Date.parse(generatedAt)) / 60000)) : null

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-1">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight flex items-center gap-2">
            <button
              onClick={resetToStart}
              title={t(lang, 'backToStart')}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            >
              Meta<span className="text-emerald-400">Blend</span>
            </button>
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
                  aria-pressed={unit === u}
                  className={`w-9 py-1 text-xs leading-none text-center transition-colors ${
                    unit === u ? 'bg-emerald-400 text-black font-bold' : 'bg-zinc-900 text-zinc-400 hover:text-emerald-400'
                  }`}
                >
                  °{u}
                </button>
              ))}
            </div>
            {/* Theme toggle — dark is the default, light is the print view */}
            <button
              onClick={toggleTheme}
              title={t(lang, theme === 'dark' ? 'themeLight' : 'themeDark')}
              aria-label={t(lang, theme === 'dark' ? 'themeLight' : 'themeDark')}
              className="press w-7 h-7 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-emerald-400 hover:border-emerald-400 flex items-center justify-center shrink-0"
            >
              {theme === 'dark'
                ? <Sun size={14} aria-hidden />
                : <Moon size={14} aria-hidden />}
            </button>
            {/* Language switcher */}
            <select
              value={lang}
              onChange={e => changeLang(e.target.value)}
              aria-label={t(lang, 'langLabel')}
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
            <Link href="/hike" className="text-zinc-500 text-xs hover:text-emerald-400 transition-colors tracking-widest uppercase inline-flex items-center gap-1.5">
              <MountainSnow size={13} aria-hidden /> {t(lang, 'hiking')}
            </Link>
            <Link href="/aviation" className="text-zinc-500 text-xs hover:text-emerald-400 transition-colors tracking-widest uppercase inline-flex items-center gap-1.5">
              <Plane size={13} aria-hidden /> {t(lang, 'aviation')}
            </Link>
            {installPrompt && (
              <button
                onClick={installApp}
                className="web-only press text-emerald-400 text-xs border border-emerald-400/40 rounded-lg px-2 py-1 hover:bg-emerald-400/10 tracking-widest uppercase inline-flex items-center gap-1.5"
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
        <BetaBanner lang={lang} className="mb-8 web-only" />

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
            <span className="text-zinc-500 text-xs uppercase tracking-wider self-center">{t(lang, 'recentTitle')}:</span>
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
                  <div className="flex justify-between"><span className="text-zinc-500">{t(lang, 'rainLabel')}</span><span>{d.consensus.rainPct != null ? `${d.consensus.rainPct}%` : '–'}</span></div>
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

        {/* Results — "right now" shrinks to one line; the future tabs are the page */}
        {data && (
          <div className="space-y-4 animate-fade-in-up">

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

            {/* Toolbar: city, refresh + data age, share / embed */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <SectionTitle icon={Layers}>{data.city}{data.country ? `, ${data.country}` : ''}</SectionTitle>
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
                    <span className="text-zinc-500 text-[11px] tabular-nums">
                      {t(lang, 'refreshesIn')} {countdownStr}
                    </span>
                  )}
                </div>
                {ageMin != null && (
                  <div className="text-[11px] mt-1 tabular-nums">
                    {justUpdated ? (
                      <span className="text-emerald-400 inline-flex items-center gap-1 animate-fade-in">
                        <CheckCircle2 size={12} aria-hidden /> {t(lang, 'updatedJustNow')}
                      </span>
                    ) : (
                      <span className="text-zinc-500">{ageMin < 1 ? t(lang, 'updatedJustNow') : fill(t(lang, 'updatedAgo'), { n: ageMin })}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={shareForecast}
                  className="press inline-flex items-center gap-1.5 leading-none bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:border-emerald-400 hover:text-emerald-400"
                >
                  <Share2 size={13} aria-hidden /> <span className="hidden sm:inline">{t(lang, 'shareBtn')}</span>
                </button>
                <button
                  onClick={() => setShowEmbed(s => !s)}
                  className="press inline-flex items-center gap-1.5 leading-none bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:border-emerald-400 hover:text-emerald-400"
                >
                  <Code2 size={13} aria-hidden /> <span className="hidden sm:inline">{t(lang, 'embedBtn')}</span>
                </button>
              </div>
            </div>

            {/* Embed code box */}
            {showEmbed && (
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
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
                  {`<iframe src="https://metablend.app/widget/${encodeURIComponent(data.city)}" width="300" height="200" frameborder="0"></iframe>`}
                </code>
                <button
                  onClick={copyEmbed}
                  className="press inline-flex items-center gap-1.5 bg-emerald-400 text-black text-xs font-bold px-3 py-1 rounded hover:bg-emerald-300"
                >
                  <Copy size={13} aria-hidden /> {t(lang, 'copied').replace('!', '')}
                </button>
              </div>
            )}

            <NowLine data={data} unit={unit} lang={lang} showT={showT} showDelta={showDelta} />

            <RangeTabs value={tab} onChange={changeTab} lang={lang} />

            {outlook ? (
              tab === 'tomorrow' ? <TabTomorrow outlook={outlook} unit={unit} lang={lang} fmt={fmt} />
                : tab === 'd7' ? <Tab7d outlook={outlook} unit={unit} lang={lang} fmt={fmt} />
                  : <TabToday outlook={outlook} now={data} unit={unit} lang={lang} fmt={fmt} />
            ) : outlookError ? (
              <OutlookError lang={lang} onRetry={retryOutlook} />
            ) : (
              <OutlookSkeleton />
            )}

            <Fold icon={Layers} title={t(lang, 'sourcesFold')}>
              <SourcesPanel data={data} unit={unit} lang={lang} showT={showT} showDelta={showDelta} />
            </Fold>
            <Fold icon={Send} title={t(lang, 'feedbackFold')}>
              <FeedbackPanel data={data} unit={unit} lang={lang} onWeights={mergeWeights} />
            </Fold>

          </div>
        )}

        {/* Plain-language explainer: comprehension for new visitors and the
            only real prose on an otherwise UI-heavy page (search engines
            index this for generic consensus/accuracy queries). */}
        <section className="mt-16 max-w-2xl" aria-labelledby="how-title">
          <h2 id="how-title" className="text-lg font-bold mb-3">{t(lang, 'howTitle')}</h2>
          <div className="space-y-3 text-sm text-zinc-400 leading-relaxed">
            <p>{t(lang, 'howP1')}</p>
            <p>{t(lang, 'howP2')}</p>
            <p>{t(lang, 'howP3')}</p>
          </div>
        </section>

        <Footer lang={lang} />
      </div>

      {/* Toast */}
      {toast && (
        <div role="status" aria-live="polite" className="app-lift animate-scale-in fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-400 text-black text-sm font-bold px-4 py-2 rounded-lg shadow-lg shadow-emerald-400/20 z-[60] inline-flex items-center gap-2">
          <CheckCircle2 size={15} aria-hidden /> {toast}
        </div>
      )}

      {/* Cookie consent banner */}
      {!consentGiven && (
        <div className="app-lift animate-fade-in-up fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 px-4 py-3 flex items-center justify-between gap-4 z-50">
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
