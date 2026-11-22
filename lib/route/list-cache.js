// A peak's marked routes as its route list last read them (/api/routes), kept while the app runs: a route opened
// from the list takes its name, line and heights from here, so its screen shows at once (UX review P5).
// the last 30 peaks, like PeakView's forecasts: a Map keeps insertion order, so the first key is the oldest
const LISTS = new Map(), MAX = 30
export const keepRouteList = (url, routes) => {
  LISTS.delete(url)
  LISTS.set(url, routes)
  if (LISTS.size > MAX) LISTS.delete(LISTS.keys().next().value)
}
export const knownRouteList = url => LISTS.get(url) ?? null
