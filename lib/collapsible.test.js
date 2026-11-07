import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const files = dir => readdirSync(dir).flatMap(name => {
  const p = join(dir, name)
  return statSync(p).isDirectory() ? files(p) : /\.(jsx?|tsx?)$/.test(name) ? [p] : []
})

// "What is consensus forecasting?" answered only on its text: a <details> row whose
// summary didn't cover the chevron and the rest of the row. Every collapsible row is
// one button now: Fold, or a button with aria-expanded.
test('collapsible rows: no <details>, and Fold’s one button holds the title and the chevron', () => {
  const left = files('app').filter(f => readFileSync(f, 'utf8').includes('<details'))
  assert.deepEqual(left, [])
  const ui = readFileSync('app/components/ui.jsx', 'utf8')
  const fold = ui.slice(ui.indexOf('export function Fold'))
  const button = fold.slice(fold.indexOf('<button'), fold.indexOf('</button>'))
  assert.ok(button.includes('{title}') && button.includes('<ChevronDown'), 'title and chevron inside the button')
  assert.match(readFileSync('app/HomePage.jsx', 'utf8'), /<Fold icon=\{Info\} title=\{t\(lang, 'howTitle'\)\} keep>/)
})
