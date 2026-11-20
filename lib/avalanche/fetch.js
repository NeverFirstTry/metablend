// The day's avalanche ratings from the EAWS data store (network; never throws
// — for ratingsFor no file, a 404 or bad JSON is "no ratings"). Cached 30 minutes by Next's
// data cache, so every summit and alert that day shares one download.
import { getJson } from '../outlook/http.js'
import { parseRatings, ratingsUrl } from './avalanche.js'

// failed: the store did not answer the day's file (timeout, refusal, bad JSON). A day without bulletins
// still has its file (200, no ratings), so a failure means the source is down; tomorrow's file before
// it is out (about 17:00) fails too, which is why only today's failure counts (avalancheAnswer).
export const ratingsRead = (date, get = getJson) =>
  get(ratingsUrl(date), { ms: 8000, next: { revalidate: 1800 } }).then(json => ({ ratings: parseRatings(json), failed: json == null }), () => ({ ratings: {}, failed: true }))
export const ratingsFor = date => ratingsRead(date).then(r => r.ratings)
