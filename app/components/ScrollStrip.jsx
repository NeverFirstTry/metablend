'use client'

import { useEffect, useState } from 'react'
import { useDragScroll } from '@/lib/useDragScroll'
import { barGeometry, seekTo } from '@/lib/drag-scroll'

// A horizontal strip a mouse can drag, with our own scroll bar centred in
// the gap below it (native bars overlay the cards and fade out). The bar
// follows the scroll position; pressing or dragging on it scrolls there.
// Without anything to scroll there is no bar. The strip is a named region
// the keyboard can focus, so the arrow keys scroll it.
export default function ScrollStrip({ children, label }) {
  const strip = useDragScroll()
  const [bar, setBar] = useState(null)

  useEffect(() => {
    const el = strip.current
    if (!el) return
    const update = () => setBar(barGeometry(el))
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update) // also fires once right away
    ro.observe(el)
    return () => { el.removeEventListener('scroll', update); ro.disconnect() }
  }, [strip])

  const seek = e => {
    const r = e.currentTarget.getBoundingClientRect()
    seekTo(strip.current, (e.clientX - r.left) / r.width)
  }

  return (
    <div>
      <div ref={strip} tabIndex={0} role="region" aria-label={label} className="scroll-x overflow-x-auto -mx-1 px-1">{children}</div>
      {bar && (
        <div aria-hidden className="scroll-track relative mt-6 h-1.5 rounded-full cursor-pointer touch-none"
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); seek(e) }}
          onPointerMove={e => { if (e.buttons) seek(e) }}>
          <div className="scroll-thumb absolute inset-y-0 rounded-full"
            style={{ width: `${bar.w * 100}%`, left: `${bar.x * (1 - bar.w) * 100}%` }} />
        </div>
      )}
    </div>
  )
}
