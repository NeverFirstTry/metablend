// The Hiking tab for a first-time user (UX review H1; owner, 2026-11-21: "yes to three well-known peaks with
// today's summit window for first-time users, from the stored summit forecasts only"). Until the phone has a
// saved or recently opened peak, My peaks shows three peaks a first-time user in the Alps knows, each with the
// window of its stored summit forecast. No request per user: the page reads the stored copies on the server.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { FIRST_PEAKS, firstPeakRows } from './hike/first-peaks.js'
import { seenOf } from './peak-shelf.js'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const featured = JSON.parse(readFileSync(new URL('./hike/featured.json', import.meta.url), 'utf8'))
const en = (await import('./i18n/en.js')).default
const LANGS = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko']

const now = Date.parse('2026-11-21T07:00:00Z')
const answer = { nowLocal: '2026-11-21T08:00', utcOffsetSec: 3600, generatedAt: '2026-11-21T06:30:00Z', notes: [],
  windows: { today: { window: { from: '2026-11-21T09:00', to: '2026-11-21T12:30' }, next: null }, tomorrow: null } }

test('three featured peaks, each with a stored summit forecast (a summit page)', () => {
  assert.equal(FIRST_PEAKS.length, 3)
  for (const id of FIRST_PEAKS) assert.ok(featured.some(p => p.id === id && p.kind !== 'hut'), id)
})

test('the rows carry the stored forecast as a visit would keep it; a missing answer leaves the row without a window', () => {
  const rows = firstPeakRows(featured, [answer, null, answer], now)
  assert.deepEqual(rows.map(r => r.id), FIRST_PEAKS)
  assert.deepEqual(rows[0].seen, seenOf(answer, now))
  assert.equal(rows[1].seen, null)
  assert.ok(rows[0].name && rows[0].elev && rows[0].lat != null)
})

test('the block: its title, the peaks, today\'s window in the peak view\'s words', async () => {
  const { FirstPeaks } = await import('../app/components/hike/MyPeaks.jsx')
  const rows = firstPeakRows(featured, [answer, null, answer], now)
  const html = render(h(FirstPeaks, { lang: 'en', peaks: rows, hrefFor: p => `/hike?peak=${p.id}`, now }))
  assert.ok(html.includes(en.peaksToStart))
  assert.match(html, /href="\/hike\?peak=grossglockner"/)
  assert.match(html, /09:00-12:30/)
  assert.equal(render(h(FirstPeaks, { lang: 'en', peaks: [], hrefFor: () => '/', now })), '')
})

// source-match-ok: a server component that reads the stored copies through the public address, and a client
// component that reads the phone's storage after hydration
test('the wiring: the page reads the stored copies with a time cap, My peaks shows them only on an empty shelf', () => {
  const page = readFileSync(new URL('../app/hike/page.js', import.meta.url), 'utf8')
  assert.match(page, /firstPeakRows\(featured, await Promise\.all\(FIRST_PEAKS\.map/)
  assert.match(page, /AbortSignal\.timeout\(2500\)/)
  assert.match(page, /<HikeApp firstPeaks=\{first\} \/>/)
  const mine = readFileSync(new URL('../app/components/hike/MyPeaks.jsx', import.meta.url), 'utf8')
  assert.match(mine, /if \(!shelf\.saved\.length && !recent\.length\) return <FirstPeaks /)
})

test('the title in every language', async () => {
  for (const l of LANGS) assert.ok((await import(`./i18n/${l}.js`)).default.peaksToStart, l)
})
