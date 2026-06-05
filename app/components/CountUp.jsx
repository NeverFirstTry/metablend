'use client'

import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Smoothly counts a number up to `value` whenever it changes (including the
// first load, animating up from 0). Used for the hero temperature and headline
// metrics so a freshly loaded forecast animates in instead of snapping.
// Renders plain text, so it drops into any element.
export default function CountUp({ value, decimals = 0, duration = 700, className, suffix = '' }) {
  const target = Number(value)
  const valid = Number.isFinite(target)
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!valid) return
    const from = fromRef.current
    if (from === target) return

    const reduce = prefersReducedMotion()
    const start = performance.now()
    const ease = p => 1 - Math.pow(1 - p, 3) // easeOutCubic

    // setState only ever runs inside this rAF callback — never synchronously in
    // the effect body — so it doesn't trigger cascading renders. Reduced motion
    // lands on the value on the first frame.
    const tick = now => {
      const p = reduce ? 1 : Math.min(1, (now - start) / duration)
      setDisplay(from + (target - from) * ease(p))
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, valid, duration])

  if (!valid) return <span className={className}>–{suffix}</span>

  const shown = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString()
  return <span className={className}>{shown}{suffix}</span>
}
