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
