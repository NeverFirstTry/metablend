import { test } from 'node:test'
import assert from 'node:assert/strict'
import { conditionIcon, heroCondition } from './conditions.js'

test('conditionIcon — words to emoji, the moon only for a clear night', () => {
  assert.equal(conditionIcon('Light rain', 12), '🌧')
  assert.equal(conditionIcon('Partly cloudy', 12, true), '⛅')
  assert.equal(conditionIcon('Clear', 12, true), '🌙')
  assert.equal(conditionIcon('Clear', 12, false), '☀️')
  assert.equal(conditionIcon(null, 12), '🌤')
})

test('heroCondition — Open-Meteo first, then the first healthy source', () => {
  assert.equal(heroCondition({ sources: [{ apiId: 'x', condition: 'Rain' }, { apiId: 'open-meteo', condition: 'Clear' }] }), 'Clear')
  assert.equal(heroCondition({ sources: [{ apiId: 'open-meteo', down: true, condition: 'Clear' }, { apiId: 'y', condition: 'Fog' }] }), 'Fog')
  assert.equal(heroCondition({ sources: [{ apiId: 'z', down: true, condition: 'Snow' }] }), null)
  assert.equal(heroCondition(null), null)
})
