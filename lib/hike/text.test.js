import { test } from 'node:test'
import assert from 'node:assert/strict'
import { windowText, windowTone } from './text.js'

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
