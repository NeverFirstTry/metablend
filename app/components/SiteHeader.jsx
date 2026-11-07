'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Sun, Moon, Download } from 'lucide-react'
import { t, LANGUAGES, LANG_SYSTEM, langChoice, detectLang, loadLanguage } from '@/lib/i18n'
import { getCookie, setCookie, clearCookie } from '@/lib/prefs'
import { publishPrefs } from '@/lib/ui-prefs'
import { THEME_COOKIE, applyTheme } from '@/lib/theme'
import { useShownTheme } from '@/lib/useTheme'
import { useLang } from '@/lib/useLang'
import { useUnit } from '@/lib/useUnit'

const NAV = [['/leaderboard', 'leaderboard'], ['/heatmap', 'heatmap'], ['/planner', 'planner'], ['/hike', 'hiking'], ['/aviation', 'aviation']]

// The website's header: logo, site navigation, unit, theme and language. The forecast
// page passes its own logo and state; every other page gets PageHeader below.
export default function SiteHeader({ logo, lang, langPick, onLang, unit, onUnit, onInstall = null }) {
  const theme = useShownTheme() // the device's setting unless the visitor chose one
  // the button flips what's on screen and keeps that as an explicit choice;
  // More → Appearance → System goes back to following the device
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setCookie(THEME_COOKIE, next)
    applyTheme(next)
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-1">
      {logo}
      {/* in the app these live in the tab bar and the More tab */}
      <nav aria-label={t(lang, 'homeNavLabel')} className="web-only order-last w-full lg:order-none lg:w-auto flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {NAV.map(([href, key]) => <Link key={href} href={href} className="text-zinc-400 hover:text-emerald-400 transition-colors">{t(lang, key)}</Link>)}
      </nav>
      <div className="web-only flex items-center gap-2 shrink-0">
        <div className="flex shrink-0">
          {['C', 'F'].map(u => (
            <button
              key={u}
              onClick={() => onUnit(u)}
              aria-pressed={unit === u}
              className={`w-8 py-2 text-sm leading-none text-center transition-colors ${
                unit === u ? 'font-bold' : 'text-zinc-400 hover:text-emerald-400'
              }`}
            >
              °{u}
            </button>
          ))}
        </div>
        <button
          onClick={toggleTheme}
          title={t(lang, theme === 'dark' ? 'themeLight' : 'themeDark')}
          aria-label={t(lang, theme === 'dark' ? 'themeLight' : 'themeDark')}
          className="press w-8 h-8 rounded-lg text-zinc-400 hover:text-emerald-400 flex items-center justify-center shrink-0"
        >
          {theme === 'dark' ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
        </button>
        <select
          value={langPick}
          onChange={e => onLang(e.target.value)}
          aria-label={t(lang, 'langLabel')}
          className="bg-transparent border-0 rounded-lg py-2 text-sm text-zinc-400 hover:text-emerald-400 outline-none cursor-pointer max-w-28"
        >
          <option value={LANG_SYSTEM}>{t(lang, 'themeSystemName')}</option>
          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        {onInstall && (
          <button onClick={onInstall} aria-label={t(lang, 'installApp')} title={t(lang, 'installApp')} className="press text-emerald-400 w-8 h-8 inline-flex items-center justify-center">
            <Download size={16} aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}

// The same header on every page but the forecast (which has its own state) and the
// embed (it lives on other people's sites). Rendered once, by the root layout.
export function PageHeader() {
  const path = usePathname()
  const router = useRouter()
  const lang = useLang()
  const unit = useUnit()
  const [langPick, setLangPick] = useState(LANG_SYSTEM)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the cookie is only readable after hydration
  useEffect(() => setLangPick(langChoice(getCookie('metablend_lang'))), [path]) // the home page has its own picker
  if (path === '/' || /^\/[a-z]{2}$/.test(path) || path.startsWith('/widget')) return null // / and /de … have their own

  const changeLang = code => {
    setLangPick(code)
    if (code === LANG_SYSTEM) clearCookie('metablend_lang')
    else setCookie('metablend_lang', code)
    const next = code === LANG_SYSTEM ? detectLang(navigator.language) : code
    loadLanguage(next).then(ok => {
      const shown = ok ? next : 'en'
      publishPrefs({ lang: shown })
      document.documentElement.lang = shown
    })
    router.refresh() // pages the server renders in the old language
  }
  const changeUnit = u => {
    setCookie('metablend_unit', u)
    publishPrefs({ unit: u })
  }
  return (
    <header className="site-header web-only text-white">
      <div className="site-col">
        <SiteHeader
          logo={<Link href="/" title={t(lang, 'backToStart')} className="site-logo tracking-tight hover:opacity-80 transition-opacity">Meta<span className="text-emerald-400">Blend</span></Link>}
          lang={lang} langPick={langPick} onLang={changeLang} unit={unit} onUnit={changeUnit}
        />
      </div>
    </header>
  )
}
