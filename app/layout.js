import { Geist, Geist_Mono } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata = {
  title: 'MetaBlend – Wetterwahrheit durch Konsensus',
  description: 'Mehrere Wetter-APIs vereint zu einem gewichteten Konsensus. Echtzeit-Prognosen für jede Stadt weltweit.',
  manifest: '/manifest.json',
  openGraph: {
    title: 'MetaBlend – Wetterwahrheit durch Konsensus',
    description: 'Mehrere Wetter-APIs vereint zu einem gewichteten Konsensus.',
    url: 'https://metablend-beta.vercel.app',
    siteName: 'MetaBlend',
    images: [{ url: 'https://metablend-beta.vercel.app/og.png', width: 1200, height: 630, alt: 'MetaBlend' }],
    type: 'website',
    locale: 'de_DE',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MetaBlend – Wetterwahrheit durch Konsensus',
    description: 'Mehrere Wetter-APIs vereint zu einem gewichteten Konsensus.',
    images: ['https://metablend-beta.vercel.app/og.png'],
  },
  appleWebApp: {
    capable: true,
    title: 'MetaBlend',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export const viewport = {
  themeColor: '#0e0e12',
}

export default function RootLayout({ children }) {
  return (
    <html lang="de" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Script
          defer
          data-domain="metablend-beta.vercel.app"
          src="https://plausible.io/js/script.js"
        />
      </body>
    </html>
  )
}
