// The peak's Week tab gives a verdict (UX review 2026-11-20, P1; owner: before submission on 3 Dec): a
// headline with the best day and its window, and on every day its window or why it has none. The windows
// come from /api/hike windows.days (feat/hike-week-windows). Fable's rules: a day whose window has an hour
// without storm data never beats one without; far days (from EXACT_DAYS on) give a tendency, not times to
// the hour, and are the best day only when no nearer day has a window; a cut-off last day has no entry.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { weekVerdict, rowText, headlineText, EXACT_DAYS } from './hike/week.js'
import { addDays } from './localtime.js'

const TODAY = '2026-11-20'
const D = k => addDays(TODAY, k)
const win = (date, from, to, hours) => ({ window: { from: `${date}T${from}`, to: `${date}T${to}`, hours }, next: null })
const none = (date, reason = 'rain', at = '08:00') => ({ window: null, next: { reason, at: `${date}T${at}` } })
const day = (k, w, stormUnknown = false) => ({ date: D(k), w, stormUnknown, n: w?.window ? 5 : null })

test('the best day: the longest window among the near days', () => {
  const v = weekVerdict([day(0, none(D(0))), day(1, win(D(1), '09:00', '12:00', 3)), day(2, win(D(2), '08:00', '14:00', 6))], TODAY)
  assert.equal(v.best.date, D(2))
  assert.equal(v.best.exact, true)
})

test('a window with unknown storm risk never beats one without', () => {
  const v = weekVerdict([day(1, win(D(1), '08:00', '15:00', 7), true), day(2, win(D(2), '09:00', '11:00', 2))], TODAY)
  assert.equal(v.best.date, D(2))
})

test('a far day is the best day only when no near day has a window', () => {
  assert.ok(EXACT_DAYS >= 1)
  const far = EXACT_DAYS + 1
  const withNear = weekVerdict([day(1, win(D(1), '10:00', '11:00', 1)), day(far, win(D(far), '07:00', '16:00', 9))], TODAY)
  assert.equal(withNear.best.date, D(1))
  const onlyFar = weekVerdict([day(0, none(D(0))), day(1, none(D(1))), day(far, win(D(far), '07:00', '16:00', 9))], TODAY)
  assert.equal(onlyFar.best.date, D(far))
  assert.equal(onlyFar.best.exact, false)
  assert.equal(weekVerdict([day(0, none(D(0)))], TODAY).best, null)
  assert.equal(weekVerdict(undefined, TODAY).best, null, 'an older answer without windows.days')
})

test('the headline and the rows say it in words, with times to the hour only for near days', () => {
  const far = EXACT_DAYS + 1
  const v = weekVerdict([day(0, null), day(1, none(D(1))), day(2, win(D(2), '08:00', '13:00', 5), true), day(far, win(D(far), '09:00', '12:00', 3))], TODAY)
  assert.match(headlineText('en', v, TODAY).title, /^Best day: .+, summit window 08:00-13:00$/)
  assert.equal(headlineText('en', v, TODAY).tone, 'warn') // its storm risk is unknown
  assert.equal(rowText('en', v.rows.get(D(0))), 'No daylight left today')
  assert.equal(rowText('en', v.rows.get(D(1))), 'rain from 08:00')
  assert.equal(rowText('en', v.rows.get(D(2))), 'Window 08:00-13:00 · Storm risk unknown for this peak')
  assert.equal(rowText('en', v.rows.get(D(far))), 'About 09:00-12:00, a tendency')
  assert.equal(v.rows.get(D(far + 1)), undefined) // a cut-off day: no entry, no verdict
  const empty = weekVerdict([day(0, none(D(0))), day(1, none(D(1), 'storms', '12:00'))], TODAY)
  // X3: no answer, a neutral card (it was the rain colour)
  assert.deepEqual(headlineText('en', empty, TODAY), { title: 'No favourable summit window this week', sub: null, tone: 'neutral' })
})

test('the Week tab shows the verdict above the table and a line under each covered day; an older answer shows the table alone', async () => {
  await import('./test-jsx-hooks.js')
  const { createElement: h } = await import('react')
  const { renderToStaticMarkup: render } = await import('react-dom/server')
  const { default: SummitDays } = await import('../app/components/hike/SummitDays.jsx')
  const fmt = { fmtTemp: v => `${Math.round(v)}°` }
  const rows = [0, 1, 2].map(k => ({ date: D(k), icon: '☀️', tempMin: -8, tempMax: -3, windMax: 40, freezingMin: 1800, freezingMax: 2400, storm: 'low' }))
  const windows = [day(0, none(D(0))), day(1, win(D(1), '08:00', '13:00', 5))] // day 2 cut off: no entry
  const html = render(h(SummitDays, { days: rows, windows, todayLocal: TODAY, lang: 'en', fmt }))
  assert.match(html, /Best day: tomorrow, summit window 08:00-13:00/)
  assert.ok(html.indexOf('Best day') < html.indexOf('°'), 'the verdict comes first')
  assert.match(html, />rain from 08:00</)
  assert.match(html, />Window 08:00-13:00</)
  assert.equal((html.match(/text-xs text-zinc-300/g) ?? []).length, 2, 'no line for the cut-off day')
  const old = render(h(SummitDays, { days: rows, todayLocal: TODAY, lang: 'en', fmt }))
  assert.ok(!/Best day|No favourable/.test(old), 'no verdict without windows.days')
})
