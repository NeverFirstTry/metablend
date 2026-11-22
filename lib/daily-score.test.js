// The nightly scoring compares like with like (code audit of 2026-11-20, finding 18; owner 2026-11-21: "First
// fix the daily scoring, so the final report compares like with like"). A stored forecast is the temperature
// at the moment someone looked. Until this change it was scored against the mean of the whole day: a city
// looked at at 15:00 with 25 degrees on a day whose mean was 18 marked the source that said 25 down and the
// one that said 21 up, every day. Now each reading is scored against the measured temperature of its own hour.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { localHour, dailyDeltas, dayHours, recordBudget } from './daily-score.js'

// a July day in Vienna: 14 at night, 25 at 15:00; its mean is about 18
const HOURS = [15, 14, 14, 13, 13, 14, 15, 17, 19, 21, 22, 23, 24, 25, 25, 25, 24, 23, 21, 19, 18, 17, 16, 15]
const at = hhmmUtc => `2026-07-10T${hhmmUtc}:00+00:00`

test('localHour: the nearest full hour on the place\'s own clock, from the service\'s offset', () => {
  assert.equal(localHour(at('13:00'), 2), 15)
  assert.equal(localHour(at('12:40'), 2), 15, '14:40 is nearer to 15:00')
  assert.equal(localHour(at('13:20'), 2), 15)
  assert.equal(localHour(at('02:10'), -8), 18, 'the evening before, in California')
  assert.equal(localHour(at('21:50'), 2), 23, 'ten minutes before midnight stays in its day')
  assert.equal(localHour(at('06:30'), 5.5), 12, 'half-hour offsets')
})

test('the audit\'s case: looked at at 15:00 with 25 degrees, the source that said 25 is right and the one that said 20 is not', () => {
  const rows = [
    { api_id: 'right', temp: 25, created_at: at('13:00') },
    { api_id: 'cold', temp: 20, created_at: at('13:00') },
    { api_id: 'near', temp: 24.2, created_at: at('13:00') },
  ]
  const d = dailyDeltas(rows, HOURS, 2)
  assert.equal(d.right, 2)
  assert.ok(d.cold < d.near && d.near <= d.right, JSON.stringify(d))
  assert.ok(d.cold < 0, 'five degrees off at that hour is marked down')
})

test('each source is scored at the hour of its own reading', () => {
  // one source was last read at 07:00 (17 degrees), another at 15:00 (25): both were right
  const d = dailyDeltas([{ api_id: 'morning', temp: 17, created_at: at('05:00') }, { api_id: 'noon', temp: 25, created_at: at('13:00') }], HOURS, 2)
  assert.deepEqual(d, { morning: 2, noon: 2 })
})

test('an hour without a measurement scores nothing; the outlier rule stays', () => {
  const gap = HOURS.map((t, h) => (h === 15 ? null : t))
  assert.deepEqual(dailyDeltas([{ api_id: 'a', temp: 25, created_at: at('13:00') }], gap, 2), {})
  const rows = ['a', 'b', 'c'].map(id => ({ api_id: id, temp: 25, created_at: at('13:00') })).concat({ api_id: 'far', temp: 33, created_at: at('13:00') })
  assert.equal(dailyDeltas(rows, HOURS, 2).far, -2, 'more than 5 degrees from the others')
})

test('dayHours: 24 temperatures by hour, the offset and what the request cost, from the service\'s answer', () => {
  const answer = { tzoffset: 2, queryCost: 24, days: [{ hours: HOURS.map((temp, h) => ({ datetime: `${String(h).padStart(2, '0')}:00:00`, temp })) }] }
  assert.deepEqual(dayHours(answer), { hours: HOURS, tzoffset: 2, cost: 24 })
  assert.equal(dayHours({ days: [] }), null)
  assert.equal(dayHours({ tzoffset: 2, days: [{ hours: [{ datetime: '03:00:00', temp: 9 }] }] }).hours[3], 9)
  assert.equal(dayHours({ tzoffset: 2, days: [{ hours: [{ datetime: '03:00:00', temp: 9 }] }] }).hours[4], null, 'a missing hour is null')
})

// Visual Crossing's free plan has 1,000 records a day for everything: every forecast our server builds asks it
// once (1 record, measured: queryCost 1), the night's scoring 24 a place. The forecasts come first. In the week
// to 2026-11-21 the forecasts asked it between 199 and 447 times on a full day (Vercel's count of the real
// requests), so a fixed 720 for the night would have gone over on four of the eight days.
test('recordBudget: what the day leaves after the live forecasts and a reserve, never more than 30 places', () => {
  assert.equal(recordBudget(199), 651, 'the quietest full day: 27 places')
  assert.equal(recordBudget(447), 403, 'the busiest day of the week: 16 places')
  assert.equal(recordBudget(0), 720, 'never more than 30 places')
  assert.equal(recordBudget(900), 0, 'a day that needs the allowance for its forecasts: no scoring that night')
  assert.equal(recordBudget(447) + 447 + 150, 1000, 'forecasts, the night and the reserve are the allowance')
})
