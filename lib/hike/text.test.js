import { test } from 'node:test'
import assert from 'node:assert/strict'
import { windowText, windowTone, defaultSummitTab, noDaylightPointer, seenOn } from './text.js'

const T = '2026-10-01'

test('windowText — a window and what ends it', () => {
  const w = { window: { from: '2026-10-02T07:00', to: '2026-10-02T12:00', hours: 5 }, next: { reason: 'storms', at: '2026-10-02T14:00' } }
  assert.deepEqual(windowText('en', w, { date: '2026-10-02', todayLocal: T }), { title: 'Summit window tomorrow 07:00-12:00', sub: 'storms likely from 14:00' })
  assert.equal(windowText('de', w, { date: '2026-10-02', todayLocal: T }).title, 'Gipfelfenster morgen 07:00-12:00')
})

test('windowText — no window; no daylight left; nothing ends a fine day', () => {
  assert.deepEqual(windowText('en', { window: null, next: { reason: 'rain', at: `${T}T09:00` } }, { date: T, todayLocal: T }), { title: 'No favourable summit window today', sub: 'rain from 09:00' })
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

// X3 (owner 2026-11-20): the window is the peak's answer, gold; none is neutral (it was green and blue)
test('windowTone — the answer (gold) for a window, neutral for none and without daylight', () => {
  assert.equal(windowTone({ window: { from: 'a', to: 'b', hours: 1 }, next: null }), 'answer')
  assert.equal(windowTone({ window: null, next: null }), 'neutral')
  assert.equal(windowTone(null), 'neutral')
})

test('unknown storm risk — the headline says so and is never green', () => {
  const w = { window: { from: `${T}T08:00`, to: `${T}T18:00`, hours: 10 }, next: null }
  assert.deepEqual(windowText('en', w, { date: T, todayLocal: T, stormUnknown: true }), { title: 'Summit window today 08:00-18:00', sub: 'Storm risk unknown for this peak' })
  const late = { ...w, next: { reason: 'rain', at: `${T}T18:00` } }
  assert.equal(windowText('en', late, { date: T, todayLocal: T, stormUnknown: true }).sub, 'rain from 18:00 · Storm risk unknown for this peak')
  assert.equal(windowTone(w, { stormUnknown: true }), 'warn')
  assert.equal(windowTone({ window: null, next: null }, { stormUnknown: true }), 'neutral')
})

test('defaultSummitTab — after sunset (no window possible today) the peak opens on Tomorrow', () => {
  assert.equal(defaultSummitTab(null), 'today') // still loading
  assert.equal(defaultSummitTab({ windows: { today: { window: null, next: null }, tomorrow: null } }), 'today') // a day without a window is still today's answer
  assert.equal(defaultSummitTab({ windows: { today: null, tomorrow: { window: null } } }), 'tomorrow')
})

test('noDaylightPointer — Today after sunset: one line pointing to tomorrow', () => {
  const d = { nowLocal: '2026-10-01T19:30', notes: [], windows: { today: null, tomorrow: { window: { from: '2026-10-02T08:00', to: '2026-10-02T11:00', hours: 3 }, next: null } } }
  // neutral: green or blue on "no daylight left" would read as a verdict on tonight
  assert.deepEqual(noDaylightPointer('en', d), { title: 'No daylight left today', sub: 'Summit window tomorrow 08:00-11:00', tone: 'neutral' })
  const none = { ...d, windows: { today: null, tomorrow: { window: null, next: null } } }
  assert.deepEqual(noDaylightPointer('en', none), { title: 'No daylight left today', sub: 'No favourable summit window tomorrow', tone: 'neutral' })
  assert.equal(noDaylightPointer('en', { ...d, windows: { today: null, tomorrow: null } }).sub, null)
})

test('windowText — a window cut by missing forecast data says so', () => {
  const w = { window: { from: '2026-10-02T08:00', to: '2026-10-02T09:00', hours: 1 }, next: { reason: 'nodata', at: '2026-10-02T09:00' } }
  assert.equal(windowText('en', w, { date: '2026-10-02', todayLocal: '2026-10-02' }).sub, 'no complete forecast from 09:00')
  assert.equal(windowText('de', w, { date: '2026-10-02', todayLocal: '2026-10-02' }).sub, 'keine vollständige Vorhersage ab 09:00')
})

// A copy is read later than it was made: kept through an outage, or made before midnight and read after it. Until
// 2026-11-21 the app's peak view called the copy's day 'Today' (code audit, finding 11); the summit pages were
// fixed for the same on 17 November. The reader's day at the summit decides, and each window keeps its own date.
const win = (date, from, to) => ({ window: { from: date + 'T' + from, to: date + 'T' + to, hours: 4 }, next: null })
const copy = (nowLocal, today, more = {}) => ({
  nowLocal, notes: [], days: ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'].map(date => ({ date })),
  windows: { today, tomorrow: win('2026-11-21', '08:00', '12:00'), days: [{ date: '2026-11-20', w: today }, { date: '2026-11-21', w: win('2026-11-21', '08:00', '12:00') }, { date: '2026-11-22', w: win('2026-11-22', '09:00', '13:00') }] },
  ...more,
})

test("seenOn — read on the day it was made, the copy is shown as it is", () => {
  const d = copy('2026-11-20T14:00', win('2026-11-20', '14:00', '16:00'))
  assert.equal(seenOn(d, '2026-11-20'), d)
})

test("seenOn — a copy of yesterday afternoon read this morning: today is the reader's day, with that day's window", () => {
  const seen = seenOn(copy('2026-11-20T14:00', win('2026-11-20', '14:00', '16:00')), '2026-11-21')
  assert.equal(seen.nowLocal.slice(0, 10), '2026-11-21')
  assert.equal(seen.windows.today.window.from, '2026-11-21T08:00')
  assert.equal(seen.windows.tomorrow.window.from, '2026-11-22T09:00')
})

test("seenOn — made at 23:00 with no daylight left, read after midnight: the peak opens on Today, not on the day after", () => {
  const d = copy('2026-11-20T23:00', null)
  assert.equal(defaultSummitTab(d), 'tomorrow')
  const seen = seenOn(d, '2026-11-21')
  assert.equal(defaultSummitTab(seen), 'today')
  assert.equal(seen.windows.today.window.from, '2026-11-21T08:00')
})

test("seenOn — an older copy without the list of days: its tomorrow is the reader's today, and the day after has no window", () => {
  const d = copy('2026-11-20T23:00', null)
  const seen = seenOn({ ...d, windows: { today: null, tomorrow: d.windows.tomorrow } }, '2026-11-21')
  assert.equal(seen.windows.today.window.from, '2026-11-21T08:00')
  assert.equal(seen.windows.tomorrow, undefined)
})

test("seenOn — a clock the copy has no day for is not believed: the copy is shown as it is", () => {
  const d = copy('2026-11-20T14:00', win('2026-11-20', '14:00', '16:00'))
  assert.equal(seenOn(d, '2027-03-01'), d)
  assert.equal(seenOn(d, '2026-11-19'), d)
})
