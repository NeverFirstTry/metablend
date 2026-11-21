// Saved and recently opened peaks (UX review 2026-11-20, H2; owner: before submission on 3 Dec): the
// weekend hiker checks the same mountains on Thursday, Friday and Saturday morning. Kept on the phone; the
// window shown on a row is the one from the last forecast this phone fetched for that peak, never a new
// request (each would be an Open-Meteo request per visit), and only while it still speaks of today or tomorrow.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readShelf, toggleSaved, isSaved, noteVisit, rowWindow } from './peak-shelf.js'

const store = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) } }
const glockner = { id: 'grossglockner', name: 'Großglockner', lat: 47.074, lon: 12.694, elev: 3798, country: 'AT', grade: 'ZS' }
const lienzer = { id: 'q-46.8,12.8', name: 'Spitzkofel', lat: 46.8, lon: 12.8, elev: 2718 }
const win = (date, from, to) => ({ window: { from: `${date}T${from}`, to: `${date}T${to}` }, next: null })

test('a star keeps a peak in My peaks, a second tap takes it out; at most 12, newest first', () => {
  const s = store()
  assert.deepEqual(readShelf(s), { saved: [], recent: [] })
  toggleSaved(glockner, s)
  assert.ok(isSaved(readShelf(s), 'grossglockner'))
  assert.deepEqual(readShelf(s).saved.map(p => p.name), ['Großglockner'])
  toggleSaved(glockner, s)
  assert.equal(isSaved(readShelf(s), 'grossglockner'), false)
  for (let i = 0; i < 14; i++) toggleSaved({ ...lienzer, id: `q-${i}`, name: `Peak ${i}` }, s)
  assert.equal(readShelf(s).saved.length, 12)
  assert.equal(readShelf(s).saved[0].name, 'Peak 13')
})

test('an opened peak goes to the top of Recent, once, at most five; only what a row needs is kept', () => {
  const s = store()
  noteVisit(glockner, null, s)
  noteVisit(lienzer, null, s)
  noteVisit(glockner, null, s)
  assert.deepEqual(readShelf(s).recent.map(p => p.id), ['grossglockner', 'q-46.8,12.8'])
  for (let i = 0; i < 7; i++) noteVisit({ ...lienzer, id: `q-${i}` }, null, s)
  assert.equal(readShelf(s).recent.length, 5)
  assert.deepEqual(Object.keys(readShelf(s).recent[0]).sort(), ['country', 'elev', 'elevApprox', 'id', 'lat', 'lon', 'name', 'seen'].sort())
})

test('the row window: from the last forecast fetched here, today\'s or, after dark or after midnight, tomorrow\'s', () => {
  const s = store()
  const d = { nowLocal: '2026-11-20T09:00', utcOffsetSec: 3600, windows: { today: win('2026-11-20', '08:00', '13:00'), tomorrow: win('2026-11-21', '09:00', '14:00') } }
  noteVisit(glockner, d, s, Date.parse('2026-11-20T08:00:00Z'))
  const p = readShelf(s).recent[0]
  assert.equal(rowWindow(p, Date.parse('2026-11-20T10:00:00Z')).date, '2026-11-20') // the same morning
  assert.equal(rowWindow(p, Date.parse('2026-11-21T05:00:00Z')).date, '2026-11-21') // the next morning: the copy's tomorrow
  assert.equal(rowWindow(p, Date.parse('2026-11-22T05:00:00Z')), null) // two days on: nothing, not an old window
  assert.equal(rowWindow({ ...p, seen: null }, Date.now()), null)
})

test('a broken store reads as empty and never throws', () => {
  const bad = { getItem: () => '{nope', setItem: () => { throw new Error('full') } }
  assert.deepEqual(readShelf(bad), { saved: [], recent: [] })
  assert.doesNotThrow(() => toggleSaved(glockner, bad))
  assert.doesNotThrow(() => noteVisit(glockner, null, bad))
})

test('wired in: the star beside the peak\'s name, a 44 px toggle', async () => {
  await import('./test-jsx-hooks.js')
  const { createElement: h } = await import('react')
  const { renderToStaticMarkup: render } = await import('react-dom/server')
  const { default: PeakView } = await import('../app/components/hike/PeakView.jsx')
  const html = render(h(PeakView, { peak: glockner, lang: 'en', unit: 'C', onBack() {} }))
  const star = html.match(/<button[^>]*aria-pressed="false"[^>]*aria-label="Save this peak"[^>]*>/)?.[0] ?? ''
  assert.match(star, /size-11/)
  assert.ok(html.indexOf(star) > html.indexOf('Großglockner'), 'beside the name')
})

test('wired in: My peaks at the top of the Hiking tab', async () => {
  // source-match-ok: My peaks appears only after the phone's storage is read, so a static render cannot show its place
  const { readFileSync } = await import('node:fs')
  const hike = readFileSync(new URL('../app/components/hike/HikeApp.jsx', import.meta.url), 'utf8')
  assert.ok(hike.indexOf('<MyPeaks') > 0 && hike.indexOf('<MyPeaks') < hike.indexOf('<PeakSearch'), 'My peaks comes first')
})

test('Fable\'s review: the row says when the forecast was made, not when the phone looked', () => {
  const s = store()
  const d = { nowLocal: '2026-11-20T18:00', utcOffsetSec: 3600, generatedAt: '2026-11-20T15:04:33.476Z', windows: { today: null, tomorrow: win('2026-11-21', '09:00', '14:00') } }
  noteVisit(glockner, d, s, Date.parse('2026-11-20T17:00:00Z'))
  assert.equal(readShelf(s).recent[0].seen.at, Date.parse('2026-11-20T15:04:33.476Z')) // a kept answer in an outage carries its old time
  noteVisit(glockner, { ...d, generatedAt: undefined }, s, 1234)
  assert.equal(readShelf(s).recent[0].seen.at, 1234)
})

test('Fable\'s review: a window judged without storm data says so and is not shown as favourable; no window is not gold', async () => {
  const { rowView } = await import('./peak-shelf.js')
  const at = Date.parse('2026-11-20T08:00:00Z')
  const seen = (windows, notes = []) => ({ ...glockner, seen: { nowLocal: '2026-11-20T09:00', utcOffsetSec: 3600, windows, at, stormUnknown: notes.includes('no_storm_data') } })
  const s = store()
  noteVisit(glockner, { nowLocal: '2026-11-20T09:00', utcOffsetSec: 3600, generatedAt: '2026-11-20T08:00:00Z', notes: ['no_storm_data'], windows: { today: win('2026-11-20', '10:00', '13:00'), tomorrow: null } }, s, at)
  assert.equal(readShelf(s).recent[0].seen.stormUnknown, true, 'kept from the forecast')
  const unknown = rowView('en', seen({ today: win('2026-11-20', '10:00', '13:00'), tomorrow: null }, ['no_storm_data']), at + 3600e3)
  assert.equal(unknown.tone, 'warn')
  assert.equal(unknown.sub, 'Storm risk unknown for this peak')
  assert.equal(rowView('en', seen({ today: win('2026-11-20', '10:00', '13:00'), tomorrow: null }), at + 3600e3).tone, 'ok')
  assert.equal(rowView('en', seen({ today: { window: null, next: null }, tomorrow: null }), at + 3600e3).tone, 'rain')
  assert.equal(rowView('en', { ...glockner, seen: null }, at), null)
})
