'use client'

import { useSyncExternalStore } from 'react'
import Script from 'next/script'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'

// Plausible, Vercel Web Analytics and Speed Insights load only on metablend.app (the apps open it too):
// a preview, a local build or a check is never a visit. The server renders nothing; the browser
// decides once the page is live (www redirects to metablend.app).
const never = () => () => {}
const onSite = () => location.hostname === 'metablend.app'

export default function SiteAnalytics() {
  if (!useSyncExternalStore(never, onSite, () => false)) return null
  return (
    <>
      <Script defer data-domain="metablend.app" src="https://plausible.io/js/script.js" />
      {/* Cookieless Core Web Vitals (disclosed in the privacy notice) */}
      <SpeedInsights />
      <Analytics />
    </>
  )
}
