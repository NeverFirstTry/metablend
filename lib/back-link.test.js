// The way back at the top of a page (UX review 2026-11-20, X1 and O1): one component, a 44 px high target,
// and a label that names where it leads ("More", the peak's name, "Hiking"), not "Back" or "All peaks"
// on a link that leads elsewhere.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { default: BackLink } = await import('../app/components/BackLink.jsx')

const APP = fileURLToPath(new URL('../app/', import.meta.url))
const files = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.jsx?$/.test(f) ? [p] : [] })

test('BackLink: a 44 px high target with its arrow and the name of where it goes', () => {
  const link = render(h(BackLink, { href: '/more' }, 'More'))
  assert.match(link, /href="\/more"/)
  assert.match(link, /min-h-11/)
  assert.match(link, />More<\/a>$/)
  const button = render(h(BackLink, { onClick() {} }, 'Großglockner'))
  assert.match(button, /^<button type="button"[^>]*min-h-11/)
})

test('every way back at the top of a page is a BackLink: no hand-made 20 px arrow links are left', () => {
  const left = files(APP).filter(f => !f.endsWith('BackLink.jsx') && /<ArrowLeft\b/.test(readFileSync(f, 'utf8')))
  assert.deepEqual(left.map(f => f.slice(APP.length)), [])
})

test('the app\'s pages opened from More lead back to More and say so', () => {
  for (const f of ['leaderboard/page.js', 'heatmap/page.js', 'planner/page.js', 'aviation/page.js', 'impressum/LangChrome.jsx', 'privacy/content.jsx', 'terms/content.jsx']) {
    const src = readFileSync(join(APP, f), 'utf8')
    assert.match(src, /<(BackLink|WayBack) href="\/more"/, f) // WayBack: the Impressum's own BackLink wraps it
  }
})

test('the route\'s way back names its peak, or Hiking for an imported route (O1)', () => {
  const src = readFileSync(join(APP, 'components/hike/RouteScreen.jsx'), 'utf8')
  assert.match(src, /backLabel=\{peak\?\.name \|\| t\(lang, 'hiking'\)\}/)
  assert.ok(!readFileSync(join(APP, 'components/hike/RouteView.jsx'), 'utf8').includes("'hikeBack'"), 'not "All peaks"')
})
