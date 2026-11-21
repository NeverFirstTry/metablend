// The week list (UX review T1, owner: before launch): its agreement dots were explained only under the list, and
// nothing on a row showed that it opens the day's hours. The legend now stands above the list, and every day
// with hours ends in a chevron that turns when the day is open.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { default: Tab7d } = await import('../app/components/outlook/Tab7d.jsx')
const { tempFormatter, deltaFormatter, spanFormatter } = await import('./outlook/text.js')
const en = (await import('./i18n/en.js')).default
const outlook = JSON.parse(readFileSync(new URL('./__fixtures__/outlook-vienna.json', import.meta.url), 'utf8'))
const fmt = { fmtTemp: tempFormatter('C'), fmtDelta: deltaFormatter('C'), fmtSpan: spanFormatter('C') }

test('the legend for the dots stands above the list', () => {
  const html = render(h(Tab7d, { outlook, unit: 'C', lang: 'en', fmt }))
  const legend = html.indexOf(en.agreeHint.split(' ')[0] === '●●●' ? 'sources agree' : en.agreeHint)
  const firstRow = html.indexOf('aria-expanded')
  assert.ok(legend > 0 && legend < firstRow, 'legend before the first day')
})

test('every day that opens ends in a chevron', () => {
  const html = render(h(Tab7d, { outlook, unit: 'C', lang: 'en', fmt }))
  const rows = html.split('aria-expanded').slice(1).map(r => r.slice(0, r.indexOf('</button>')))
  const openable = rows.filter(r => !/^="(true|false)" disabled=""/.test(r))
  assert.ok(openable.length > 0)
  for (const r of openable) assert.match(r, /lucide-chevron-down/)
})
