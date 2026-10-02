// Mouse drag-to-scroll for horizontal strips (the hour rows). Touch and
// trackpads scroll natively; a mouse only had a thin scrollbar.

const THRESHOLD = 4 // px: less is a click, more is a drag

// The scroll position for a pointer at x, given where the drag started.
export function dragStep({ startLeft, startX, x, moved }) {
  const dx = x - startX
  const nowMoved = moved || Math.abs(dx) > THRESHOLD
  return { moved: nowMoved, left: nowMoved ? Math.max(0, startLeft - dx) : startLeft }
}

// Wires an element: mouse drag scrolls it, the cursor shows grab/grabbing
// (CSS .scroll-x), and the click that ends a drag is swallowed. Returns the
// cleanup function.
export function attachDragScroll(el) {
  let drag = null
  const down = e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    drag = { startLeft: el.scrollLeft, startX: e.clientX, moved: false, id: e.pointerId }
  }
  const move = e => {
    if (!drag) return
    const step = dragStep({ ...drag, x: e.clientX })
    if (step.moved && !drag.moved) { el.setPointerCapture?.(drag.id); el.dataset.dragging = '1' }
    drag.moved = step.moved
    if (step.moved) el.scrollLeft = step.left
  }
  const up = () => {
    if (!drag) return
    if (el.hasPointerCapture?.(drag.id)) el.releasePointerCapture(drag.id)
    delete el.dataset.dragging
    // keep `moved` for the click that follows this pointerup, then forget it
    const wasDrag = drag.moved
    drag = null
    if (wasDrag) {
      const swallow = ev => { ev.stopPropagation(); ev.preventDefault() }
      el.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 0)
    }
  }
  el.addEventListener('pointerdown', down)
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
  return () => {
    el.removeEventListener('pointerdown', down)
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
  }
}
