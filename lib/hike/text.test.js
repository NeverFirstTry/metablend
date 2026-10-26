import { test } from 'node:test'
import assert from 'node:assert/strict'
import { windowText, windowTone, defaultSummitTab, noDaylightPointer } from './text.js'

const T = '2026-10-01'

test('windowText — a window and what ends it', () => {
  const w = { window: { from: '2026-10-02T07:00', to: '2026-10-02T12:00', hours: 5 }, next: { reason: 'storms', at: '2026-10-02T14:00' } }
  assert.deepEqual(windowText('en', w, { date: '2026-10-02', todayLocal: T }), { title: 'Summit window tomorrow 07:00–12:00', sub: 'storms likely from 14:00' })
  assert.equal(windowText('de', w, { date: '2026-10-02', todayLocal: T }).title, 'Gipfelfenster morgen 07:00–12:00')
})

test('windowText — no window; no daylight left; nothing ends a fine day', () => {
  assert.deepEqual(windowText('en', { window: null, next: { reason: 'rain', at: `${T}T09:00` } }, { date: T, todayLocal: T }), { title: 'No safe summit window today', sub: 'rain from 09:00' })
  assert.deepEqual(windowText('en', null, { date: T, todayLocal: T }), { title: 'No daylight left today', sub: null })
  assert.equal(windowText('en', { window: { from: `${T}T08:00`, to: `${T}T18:40`, hours: 11 }, next: null }, { date: T, todayLocal: T }).sub, null)
})

test('windowText — every language has every sentence', () => {
  for (const lang of ['en', 'de', 'fr', 'es', 'it']) {
    for (const reason of ['storms', 'rain', 'wind', 'cold']) {
      const r = windowText(lang, { window: null, next: { reason, at: `${T}T10:00` } }, { date: T, todayLocal: T })
      assert.doesNotMatch(`${r.title} ${r.sub}`, /\{|sw[A-Z]|reason[A-Z]/, `${lang} ${reason}`)
    }
    assert.doesNotMatch(windowText(lang, null, { date: T, todayLocal: T }).title, /sw[A-Z]/, lang)
  }
})

test('windowTone — green for a window, blue for none, neutral without daylight', () => {
  assert.equal(windowTone({ window: { from: 'a', to: 'b', hours: 1 }, next: null }), 'ok')
  assert.equal(windowTone({ window: null, next: null }), 'rain')
  assert.equal(windowTone(null), 'neutral')
})

test('unknown storm risk — the headline says so and is never green', () => {
  const w = { window: { from: `${T}T08:00`, to: `${T}T18:00`, hours: 10 }, next: null }
  assert.deepEqual(windowText('en', w, { date: T, todayLocal: T, stormUnknown: true }), { title: 'Summit window today 08:00–18:00', sub: 'Storm risk unknown for this peak' })
  const late = { ...w, next: { reason: 'rain', at: `${T}T18:00` } }
  assert.equal(windowText('en', late, { date: T, todayLocal: T, stormUnknown: true }).sub, 'rain from 18:00 · Storm risk unknown for this peak')
  assert.equal(windowTone(w, { stormUnknown: true }), 'warn')
  assert.equal(windowTone({ window: null, next: null }, { stormUnknown: true }), 'rain')
})

test('defaultSummitTab — after sunset (no window possible today) the peak opens on Tomorrow', () => {
  assert.equal(defaultSummitTab(null), 'today') // still loading
  assert.equal(defaultSummitTab({ windows: { today: { window: null, next: null }, tomorrow: null } }), 'today') // a day without a window is still today's answer
  assert.equal(defaultSummitTab({ windows: { today: null, tomorrow: { window: null } } }), 'tomorrow')
})

test('noDaylightPointer — Today after sunset: one line pointing to tomorrow', () => {
  const d = { nowLocal: '2026-10-01T19:30', notes: [], windows: { today: null, tomorrow: { window: { from: '2026-10-02T08:00', to: '2026-10-02T11:00', hours: 3 }, next: null } } }
  // neutral: green or blue on "no daylight left" would read as a verdict on tonight
  assert.deepEqual(noDaylightPointer('en', d), { title: 'No daylight left today', sub: 'Summit window tomorrow 08:00–11:00', tone: 'neutral' })
  const none = { ...d, windows: { today: null, tomorrow: { window: null, next: null } } }
  assert.deepEqual(noDaylightPointer('en', none), { title: 'No daylight left today', sub: 'No safe summit window tomorrow', tone: 'neutral' })
  assert.equal(noDaylightPointer('en', { ...d, windows: { today: null, tomorrow: null } }).sub, null)
})
