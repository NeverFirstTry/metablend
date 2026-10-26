import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resumeForecast } from './forecast-session.js'

const NOW = Date.parse('2026-10-26T12:00:00Z')
const session = { city: 'Vienna', data: { city: 'Vienna' }, outlook: { days: [] }, nextRefreshAt: NOW + 10 * 60e3 }

test('resumeForecast — back on the Forecast tab: the last screen at once, nothing fetched while fresh', () => {
  assert.deepEqual(resumeForecast({ session, deepLink: null, now: NOW }), { restore: true, refresh: false, load: null })
})

test('resumeForecast — the last screen at once even when due, refreshed quietly behind it', () => {
  assert.deepEqual(resumeForecast({ session, deepLink: null, now: NOW + 11 * 60e3 }), { restore: true, refresh: true, load: null })
})

test('resumeForecast — a link to another city (notification, widget) loads that one; the same city counts as a resume', () => {
  assert.deepEqual(resumeForecast({ session, deepLink: 'Lienz', now: NOW }), { restore: false, refresh: false, load: 'Lienz' })
  assert.deepEqual(resumeForecast({ session, deepLink: 'vienna', now: NOW }), { restore: true, refresh: false, load: null })
})

test('resumeForecast — nothing kept yet (the page just opened): the normal start', () => {
  assert.deepEqual(resumeForecast({ session: { city: '', data: null }, deepLink: null, now: NOW }), { restore: false, refresh: false, load: null })
})
