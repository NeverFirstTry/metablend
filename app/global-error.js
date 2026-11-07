'use client'

import './globals.css'
import ProblemScreen from './components/ProblemScreen'
import { THEME_BOOT_SCRIPT } from '@/lib/theme'

// The layout itself failed, so this page has to bring its own html, styles and theme.
export default function GlobalError({ reset }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <ProblemScreen titleKey="errorPageTitle" textKey="errorPageText" onRetry={reset} logo />
      </body>
    </html>
  )
}
