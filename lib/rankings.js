import { isRetired, covers } from './sources.js'

// No "global": nothing has scored it since 2026-09-14, only a manual recalibration writes it.
const REGION_ORDER = ['europe', 'north_america', 'south_america', 'asia', 'africa', 'oceania']

// Rows → [{ region, apis, leader }], best-weighted first, stats attached. Sources we no
// longer ask are left out, and each region's weights add up to 100% without them.
export function groupByRegion(rows, stats = {}) {
  const byRegion = {}
  for (const row of rows) {
    if (isRetired(row.id) || !covers(row.id, row.region)) continue
    ;(byRegion[row.region] ??= []).push({ ...row, ...stats[row.id] })
  }
  return REGION_ORDER.filter(r => byRegion[r]?.length).map(region => {
    const total = byRegion[region].reduce((n, r) => n + (r.weight ?? 0), 0) || 1
    const apis = byRegion[region].map(r => ({ ...r, weight: (r.weight ?? 0) / total })).sort((a, b) => b.weight - a.weight)
    return { region, apis, leader: apis[0] }
  })
}
