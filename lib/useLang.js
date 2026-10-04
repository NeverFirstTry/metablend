'use client'

import { useState, useEffect } from 'react'
import { preferredLang, loadLanguage } from './i18n'

// Active UI language for pages without their own switcher: the cookie the home
// page writes, falling back to the browser language. Post-hydration sync so
// the server render (English) always matches the client's first paint. The
// switch waits for that language's texts (fetched on demand); offline → English.
export function useLang() {
  const [lang, setLang] = useState('en')
  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )metablend_lang=([^;]*)/)
    const want = preferredLang(m ? decodeURIComponent(m[1]) : null, navigator.language)
    loadLanguage(want).then(ok => {
      const l = ok ? want : 'en'
      setLang(l)
      // screen readers pick the voice from it, and hyphens: auto the dictionary
      document.documentElement.lang = l
    })
  }, [])
  return lang
}
