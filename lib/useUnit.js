'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { publishPrefs, subscribePrefs, knownUnit, cookiePrefs } from './ui-prefs'

// Temperature unit for pages without their own switcher: the cookie the home
// page writes. Shared once known, like useLang: a later tab or page starts in
// °F from its first frame; °C while hydrating the first page load.
export function useUnit() {
  const unit = useSyncExternalStore(subscribePrefs, () => knownUnit() ?? 'C', () => 'C')
  useEffect(() => {
    publishPrefs({ unit: cookiePrefs(document.cookie, navigator.language).unit })
  }, [])
  return unit
}
