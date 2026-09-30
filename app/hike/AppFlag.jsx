'use client'

import { useEffect } from 'react'
import { APP_COOKIE } from '@/lib/app-client'

// ?app=1 / ?app=0 → remember the choice for later navigations (testing the
// app view in a normal browser).
export default function AppFlag({ value }) {
  useEffect(() => {
    if (value === '1') document.cookie = `${APP_COOKIE}=1; path=/; max-age=2592000; samesite=lax`
    if (value === '0') document.cookie = `${APP_COOKIE}=; path=/; max-age=0`
  }, [value])
  return null
}
