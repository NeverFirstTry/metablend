'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Settings, Compass, LifeBuoy, Scale, ChevronRight } from 'lucide-react'
import { t, LANGUAGES, langChoice, LANG_SYSTEM } from '@/lib/i18n'
import { useLang } from '@/lib/useLang'
import { useUnit } from '@/lib/useUnit'
import { publishPrefs } from '@/lib/ui-prefs'
import { getCookie, setCookie, clearCookie } from '@/lib/prefs'
import { THEME_COOKIE, readThemePref, applyTheme } from '@/lib/theme'
import { SectionTitle } from '../components/ui'
import Credits from '../components/Credits'
import SocialLinks from '../components/SocialLinks'
import NotificationSettings from '../components/push/NotificationSettings'
import AppIconPicker from '../components/AppIconPicker'
import FeedbackLink from '../components/FeedbackLink'
import { isNative } from '@/lib/native'

// three groups, each tool saying what it is (UX review E1: one list of eight rows, "Planner" and "Aviation" unexplained)
const TOOLS = [['/leaderboard', 'leaderboard', 'toolLineRankings'], ['/heatmap', 'heatmap', 'toolLineHeatmap'], ['/planner', 'planner', 'toolLinePlanner'], ['/aviation', 'aviation', 'toolLineAviation']]
const LEGAL = [['/privacy', 'footerPrivacy'], ['/terms', 'footerTerms'], ['/impressum', 'footerImpressum']]
const label = s => s.replace(/\s*→$/, '')
// the tab's title in the reader's language: the page is static and its metadata says "More", which stayed in every
// language (owner, 2026-11-22); the layout's template is '%s · MetaBlend' (lib/site-metadata.js)
export const moreTitle = lang => `${t(lang, 'more')} · MetaBlend`

// The app's "More" tab: settings (the same cookies the home page writes)
// and the sections that have no tab of their own.
export default function MoreClient() {
  const lang = useLang()
  useEffect(() => { document.title = moreTitle(lang) }, [lang])
  const [langPick, setLangPick] = useState(LANG_SYSTEM)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- post-hydration cookie sync, like useLang
  useEffect(() => { setLangPick(langChoice(getCookie('metablend_lang'))) }, [])
  const cookieUnit = useUnit()
  const [unit, setUnit] = useState(null)
  const [theme, setTheme] = useState('system')
  const [native, setNative] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-hydration cookie sync
    setTheme(readThemePref(getCookie(THEME_COOKIE)))
    setNative(isNative())
  }, [])
  const u = unit ?? cookieUnit

  const pick = (key, on, text, onClick) => (
    <button key={key} onClick={onClick} aria-pressed={on}
      className={`press flex-1 rounded-lg py-2 text-sm ${on ? 'bg-zinc-700 text-white font-semibold' : 'text-zinc-400 hover:text-emerald-400'}`}>
      {text}
    </button>
  )
  const chooseTheme = x => {
    setCookie(THEME_COOKIE, x)
    setTheme(x)
    applyTheme(x)
  }
  const box = 'bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2'
  const row = 'press-row flex items-center justify-between gap-3 px-4 py-3 text-sm hover:text-emerald-400'
  const list = 'bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800'
  const caption = 'text-zinc-500 text-xs uppercase tracking-wider'

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t(lang, 'more')}</h1>
      <section className="space-y-3">
        <SectionTitle icon={Settings}>{t(lang, 'settingsTitle')}</SectionTitle>
        <label className={`${box} block`}>
          <span className={caption}>{t(lang, 'langLabel')}</span>
          <select value={langPick} onChange={e => { if (e.target.value === LANG_SYSTEM) clearCookie('metablend_lang'); else setCookie('metablend_lang', e.target.value); location.reload() }}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm">
            <option value={LANG_SYSTEM}>{t(lang, 'themeSystemName')}</option>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </label>
        <div className={box}>
          <div className={caption}>{t(lang, 'unitLabel')}</div>
          <div className="flex gap-1 bg-zinc-800/60 rounded-xl p-1">
            {['C', 'F'].map(x => pick(x, u === x, `°${x}`, () => { setCookie('metablend_unit', x); setUnit(x); publishPrefs({ unit: x }) }))}
          </div>
        </div>
        <div className={box}>
          <div className={caption}>{t(lang, 'themeLabel')}</div>
          <div className="flex gap-1 bg-zinc-800/60 rounded-xl p-1">
            {[['system', 'themeSystemName'], ['dark', 'themeDarkName'], ['light', 'themeLightName']].map(([x, k]) => pick(x, theme === x, t(lang, k), () => chooseTheme(x)))}
          </div>
        </div>
      </section>
      {/* notifications right after the pickers (UX review E3: the icon grid stood above them, a screen tall), then the
          icon grid, still among the settings: below the legal links it read as gone (owner, 2026-11-22, TestFlight) */}
      {native && <NotificationSettings lang={lang} unit={u} />}
      {native && <AppIconPicker lang={lang} />}
      <section className="space-y-3">
        <SectionTitle icon={Compass}>{t(lang, 'moreTools')}</SectionTitle>
        <ul className={list}>
          {TOOLS.map(([href, key, line]) => (
            <li key={href}>
              <Link href={href} className={row}>
                <span className="min-w-0"><span className="block">{label(t(lang, key))}</span><span className="block text-xs text-zinc-500">{t(lang, line)}</span></span>
                <ChevronRight size={16} className="shrink-0 text-zinc-600" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <SectionTitle icon={LifeBuoy}>{t(lang, 'moreHelp')}</SectionTitle>
        <ul className={list}>
          <li><FeedbackLink lang={lang} /></li>
          <li><Link href="/support" className={row}>{t(lang, 'footerSupport')}<ChevronRight size={16} className="shrink-0 text-zinc-600" aria-hidden /></Link></li>
        </ul>
      </section>
      <section className="space-y-3">
        <SectionTitle icon={Scale}>{t(lang, 'moreLegal')}</SectionTitle>
        <ul className={list}>
          {LEGAL.map(([href, key]) => (
            <li key={href}><Link href={href} className={row}>{label(t(lang, key))}<ChevronRight size={16} className="shrink-0 text-zinc-600" aria-hidden /></Link></li>
          ))}
        </ul>
      </section>
      {/* the footer is hidden in the app, but its data attribution (Open-Meteo CC BY, OpenStreetMap) must stay reachable */}
      <section className="space-y-2 text-xs text-zinc-500 leading-relaxed">
        <p><Credits lang={lang} full /></p>
        <p>
          {t(lang, 'footerContact')}:{' '}
          <a href="mailto:info@metablend.app" className="text-emerald-400/80 hover:text-emerald-400">info@metablend.app</a>
        </p>
        <SocialLinks linkClass="text-zinc-400 hover:text-emerald-400" />
        <p>© {new Date().getFullYear()} MetaBlend</p>
      </section>
    </div>
  )
}
