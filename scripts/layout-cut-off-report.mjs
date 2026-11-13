// The table of the cut-off measurement (scripts/check-phone-layout.mjs with MEASURE=<file.json>): every
// element that is cut off sideways, per page file, with the page, the languages and widths it shows in and
// how far it sticks out at most. Report only: it judges nothing; the owner decides per line.
//   node scripts/layout-cut-off-report.mjs cut-off-*.json            a Markdown table
//   node scripts/layout-cut-off-report.mjs --json cut-off-*.json     the same lines as JSON
// One line is one element (its tag and classes) in one clipping box on one page, however many languages,
// widths, views and copies of it (table rows, map tiles) the measurement met.
import { readFileSync } from 'node:fs'

// the page file whose outer element clips sideways (or holds the page's layout), by the measurement's page name
export const PAGE_FILE = {
  forecast: 'app/HomePage.jsx', 'forecast week': 'app/HomePage.jsx', 'terms notice': 'app/HomePage.jsx', home: 'app/HomePage.jsx', 'language landing': 'app/HomePage.jsx',
  hiking: 'app/hike/page.js', peak: 'app/hike/page.js', route: 'app/hike/page.js',
  more: 'app/more/page.js', rankings: 'app/leaderboard/page.js', planner: 'app/planner/page.js', heatmap: 'app/heatmap/page.js',
  aviation: 'app/aviation/page.js', airport: 'app/aviation/[icao]/page.js',
  'summit page': 'app/mountains/[peak]/SummitPage.jsx', 'summit list': 'app/mountains/MountainList.jsx',
  'city page': 'app/weather/[city]/CityPage.jsx', 'city list': 'app/weather/CityList.jsx',
  privacy: 'app/privacy/content.jsx', terms: 'app/terms/content.jsx', impressum: 'app/impressum/page.js', support: 'app/support/page.js',
  testers: 'app/testers/TestersContent.jsx', widget: 'app/widget/[city]/Widget.jsx',
  'shared city link': 'app/HomePage.jsx', // app/city/[name]/GoToCity.jsx sends the visitor on to the forecast
}

// What a line is, as far as the measurement can tell. Only 'content' needs a look at the page; the others are
// listed all the same, because nothing is left out of this report.
export function sortOf(f) {
  if (/leaflet/.test(f.el) || /leaflet/.test(f.clip)) return 'map inside its frame'
  if (f.clipWidth != null && f.clipWidth <= 2) return 'text for screen readers'
  if (f.decor) return 'ornament'
  if (f.faint) return 'transparent just then'
  return 'content'
}

export function lines(findings, { langs, widths }) {
  const groups = new Map()
  for (const f of findings) {
    const key = [f.page, f.kind, f.el, f.clip, sortOf(f)].join('\n')
    let g = groups.get(key)
    if (!g) groups.set(key, g = { file: PAGE_FILE[f.page] ?? '?', page: f.page, sort: sortOf(f), kind: f.kind, el: f.el, clip: f.clip, views: new Set(), langs: new Set(), widths: new Set(), texts: new Set(), by: 0, at: '', seen: 0 })
    g.views.add(f.view); g.langs.add(f.lang); g.widths.add(f.width); g.seen++
    if (f.text && g.texts.size < 4) g.texts.add(f.text)
    if (f.by > g.by) { g.by = f.by; g.at = `${f.lang}, ${f.width} px, ${f.view}` }
  }
  const order = ['content', 'transparent just then', 'ornament', 'text for screen readers', 'map inside its frame']
  return [...groups.values()]
    .map(g => ({ ...g, views: [...g.views].sort(), langs: langs.filter(l => g.langs.has(l)), widths: widths.filter(w => g.widths.has(w)), texts: [...g.texts] }))
    .sort((a, b) => order.indexOf(a.sort) - order.indexOf(b.sort) || a.file.localeCompare(b.file) || a.page.localeCompare(b.page) || b.by - a.by)
}

if (process.argv[1]?.endsWith('layout-cut-off-report.mjs')) {
  const args = process.argv.slice(2), files = args.filter(a => a !== '--json')
  const runs = files.map(f => JSON.parse(readFileSync(f, 'utf8')))
  const langs = [...new Set(runs.flatMap(r => r.langs))], widths = [...new Set(runs.flatMap(r => r.widths))].sort((a, b) => a - b)
  const all = lines(runs.flatMap(r => r.findings), { langs, widths })
  if (args.includes('--json')) console.log(JSON.stringify({ langs, widths, pages: runs.reduce((n, r) => n + r.pages, 0), notMeasured: runs.flatMap(r => r.notMeasured), lines: all }, null, 1))
  else {
    const cell = s => String(s).replaceAll('|', '\\|')
    console.log(`${runs.reduce((n, r) => n + r.pages, 0)} pages measured in ${langs.join(', ')} at ${widths.join(', ')} px: ${all.length} lines (${all.filter(l => l.sort === 'content').length} content)\n`)
    console.log('| What | Page file | Page | Element | Cut by | Kind | Languages | Widths | Up to | Text |\n|---|---|---|---|---|---|---|---|---|---|')
    for (const l of all) console.log(`| ${[l.sort, l.file, `${l.page} (${l.views.join(', ')})`, l.el, l.clip, l.kind, l.langs.length === langs.length ? 'all' : l.langs.join(', '), l.widths.join(', '), `${l.by} px (${l.at})`, l.texts.slice(0, 2).join(' / ')].map(cell).join(' | ')} |`)
    for (const n of runs.flatMap(r => r.notMeasured)) console.log(`\nnot measured: ${n}`)
  }
}
