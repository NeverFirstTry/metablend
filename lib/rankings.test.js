import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupByRegion } from './rankings.js'

test('groupByRegion: no Global tab, and regions in their fixed order', () => {
  const regions = groupByRegion([
    { id: 'icon', region: 'asia', weight: 1 },
    { id: 'icon', region: 'global', weight: 1 },
    { id: 'icon', region: 'europe', weight: 1 },
  ])
  assert.deepEqual(regions.map(r => r.region), ['europe', 'asia'])
})

test('groupByRegion: retired sources are gone and the shares of the others add up to 100%, in the same proportions', () => {
  const [europe] = groupByRegion([
    { id: 'ecmwf', region: 'europe', weight: 0.3 },
    { id: 'tomorrow', region: 'europe', weight: 0.25 },
    { id: 'icon', region: 'europe', weight: 0.6 },
    { id: 'world-weather-online', region: 'europe', weight: 0.05 },
    { id: 'weatherstack', region: 'europe', weight: 0.03 },
    { id: 'nasa-power', region: 'europe', weight: 0.02 },
  ])
  assert.deepEqual(europe.apis.map(a => a.id), ['icon', 'ecmwf'])
  assert.ok(Math.abs(europe.apis[0].weight - 2 / 3) < 1e-9)
  assert.ok(Math.abs(europe.apis[1].weight - 1 / 3) < 1e-9)
  assert.equal(europe.leader.id, 'icon')
})

test('groupByRegion: stats join by source, and a region holding only retired sources has no tab', () => {
  const regions = groupByRegion([
    { id: 'icon', region: 'europe', weight: 1 },
    { id: 'tomorrow', region: 'asia', weight: 1 },
  ], { icon: { avgMs: 120, uptime: 99 } })
  assert.deepEqual(regions.map(r => r.region), ['europe'])
  assert.equal(regions[0].apis[0].avgMs, 120)
})
