import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pushText } from './text.js'

test('pushText — weather alerts in the language, hours as HH:MM', () => {
  assert.deepEqual(pushText('en', 'C', { kind: 'rain', vars: { city: 'Vienna', from: '2026-10-01T15:00', pct: 80 } }),
    { title: '🌧 Rain in Vienna', body: 'From 15:00 (80%)' })
  assert.deepEqual(pushText('de', 'C', { kind: 'rain', vars: { city: 'Wien', from: '2026-10-01T15:00', pct: 80 } }),
    { title: '🌧 Regen in Wien', body: 'Ab 15:00 (80 %)' })
  assert.deepEqual(pushText('en', 'C', { kind: 'storm', vars: { city: 'Vienna', from: '2026-10-01T16:00', to: '2026-10-01T19:00' } }),
    { title: '⛈ Thunderstorms in Vienna', body: 'Likely 16:00–19:00' })
  assert.deepEqual(pushText('fr', 'C', { kind: 'severe', vars: { city: 'Vienne', what: 'wind', from: '2026-10-01T14:00' } }),
    { title: '⚠️ Vent fort à Vienne', body: 'À partir de 14:00' })
})

test('pushText — heat and briefing in the device unit', () => {
  assert.deepEqual(pushText('en', 'F', { kind: 'heat', vars: { city: 'Vienna', max: 34 } }),
    { title: '🌡 Hot day in Vienna', body: 'Up to 93°' })
  const brief = pushText('en', 'C', { kind: 'briefing', vars: {
    city: 'Vienna', date: '2026-10-01', min: 12.4, max: 21.2, heat: false,
    headline: { code: 'dry', night: false, peak: null }, best: '2026-10-01T14:00',
  } })
  assert.deepEqual(brief, { title: 'Vienna today', body: '12–21° · Dry for the rest of today · Best time out 14:00' })
  const hot = pushText('de', 'C', { kind: 'briefing', vars: {
    city: 'Wien', date: '2026-10-01', min: 19, max: 31, heat: true,
    headline: { code: 'dry', night: false, peak: null }, best: null,
  } })
  assert.deepEqual(hot, { title: '🌡 Wien heute', body: '19–31° · Heute bleibt es trocken' })
})

test('pushText — hike windows and the test message', () => {
  const w = { window: { from: '2026-10-02T07:00', to: '2026-10-02T11:00', hours: 4 }, next: { reason: 'storms', at: '2026-10-02T11:00' } }
  const hike = pushText('en', 'C', { kind: 'hike_evening', vars: { peak: 'Triglav', window: w, date: '2026-10-02', todayLocal: '2026-10-01', stormUnknown: false } })
  assert.equal(hike.title, '⛰ Triglav')
  assert.match(hike.body, /07:00/)
  assert.match(hike.body, /11:00/)
  assert.deepEqual(pushText('it', 'C', { kind: 'test', vars: {} }), { title: 'MetaBlend', body: 'Le notifiche funzionano 👍' })
  assert.equal(pushText('en', 'C', { kind: 'nonsense', vars: {} }), null)
})

test('pushText — every kind in every language and unit: filled, no leftover {placeholders}', () => {
  const w = { window: { from: '2026-10-02T07:00', to: '2026-10-02T11:00', hours: 4 }, next: null }
  const msgs = [
    { kind: 'rain', vars: { city: 'X', from: '2026-10-01T15:00', pct: 80 } },
    { kind: 'storm', vars: { city: 'X', from: '2026-10-01T16:00', to: '2026-10-01T19:00' } },
    ...['heavy_rain', 'heavy_snow', 'freezing_rain', 'wind'].map(what => ({ kind: 'severe', vars: { city: 'X', what, from: '2026-10-01T14:00' } })),
    { kind: 'heat', vars: { city: 'X', max: 31 } },
    { kind: 'briefing', vars: { city: 'X', date: '2026-10-01', min: 12, max: 21, heat: true, headline: { code: 'rain_window', from: '2026-10-01T13:00', to: '2026-10-01T17:00', agree: 5, total: 7, night: false, peak: null }, best: '2026-10-01T10:00' } },
    { kind: 'hike_evening', vars: { peak: 'P', window: w, date: '2026-10-02', todayLocal: '2026-10-01', stormUnknown: true } },
    { kind: 'hike_morning', vars: { peak: 'P', window: { window: null, next: { reason: 'storms', at: '2026-10-02T11:00' } }, date: '2026-10-02', todayLocal: '2026-10-02', stormUnknown: false } },
    { kind: 'test', vars: {} },
  ]
  for (const lang of ['en', 'de', 'fr', 'es', 'it']) {
    for (const unit of ['C', 'F']) {
      for (const m of msgs) {
        const r = pushText(lang, unit, m)
        assert.ok(r?.title && r?.body, `${lang} ${unit} ${m.kind}`)
        assert.doesNotMatch(`${r.title} ${r.body}`, /[{}]|undefined|NaN/, `${lang} ${unit} ${m.kind}: ${r.title} / ${r.body}`)
      }
    }
  }
})

test('pushText — route alerts: the start, or why there is none', () => {
  const ok = pushText('en', 'C', { kind: 'hike_route_evening', vars: { peak: '712 Alter Kalser Weg', date: '2026-10-03', todayLocal: '2026-10-02', suggestion: { start: '07:30', latest: '09:00', highAt: '10:45' } } })
  assert.equal(ok.body, 'Start by 07:30 — summit ~10:45 (safe to start until 09:00)')
  const none = pushText('de', 'C', { kind: 'hike_route_morning', vars: { peak: 'X', date: '2026-10-03', todayLocal: '2026-10-03', suggestion: { none: true, reason: 'storms' } } })
  assert.match(none.body, /^Kein sicherer Start heute: Gewitter/)
})

test('pushText — a nowcast rain alert says when and how long', () => {
  const m = pushText('en', 'C', { kind: 'rain', vars: { city: 'Vienna', from: '2026-10-03T14:30', minutes: 25, duration: 30, intensity: 'light', nowcast: true } })
  assert.equal(m.title, '🌧 Rain in Vienna')
  assert.equal(m.body, 'In ~25 min · light, about 30 min')
})
