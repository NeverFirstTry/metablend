import Script from 'next/script'
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <head>
        <title>Next.js</title>
        <Script
          defer
          data-domain="www.metablend.app"
          src="https://plausible.io"
        />
      </head>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
