'use client'

import { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react'
import Link from 'next/link'
import { STORES } from '@/lib/hike/stores'
import {
  RefreshCw,
  Search, Navigation, ArrowLeftRight, Star, Share2, Code2,
  AlertTriangle, WifiOff, Loader2,
  CheckCircle2, Send, Gauge, CloudRain, Layers,
  Sparkles, ChevronDown, X, Info,
} from 'lucide-react'
import { t, detectLang, preferredLang, langChoice, LANG_SYSTEM, translateCondition, loadLanguage } from '@/lib/i18n'
import { getCookie, setCookie, clearCookie } from '@/lib/prefs'
import { countSources } from '@/lib/sources'
import { nativeShare, isNative, nativePosition } from '@/lib/native'
import { askName, nearParam, placeAt, rememberName, withNear } from '@/lib/geo'
import { useRouter } from 'next/navigation'
import { bumpCityView } from '@/lib/push-client'
import { syncWidgets } from '@/lib/app-widget-client'
import { cityName, countryName } from '@/lib/city-names'
import { useHans } from '@/lib/useHans'
import { startCity, isAppView, deepLinkCity, firstLoad } from '@/lib/app-client'
import { SESSION, rememberForecast, resumeForecast, startLoad, isLatestLoad, currentLoad } from '@/lib/forecast-session'
import { publishPrefs, knownLang, knownUnit } from '@/lib/ui-prefs'
import { skyFor, isDark } from '@/lib/sky'
import { useSky } from '@/lib/useSky'
import { tempFormatter, deltaFormatter, spanFormatter, fill } from '@/lib/outlook/text'
import { atNow } from '@/lib/outlook/at-now'
import { TermsBar } from './components/TermsNotice'
import Footer from './components/Footer'
import SiteHeader from './components/SiteHeader'
import PlaceName from './components/PlaceName'
import { SectionTitle, Fold } from './components/ui'
import NowLine from './components/outlook/NowLine'
import WarningStrip from './components/outlook/WarningStrip'
import RangeTabs, { RANGES } from './components/outlook/RangeTabs'
import TabToday from './components/outlook/TabToday'
import TabTomorrow from './components/outlook/TabTomorrow'
import Tab7d from './components/outlook/Tab7d'
import SourcesPanel from './components/outlook/SourcesPanel'
import FeedbackPanel from './components/outlook/FeedbackPanel'
import { OutlookError } from './components/outlook/Status'
import SkyLoader from './components/SkyLoader'
import NowDetails from './components/outlook/NowDetails'
import HowItWorks from './components/HowItWorks'
import { DataAge } from './components/RefreshClock'
import EmbedPanel from './components/EmbedPanel'
import PushPrompt from './components/push/PushPrompt'
import { cityShareUrl, shareText } from '@/lib/share'
import { heroCondition } from '@/lib/conditions'

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
// Only what the user searched or tapped; links, notifications and refreshes
// don't add to it. The last city viewed (any way) is kept per session apart.
const LAST_KEY = 'metablend_last'
function getRecent() {
  try { return JSON.parse(getCookie('metablend_recent') ?? '[]') } catch { return [] }
}
function pushRecent(city) {
  if (!city) return getRecent()
  const list = [city, ...getRecent().filter(c => c.toLowerCase() !== city.toLowerCase())].slice(0, 5)
  setCookie('metablend_recent', JSON.stringify(list))
  return list
}
// Removing the last one, or all of them, also forgets the last city viewed: the
// next visit starts as a first one (the landing page, or the app's first screen).
function removeRecent(city) {
  const list = getRecent().filter(c => c.toLowerCase() !== city.toLowerCase())
  if (list.length) setCookie('metablend_recent', JSON.stringify(list))
  else clearRecent()
  return list
}
function clearRecent() {
  clearCookie('metablend_recent')
  try { sessionStorage.removeItem(LAST_KEY) } catch { /* private mode */ }
  return []
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
const nearQuery = near => (near ? `&near=${near}` : '')
// what a failed load says, in the page's language (the server's text is English)
const loadError = (lang, status, q) =>
  status === 404 ? fill(t(lang, 'cityNotFound'), { city: q }) : t(lang, status === 429 ? 'tooManyRequests' : 'outlookError')
// Where each place was found (a located phone, a picked suggestion), by name,
// kept on the phone: its refreshes, Recent and the app's next start open the
// same town of that name (lib/geo.js). shortcut: widgets, shared links and
// alerts carry the name only — they open the biggest place of that name
const NEAR_KEY = 'metablend_near'
const nearMap = () => { try { return JSON.parse(localStorage.getItem(NEAR_KEY)) ?? {} } catch { return {} } }
const nearOf = q => nearMap()[q.trim().toLowerCase()] ?? null
const rememberNear = (q, near) => { try { localStorage.setItem(NEAR_KEY, JSON.stringify(withNear(nearMap(), q, near))) } catch { /* private mode */ } }
// The English name of each translated one, so another language still finds the
// place (lib/geo.js). Filled by every successful load.
const NAMES_KEY = 'metablend_names'
const nameMap = () => { try { return JSON.parse(localStorage.getItem(NAMES_KEY)) ?? {} } catch { return {} } }
const keepName = (json, lang) => { try { localStorage.setItem(NAMES_KEY, JSON.stringify(rememberName(nameMap(), json.city, json.learnCity, lang))) } catch { /* private mode */ } }
const TAB_KEY = 'mb_tab'

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
// pageLang: the language of /de, /fr ... (the server renders those in it).
// example: the landing page's Vienna forecast, from the server (lib/landing.js).
export default function Home({ pageLang = null, example = null, peaks = 0 }) {
  // back on this tab (the app's tabs unmount it): the last screen from memory
  // at once — empty on a fresh page load, so the first render matches the server's
  const [city, setCity] = useState(() => SESSION.city || '')
  // a first visit starts on the server's Vienna forecast (example), marked until a place of their own loads
  const [data, setData] = useState(() => SESSION.data ?? example?.forecast ?? null)
  const [isExample, setIsExample] = useState(() => !SESSION.data && !!example?.forecast)
  // has a place of the visitor's own loaded on this page? (a ref: the async load reads it after awaits)
  const ownCity = useRef(!!SESSION.data)
  // Any state without a city falls back to the first-visit default: the Vienna example.
  // The app hides it under its own first screen; the returning mark must not hide it on the web.
  function showExample() {
    if (!example?.forecast) return
    setData(example.forecast)
    setOutlook(example.outlook ?? null)
    setIsExample(true)
    setCity('')
    delete document.documentElement.dataset.returning
  }
  // left while the first forecast was loading: back straight to its loader
  const [loading, setLoading] = useState(() => !SESSION.data && !!SESSION.pending)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState(null)
  // The future forecast (today / tomorrow / week) — fetched alongside "right
  // now" and failing independently of it.
  const [outlookBuilt, setOutlook] = useState(() => SESSION.outlook ?? (SESSION.data ? null : example?.outlook ?? null))
  // The outlook as of this quarter hour. Its copy can be two and a half hours old (the CDN's), so
  // "now", the hours ahead and the headlines are worked out again here (lib/outlook/at-now.js), and
  // again when the hour turns on an open page. After mount only: the first render matches the server's.
  const [clock, setClock] = useState(null)
  useEffect(() => {
    const tick = () => setClock(Math.floor(Date.now() / 900e3) * 900e3)
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])
  const outlook = useMemo(() => (clock ? atNow(outlookBuilt, clock) : outlookBuilt), [outlookBuilt, clock])
  const [outlookError, setOutlookError] = useState(null)
  const [tab, setTab] = useState(() => SESSION.tab ?? 'today')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  // the shared value first: a language or unit just changed on another tab beats this tab's memory
  const [lang, setLang] = useState(() => knownLang() ?? SESSION.lang ?? pageLang ?? 'en')
  const hans = useHans(lang) // names the browser got from the geocoder, in simplified Chinese (lib/useHans.js)
  // The search box shows a loaded place as the reader reads it (the forecast's cityShown: simplified Chinese);
  // a search for that text asks by the name the place goes by (city), the one that finds it again
  const askedAs = useRef({})
  const [langPick, setLangPick] = useState(LANG_SYSTEM) // what the picker shows: a language, or follow the phone
  const [unit, setUnit] = useState(() => knownUnit() ?? SESSION.unit ?? 'C')
  // restore or load — decided once, together with the state restored above, so
  // the two can't disagree (a load finishing in between left a loader stuck)
  useLayoutEffect(() => {
    if (document.documentElement.dataset.app !== '1' && deepLinkCity(window.location.search)) document.documentElement.dataset.returning = '1'
  }, [])
  const [resume] = useState(() => resumeForecast({ deepLink: typeof window === 'undefined' ? null : deepLinkCity(window.location.search) }))
  const router = useRouter()
  const [offline, setOffline] = useState(false)
  const [recent, setRecent] = useState([])
  const [favorites, setFavorites] = useState([])
  const [installPrompt, setInstallPrompt] = useState(null)
  const [toast, setToast] = useState(null)
  const [showEmbed, setShowEmbed] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [compareCity, setCompareCity] = useState('')
  const [compareData, setCompareData] = useState(null)
  const [compareLoading, setCompareLoading] = useState(false)
  // Refresh / auto-refresh
  const [refreshing, setRefreshing] = useState(false)      // silent background re-fetch
  const [nextRefreshAt, setNextRefreshAt] = useState(() => SESSION.nextRefreshAt) // ms timestamp of next auto-refresh
  const [justUpdated, setJustUpdated] = useState(false)    // drives the "Updated just now" flash
  const autoRefreshRef = useRef(() => {})
  const suggestTimer = useRef(null)  // debounce for the geocoding suggestions
  // a language shows once its texts have loaded; the latest pick wins a race
  const langWanted = useRef('en')
  const showLang = code => {
    langWanted.current = code
    loadLanguage(code).then(ok => {
      if (langWanted.current !== code) return
      setLang(ok ? code : 'en')
      publishPrefs({ lang: ok ? code : 'en' }) // the other tabs start in it (lib/ui-prefs.js)
    })
  }
  const suggestSeq = useRef(0)       // drops out-of-order suggestion responses

  // mount: language, unit, recent cities, service worker, online/offline
  useEffect(() => {
    // Deliberate one-time sync from cookies/localStorage AFTER hydration: the
    // server renders the defaults, so reading these in a state initializer
    // would make the client's first render differ from the server HTML.
    /* eslint-disable react-hooks/set-state-in-effect */
    const savedLang = getCookie('metablend_lang')
    const detectedLang = preferredLang(savedLang, pageLang ?? document.documentElement.dataset.pageLang ?? navigator.language) // a language page beats the browser, a choice beats both
    showLang(detectedLang)
    setLangPick(langChoice(savedLang))
    const savedUnit = getCookie('metablend_unit') === 'F' ? 'F' : 'C'
    setUnit(savedUnit)
    publishPrefs({ unit: savedUnit })
    setRecent(getRecent())
    setFavorites(getFavorites())
    try {
      const savedTab = localStorage.getItem(TAB_KEY)
      if (RANGES.some(([id]) => id === savedTab)) setTab(savedTab)
    } catch { /* private mode */ }
    // Deep link: /?city=Vienna loads that city straight away (used by the
    // per-city SEO pages and the RSS feed links).
    // Inside the app the Forecast tab reloads the page, so it brings back the
    // last city looked at.
    if (resume.restore) {
      // the last screen is already showing (state initializers); refresh it quietly when due
      if (resume.refresh) loadForecast(SESSION.city, { silent: true, lang: detectedLang })
    } else {
      // which place, and whether it goes into Recent (lib/app-client.js, tested there)
      const { city: first, remember } = firstLoad({
        search: window.location.search,
        resumed: resume.load,
        last: (() => { try { return sessionStorage.getItem(LAST_KEY) } catch { return null } })(),
        recent: getRecent(),
      })
      if (first) {
        setCity(askName(nameMap(), first, detectedLang))
        loadForecast(first, { lang: detectedLang, remember })
      } else delete document.documentElement.dataset.returning
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    if ('serviceWorker' in navigator) {
      // Not inside the app: it has its own offline screen, and Android drops
      // the app's user agent on service-worker requests (pages would render
      // as the website). Remove one an earlier version registered.
      if (document.documentElement.dataset.app === '1') {
        navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {})
      } else {
        navigator.serviceWorker.register('/sw.js').catch(() => {})
      }
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
    setLangPick(code)
    if (code === LANG_SYSTEM) {
      clearCookie('metablend_lang')
      showLang(detectLang(navigator.language))
    } else {
      showLang(code)
      setCookie('metablend_lang', code)
    }
    // pages rendered by the server in the old language (the hiking teaser) are
    // dropped from the client cache, not reused for the next 3 minutes
    router.refresh()
  }

  function changeUnit(u) {
    setUnit(u)
    setCookie('metablend_unit', u)
    publishPrefs({ unit: u })
  }

  // Recent places: keyboard focus stays in the list, on the next ×, or goes to the search once it's empty
  function forgetRecent(c, i) {
    setRecent(removeRecent(c))
    requestAnimationFrame(() => {
      const rest = document.querySelectorAll('[data-recent-remove]')
      ;(rest[Math.min(i, rest.length - 1)] ?? document.querySelector('.home-search input'))?.focus()
    })
  }
  function forgetAllRecent() {
    setRecent(clearRecent())
    requestAnimationFrame(() => document.querySelector('.home-search input')?.focus())
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
    // the website: back to the visitor's own city, or the landing page if they have none
    if (document.documentElement.dataset.app !== '1') {
      const home = startCity({ deepLink: null, recent: getRecent() })
      if (home) {
        setCity(home)
        loadForecast(home, { remember: false })
        return
      }
    }
    ownCity.current = false
    showExample()
  }

  function changeTab(next) {
    setTab(next)
    try { localStorage.setItem(TAB_KEY, next) } catch { /* private mode */ }
  }

  // celsius value → number shown in the active unit
  const showT = c => c == null ? '–' : unit === 'F' ? Math.round(cToF(c)) : Math.round(c * 10) / 10
  // formatters the outlook tabs and headlines share
  const fmt = useMemo(() => ({ fmtTemp: tempFormatter(unit), fmtDelta: deltaFormatter(unit), fmtSpan: spanFormatter(unit) }), [unit])
  // the sun at the city right now: dark mode glows faintly where it is (lib/useSky.js)
  useSky(outlook ? skyFor({ nowLocal: outlook.nowLocal, sun: outlook.sun }) : null)
  // screen readers pick the voice from it, and hyphens: auto the dictionary
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  // what a later visit to this tab starts from (lib/forecast-session.js)
  useEffect(() => {
    rememberForecast({ city: data?.city ?? '', data, outlook, tab, lang, unit, nextRefreshAt })
  }, [data, outlook, tab, lang, unit, nextRefreshAt])

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
  // `remember` = put it into Recent: what the user searched or tapped, not a
  // ?city= link (notification, widget, shared link) or the app's start city.
  // `lang` defaults to the current language; the first load passes the detected
  // one, since the state still holds the server default ('en') at that moment —
  // and the language decides the place ("Wien" in English is a town in Missouri)
  // `near` = where the place was found (a located phone, a picked suggestion):
  // sent along, and remembered for every later load of that name (nearOf), so
  // a town of the same name elsewhere can't take its place.
  async function loadForecast(targetCity, { silent = false, remember = !silent, lang: asLang = lang, near: nearAt } = {}) {
    const typed = targetCity ?? city
    const q = askedAs.current[typed] ?? typed
    if (!q.trim()) return
    const near = nearAt ?? nearOf(q)
    // a place just picked or located keeps its name: it comes in the current language
    const ask = nearAt ? q : askName(nameMap(), q, asLang)
    if (nearAt) rememberNear(q, nearAt) // kept at once: a load left half-way resumes with it
    // only the latest load shows or keeps its answer (lib/forecast-session.js)
    const load = startLoad()
    if (silent) setRefreshing(true)
    else {
      setLoading(true); setError(null)
      if (!data) rememberForecast({ pending: q })
      // a search is on its way: a suggestion lookup still pending from the last
      // keystrokes must not pop its list open over the loader
      clearTimeout(suggestTimer.current); suggestSeq.current++; setShowSuggestions(false)
    }
    try {
      // "right now" and the outlook in parallel; each part fails on its own
      const [nowRes, outRes] = await Promise.allSettled([
        fetch(`/api/forecast?city=${cityKey(ask)}&lang=${asLang}${nearQuery(near)}`).then(r => r.json().then(j => (j.error ? { error: loadError(asLang, r.status, q) } : j))),
        fetch(`/api/outlook?city=${cityKey(ask)}&lang=${asLang}${nearQuery(near)}`).then(r => r.json()),
      ])
      if (!isLatestLoad(load)) return // a newer load (another city, or this tab left and opened again) wins
      const json = nowRes.status === 'fulfilled' ? nowRes.value : { error: loadError(asLang, 0, q) }
      if (json.error) throw new Error(json.error)
      const out = outRes.status === 'fulfilled' && !outRes.value?.error ? outRes.value : null
      setData(json)
      if (!silent && json.cityShown && json.cityShown !== q) {
        askedAs.current[json.cityShown] = q
        setCity(c => (c === q || c === typed ? json.cityShown : c))
      }
      // kept even if the tab was left meanwhile (the effect below no longer runs then)
      rememberForecast({ city: json.city ?? q, data: json, outlook: out ?? (silent ? SESSION.outlook : null), nextRefreshAt: Date.now() + AUTO_REFRESH_MS, pending: null })
      if (near) rememberNear(json.city ?? q, near)
      keepName(json, asLang)
      if (out) { setOutlook(out); setOutlookError(null) }
      else {
        setOutlookError(outRes.status === 'fulfilled' ? outRes.value?.error ?? 'error' : 'network')
        if (!silent) setOutlook(null) // a failed background refresh keeps the last outlook on screen
      }
      setOffline(false)
      setError(null)
      setIsExample(false)
      ownCity.current = true
      cacheForecast(json.city ?? q, json, out)
      if (remember) setRecent(pushRecent(json.city ?? q))
      try { sessionStorage.setItem(LAST_KEY, json.city ?? q) } catch { /* private mode */ }
      if (!silent) bumpCityView(json.city ?? q).then(() => syncWidgets()) // app only: the soft prompt, the home-city preset, the widgets' recent cities
      // Reset the auto-refresh clock on every successful load (manual, search,
      // or auto), so the countdown always restarts from a full 15 minutes.
      setNextRefreshAt(Date.now() + AUTO_REFRESH_MS)
      if (silent && !json.kept) { // a kept blend (every Open-Meteo source failed) is not "updated just now": its age stays
        setJustUpdated(true)
        setTimeout(() => setJustUpdated(false), 2500)
      }
    } catch (e) {
      // A failed request doesn't mean we're offline — it could be a server or
      // data error while the device is perfectly online. Only treat it as
      // offline when the browser actually reports no connectivity.
      if (!isLatestLoad(load)) return
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
        // online but the request failed: surface the error, stay "online"; with no place of
        // their own on screen (a bad shared link), the example stays under the error
        setOffline(false)
        setError(e.message)
        if (!ownCity.current) showExample()
      }
    } finally {
      if (silent) setRefreshing(false)
      else if (isLatestLoad(load)) { setLoading(false); rememberForecast({ pending: null }) }
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
    // another city loaded meanwhile: this answer is stale (lib/forecast-session.js)
    const load = currentLoad()
    try {
      const out = await fetch(`/api/outlook?city=${cityKey(askName(nameMap(), data.city, lang))}&lang=${lang}${nearQuery(nearOf(data.city))}`).then(r => r.json())
      if (out.error) throw new Error(out.error)
      if (isLatestLoad(load)) setOutlook(out)
    } catch (e) {
      if (isLatestLoad(load)) setOutlookError(e.message)
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

  // 1-second check that fires the silent refresh when it's due. No state: the
  // countdown on screen ticks on its own (components/RefreshClock.jsx), so the
  // page isn't redrawn every second. Only runs while a forecast is on screen.
  useEffect(() => {
    if (!data) return
    const id = setInterval(() => autoRefreshRef.current(), 1000)
    return () => clearInterval(id)
  }, [data])

  async function handleLocation() {
    const native = isNative()
    if (!native && !navigator.geolocation) { setError(t(lang, 'geolocationUnsupported')); return }
    setLocating(true)
    setError(null)
    // inside the app only the native location — the browser API there would
    // show Android's permission prompt a second time after a denial
    const pos = native
      ? await nativePosition()
      : await new Promise(resolve => navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }), () => resolve(null)))
    if (!pos) { setError(t(lang, 'locationUnavailable')); setLocating(false); return }
    try {
      // our own server names the place, from the position rounded to about 10 km: the exact one stays on the device (lib/geo.js)
      const place = await placeAt(pos, lang)
      if (!place) throw new Error('no place name')
      setCity(place.name)
      await loadForecast(place.name, { near: place.near })
    } catch {
      setError(t(lang, 'locationNotDetected')) // the reverse lookup failed or found no place
    } finally {
      setLocating(false)
    }
  }

  function flashToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  // The share sheet on phones (and in the app), the link on the clipboard on
  // desktop. The link opens a page with a live preview card of this city.
  async function shareForecast() {
    if (!data) return
    const url = cityShareUrl({ city: data.city, lang, unit })
    const shown = hans(data.cityShown ?? data.city)
    const title = fill(t(lang, 'shareTitle'), { city: shown })
    const text = shareText(lang, {
      city: shown,
      temp: fmt.fmtTemp(data.consensus.temp),
      condition: translateCondition(lang, heroCondition(data) ?? ''),
      sources: countSources(data.sources),
      agree: data.consensus.confidencePct,
    })
    if (await nativeShare({ title, text, url })) return
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); return } catch (e) { if (e?.name === 'AbortError') return } // cancelled: nothing to copy
    }
    try {
      await navigator.clipboard.writeText(`${text}
${url}`)
      flashToast(t(lang, 'linkCopied'))
    } catch {
      flashToast(t(lang, 'copyFailed'))
    }
  }

  async function loadCompare(targetCity) {
    const q = targetCity ?? compareCity
    if (!q.trim()) return
    setCompareLoading(true)
    try {
      // cityKey, like the main search: the same CDN copy, not a second fan-out
      const res = await fetch(`/api/forecast?city=${cityKey(q)}&lang=${lang}`).catch(() => null)
      const json = res && await res.json().catch(() => null)
      if (!json || json.error) throw new Error(loadError(lang, res?.status ?? 0, q))
      setCompareData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setCompareLoading(false)
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

  // how old the data on screen is (components/RefreshClock.jsx): the blend's own time, the number the
  // page opens with. Until 2026-11-13 the outlook's stood here, which the CDN keeps up to 2.5 hours:
  // "updated 104 min ago" over a blend built a minute before.
  const generatedAt = data?.generatedAt ?? outlook?.generatedAt
  // nothing asked for yet: on the website the landing page takes the search's place (CSS decides, see globals.css)
  const suggestionList = showSuggestions && suggestions.length > 0 && (
    <div className="mb-overlay absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden z-50">
      {suggestions.map(s => (
        <button
          type="button"
          key={s.id}
          className="press-row w-full text-left px-4 py-3 text-sm hover:bg-zinc-800 transition-colors flex justify-between items-center"
          onMouseDown={() => { setCity(s.name); setShowSuggestions(false); setTimeout(() => loadForecast(s.name, { near: nearParam(s.latitude, s.longitude) }), 50) }}
        >
          <span>{hans(s.name)}</span>
          <span className="text-zinc-500 text-xs">{s.admin1 ? `${hans(s.admin1)}, ` : ''}{countryName(s.country_code, lang, hans(s.country))}</span>
        </button>
      ))}
    </div>
  )

  return (
    <main className="home min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="home-col max-w-3xl mx-auto">

        {/* Header */}
        <SiteHeader
          lang={lang} langPick={langPick} onLang={changeLang} unit={unit} onUnit={changeUnit} onInstall={installPrompt ? installApp : null}
          logo={
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight flex flex-wrap items-center gap-2">
              <button
                onClick={resetToStart}
                title={t(lang, 'backToStart')}
                className="cursor-pointer hover:opacity-80 transition-opacity"
              >
                Meta<span className="text-emerald-400">Blend</span>
              </button>
            </h1>
          }
        />
        {isExample && !loading && (
          <div className="landing-view web-only mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm">
            <span>{t(lang, 'exampleNote')}</span>
            <button type="button" onClick={handleLocation} disabled={locating} className="press inline-flex items-center gap-1.5 text-emerald-400 hover:underline">
              <Navigation size={14} aria-hidden /> {t(lang, 'a11yLocate')}
            </button>
          </div>
        )}
        <p className="app-only text-zinc-500 text-sm mb-4 tracking-widest uppercase">
          {t(lang, 'tagline')}
        </p>
        <p className={`web-only text-zinc-400 mt-4 mb-8 max-w-prose`}>{t(lang, 'homeLead')}</p>

        {/* First use in the app (no city yet): one clear way to start. Only CSS shows it
            (html[data-first-use], set before first paint), so it's there from the first
            frame; the phone asks for location only when it's tapped, never by itself. */}
        {!data && !loading && (
          <div className="first-use-only mb-4">
            <button onClick={handleLocation} disabled={locating}
              className="press w-full text-left rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-5 py-4 flex items-center gap-4 disabled:opacity-60">
              {locating
                ? <Loader2 size={22} className="shrink-0 text-emerald-400 animate-spin-slow" aria-hidden />
                : <Navigation size={22} className="shrink-0 text-emerald-400" aria-hidden />}
              <span className="min-w-0">
                <span className="block font-semibold">{t(lang, 'a11yLocate')}</span>
                <span className="block text-sm text-zinc-400 mt-0.5">{t(lang, 'locateCardText')}</span>
              </span>
            </button>
          </div>
        )}

        {/* Search (large text: the field on its own line above the buttons) */}
        <div className={`home-search @container relative flex flex-wrap gap-2 mb-8`}>
          <button
            onClick={handleLocation}
            disabled={locating || loading}
            title={t(lang, 'a11yLocate')}
            aria-label={t(lang, 'a11yLocate')}
            className="press bg-zinc-800 border border-zinc-700 rounded-lg px-3 flex items-center justify-center hover:border-emerald-400 disabled:opacity-40 shrink-0 @max-[18rem]:flex-1 @max-[18rem]:py-3"
          >
            {locating
              ? <Loader2 size={18} className="text-zinc-400 animate-spin-slow" aria-hidden />
              : <Navigation size={18} className="text-zinc-300" aria-hidden />}
          </button>
          <div className="relative flex-1 @max-[18rem]:basis-full @max-[18rem]:order-first">
            <input
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-colors"
              placeholder={t(lang, 'placeholder')}
              value={city}
              onChange={e => { setCity(e.target.value); fetchSuggestions(e.target.value) }}
              onKeyDown={e => { if (e.key === 'Enter') { setShowSuggestions(false); loadForecast() } }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            />
            {suggestionList}
          </div>
          <button
            onClick={() => { setShowSuggestions(false); loadForecast() }}
            disabled={loading}
            aria-label={t(lang, 'a11ySearch')}
            className="press bg-emerald-400 text-black font-bold px-5 rounded-lg text-sm hover:bg-emerald-300 disabled:opacity-40 shrink-0 flex items-center justify-center @max-[18rem]:flex-1 @max-[18rem]:py-3"
          >
            {loading
              ? <Loader2 size={18} className="animate-spin-slow" aria-hidden />
              : <Search size={18} aria-hidden />}
          </button>
          <button
            onClick={() => { setCompareMode(m => !m); setCompareData(null) }}
            title={t(lang, 'compareBtn')}
            aria-label={t(lang, 'compareBtn')}
            aria-pressed={compareMode}
            className={`press px-3 rounded-lg text-xs shrink-0 border inline-flex items-center justify-center gap-1.5 @max-[18rem]:flex-1 @max-[18rem]:py-3 ${
              compareMode ? 'bg-emerald-400 text-black border-emerald-400 font-bold' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-emerald-400'
            }`}
          >
            <ArrowLeftRight size={14} aria-hidden /> <span className="hidden sm:inline">{t(lang, 'compareBtn')}</span>
          </button>
          {data && (
            <button
              onClick={() => setFavorites(toggleFavorite(data.city))}
              title={isFavorite(favorites, data.city) ? t(lang, 'unsaveCity') : t(lang, 'saveCity')}
              aria-label={isFavorite(favorites, data.city) ? t(lang, 'unsaveCity') : t(lang, 'saveCity')}
              className={`press px-3 rounded-lg text-sm shrink-0 border flex items-center justify-center @max-[18rem]:flex-1 @max-[18rem]:py-3 ${
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
          <div className={`flex gap-2 flex-wrap -mt-4 mb-4`}>
            <span className="text-amber-500/70 text-xs uppercase tracking-wider self-center inline-flex items-center gap-1"><Star size={11} fill="currentColor" aria-hidden /> {t(lang, 'favoritesTitle')}:</span>
            {favorites.map(c => (
              <button
                key={c}
                onClick={() => { setCity(c); loadForecast(c) }}
                className="press bg-amber-900/20 border border-amber-500/30 rounded-full px-3 py-1 text-xs text-amber-200 hover:border-amber-400 inline-flex items-center gap-1"
              >
                <Star size={11} fill="currentColor" aria-hidden /> {hans(c)}
              </button>
            ))}
          </div>
        )}

        {/* Recent city chips */}
        {recent.length > 0 && !compareMode && (
          <div className={`flex gap-2 flex-wrap mb-6 ${favorites.length ? '' : '-mt-4'}`}>
            <span className="text-zinc-500 text-xs uppercase tracking-wider self-center">{t(lang, 'recentTitle')}:</span>
            {recent.map((c, i) => (
              <span key={c} className="recent-chip inline-flex items-center bg-zinc-900 border border-zinc-800 rounded-full text-xs text-zinc-300 hover:border-emerald-400">
                <button onClick={() => { setCity(c); loadForecast(c) }} className="press pl-3 pr-1 py-1 rounded-l-full hover:text-emerald-400">
                  {hans(c)}
                </button>
                <button
                  type="button"
                  data-recent-remove
                  onClick={() => forgetRecent(c, i)}
                  aria-label={fill(t(lang, 'recentRemove'), { city: hans(c) })}
                  title={fill(t(lang, 'recentRemove'), { city: c })}
                  className="recent-x press inline-flex items-center justify-center w-7 h-7 -my-1 mr-0.5 rounded-full text-zinc-500 hover:text-emerald-400"
                >
                  <X size={12} aria-hidden />
                </button>
              </span>
            ))}
            <button type="button" onClick={forgetAllRecent} aria-label={t(lang, 'recentClearAllLabel')} className="recent-clear press text-xs text-zinc-500 hover:text-emerald-400 hover:underline underline-offset-2 px-1 py-1.5">
              {t(lang, 'recentClearAll')}
            </button>
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
              aria-label={t(lang, 'compareBtn')}
              className="press bg-emerald-400 text-black font-bold px-5 rounded-lg text-sm hover:bg-emerald-300 shrink-0 flex items-center justify-center"
            >
              <Search size={18} aria-hidden />
            </button>
          </div>
        )}

        {/* Side-by-side comparison */}
        {compareMode && compareLoading && <SkyLoader lang={lang} title={t(lang, 'loadingForecast')} compact />}
        {compareMode && data && compareData && !compareLoading && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[data, compareData].map((d, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5">
                <div className="text-emerald-400 text-xs uppercase tracking-wider mb-2 truncate">{d.city}</div>
                <div className="text-4xl font-bold mb-3">{isAppView() ? showT(d.consensus.temp) : Math.round(showT(d.consensus.temp))}°{unit}</div>
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

        {/* A search in flight: the loader takes the stage, the answer rises in after */}
        {loading && <SkyLoader lang={lang} title={t(lang, 'loadingForecast')} />}


        {/* Welcome / empty state — before any city has been searched */}
        {(!data || isExample) && !loading && !error && !compareMode && (
          <>
            {/* a returning visitor's forecast (first paint, until the effect starts it) */}
            <div className="web-only returning-only"><SkyLoader lang={lang} title={t(lang, 'loadingForecast')} names={[]} compact /></div>
            <div className="app-only"><WelcomeState lang={lang} onPick={c => { setCity(c); loadForecast(c) }} /></div>
          </>
        )}

        {/* Offline banner */}
        {offline && data && (
          <div className="animate-scale-in bg-amber-900/30 border border-amber-500/40 rounded-lg p-3 text-amber-300 text-sm mb-6 flex items-center gap-2">
            <WifiOff size={16} className="shrink-0" aria-hidden /> {t(lang, 'offlineBanner')}
          </div>
        )}

        {/* Results — "right now" shrinks to one line; the future tabs are the page */}
        {data && !loading && (
          <div className={`home-data space-y-4 animate-fade-in-up ${isExample ? 'landing-view' : ''}`}>

            {/* Severe-weather warning */}
            {data.warning?.active && (
              <div className="home-warning bg-red-600/20 border-2 border-red-500 rounded-2xl p-5 sm:p-6 animate-pulse">
                <div className="flex items-center gap-3">
                  <span className="app-only text-3xl">{data.warning.type === 'thunderstorm' ? '⛈' : '🌧'}</span>
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

            <div className="home-now space-y-4">
            {/* Toolbar: city, refresh + data age, share / embed */}
            <div className="home-toolbar flex items-start justify-between gap-3">
              <div className="min-w-0">
                {/* the refresh button stays beside the name; a long name wraps inside its own box (de, cs, ja on a phone),
                    between words only (オーストリア stays whole), a single over-long name still anywhere */}
                <div className="flex items-center gap-2">
                  <h2 className="mb-rise min-w-0 text-3xl sm:text-4xl font-semibold tracking-tight [word-break:keep-all] [overflow-wrap:break-word]">
                    {/* the example comes in English from the server: its name in the reader's language */}
                    <PlaceName city={isExample ? cityName('vienna', lang, data.city) : hans(data.cityShown ?? data.city)} cc={data.cc ?? (isExample ? 'AT' : null)} country={data.country} lang={lang} />
                  </h2>
                  <button
                    onClick={manualRefresh}
                    disabled={refreshing || loading}
                    title={t(lang, 'refreshNow')}
                    aria-label={t(lang, 'refreshNow')}
                    className="press shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-emerald-400 hover:text-emerald-400 disabled:opacity-60"
                  >
                    <RefreshCw size={13} className={refreshing || loading ? 'animate-spin-slow' : ''} aria-hidden />
                  </button>
                </div>
                {generatedAt && <DataAge generatedAt={generatedAt} justUpdated={justUpdated} lang={lang} kept={outlook?.kept} utcOffsetSec={outlook?.utcOffsetSec} />}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={shareForecast}
                  aria-label={t(lang, 'shareBtn')}
                  className="press inline-flex items-center gap-1.5 leading-none bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:border-emerald-400 hover:text-emerald-400"
                >
                  <Share2 size={13} aria-hidden /> <span className="hidden sm:inline">{t(lang, 'shareBtn')}</span>
                </button>
                <button
                  onClick={() => setShowEmbed(s => !s)}
                  aria-label={t(lang, 'embedBtn')} aria-expanded={showEmbed}
                  className="press inline-flex items-center gap-1.5 leading-none bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:border-emerald-400 hover:text-emerald-400"
                >
                  <Code2 size={13} aria-hidden /> <span className="hidden sm:inline">{t(lang, 'embedBtn')}</span>
                </button>
              </div>
            </div>

            {showEmbed && <EmbedPanel city={data.city} lang={lang} unit={unit} />}

            {outlook && <WarningStrip lat={data.lat} lon={data.lon} cc={outlook.cc} lang={lang} todayLocal={outlook.nowLocal.slice(0, 10)}
              onOpen={() => { changeTab('today'); requestAnimationFrame(() => document.getElementById('warnings')?.scrollIntoView({ block: 'start' })) }} />}
            <NowLine data={data} unit={unit} lang={lang} showT={showT} dark={outlook ? isDark(outlook.nowLocal?.slice(11, 16), outlook.sun) : null} />
            </div>

            {/* desktop (64rem+): right now in full beside the hero; the Current details fold below is hidden there (globals.css) */}
            <div className="home-now-details hidden bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-5">
              <NowDetails data={data} unit={unit} lang={lang} />
            </div>

            <div className="home-forecast space-y-4">
              <RangeTabs value={tab} onChange={changeTab} lang={lang} />

              {outlook ? (
                tab === 'tomorrow' ? <TabTomorrow outlook={outlook} unit={unit} lang={lang} fmt={fmt} />
                  : tab === 'd7' ? <Tab7d outlook={outlook} unit={unit} lang={lang} fmt={fmt} />
                    : <TabToday outlook={outlook} now={data} unit={unit} lang={lang} fmt={fmt} />
              ) : outlookError ? (
                <OutlookError lang={lang} onRetry={retryOutlook} />
              ) : (
                <SkyLoader lang={lang} title={t(lang, 'loadingForecast')} names={[]} compact />
              )}

              <PushPrompt lang={lang} unit={unit} />
            </div>

            <div className="home-more space-y-4">
              <Fold icon={Gauge} title={t(lang, 'detailsFold')}>
                <NowDetails data={data} unit={unit} lang={lang} />
              </Fold>

              {/* folded to one line ("20 sources · 92% agree"); open or closed is remembered */}
              <Fold icon={Layers} title={t(lang, 'sourcesFold')} storeKey="mb_sources_open"
                summary={fill(t(lang, 'widgetSources'), { n: countSources(data.sources), agree: data.consensus.confidencePct })}>
                <SourcesPanel data={data} unit={unit} lang={lang} />
              </Fold>
              <Fold icon={Send} title={t(lang, 'feedbackFold')}>
                <FeedbackPanel data={data} unit={unit} lang={lang} onWeights={mergeWeights} />
              </Fold>
            </div>

          </div>
        )}

        {/* the landing page has its own three steps */}
        <div><HowItWorks lang={lang} data={data} /></div>
        {isExample && (
          <div className="landing-view web-only mt-12 max-w-prose space-y-6">
            <section>
              <h2 className="font-semibold tracking-tight mb-3">{t(lang, 'hikeTitle')}</h2>
              <p className="text-sm text-zinc-400 mb-3">{fill(t(lang, 'hikeTeaserSub'), { n: peaks })}</p>
              <Link href="/mountains" className="text-emerald-400 text-sm hover:underline">{t(lang, 'landingAllSummits')}</Link>
            </section>
            <p className="text-sm text-zinc-400">{t(lang, 'landingPersonal')}</p>
          </div>
        )}
        <div className="web-only mt-12 max-w-prose space-y-2 text-sm text-zinc-400">
          <p>{t(lang, 'forecastDisclaimer')}</p>
          {!(STORES.ios && STORES.android) && <Link href="/testers" className={`inline-block text-emerald-400 hover:underline`}>{t(lang, 'testersTryApp')}</Link>}
        </div>

        {/* Plain-language explainer: comprehension for new visitors and the
            only real prose on an otherwise UI-heavy page (search engines
            index this for generic consensus/accuracy queries). */}
        {/* collapsed: the title shows, a tap opens it; still in the HTML for search engines */}
        {/* id: linked from the README as metablend.app/#how-it-works */}
        <div id="how-it-works" className="mt-16 max-w-2xl">
          <Fold icon={Info} title={t(lang, 'howTitle')} keep>
            <div className="space-y-3 text-sm text-zinc-400 leading-relaxed">
              <p>{t(lang, 'howP1')}</p>
              <p>{t(lang, 'howP2')}</p>
              <p>{t(lang, 'howP3')}</p>
            </div>
          </Fold>
        </div>

        <Footer lang={lang} />
      </div>

      {/* Toast */}
      {toast && (
        <div role="status" aria-live="polite" className="app-lift animate-scale-in fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-400 text-black text-sm font-bold px-4 py-2 rounded-lg shadow-lg shadow-emerald-400/20 z-[60] inline-flex items-center gap-2">
          <CheckCircle2 size={15} aria-hidden /> {toast}
        </div>
      )}

      {/* The website's one-time terms notice (the app has its own screen, TermsNotice) */}
      <TermsBar lang={lang} />
    </main>
  )
}
