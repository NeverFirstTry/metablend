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

test('heroCondition — a tie goes to Open-Meteo; down sources and empty data say nothing', () => {
  assert.equal(heroCondition({ sources: [{ apiId: 'x', condition: 'Rain' }, { apiId: 'open-meteo', condition: 'Clear' }] }), 'Clear')
  assert.equal(heroCondition({ sources: [{ apiId: 'open-meteo', down: true, condition: 'Clear' }, { apiId: 'y', condition: 'Fog' }] }), 'Fog')
  assert.equal(heroCondition({ sources: [{ apiId: 'z', down: true, condition: 'Snow' }] }), null)
  assert.equal(heroCondition(null), null)
})

test('heroCondition — what most sources say: one source\'s rain doesn\'t beat a dry majority', () => {
  const sources = [
    { apiId: 'open-meteo', condition: 'Slight rain' },
    { apiId: 'owm', condition: 'scattered clouds' }, { apiId: 'weatherapi', condition: 'Partly Cloudy' },
    { apiId: 'tomorrow', condition: 'Clear' }, { apiId: 'met-norway', condition: 'Cloudy' },
    { apiId: 'gfs', condition: 'Partly cloudy' },
  ]
  // dry 5 : wet 1; of the dry ones partly cloudy is the most common — in its most common wording
  assert.equal(heroCondition({ sources }), 'Partly Cloudy')
})

test('heroCondition — rain when most sources report it, whatever Open-Meteo says', () => {
  const sources = [
    { apiId: 'open-meteo', condition: 'Overcast' },
    { apiId: 'owm', condition: 'light rain' }, { apiId: 'weatherapi', condition: 'Light rain' },
    { apiId: 'tomorrow', condition: 'Drizzle' }, { apiId: 'gfs', condition: 'Cloudy' },
  ]
  assert.equal(heroCondition({ sources }), 'light rain')
})

test('heroCondition — a tie between wet and dry goes to Open-Meteo, and so does a tie inside the winner', () => {
  const wet = [{ apiId: 'open-meteo', condition: 'Light drizzle' }, { apiId: 'a', condition: 'Rain' }, { apiId: 'b', condition: 'Clear' }, { apiId: 'c', condition: 'Clear' }]
  assert.equal(heroCondition({ sources: wet }), 'Light drizzle')
  const dry = [{ apiId: 'open-meteo', condition: 'Fog' }, { apiId: 'a', condition: 'Clear' }, { apiId: 'b', condition: 'Rain' }, { apiId: 'c', condition: 'Showers' }]
  assert.equal(heroCondition({ sources: dry }), 'Fog')
})

test('heroCondition — snow and thunder count as wet; the synthetic MetaBlend Local entry never votes', () => {
  assert.equal(heroCondition({ sources: [{ apiId: 'open-meteo', condition: 'Partly cloudy' }, { apiId: 'a', condition: 'Light snow' }, { apiId: 'b', condition: 'Snow showers' }] }), 'Light snow')
  assert.equal(heroCondition({ sources: [{ apiId: 'open-meteo', condition: 'Clear' }, { apiId: 'a', condition: 'Rain' }, { apiId: 'metablend', synthetic: true, condition: 'Clear' }, { apiId: 'b', condition: 'Rain' }] }), 'Rain')
  // nothing recognisable: the old order (Open-Meteo, then the first healthy source)
  assert.equal(heroCondition({ sources: [{ apiId: 'x', condition: 'Weird' }, { apiId: 'open-meteo', condition: 'Odd' }] }), 'Odd')
})
