'use client'

import { useEffect, useLayoutEffect } from 'react'
import { getCookie } from '@/lib/prefs'
import { THEME_COOKIE, readThemePref, applyTheme, deviceMedia } from '@/lib/theme'

// "System" theme, live: when the device switches between dark and light
// (Control Centre, sunset schedule), the page follows — unless the visitor
// picked dark or light themselves. Renders nothing.
export default function ThemeSync() {
  // a page React rebuilt after a failed hydration lost the boot script's data-theme: the
  // same answer, put back before paint
  useLayoutEffect(() => { applyTheme(readThemePref(getCookie(THEME_COOKIE))) }, [])
  useEffect(() => {
    const media = deviceMedia()
    if (!media) return
    const follow = () => { if (readThemePref(getCookie(THEME_COOKIE)) === 'system') applyTheme('system') }
    media.addEventListener('change', follow)
    return () => media.removeEventListener('change', follow)
  }, [])
  return null
}
