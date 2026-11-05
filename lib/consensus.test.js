import test from 'node:test'
import assert from 'node:assert/strict'
import { blendNow } from './consensus.js'

const source = (apiId, temp, more = {}) => ({ apiId, temp, windKmh: 10, ...more })
const rows = (...weights) => weights.map(([id, weight]) => ({ id, weight }))

test('the consensus is the weighted mean, rounded like the page shows it', () => {
  const { consensus, weights } = blendNow(
    [source('a', 10, { feelsLike: 8, windKmh: 10 }), source('b', 20, { windKmh: 21 })],
    rows(['a', 0.75], ['b', 0.25]),
  )
  assert.equal(consensus.temp, 12.5)
  assert.equal(consensus.feelsLike, 11) // b has no feels-like and counts with its temperature
  assert.equal(consensus.windKmh, 13)
  assert.deepEqual(weights, { a: 0.75, b: 0.25 })
})

test('a source never scored here counts like an average one, not about five times as much', () => {
  const { consensus } = blendNow(
    [source('a', 10), source('b', 10), source('new', 40)],
    rows(['a', 0.5], ['b', 0.5]),
  )
  assert.equal(consensus.temp, 20) // (5 + 5 + 40 × 0.5) / 1.5
})

test('with no saved weights at all, every source counts the same', () => {
  assert.equal(blendNow([source('a', 10), source('b', 20)], []).consensus.temp, 15)
})

test('rain is averaged over real probabilities; stand-ins count only when nothing better answered', () => {
  const real = source('a', 10, { rainPct: 40, rainIsProb: true })
  const standIn = source('b', 10, { rainPct: 90 })
  assert.equal(blendNow([real, standIn], rows(['a', 0.5], ['b', 0.5])).consensus.rainPct, 40)
  assert.equal(blendNow([standIn], rows(['b', 1])).consensus.rainPct, 90)
  assert.equal(blendNow([source('c', 10)], rows(['c', 1])).consensus.rainPct, null)
})

test('sources reporting rain floor the number: "3 report rain" never sits next to a single-digit chance', () => {
  const dry = source('a', 10, { rainPct: 5, rainIsProb: true, condition: 'Clear' })
  const wet = id => source(id, 10, { condition: 'Light rain' })
  const blended = blendNow([dry, wet('b'), wet('c')], rows(['a', 0.4], ['b', 0.3], ['c', 0.3]))
  assert.equal(blended.consensus.rainPct, 67)
  assert.deepEqual(blended.rainingNow, { count: 2, total: 3 })
  // fewer than three sources describing the sky is not a vote
  assert.equal(blendNow([dry, wet('b')], rows(['a', 0.5], ['b', 0.5])).consensus.rainPct, 5)
  // and no rain data plus nobody reporting rain stays "no data"
  assert.equal(blendNow(['a', 'b', 'c'].map(id => source(id, 10, { condition: 'Clear' })), []).consensus.rainPct, null)
})

test('confidence falls as the sources disagree, and stays between 0 and 100', () => {
  const agree = blendNow([source('a', 10), source('b', 10)], rows(['a', 0.5], ['b', 0.5]))
  assert.equal(agree.consensus.confidencePct, 100)
  const split = blendNow([source('a', 8), source('b', 12)], rows(['a', 0.5], ['b', 0.5]))
  assert.equal(split.consensus.confidencePct, 76) // std 2 °C
  const apart = blendNow([source('a', -20), source('b', 40)], rows(['a', 0.5], ['b', 0.5]))
  assert.equal(apart.consensus.confidencePct, 0)
})

test('the warning needs everyone to agree, and a humid stand-in cannot trip it', () => {
  const heavy = id => source(id, 10, { rainPct: 90, rainIsProb: true, condition: 'Rain' })
  assert.deepEqual(blendNow([heavy('a'), heavy('b')], []).warning, { active: true, type: 'heavy_rain' })
  // one probability source is not everyone
  assert.deepEqual(blendNow([heavy('a')], []).warning, { active: false })
  // cloud-cover stand-ins at 95 % don't count
  assert.deepEqual(blendNow([source('a', 10, { rainPct: 95 }), source('b', 10, { rainPct: 95 })], []).warning, { active: false })
  const storm = id => source(id, 10, { condition: 'Gewitter' })
  assert.deepEqual(blendNow([storm('a'), storm('b')], []).warning, { active: true, type: 'thunderstorm' })
  assert.deepEqual(blendNow([storm('a'), source('b', 10, { condition: 'Clear' })], []).warning, { active: false })
})
