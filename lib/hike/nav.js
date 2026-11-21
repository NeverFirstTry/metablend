// The hiking screens' on-screen back ("All peaks", the route's back): the
// phone's history when the screen before was that very parent — so the back
// button doesn't return to the screen just left — else straight to the parent
// (the screen was opened from a link, a notification or a widget).
// trail = the hike URLs visited while the hiking page is open, in order.

export function recordVisit(trail, href) {
  if (trail.at(-1) !== href) trail.push(href)
}

export function backAction(trail, parent) {
  if (trail.length >= 2 && trail.at(-2) === parent) {
    trail.pop()
    return 'back'
  }
  trail.length = 0
  return 'replace'
}

// Inside the Hiking tab a peak or a route opens at once (UX review P5): the address changes in the browser
// (history.pushState, which Next's router follows: useSearchParams sees it), so no server round trip comes
// before the screen. The page's server part does not depend on the address. The screens then show what they
// know (the peak's name and height) and load the forecast below it.
// A new screen starts at its top, as the router's push did; a replace (the on-screen way back) keeps the place.
export function goHike(url, { replace = false } = {}) {
  window.history[replace ? 'replaceState' : 'pushState'](null, '', url)
  if (!replace) window.scrollTo({ top: 0 })
}

// For a document click listener in the capture phase, so it runs before Next's Link (which stands back when a
// click was handled). Only a plain tap on a link to /hike inside the page's <main>; a new tab, another page, the
// tab bar and the address already shown are left to the browser and the router.
export function hikeLinkClick(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const a = e.target?.closest?.('a[href]')
  if (!a || a.target || !a.closest('main')) return
  const url = new URL(a.href, location.href)
  if (url.origin !== location.origin || url.pathname !== '/hike') return
  const to = url.pathname + url.search
  if (to === location.pathname + location.search) return
  e.preventDefault()
  goHike(to)
}
