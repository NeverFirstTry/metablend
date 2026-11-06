import { test } from 'node:test'
import assert from 'node:assert/strict'
import { statRows } from './api-stats.js'

test('statRows: an answer is up; no answer and a thrown error are failures; a source that does not apply is left out', () => {
  assert.deepEqual(statRows([
    { id: 'icon', ms: 120, value: { temp: 3 }, down: false },
    { id: 'owm', ms: 80, value: null, down: false }, // over its limit: asked, no answer
    { id: 'ecmwf', ms: 8000, value: null, down: true }, // threw
    { id: 'nws', ms: 0, value: undefined, down: false }, // outside the US
  ]), [
    { api_id: 'icon', ms: 120, up: true },
    { api_id: 'owm', ms: 80, up: false },
    { api_id: 'ecmwf', ms: 8000, up: false },
  ])
})
