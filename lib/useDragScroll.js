'use client'

import { useEffect, useRef } from 'react'
import { attachDragScroll } from './drag-scroll'

// A ref for a horizontal strip: mouse drag scrolls it (lib/drag-scroll.js).
export function useDragScroll() {
  const ref = useRef(null)
  useEffect(() => (ref.current ? attachDragScroll(ref.current) : undefined), [])
  return ref
}
