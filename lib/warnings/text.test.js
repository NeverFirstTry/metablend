import { test } from 'node:test'
import assert from 'node:assert/strict'
import { t } from '../i18n.js'
import { WARNING_KEYS, levelWord, levelIcons, typeWord, warningText, warningSpan, sortWarnings, stripWarning, warningOnDay } from './text.js'
import { WARNING_TYPES } from './parse.js'

const w = (id, level, onset, expires, extra = {}) => ({ id, level, type: 'thunderstorm', onset, expires, texts: {}, ...extra })

test('every warning text exists in English (parity covers the other 12)', () => {
  for (const k of WARNING_KEYS) assert.notEqual(t('en', k), k, k)
  for (const type of WARNING_TYPES) assert.ok(WARNING_KEYS.includes(`warnType_${type}`), type)
})

test('levels — a word and an icon count, never colour alone', () => {
  assert.deepEqual([2, 3, 4].map(l => levelWord('en', l)), ['Yellow', 'Orange', 'Red'])
  assert.deepEqual([2, 3, 4].map(levelIcons), ['⚠', '⚠⚠', '⚠⚠⚠'])
  assert.equal(typeWord('en', 'snow_ice'), 'Snow and ice')
  assert.equal(typeWord('en', 'nonsense'), t('en', 'warnType_other'))
})

test('warningText — text falls back to English, then the first language', () => {
  const texts = { de: { headline: 'Gewitter' }, en: { headline: 'Thunderstorms' } }
  assert.equal(warningText({ texts }, 'de').headline, 'Gewitter')
  assert.equal(warningText({ texts }, 'ja').headline, 'Thunderstorms')
  assert.equal(warningText({ texts: { es: { headline: 'Tormentas' } } }, 'ja').headline, 'Tormentas')
  assert.deepEqual(warningText({ texts: {} }, 'en'), { event: '', headline: '', description: '', instruction: '' })
})

test('warningSpan — the issuer\'s own clock, with today / tomorrow / weekday', () => {
  assert.equal(warningSpan('en', w('a', 3, '2026-10-08T15:00:00+02:00', '2026-10-08T21:00:00+02:00'), '2026-10-08'), 'today 15:00–21:00')
  assert.equal(warningSpan('en', w('a', 3, '2026-10-08T22:00:00+02:00', '2026-10-09T06:00:00+02:00'), '2026-10-08'), 'today 22:00 – tomorrow 06:00')
})

test('sortWarnings / stripWarning — most serious first; the strip only for orange or red within 24 h', () => {
  const now = Date.parse('2026-10-08T08:00:00+02:00')
  const y = w('y', 2, '2026-10-08T09:00:00+02:00', '2026-10-08T20:00:00+02:00')
  const o = w('o', 3, '2026-10-08T15:00:00+02:00', '2026-10-08T21:00:00+02:00')
  const late = w('l', 4, '2026-10-10T12:00:00+02:00', '2026-10-10T20:00:00+02:00')
  assert.deepEqual(sortWarnings([y, late, o]).map(x => x.id), ['l', 'o', 'y'])
  assert.equal(stripWarning([y, o, late], now)?.id, 'o') // red starts in 52 h: not on the strip yet
  assert.equal(stripWarning([y], now), null)
})

test('warningOnDay — an orange or red warning touching that local day', () => {
  const o = w('o', 3, '2026-10-09T22:00:00+02:00', '2026-10-10T06:00:00+02:00')
  assert.equal(warningOnDay([o], '2026-10-10')?.id, 'o')
  assert.equal(warningOnDay([o], '2026-10-11'), null)
  assert.equal(warningOnDay([w('y', 2, '2026-10-10T08:00:00+02:00', '2026-10-10T12:00:00+02:00')], '2026-10-10'), null)
  assert.equal(warningOnDay(null, '2026-10-10'), null)
})
