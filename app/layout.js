import { Suspense } from 'react'
import { Geist_Mono, Hanken_Grotesk } from 'next/font/google'
import './globals.css'
import AppChrome from './components/AppChrome'
import SiteAnalytics from './components/SiteAnalytics'
import { PageHeader } from './components/SiteHeader'
import ThemeSync from './components/ThemeSync'
import ScrollReset from './components/ScrollReset'
import { APP_BOOT_SCRIPT } from '@/lib/app-client'
import { THEME_BOOT_SCRIPT } from '@/lib/theme'
import { LOCALE_BOOT_SCRIPT } from '@/lib/locale-boot'
import LocaleReady from './components/LocaleReady'
import { LANGUAGES } from '@/lib/i18n'
import { siteMetadata, SITE_DESCRIPTION } from '@/lib/site-metadata'

// UI face behind the Apple system font (SF Pro) — see --font-ui in globals.css
const hanken = Hanken_Grotesk({ variable: '--font-hanken', subsets: ['latin', 'latin-ext'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata = siteMetadata

// viewport-fit=cover everywhere: the sky runs under the status bar / notch and
// globals.css pads the content by the safe area (0 in a normal browser tab)
export const viewport = {
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f6fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0f151b' }, // the fixed dark background (Slate)
  ],
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${hanken.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* The theme (the device's setting unless the visitor chose one) before
            first paint, so light users never see a dark flash. Synchronous. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        {/* Inside the app: <html data-app> before first paint (no layout jump) */}
        <script dangerouslySetInnerHTML={{ __html: APP_BOOT_SCRIPT }} />
        {/* Not English or °F: content waits for the swap instead of flashing English (LocaleReady) */}
        <script dangerouslySetInnerHTML={{ __html: LOCALE_BOOT_SCRIPT }} />
        {/* Structured data so search engines understand what MetaBlend is */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'MetaBlend',
              url: 'https://metablend.app',
              description: SITE_DESCRIPTION,
              applicationCategory: 'Weather',
              operatingSystem: 'Any',
              browserRequirements: 'Requires JavaScript',
              isAccessibleForFree: true,
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
              featureList: [
                'Weighted consensus from up to 20 weather sources at once',
                'Self-learning per-city forecast (MetaBlend Local)',
                'Live weather source accuracy leaderboard',
                '7-day consensus forecast',
                'Live rain radar',
                'UV index, air quality and pollen',
                'Travel planner from 10 years of climate data',
              ],
              inLanguage: LANGUAGES.map(l => l.code),
            }),
          }}
        />
        <PageHeader />
        {children}
        <AppChrome />
        <ThemeSync />
        <LocaleReady />
        {/* reads the query, so it gets its own boundary: pages stay prerendered */}
        <Suspense fallback={null}><ScrollReset /></Suspense>
        <SiteAnalytics />
      </body>
    </html>
  )
}
