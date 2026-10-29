import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rescueStep } from './app-rescue.js'

test('rescueStep — the teaser in the app: a soft refresh first, then a full load the server always answers with the app view', () => {
  assert.deepEqual(rescueStep('https://metablend.app/hike', false), { action: 'refresh' })
  // still the teaser after the refresh, or again later in the same run
  assert.deepEqual(rescueStep('https://metablend.app/hike?peak=grossglockner#x', true), { action: 'reload', to: '/hike?peak=grossglockner&app=1#x' })
})

test('rescueStep — never a third try: with ?app=1 the server sends the app view, so there is nothing left to rescue', () => {
  assert.deepEqual(rescueStep('https://metablend.app/hike?app=1', false), { action: 'stop' })
  assert.deepEqual(rescueStep('https://metablend.app/hike?app=1', true), { action: 'stop' })
})
