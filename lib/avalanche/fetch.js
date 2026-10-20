// The day's avalanche ratings from the EAWS data store (network; never throws
// — no file, a 404 or bad JSON is "no ratings"). Cached 30 minutes by Next's
// data cache, so every summit and alert that day shares one download.
import { getJson } from '../outlook/http.js'
import { parseRatings, ratingsUrl } from './avalanche.js'

export const ratingsFor = date => getJson(ratingsUrl(date), { ms: 8000, next: { revalidate: 1800 } }).then(parseRatings, () => ({}))
