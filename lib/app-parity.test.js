// The app shows the website's forecast, sources, rankings, planner and summit table.
// The forecast's parts are rendered on the server for the start page (the Vienna
// example), and the server can't know it's the app: a component that renders
// differently when isAppView() is true makes React's hydration fail in the app, and
// the rebuilt page loses <html data-app> and the theme the boot scripts set before
// first paint (the app's start screen then showed the website layout, 2026-11-07).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

// (HomePage.jsx keeps one isAppView(): the compare card, which only renders after a tap.)
test('the server-rendered forecast parts never branch on isAppView()', () => {
  for (const f of [
    'app/components/outlook/NowLine.jsx',
    'app/components/outlook/NowDetails.jsx',
    'app/components/outlook/TabToday.jsx',
    'app/components/outlook/TabTomorrow.jsx',
    'app/components/outlook/Tab7d.jsx',
    'app/components/outlook/SourcesPanel.jsx',
  ]) assert.equal(read(f).includes('isAppView'), false, f)
})

test('one hero, one details row, no countdown, in the app as on the website', () => {
  // source-match-ok: JSX placement; whether the details fold is website-only is CSS, which no render here can see
  const home = read('app/HomePage.jsx')
  assert.equal(home.includes('<Countdown'), false)
  assert.match(home, /<Fold icon=\{Gauge\} title=\{t\(lang, 'detailsFold'\)\}>/)
  assert.equal(/className="web-only">\s*<Fold icon=\{Gauge\}/.test(home), false, 'Current details is not website-only')
  assert.equal(read('app/components/outlook/NowLine.jsx').includes('ChevronDown'), false)
})

test('Rankings, the planner and the summit table have one layout for both', () => {
  assert.equal(read('app/leaderboard/page.js').includes('isAppView() && ('), false)
  assert.equal(read('app/planner/page.js').includes('isAppView'), false)
  assert.equal(read('app/globals.css').includes('html:not([data-app]) .stack-table'), false)
})
