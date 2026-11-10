'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePagePath } from '@/lib/page-path'
import { CloudSun, MountainSnow, Menu } from 'lucide-react'
import { t, preferredLang } from '@/lib/i18n'
import { useLang } from '@/lib/useLang'
import { onBackButton, tapHaptic, setStatusBarStyle, onAppHidden, onAppUrl } from '@/lib/native'
import { initPush } from '@/lib/push-client'
import { opensByReload } from '@/lib/push-ui'
import { getCookie } from '@/lib/prefs'
import { restoreAppMark } from '@/lib/app-client'
import { syncWidgets } from '@/lib/app-widget-client'
import { pathFromAppUrl } from '@/lib/deep-link'
import { watchTextScale } from '@/lib/text-scale'
import { tabOf, tabHref, rememberTabUrl, lastTabUrls, retapScrollsUp } from '@/lib/app-tabs'
import { repairHeights } from '@/lib/route-store'
import TermsNotice from './TermsNotice'

const TABS = [['/', 'tabForecast', CloudSun], ['/hike', 'hiking', MountainSnow], ['/more', 'more', Menu]]

// App-only chrome. The layout's boot script has already marked <html
// data-app> before first paint (never inside iframes); this renders the
// bottom tab bar, keeps the status bar icons readable in both themes and
// wires Android's back button. Renders nothing for web visitors.
export default function AppChrome() {
  const [app, setApp] = useState(false)
  const lang = useLang()
  const path = usePagePath() // "/index" is the home page too (lib/page-path.js)
  const router = useRouter()

  // React rebuilds the page after a failed hydration and clears what the boot script set on
  // <html>; the mark is back before any page effect runs (layout effects run first)
  useLayoutEffect(() => { restoreAppMark(document.documentElement, window.__mbBoot) }, [])
  useEffect(() => {
    const html = document.documentElement
    const inApp = html.dataset.app === '1'
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-hydration environment sync
    setApp(inApp)
    if (!inApp) return
    // status bar icons follow the theme (dark icons on the light theme)
    const sync = () => setStatusBarStyle(html.dataset.theme === 'light')
    sync()
    const themeWatch = new MutationObserver(sync)
    themeWatch.observe(html, { attributes: true, attributeFilter: ['data-theme'] })
    let off = () => {}
    let gone = false
    onBackButton(({ canGoBack, exit }) => (canGoBack ? router.back() : exit())).then(fn => { if (gone) fn(); else off = fn })
    // push: a fresh token at every start; a tapped notification or widget opens its screen
    const open = url => (opensByReload(url) ? window.location.assign(url) : router.push(url))
    let offPush = () => {}, offUrl = () => {}, offHidden = () => {}
    initPush({ lang: preferredLang(getCookie('metablend_lang'), navigator.language), unit: getCookie('metablend_unit') === 'F' ? 'F' : 'C', onOpen: open })
      .then(fn => { if (gone) fn(); else offPush = fn })
    onAppUrl(raw => { const path = pathFromAppUrl(raw); if (path) open(path) })
      .then(fn => { if (gone) fn(); else offUrl = fn })
    // widgets: settings at start, and fresh again whenever the app is left
    syncWidgets({ refresh: true })
    onAppHidden(() => syncWidgets()).then(fn => { if (gone) fn(); else offHidden = fn })
    // saved routes still without heights are filled (once — then nothing to do)
    repairHeights().catch(() => {})
    // Larger Text: the phone's text size scales the page
    let offScale = () => {}
    watchTextScale().then(fn => { if (gone) fn(); else offScale = fn })
    return () => { gone = true; off(); offPush(); offUrl(); offHidden(); offScale(); themeWatch.disconnect() }
  }, [router])

  if (!app) return null
  const activeTab = tabOf(path)
  const leave = (e, href) => {
    tapHaptic()
    // the open tab tapped again at its start: back to the top (smooth unless reduced motion — globals.css)
    if (retapScrollsUp(href, activeTab, window.location)) { e.preventDefault(); window.scrollTo({ top: 0 }); return }
    // coming back to Hiking finds the peak or route you had open (lib/app-tabs.js)
    rememberTabUrl(activeTab, window.location.pathname + window.location.search)
  }
  return (<>
    <TermsNotice lang={lang} path={path} />
    <nav aria-label="MetaBlend" className="app-tabbar fixed bottom-0 inset-x-0 z-40 border-t border-zinc-800 bg-[#0e0e12]/95 backdrop-blur">
      <div className="max-w-3xl mx-auto grid grid-cols-3">
        {TABS.map(([href, key, Icon]) => (
          <Link
            key={href}
            href={tabHref(href, lastTabUrls(), activeTab)}
            // Hiking and More fetched ahead in full (kept 5 minutes), so a tap shows them at once
            prefetch={href === '/' ? undefined : true}
            onClick={e => leave(e, href)}
            aria-current={activeTab === href ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 py-2 text-[0.6875rem] ${activeTab === href ? 'text-emerald-400' : 'text-zinc-500'}`}
          >
            <Icon size={20} aria-hidden /> {t(lang, key)}
          </Link>
        ))}
      </div>
    </nav>
  </>)
}
