'use client'

import { useEffect } from 'react'

// Puts a sky on the page (<html data-sky>, see lib/sky.js and globals.css);
// null falls back to the default night sky. Cleared again on unmount so the
// next page starts from its own sky.
export function useSky(key) {
  useEffect(() => {
    const html = document.documentElement
    if (key) html.dataset.sky = key
    else delete html.dataset.sky
  }, [key])
  useEffect(() => () => { delete document.documentElement.dataset.sky }, [])
}
