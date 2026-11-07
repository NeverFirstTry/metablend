'use client'

import { useEffect } from 'react'

// Marks where the sun is at the shown place, <html data-sky="dawn|day|dusk|night">
// (skyFor without a weather code, lib/sky.js). Dark mode draws a faint gold glow from it
// (globals.css); the background itself stays one fixed colour. Set when the place's data
// arrives, cleared on unmount so the next page starts without a glow.
export function useSky(key) {
  useEffect(() => {
    const html = document.documentElement
    if (key) html.dataset.sky = key
    else delete html.dataset.sky
  }, [key])
  useEffect(() => () => { delete document.documentElement.dataset.sky }, [])
}
