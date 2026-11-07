import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// One tile everywhere: the chart card's surface, real padding, in the shared grid.
test('the tile wears the chart card classes and pads its content', () => {
  const ui = readFileSync('app/components/ui.jsx', 'utf8')
  const tile = ui.slice(ui.indexOf('export function MetricCard'), ui.indexOf('export function TileGrid'))
  assert.match(tile, /bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-4/)
})

test('every row of tiles sits in TileGrid (two per row on a phone, one row on a wide screen)', () => {
  for (const f of ['app/components/outlook/TabToday.jsx', 'app/components/outlook/TabTomorrow.jsx', 'app/components/outlook/Tab7d.jsx', 'app/components/hike/PeakView.jsx']) {
    const s = readFileSync(f, 'utf8')
    assert.ok(s.includes('<TileGrid>'), f)
    assert.ok(!s.includes('<div className="flex flex-wrap gap-3">'), f)
  }
})
