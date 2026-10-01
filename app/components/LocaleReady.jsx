'use client'

import { useEffect } from 'react'

// Reveals the page once the client has swapped in the visitor's language and
// unit (see lib/locale-boot.js). The pages set those in their own mount
// effects, which run before this layout-level one; two frames later their
// re-render has painted.
export default function LocaleReady() {
  useEffect(() => {
    const html = document.documentElement
    if (!html.dataset.localizing) return
    let id = requestAnimationFrame(() => { id = requestAnimationFrame(() => { delete html.dataset.localizing }) })
    return () => cancelAnimationFrame(id)
  }, [])
  return null
}
