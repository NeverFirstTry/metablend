'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CloudSun, MountainSnow, Menu } from 'lucide-react'
import { t } from '@/lib/i18n'
import { useLang } from '@/lib/useLang'
import { onBackButton, tapHaptic, setStatusBarStyle } from '@/lib/native'
import { initPush } from '@/lib/push-client'
import { getCookie } from '@/lib/prefs'

const TABS = [['/', 'tabForecast', CloudSun], ['/hike', 'hiking', MountainSnow], ['/more', 'more', Menu]]

// App-only chrome. The layout's boot script has already marked <html
// data-app> before first paint (never inside iframes); this renders the
// bottom tab bar, keeps the status bar icons readable in both themes and
// wires Android's back button. Renders nothing for web visitors.
export default function AppChrome() {
  const [app, setApp] = useState(false)
  const lang = useLang()
  const path = usePathname()
  const router = useRouter()

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
    // push: a fresh token at every start, and a tapped notification opens its screen
    let offPush = () => {}
    initPush({ lang: getCookie('metablend_lang') ?? 'en', unit: getCookie('metablend_unit') === 'F' ? 'F' : 'C', onOpen: url => router.push(url) })
      .then(fn => { if (gone) fn(); else offPush = fn })
    return () => { gone = true; off(); offPush(); themeWatch.disconnect() }
  }, [router])

  if (!app) return null
  const active = href => (href === '/' ? path === '/' : path?.startsWith(href))
  return (
    <nav aria-label="MetaBlend" className="app-tabbar fixed bottom-0 inset-x-0 z-40 border-t border-zinc-800 bg-[#0e0e12]/95 backdrop-blur">
      <div className="max-w-3xl mx-auto grid grid-cols-3">
        {TABS.map(([href, key, Icon]) => (
          <Link
            key={href}
            href={href}
            onClick={() => tapHaptic()}
            aria-current={active(href) ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 py-2 text-[11px] ${active(href) ? 'text-emerald-400' : 'text-zinc-500'}`}
          >
            <Icon size={20} aria-hidden /> {t(lang, key)}
          </Link>
        ))}
      </div>
    </nav>
  )
}
