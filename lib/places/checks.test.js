import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runChecks, formatReport, reportTitle } from './checks.js'

const peak = (id, name, lat, lon, elev, extra = {}) => ({ id, name, names: null, lat, lon, elev, kind: 'peak', country: 'CH', region: 'Valais', ...extra })
const MATTERHORN_F = { id: 'matterhorn', name: 'Matterhorn', lat: 45.97643, lon: 7.6586, elev: 4478, kind: 'peak', country: 'CH', grade: 'ZS', region: 'western-alps', aka: ['Cervino'] }
const EIGER_F = { id: 'eiger', name: 'Eiger', lat: 46.57763, lon: 8.00547, elev: 3967, kind: 'peak', country: 'CH', grade: 'ZS', region: 'western-alps' }
const ZERMATT = { id: 2657928, name: 'Zermatt', country: 'CH', region: 'Valais', population: 5800, lat: 46.0207, lon: 7.7491, exact: true, prefix: true }
const HANOI = { id: 1581130, name: 'Hanoi', country: 'VN', region: 'Hanoi', population: 8053663, lat: 21.0245, lon: 105.8412, exact: true, prefix: true }
const fansipan = peak('osm-N1', 'Đinh Núi Phan Xi Phăng', 22.3031, 103.7754, 3147, { names: { en: 'Fansipan Mountain Peak' }, notability: 3, country: 'VN' })

// two peaks kilometres inside Austria, and a namesake elsewhere that must not be taken for one of them
const AUSTRIAN = {
  'Zuckerhütl': [peak('osm-N8', 'Zuckerhütl', 47.5, 13.2, 1900, { country: 'AT', region: 'Salzburg' }), peak('osm-N410930695', 'Zuckerhütl', 46.9643, 11.1538, 3508, { country: 'AT', region: 'Tyrol' })],
  Birkkarspitze: [peak('osm-N9', 'Birkkarspitze', 47.4113, 11.4376, 2749, { country: 'AT', region: 'Tyrol' })],
}

// a database that knows the Alps and northern Vietnam a little
const places = {
  search: async q => (q === 'matterhron' || q === 'cervino' ? [peak('osm-N2', 'Matterhorn', 45.9763, 7.6586, 4478, { names: { it: 'Cervino' } })] : AUSTRIAN[q] ?? []),
  towns: async q => (q === 'zermatt' ? [ZERMATT] : q === 'hà nội' ? [HANOI] : []),
  pool: async lat => (lat > 40 ? [peak('osm-N5', 'Gornergrat', 45.9836, 7.7845, 3135, { notability: 2 })] : lat > 22 ? [fansipan] : [peak('osm-N7', 'Núi Chè', 21.1, 105.9, 127)]),
  near: async () => [],
}

test('runChecks — the searches and Near you spots a refresh must answer, from the loaded database', async () => {
  const results = await runChecks({ places, featured: [MATTERHORN_F, EIGER_F] })
  assert.deepEqual(results.map(r => [r.check, r.ok]), [
    ['search "matterhron"', true], ['search "cervino"', true], ['search "zermatt"', true], ['search "hà nội"', true],
    ['Near you, Jungfrau region', true], ['Near you, Sa Pa', true],
    ['country of Zuckerhütl', true], ['country of Birkkarspitze', true],
  ])
  assert.match(results[2].got, /around Zermatt: .*Matterhorn/)
  assert.ok(results.every(r => r.ms >= 0 && r.want))
})

test('runChecks — what\'s missing fails its check', async () => {
  const empty = { search: async () => [], towns: async () => [], pool: async () => [], near: async () => [] }
  const results = await runChecks({ places: empty, featured: [] })
  assert.ok(results.every(r => !r.ok))
  const broken = { ...empty, search: async () => null, pool: async () => null }
  assert.ok((await runChecks({ places: broken, featured: [] })).every(r => !r.ok && r.got === 'database error'))
})

const summaries = {
  runUrl: 'https://github.com/o/r/actions/runs/42', runId: '42', minutes: 74, diskPeakGb: 1.2, diskFreeGb: 18.5, dev: true,
  osm: {
    europe: { fileMb: 31000, secondPassMb: 21000, seconds: 1800, points: 300000, ways: 9000, missingNodes: 0, changedBetweenPasses: false },
    asia: { fileMb: 13000, secondPassMb: 9000, seconds: 700, points: 150000, ways: 900, missingNodes: 3, changedBetweenPasses: true },
  },
  build: { towns: 69985, peaks: 543998, huts: 24248, peaksNoEle: 22504, dropped: 158070 },
  load: { sent: { towns: 69985, summits: 568246 }, written: { towns: 0, summits: 12 }, deleted: { summits: 2, towns: 0 }, size: [{ relation: 'summits', row_count: 568244, total_mb: 196.1 }, { relation: 'towns', row_count: 69985, total_mb: 25.3 }, { relation: 'whole database', row_count: null, total_mb: 241 }] },
  checks: [{ check: 'search "matterhron"', want: 'Matterhorn first', got: 'Matterhorn 4478 m', ok: true, ms: 80 }, { check: 'Near you, Sa Pa', want: 'Fansipan among them', got: 'Fansipan', ok: true, ms: 60 }],
  bench: [{ query: "select count(*) from places_search('mont')", avg_ms: 4.46 }],
}

test('formatReport — counts, size, changed rows, checks, the extract run and the one production command', () => {
  const md = formatReport(summaries)
  assert.match(md, /Ready for production/)
  assert.match(md, /568,246/)
  assert.match(md, /241 MB/)
  assert.match(md, /12 summits and huts new or changed, 0 towns; 2 summits and huts and 0 towns deleted/)
  assert.match(md, /\| search "matterhron" \| Matterhorn first \| Matterhorn 4478 m \| ✅ \|/)
  assert.match(md, /74 min/)
  assert.match(md, /node scripts\/places\/load\.mjs --production --run=42/)
  assert.match(md, /asia .*file changed between the passes/)
  assert.equal(reportTitle(summaries), 'Places refresh: ready for production (568,246 summits and huts, 69,985 towns)')
})

test('formatReport — a failed check, or a step that didn\'t finish, says so first; no production command then', () => {
  const failed = { ...summaries, checks: [{ ...summaries.checks[0], ok: false, got: 'nothing' }] }
  assert.match(formatReport(failed), /^\*\*Not ready\*\* — 1 of 1 checks failed/)
  assert.doesNotMatch(formatReport(failed), /--production/)
  assert.equal(reportTitle(failed), 'Places refresh: checks failed')
  const noLoad = { ...summaries, load: null, checks: null }
  assert.match(formatReport(noLoad), /^\*\*Not ready\*\* — the load into the dev database didn't finish/)
  const noDev = { ...summaries, dev: false, load: null, checks: null }
  assert.match(formatReport(noDev), /^\*\*Built, not loaded\*\* — the dev database secrets aren't set/)
  const noOsm = { ...summaries, osm: { europe: summaries.osm.europe }, build: null, load: null, checks: null }
  assert.match(formatReport(noOsm), /^\*\*Not ready\*\* — the OpenStreetMap extract didn't finish \(missing: .*asia/)
})

test('formatReport — what wasn\'t measured is left out, never "null"', () => {
  const md = formatReport({ ...summaries, minutes: null, diskPeakGb: null, diskFreeGb: null })
  assert.doesNotMatch(md, /null/)
  assert.match(md, /\[The run\]\(https:\/\/github.com\/o\/r\/actions\/runs\/42\)/)
})

test('formatReport — a run that loaded an earlier run\'s data names that run in the production command (its artifact holds the data)', () => {
  assert.match(formatReport({ ...summaries, dataRunId: '41' }), /--production --run=41/)
})

test('formatReport — each region streams in a job of its own: the 6 h limit is per job, and the slowest region is what counts', () => {
  const md = formatReport(summaries)
  assert.match(md, /took 74 min on GitHub's free runners \(limit: 6 h per job; the slowest region, europe, took 30 min\)/)
  assert.match(md, /the build job used at most 1\.2 GB of disk, with 18\.5 GB free at the start/)
})

test('runChecks — a summit filed under the neighbour fails its check, and a run whose country areas gave no answer is not ready', async () => {
  const italian = { ...places, search: async q => (q === 'Zuckerhütl' ? [peak('osm-N410930695', 'Zuckerhütl', 46.9643, 11.1538, 3508, { country: 'IT', region: 'Trentino-Alto Adige' })] : places.search(q)) }
  const results = await runChecks({ places: italian, featured: [MATTERHORN_F, EIGER_F] })
  const z = results.find(r => r.check === 'country of Zuckerhütl')
  assert.equal(z.ok, false)
  assert.equal(z.got, 'IT, Trentino-Alto Adige')
  assert.equal(z.want, 'AT, Tyrol')
  assert.equal(results.find(r => r.check === 'country of Birkkarspitze').ok, true)

  const filed = { ...summaries, build: { ...summaries.build, inArea: 562000, noArea: 6246, areasFailed: [] } }
  assert.match(formatReport(filed), /Ready for production/)
  assert.match(formatReport(filed), /Country: 562,000 summits and huts from the country area they lie in \(OpenStreetMap's boundaries\), 6,246 from the nearest town/)
  const gap = { ...filed, build: { ...filed.build, areasFailed: ['IT', 'US'] } }
  assert.match(formatReport(gap), /^\*\*Not ready\*\* — the country areas of IT, US gave no answer/)
  assert.equal(reportTitle(gap), 'Places refresh: country areas missing')
  assert.doesNotMatch(formatReport(gap), /load\.mjs --production/)
})
