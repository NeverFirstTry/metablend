import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planDays } from './push-days.js'

test('planDays — today and the next 7 days, named in the language', () => {
  const days = planDays('en', '2026-10-01')
  assert.equal(days.length, 8)
  assert.deepEqual(days.slice(0, 2).map(d => d.date), ['2026-10-01', '2026-10-02'])
  assert.equal(days[7].date, '2026-10-08')
  assert.ok(days.every(d => typeof d.label === 'string' && d.label.length > 0))
  assert.notEqual(planDays('de', '2026-10-01')[1].label, days[1].label)
})

test('planDays — the chips stand alone, so they start with a capital', () => {
  assert.deepEqual(planDays('en', '2026-10-01').slice(0, 2).map(d => d.label), ['Today', 'Tomorrow'])
  assert.equal(planDays('de', '2026-10-01')[0].label, 'Heute')
})
