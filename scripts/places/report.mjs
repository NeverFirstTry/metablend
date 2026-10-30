// The GitHub issue a places refresh opens (.github/workflows/places-refresh.yml),
// from what each step left in data/places: osm-summary.json, build-summary.json,
// load-summary.json, check-summary.json, and disk.log (the runner's disk use,
// sampled while it ran). Prints the issue's text; with --title, its title.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatReport, reportTitle } from '../../lib/places/checks.js'

const read = name => {
  const f = join('data', 'places', name)
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null
}
// "used avail" in MB, one line per sample
const disk = (existsSync(join('data', 'places', 'disk.log')) ? readFileSync(join('data', 'places', 'disk.log'), 'utf8') : '')
  .split('\n').map(l => l.trim().split(/\s+/).map(Number)).filter(([u, a]) => Number.isFinite(u) && Number.isFinite(a))
const gb = mb => +(mb / 1024).toFixed(1)
const check = read('check-summary.json')
const { GITHUB_SERVER_URL: server, GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: runId, PLACES_STARTED: started } = process.env
const summaries = {
  runUrl: `${server}/${repo}/actions/runs/${runId}`, runId, dataRunId: process.env.FROM_RUN || runId,
  minutes: started ? Math.round((Date.now() / 1000 - Number(started)) / 60) : null,
  diskPeakGb: disk.length ? gb(Math.max(...disk.map(d => d[0])) - disk[0][0]) : null, diskFreeGb: disk.length ? gb(disk[0][1]) : null,
  dev: process.env.HAVE_DEV === 'true',
  osm: read('osm-summary.json'), build: read('build-summary.json'), load: read('load-summary.json'),
  checks: check?.checks ?? null, bench: check?.bench ?? null,
}
console.log(process.argv.includes('--title') ? reportTitle(summaries) : formatReport(summaries))
