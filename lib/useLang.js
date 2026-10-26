'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { loadLanguage } from './i18n'
import { publishPrefs, subscribePrefs, knownLang, cookiePrefs } from './ui-prefs'

// Active UI language for pages without their own switcher: the cookie the home
// page writes, falling back to the phone's language ("System"). Once known it
// is shared (lib/ui-prefs.js): a tab or page opened later renders in it from
// its first frame. While hydrating the first page load it is English, like the
// server render (LocaleReady keeps that page hidden until the swap). The switch
// waits for that language's texts (fetched on demand); offline → English.
export function useLang() {
  const lang = useSyncExternalStore(subscribePrefs, () => knownLang() ?? 'en', () => 'en')
  useEffect(() => {
    const want = cookiePrefs(document.cookie, navigator.language).lang
    if (want === knownLang()) return
    loadLanguage(want).then(ok => {
      const l = ok ? want : 'en'
      publishPrefs({ lang: l })
      // screen readers pick the voice from it, and hyphens: auto the dictionary
      document.documentElement.lang = l
    })
  }, [])
  return lang
}
