import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planDays } from './push-days.js'

test('planDays — the next 7 days from tomorrow (a hike today can no longer be announced), named in the language', () => {
  const days = planDays('en', '2026-10-01')
  assert.equal(days.length, 7)
  assert.deepEqual(days.slice(0, 2).map(d => d.date), ['2026-10-02', '2026-10-03'])
  assert.equal(days[6].date, '2026-10-08')
  assert.ok(days.every(d => typeof d.label === 'string' && d.label.length > 0))
  assert.notEqual(planDays('de', '2026-10-01')[0].label, days[0].label)
})

test('planDays — the chips stand alone, so they start with a capital', () => {
  assert.equal(planDays('en', '2026-10-01')[0].label, 'Tomorrow')
  assert.equal(planDays('de', '2026-10-01')[0].label, 'Morgen')
})
