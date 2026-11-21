// A peak's marked routes as its route list last read them (/api/routes), kept while the app runs: a route opened
// from the list takes its name, line and heights from here, so its screen shows at once (UX review P5).
const LISTS = new Map()
export const keepRouteList = (url, routes) => { LISTS.set(url, routes) }
export const knownRouteList = url => LISTS.get(url) ?? null
