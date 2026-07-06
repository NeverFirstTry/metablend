'use client'

import { useState, useEffect } from 'react'
import { detectLang } from './i18n'

// Active UI language for pages without their own switcher: the cookie the home
// page writes, falling back to the browser language. Post-hydration sync so
// the server render (English) always matches the client's first paint.
export function useLang() {
  const [lang, setLang] = useState('en')
  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )metablend_lang=([^;]*)/)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate post-hydration cookie sync
    setLang(m ? decodeURIComponent(m[1]) : detectLang(navigator.language))
  }, [])
  return lang
}
