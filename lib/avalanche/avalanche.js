// Avalanche danger (pure — unit tested): the official European bulletins'
// daily level per avalanche region, as the EAWS map publishes it at
// static.avalanche.report, and the region a spot lies in (lib/avalanche/
// regions.json, scripts/build-avalanche-regions.mjs — server-only, ~1.7 MB).
// Levels 1–5 (low … very high); 0 = not rated (no snow / out of season).
import { regionsAt } from '../warnings/regions.js'

export const AVA_KEYS = ['avaTitle', 'avaToday', 'avaTomorrow', 'avaNote', 'avaSource', 'avaLevel1', 'avaLevel2', 'avaLevel3', 'avaLevel4', 'avaLevel5', 'pushAvaLine']
// the official EAWS colours (as an accent next to the number and word, never alone)
export const AVA_COLORS = { 1: '#ccff66', 2: '#ffff00', 3: '#ff9900', 4: '#ff0000', 5: '#a00000' }
export const AVA_LINK = 'https://avalanches.org/'

export const ratingsUrl = date => `https://static.avalanche.report/eaws_bulletins/${date}/${date}.ratings.json`

// the day's highest level per region; the :am / :pm / :high / :low variants
// aren't needed for "the danger in this area today"
export function parseRatings(json) {
  const out = {}
  for (const [id, level] of Object.entries(json?.maxDangerRatings ?? {})) {
    if (!id.includes(':') && Number.isInteger(level) && level >= 1 && level <= 5) out[id] = level
  }
  return out
}

// { region, level } at a spot, or null (no avalanche region there, or not rated)
export function avalancheLevel(regionData, ratings, lat, lon) {
  let best = null
  for (const id of regionsAt(regionData, lat, lon)) {
    const level = ratings?.[id]
    if (level && (!best || level > best.level)) best = { region: id, level }
  }
  return best
}

// The bulletins are dated in Central European time.
export function bulletinDates(now = Date.now()) {
  const day = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms))
  return { today: day(now), tomorrow: day(now + 24 * 3600e3) }
}
