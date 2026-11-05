// "Who counts most here" for the forecast on screen (pure, unit tested). The
// forecast already carries its region's weights, so this needs no request.
import { t } from './i18n.js'

export const REGION_KEYS = {
  global: 'regionGlobal',
  europe: 'regionEurope',
  north_america: 'regionNorthAmerica',
  south_america: 'regionSouthAmerica',
  asia: 'regionAsia',
  africa: 'regionAfrica',
  oceania: 'regionOceania',
}

// the pack's name starts with a flag or globe, for the leaderboard's tabs
export const regionName = (lang, region) => t(lang, REGION_KEYS[region] ?? REGION_KEYS.global).replace(/^[^\p{L}]+/u, '')

export function trustedSources(sources, weights, count = 5) {
  const rows = (sources ?? [])
    .filter(s => !s.down && !s.synthetic && typeof weights?.[s.apiId] === 'number')
    .map(s => ({ id: s.apiId, name: s.displayName ?? s.apiId, weight: weights[s.apiId] }))
  const total = rows.reduce((sum, r) => sum + r.weight, 0)
  if (!total) return []
  return rows
    .sort((a, b) => b.weight - a.weight)
    .slice(0, count)
    .map(({ id, name, weight }) => ({ id, name, share: Math.round((weight / total) * 100) }))
}
