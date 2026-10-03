import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nowcastSentence, nowcastShort, nowcastPushBody, NOWCAST_KEYS } from './nowcast-text.js'
import { t } from './i18n.js'

const start = { kind: 'start', at: '2026-10-03T14:30', minutes: 25, until: '2026-10-03T15:00', duration: 30, intensity: 'light', agree: 1 }

test('nowcastSentence — every summary kind in English', () => {
  assert.equal(nowcastSentence('en', { kind: 'dry' }), 'Dry for the next 2 hours')
  assert.equal(nowcastSentence('en', start), 'Rain from ~14:30 for about 30 min · light')
  assert.equal(nowcastSentence('en', { ...start, until: null, duration: null, intensity: 'heavy' }), 'Rain from ~14:30 · heavy')
  assert.equal(nowcastSentence('en', { kind: 'stop', until: '2026-10-03T14:45', intensity: 'moderate' }), 'Rain now, stops ~14:45')
  assert.equal(nowcastSentence('en', { kind: 'all', intensity: 'light' }), 'Rain for the next 2 hours · light')
  assert.equal(nowcastSentence('en', null), null)
})

test('nowcastShort — only when rain starts or stops within 2 hours', () => {
  assert.equal(nowcastShort('en', start), 'Rain ~14:30')
  assert.equal(nowcastShort('en', { kind: 'stop', until: '2026-10-03T14:45', intensity: 'light' }), 'Rain until ~14:45')
  assert.equal(nowcastShort('en', { kind: 'dry' }), null)
  assert.equal(nowcastShort('en', { kind: 'all', intensity: 'light' }), null)
})

test('nowcastPushBody — minutes, intensity, duration when known', () => {
  assert.equal(nowcastPushBody('en', { minutes: 25, duration: 30, intensity: 'light' }), 'In ~25 min · light, about 30 min')
  assert.equal(nowcastPushBody('en', { minutes: 25, duration: null, intensity: 'heavy' }), 'In ~25 min · heavy')
})

test('every nowcast text exists (English; parity.test.js covers the rest)', () => {
  for (const k of NOWCAST_KEYS) assert.notEqual(t('en', k), k, k)
})
