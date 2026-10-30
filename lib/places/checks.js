// What a places refresh checks in the database it just loaded
// (scripts/places/check.mjs) — the app's own search and Near you code on a few
// places everyone knows — and the GitHub issue it opens about the run
// (scripts/places/report.mjs). Pure apart from the database it's handed; unit
// tested with fakes.
import { pickNearPeaks } from '../hike/near.js'
import { matchFeatured } from '../hike/search.js'
import { ownSearch } from './search.js'
import { missingRegions } from './plan.js'

const named = re => p => !!p && [p.name, ...Object.values(p.names ?? {})].some(n => re.test(n))
const show = p => `${p.name} ${p.elev ?? '?'} m`
const fmt = n => Number(n).toLocaleString('en-US')

export const SEARCH_CHECKS = [
  { q: 'matterhron', want: 'Matterhorn first, despite the typo', ok: a => named(/^Matterhorn$/)(a.peaks[0]) },
  { q: 'cervino', want: 'Matterhorn by its Italian name', ok: a => a.peaks.slice(0, 3).some(named(/^Matterhorn$/)) },
  { q: 'zermatt', want: 'around Zermatt, with the Matterhorn', ok: a => a.around?.place.name === 'Zermatt' && a.around.peaks.some(named(/^Matterhorn$/)) },
  { q: 'hà nội', want: 'around Hanoi', ok: a => a.around?.place.name === 'Hanoi' && a.around.peaks.length > 0 },
]
export const NEAR_CHECKS = [
  { name: 'Jungfrau region', lat: 46.55, lon: 7.95, want: 'Eiger, Mönch or Jungfrau among them', ok: list => list.some(named(/^(Eiger|Mönch|Jungfrau)$/)) },
  { name: 'Sa Pa', lat: 22.34, lon: 103.84, want: 'Fansipan among them', ok: list => list.some(named(/fansipan|phan xi p/i)) },
]

export async function runChecks({ places, featured }) {
  // our data only: no terrain-model heights, no geocoder
  const deps = { places, featured, demEle: async points => points.map(() => null), geocode: async () => ({ place: null, down: false }) }
  const results = []
  for (const c of SEARCH_CHECKS) {
    const t0 = Date.now()
    const own = await ownSearch({ q: c.q, bias: null, full: false }, matchFeatured(c.q, featured), deps)
    const a = own?.body
    const got = !a ? 'database error'
      : [a.peaks.slice(0, 3).map(show).join(', '), a.around && `around ${a.around.place.name}: ${a.around.peaks.slice(0, 4).map(show).join(', ')}`].filter(Boolean).join('; ') || 'nothing found'
    results.push({ check: `search "${c.q}"`, want: c.want, got, ok: !!a && c.ok(a), ms: Date.now() - t0 })
  }
  for (const c of NEAR_CHECKS) {
    const t0 = Date.now()
    const pool = await places.pool(c.lat, c.lon)
    const list = pool ? pickNearPeaks(pool, featured, c) : []
    results.push({ check: `Near you, ${c.name}`, want: c.want, got: pool ? list.slice(0, 6).map(show).join(', ') || 'nothing found' : 'database error', ok: !!pool && c.ok(list), ms: Date.now() - t0 })
  }
  return results
}

// Where the run stands: ready, or the first thing that kept it from it.
function verdict(s) {
  if (!s.build) {
    const missing = missingRegions(Object.keys(s.osm ?? {}).map(r => `${r}.ndjson`))
    return { ready: false, line: missing.length ? `the OpenStreetMap extract didn't finish (missing: ${missing.join(', ')})` : 'the build didn\'t finish', title: 'failed' }
  }
  if (!s.dev) return { ready: false, built: true, line: 'the dev database secrets aren\'t set (DEV_SUPABASE_URL, DEV_SUPABASE_SERVICE_ROLE_KEY), so nothing was loaded or checked', title: 'built, not loaded' }
  if (!s.load) return { ready: false, line: 'the load into the dev database didn\'t finish', title: 'load failed' }
  const failed = (s.checks ?? []).filter(c => !c.ok).length
  if (!s.checks) return { ready: false, line: 'the checks didn\'t run', title: 'checks failed' }
  if (failed) return { ready: false, line: `${failed} of ${s.checks.length} checks failed`, title: 'checks failed' }
  return { ready: true, line: `all ${s.checks.length} checks passed in the dev database`, title: 'ready for production' }
}

export function reportTitle(s) {
  const v = verdict(s)
  return v.ready ? `Places refresh: ready for production (${fmt(s.load.sent.summits)} summits and huts, ${fmt(s.load.sent.towns)} towns)` : `Places refresh: ${v.title}`
}

export function formatReport(s) {
  const v = verdict(s)
  const out = [`**${v.ready ? 'Ready for production' : v.built ? 'Built, not loaded' : 'Not ready'}** — ${v.line}.`, '']
  const slowest = Object.entries(s.osm ?? {}).sort((a, b) => b[1].seconds - a[1].seconds)[0]
  const took = s.minutes == null ? ''
    : ` took ${s.minutes} min on GitHub's free runners (limit: 6 h per job${slowest ? `; the slowest region, ${slowest[0]}, took ${Math.round(slowest[1].seconds / 60)} min` : ''})`
  const disk = s.diskPeakGb != null ? `; the build job used at most ${s.diskPeakGb} GB of disk, with ${s.diskFreeGb} GB free at the start` : ''
  out.push(`[The run](${s.runUrl})${took}${disk}.`, '')
  if (s.build) {
    const size = Object.fromEntries((s.load?.size ?? []).map(r => [r.relation, r]))
    out.push('### Data', '', '| | rows | in the dev database |', '|---|---|---|')
    out.push(`| Summits and huts | ${fmt(s.build.peaks + s.build.huts)} (${fmt(s.build.peaks)} peaks, ${fmt(s.build.huts)} huts) | ${size.summits ? `${size.summits.total_mb} MB` : '—'} |`)
    out.push(`| Towns | ${fmt(s.build.towns)} | ${size.towns ? `${size.towns.total_mb} MB` : '—'} |`)
    if (size['whole database']) out.push(`| Whole dev database | | ${size['whole database'].total_mb} MB |`)
    out.push('', `Peaks without a height kept for their Wikidata item: ${fmt(s.build.peaksNoEle)}; named peaks dropped (no height, no Wikidata): ${fmt(s.build.dropped)}.`)
    if (s.load) out.push('', `Changed since the last load: ${fmt(s.load.written.summits)} summits and huts new or changed, ${fmt(s.load.written.towns)} towns; ${fmt(s.load.deleted.summits)} summits and huts and ${fmt(s.load.deleted.towns)} towns deleted.`)
    out.push('')
  }
  if (s.checks) {
    out.push('### Checks (the app\'s search and Near you code on the dev database)', '', '| | expected | found | |', '|---|---|---|---|')
    for (const c of s.checks) out.push(`| ${c.check} | ${c.want} | ${c.got} | ${c.ok ? '✅' : '❌'} |`)
    out.push('')
  }
  if (s.bench?.length) {
    out.push('### Query times inside the database (places_bench)', '', '| query | ms |', '|---|---|')
    for (const b of s.bench) out.push(`| \`${b.query.replace(/^select count\(\*\) from /, '')}\` | ${b.avg_ms} |`)
    out.push('')
  }
  const regions = Object.entries(s.osm ?? {})
  if (regions.length) {
    out.push('### OpenStreetMap extracts (streamed from Geofabrik, nothing stored)', '', '| region | file | again for hut corners | time | summits and huts | huts as buildings | |', '|---|---|---|---|---|---|---|')
    for (const [name, r] of regions) {
      const notes = [r.missingNodes ? `${r.missingNodes} corner nodes missing` : '', r.changedBetweenPasses ? 'file changed between the passes' : ''].filter(Boolean).join('; ')
      out.push(`| ${name} | ${fmt(r.fileMb)} MB | ${fmt(r.secondPassMb)} MB | ${Math.round(r.seconds / 60)} min | ${fmt(r.points)} | ${fmt(r.ways)} | ${notes} |`)
    }
    const total = regions.reduce((t, [, r]) => ({ mb: t.mb + r.fileMb + r.secondPassMb, s: t.s + r.seconds }), { mb: 0, s: 0 })
    out.push('', `${fmt(Math.round(total.mb / 1000))} GB streamed; the regions' times add up to ${Math.round(total.s / 60)} min (each region in a job of its own, three at a time).`, '')
  }
  if (v.ready) {
    out.push('### Production', '', 'Not done here — its keys aren\'t in GitHub. On the PC, one command (downloads this run\'s data, asks for the project ref, writes only what changed):', '',
      '```', `node scripts/places/load.mjs --production --run=${s.dataRunId ?? s.runId}`, '```')
  }
  return out.join('\n')
}
