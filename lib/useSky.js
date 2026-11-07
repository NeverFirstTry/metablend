'use client'

import { useEffect } from 'react'

// The page used to wear the forecast (dawn, dusk, rain …) in dark mode. The owner chose
// one fixed, calm background instead (2026-11-07), so this only clears an old mark.
export function useSky() {
  useEffect(() => { delete document.documentElement.dataset.sky }, [])
}
