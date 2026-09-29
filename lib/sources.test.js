import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sourceName } from './sources.js'

test('sourceName — known ids get display names, unknown ids pass through', () => {
  assert.equal(sourceName('ecmwf'), 'ECMWF IFS')
  assert.equal(sourceName('metno-nordic'), 'MET Nordic')
  assert.equal(sourceName('open-meteo'), 'Open-Meteo')
  assert.equal(sourceName('mystery'), 'mystery')
})
