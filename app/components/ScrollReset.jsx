'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// A new page opens at the top — a tab, a link, a peak picked from the list —
// while back / forward keeps where you were. Next only scrolls when the new
// page's top is out of view, which left tab switches half-way down the page.
// A link to a part of a page (/terms#copyright) opens at that part. Renders nothing.
export default function ScrollReset() {
  const path = usePathname()
  const query = useSearchParams().toString()
  const popped = useRef(false)
  const first = useRef(true)
  useEffect(() => {
    const onPop = () => { popped.current = true }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (popped.current) { popped.current = false; return }
    const part = document.getElementById(window.location.hash.slice(1))
    if (part) part.scrollIntoView({ behavior: 'instant' })
    else window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [path, query])
  return null
}
