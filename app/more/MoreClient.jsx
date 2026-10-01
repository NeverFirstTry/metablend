'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Settings, Compass, ChevronRight, ArrowLeft } from 'lucide-react'
import { t, LANGUAGES, langChoice, LANG_SYSTEM } from '@/lib/i18n'
import { useLang } from '@/lib/useLang'
import { useUnit } from '@/lib/useUnit'
import { getCookie, setCookie, clearCookie } from '@/lib/prefs'
import { THEME_COOKIE, readThemePref, applyTheme } from '@/lib/theme'
import { SectionTitle } from '../components/ui'
import NotificationSettings from '../components/push/NotificationSettings'
import { isNative } from '@/lib/native'

const LINKS = [['/leaderboard', 'leaderboard'], ['/heatmap', 'heatmap'], ['/planner', 'planner'], ['/aviation', 'aviation'], ['/privacy', 'footerPrivacy'], ['/terms', 'footerTerms']]
const label = s => s.replace(/\s*→$/, '')


// The app's "More" tab: settings (the same cookies the home page writes)
// and the sections that have no tab of their own.
export default function MoreClient() {
  const lang = useLang()
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
      className={`press flex-1 rounded-lg py-2 text-sm ${on ? 'bg-emerald-400 text-black font-bold' : 'text-zinc-400 hover:text-emerald-400'}`}>
      {text}
    </button>
  )
  const chooseTheme = x => {
    setCookie(THEME_COOKIE, x)
    setTheme(x)
    applyTheme(x)
  }
  const box = 'bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2'
  const caption = 'text-zinc-500 text-xs uppercase tracking-wider'

  return (
    <div className="space-y-6">
      {/* on the web there is no tab bar to leave by */}
      <Link href="/" className="web-only text-zinc-500 text-sm hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5">
        <ArrowLeft size={15} aria-hidden /> {t(lang, 'back')}
      </Link>
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
            {['C', 'F'].map(x => pick(x, u === x, `°${x}`, () => { setCookie('metablend_unit', x); setUnit(x) }))}
          </div>
        </div>
        <div className={box}>
          <div className={caption}>{t(lang, 'themeLabel')}</div>
          <div className="flex gap-1 bg-zinc-800/60 rounded-xl p-1">
            {[['system', 'themeSystemName'], ['dark', 'themeDarkName'], ['light', 'themeLightName']].map(([x, k]) => pick(x, theme === x, t(lang, k), () => chooseTheme(x)))}
          </div>
        </div>
      </section>
      {native && <NotificationSettings lang={lang} unit={u} />}
      <section className="space-y-3">
        <SectionTitle icon={Compass}>{t(lang, 'moreLinks')}</SectionTitle>
        <ul className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
          {LINKS.map(([href, key]) => (
            <li key={href}>
              <Link href={href} className="flex items-center justify-between px-4 py-3 text-sm hover:text-emerald-400">
                {label(t(lang, key))}<ChevronRight size={16} className="text-zinc-600" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {/* the footer is hidden in the app, but its data attribution (Open-Meteo CC BY, OpenStreetMap) must stay reachable */}
      <section className="space-y-2 text-xs text-zinc-500 leading-relaxed">
        <p>{t(lang, 'footerData')}</p>
        <p>
          {t(lang, 'footerContact')}:{' '}
          <a href="mailto:info@metablend.app" className="text-emerald-400/80 hover:text-emerald-400">info@metablend.app</a>
        </p>
        <p>© {new Date().getFullYear()} MetaBlend</p>
      </section>
    </div>
  )
}
