'use client'

import { useEffect } from 'react'
import { languageSettled } from '@/lib/i18n'

// Reveals the page once the client has swapped in the visitor's language and
// unit (see lib/locale-boot.js). The pages set those in their own mount
// effects, which run before this layout-level one — a language first fetches
// its texts, so this waits for that; two frames later their re-render has
// painted. globals.css reveals the page anyway after 1.2 s.
export default function LocaleReady() {
  useEffect(() => {
    const html = document.documentElement
    if (!html.dataset.localizing) return
    let id, gone = false
    languageSettled().then(() => {
      if (gone) return
      id = requestAnimationFrame(() => { id = requestAnimationFrame(() => { delete html.dataset.localizing }) })
    })
    return () => { gone = true; cancelAnimationFrame(id) }
  }, [])
  return null
}
