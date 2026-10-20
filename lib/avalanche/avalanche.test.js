import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { t } from '../i18n.js'
import { parseRatings, avalancheLevel, bulletinDates, ratingsUrl, AVA_KEYS } from './avalanche.js'

const regionData = JSON.parse(fs.readFileSync(new URL('./regions.json', import.meta.url), 'utf8'))
const ratings = parseRatings(JSON.parse(fs.readFileSync(new URL('./__fixtures__/ratings-2026-03-01.json', import.meta.url), 'utf8')))

test('parseRatings — the day\'s level per region (1–5); morning / afternoon / elevation variants and "no rating" (0) drop', () => {
  const r = parseRatings({ maxDangerRatings: { 'AT-07-01': 3, 'AT-07-01:am': 2, 'AT-07-01:high': 3, 'NO-3003': 0, 'X-1': 7, 'X-2': 'high' } })
  assert.deepEqual(r, { 'AT-07-01': 3 })
  assert.deepEqual(parseRatings(null), {})
})

test('avalancheLevel — 1 March 2026: Großglockner 3, Davos 3, Zugspitze 2, Triglav 2; Vienna has no avalanche region', () => {
  assert.deepEqual(avalancheLevel(regionData, ratings, 47.0745, 12.6939), { region: 'AT-07-26-01', level: 3 })
  assert.equal(avalancheLevel(regionData, ratings, 46.80, 9.84)?.level, 3)
  assert.equal(avalancheLevel(regionData, ratings, 47.4211, 10.9853)?.level, 2)
  assert.equal(avalancheLevel(regionData, ratings, 46.3783, 13.8369)?.level, 2)
  assert.equal(avalancheLevel(regionData, ratings, 48.21, 16.37), null)
  assert.equal(avalancheLevel(regionData, {}, 47.0745, 12.6939), null) // out of season: no rating
})

test('bulletinDates — today and tomorrow in Central European time, which the bulletins use', () => {
  assert.deepEqual(bulletinDates(Date.parse('2026-01-15T22:30:00Z')), { today: '2026-01-15', tomorrow: '2026-01-16' })
  assert.deepEqual(bulletinDates(Date.parse('2026-01-15T23:30:00Z')), { today: '2026-01-16', tomorrow: '2026-01-17' }) // after midnight in Vienna
  assert.equal(ratingsUrl('2026-03-01'), 'https://static.avalanche.report/eaws_bulletins/2026-03-01/2026-03-01.ratings.json')
})

test('the five danger levels and the card texts exist in English (parity covers the other 12)', () => {
  for (const k of AVA_KEYS) assert.notEqual(t('en', k), k, k)
  assert.equal(t('en', 'avaLevel3'), 'Considerable')
})
