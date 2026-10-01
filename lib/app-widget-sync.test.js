import { test } from 'node:test'
import assert from 'node:assert/strict'
import { widgetSettings, localToday } from './app-widget-sync.js'

const plan = (name, date) => ({ id: `id-${name}`, name, lat: 46.7, lon: 12.8, elev: 2000, date, created_at: 'x' })

test('widgetSettings — home from notifications first, recent by views, upcoming hikes only', () => {
  const s = widgetSettings({
    lang: 'de', unit: 'C', home: 'Wien', views: { Lienz: 7, Wien: 2, Innsbruck: 2, Graz: 0 },
    plans: [plan('B', '2026-10-03'), plan('A', '2026-10-01'), plan('Old', '2026-09-30')], today: '2026-10-01',
  })
  assert.deepEqual(s, {
    v: 1, lang: 'de', unit: 'C', base: 'https://metablend.app', home: 'Wien', recent: ['Wien', 'Lienz', 'Innsbruck'],
    hikes: [
      { name: 'A', lat: 46.7, lon: 12.8, elev: 2000, date: '2026-10-01' },
      { name: 'B', lat: 46.7, lon: 12.8, elev: 2000, date: '2026-10-03' },
    ],
  })
})

test('widgetSettings — no notification home: the most-viewed city; nothing at all: null', () => {
  assert.equal(widgetSettings({ lang: 'en', unit: 'F', views: { Graz: 1, Linz: 3 }, today: '2026-10-01' }).home, 'Linz')
  const empty = widgetSettings({ lang: 'en', unit: 'C', today: '2026-10-01' })
  assert.equal(empty.home, null)
  assert.deepEqual(empty.recent, [])
  assert.deepEqual(empty.hikes, [])
})

test('widgetSettings — at most 8 cities and 5 hikes', () => {
  const views = Object.fromEntries('ABCDEFGHIJ'.split('').map((c, i) => [c, 20 - i]))
  const plans = ['01', '02', '03', '04', '05', '06', '07'].map(d => plan(`P${d}`, `2026-10-${d}`))
  const s = widgetSettings({ lang: 'en', unit: 'C', views, plans, today: '2026-10-01' })
  assert.deepEqual(s.recent, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
  assert.deepEqual(s.hikes.map(h => h.name), ['P01', 'P02', 'P03', 'P04', 'P05'])
})

test('localToday — the phone’s own calendar day', () => {
  assert.equal(localToday(new Date(2026, 0, 5, 23, 30)), '2026-01-05')
})
