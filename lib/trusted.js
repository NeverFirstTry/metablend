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

// Ranked by the recent average score, not the weight: most good sources tie on
// the same weight (a median of coarse scores), so a share would rank nothing.
// An older forecast without the averages falls back to the weights.
export function trustedSources(sources, weights, recent, count = 5) {
  const scoreOf = id => recent?.[id] ?? weights?.[id]
  const rows = (sources ?? [])
    .filter(s => !s.down && !s.synthetic && typeof scoreOf(s.apiId) === 'number')
    .map(s => ({ id: s.apiId, name: s.displayName ?? s.apiId, score: scoreOf(s.apiId) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
  const top = rows[0]?.score
  if (!(top > 0)) return []
  return rows.map(({ id, name, score }) => ({ id, name, bar: Math.max(0, Math.round((score / top) * 100)) }))
}
