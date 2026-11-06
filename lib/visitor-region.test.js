import { test } from 'node:test'
import assert from 'node:assert/strict'
import { regionFromTimeZone } from './visitor-region.js'

test('regionFromTimeZone: the zone gives the region', () => {
  for (const [zone, region] of [
    ['Europe/Vienna', 'europe'], ['America/New_York', 'north_america'], ['America/Mexico_City', 'north_america'],
    ['America/Sao_Paulo', 'south_america'], ['America/Argentina/Buenos_Aires', 'south_america'], ['America/Bogota', 'south_america'],
    ['Asia/Tokyo', 'asia'], ['Africa/Nairobi', 'africa'], ['Australia/Sydney', 'oceania'], ['Pacific/Auckland', 'oceania'],
  ]) assert.equal(regionFromTimeZone(zone), region, zone)
})

test('regionFromTimeZone: unknown means Europe', () => {
  for (const zone of ['UTC', 'Etc/GMT+3', 'Atlantic/Reykjavik', '', null, undefined]) assert.equal(regionFromTimeZone(zone), 'europe', String(zone))
})
