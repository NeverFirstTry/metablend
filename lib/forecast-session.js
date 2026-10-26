// The Forecast tab's last screen, kept in memory while the app is open. A tab
// switch unmounts the page; coming back shows this at once instead of the
// start screen, a loader and a new fetch. Empty on a fresh page load, so the
// first render still matches the server's.
// pending: the city whose first forecast is still on its way (the tab can be
// left before it arrives — then coming back shows its loader, not the start).
export const SESSION = { city: '', data: null, outlook: null, tab: null, lang: null, unit: null, nextRefreshAt: null, pending: null }

export function rememberForecast(patch) {
  Object.assign(SESSION, patch)
}

// What a (re)mounted Forecast tab does: restore the last screen (refreshing it
// quietly when its refresh is due), or load the city a link asks for.
export function resumeForecast({ session = SESSION, deepLink = null, now = Date.now() } = {}) {
  const kept = !!(session.data && session.city)
  if (deepLink && (!kept || deepLink.toLowerCase() !== session.city.toLowerCase())) return { restore: false, refresh: false, load: deepLink }
  if (!kept) return { restore: false, refresh: false, load: session.pending ?? null }
  return { restore: true, refresh: !session.nextRefreshAt || now >= session.nextRefreshAt, load: null }
}
