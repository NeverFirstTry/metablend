import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { MetricCard } = await import('../app/components/ui.jsx')

// One tile everywhere: the chart card's surface, real padding, in the shared grid.
test('the tile wears the chart card classes and pads its content', () => {
  const tile = render(h(MetricCard, { icon: () => null, label: 'UV Index', value: 3, sub: 'Moderate' }))
  const cls = tile.match(/^<div class="([^"]*)"/)?.[1].split(' ') ?? []
  for (const c of ['bg-zinc-900', 'border', 'border-zinc-800', 'rounded-2xl', 'px-4', 'py-4']) assert.ok(cls.includes(c), c)
  assert.ok(tile.includes('UV Index') && tile.includes('Moderate'), 'label and sub inside the tile')
})

test('every row of tiles sits in TileGrid (two per row on a phone, one row on a wide screen)', () => {
  // source-match-ok: a layout rule over every screen that shows tiles, checked as a scan
  for (const f of ['app/components/outlook/TabToday.jsx', 'app/components/outlook/TabTomorrow.jsx', 'app/components/outlook/Tab7d.jsx', 'app/components/hike/PeakView.jsx']) {
    const s = readFileSync(f, 'utf8')
    assert.ok(s.includes('<TileGrid>'), f)
    assert.ok(!s.includes('<div className="flex flex-wrap gap-3">'), f)
  }
})
