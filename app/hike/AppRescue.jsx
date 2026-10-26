'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Ran into the website teaser inside the app — the server tells the app by
// its user agent or cookie, so this shouldn't happen, but a tester saw
// something flash on Hiking. The teaser is .web-only (hidden in the app
// before first paint by the boot script's <html data-app>); this fetches the
// app view in its place, once.
let tried = false
export default function AppRescue() {
  const router = useRouter()
  useEffect(() => {
    if (tried || document.documentElement.dataset.app !== '1') return
    tried = true
    router.refresh() // the boot script has set the app cookie by now
  }, [router])
  return null
}
