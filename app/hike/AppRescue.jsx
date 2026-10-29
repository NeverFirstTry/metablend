'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { t } from '@/lib/i18n'
import { rescueStep } from '@/lib/app-rescue'

// Ran into the website teaser inside the app — the server tells the app by
// its user agent or cookie, so this shouldn't happen, but a tester saw
// something flash on Hiking. The teaser is .web-only (hidden in the app
// before first paint by the boot script's <html data-app>); this loads the
// app view in its place: a refresh, then — if the teaser is still there two
// seconds later, or comes back — a full load with ?app=1 (lib/app-rescue.js).
// Meanwhile the app shows a loading line instead of a blank page.
let softTried = false // per app run: a second teaser goes straight to the full load
const SOFT_WAIT_MS = 2000

export default function AppRescue({ lang }) {
  const router = useRouter()
  useEffect(() => {
    if (document.documentElement.dataset.app !== '1') return
    let timer
    const go = () => {
      const step = rescueStep(window.location.href, softTried)
      if (step.action === 'refresh') {
        softTried = true
        router.refresh()
        timer = setTimeout(go, SOFT_WAIT_MS) // unmounted before then = the app view arrived
      } else if (step.action === 'reload') window.location.replace(step.to)
    }
    go()
    return () => clearTimeout(timer)
  }, [router])
  // .app-only: never shown on the website
  return <p className="app-only text-sm text-zinc-500">{t(lang, 'loading')}</p>
}
