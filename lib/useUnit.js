'use client'

import { useState, useEffect } from 'react'

// Temperature unit for pages without their own switcher: the cookie the home
// page writes. Post-hydration sync, like useLang.
export function useUnit() {
  const [unit, setUnit] = useState('C')
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate post-hydration cookie sync
    setUnit(/(?:^|; )metablend_unit=F(?:;|$)/.test(document.cookie) ? 'F' : 'C')
  }, [])
  return unit
}
