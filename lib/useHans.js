'use client'

import { useEffect, useState } from 'react'

const same = s => s

// The browser's own place searches (the start page's suggestions, the notification home city) get their names
// straight from Open-Meteo's geocoder, which writes Chinese in traditional script (維也納). This gives the function
// that shows a name in simplified characters, loaded only for Chinese readers; it shows names unchanged until
// then. Only what is shown changes: a picked place is still sent as the geocoder named it, since GeoNames files
// many places under the traditional form only (维也纳 finds Vienna, West Virginia, not Vienna).
export function useHans(lang) {
  const [toHans, setToHans] = useState(null)
  const zh = lang === 'zh'
  useEffect(() => {
    if (!zh || toHans) return
    let on = true
    import('./zh-hans.js').then(m => { if (on) setToHans(() => m.toHans) })
    return () => { on = false }
  }, [zh, toHans])
  return zh && toHans ? toHans : same
}
