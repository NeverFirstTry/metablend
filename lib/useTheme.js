'use client'

import { useSyncExternalStore } from 'react'

// The theme on screen right now ('dark' | 'light'), read from <html
// data-theme> and kept current when it changes — by a setting, or by the
// device when the preference is "system". The server render is dark.
function subscribe(onChange) {
  const watch = new MutationObserver(onChange)
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => watch.disconnect()
}
const current = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

export function useShownTheme() {
  return useSyncExternalStore(subscribe, current, () => 'dark')
}
