// A stored summit page is read hours after it was built, and what the copy calls "today" can be
// yesterday by then: until 2026-11-17 a page stored in the evening and read at 05:00 called yesterday
// "Today", with yesterday's favourable window and avalanche danger. Now the day comes from the reader's
// clock at the summit, and while no clock has been read (the server's render and the browser's first
// one) nothing is called today: every day stands with its date. The hiking page's teaser reads the same
// stored copy on the server and follows the same rule.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const { summitDay, summitOn, freshAva, teaserWindow, summitProps } = await import('./hike/summit-props.js')
const { dayWord } = await import('./outlook/text.js')
const { formatCalendarDate } = await import('./localtime.js')
const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { default: SummitPage } = await import('../app/mountains/[peak]/SummitPage.jsx')

// a copy made on Monday 16 November 2026 at 19:00 at the summit (UTC+1)
const MON = '2026-11-16', TUE = '2026-11-17', WED = '2026-11-18'
const day = date => ({ date, icon: '☀️', tempMin: -8, tempMax: -3, windMax: 40, rainPct: 10, freezingMin: 1800, freezingMax: 2400, storm: null })
const winMon = { window: { from: `${MON}T09:00`, to: `${MON}T14:00` }, next: null }
const winTue = { window: { from: `${TUE}T10:00`, to: `${TUE}T15:00` }, next: null }
const copy = { days: [day(MON), day(TUE), day(WED)], windows: { today: winMon, tomorrow: winTue }, todayLocal: MON, tomorrowLocal: TUE, stormUnknown: false, sources: ['ECMWF IFS'], kept: false, madeAt: `${MON}T19:00`, utcOffsetSec: 3600 }
const ava = { today: 3, tomorrow: 2 }
const dates = list => list.map(x => x.date)

test('summitDay: the calendar day at the summit, from the forecast\'s own offset', () => {
  assert.equal(summitDay(3600, Date.parse('2026-11-16T22:30:00Z')), MON) // 23:30 at the summit
  assert.equal(summitDay(3600, Date.parse('2026-11-16T23:30:00Z')), TUE) // 00:30 at the summit
})

test('summitProps carries the summit\'s offset, so the page can tell its day', () => {
  assert.equal(summitProps({ nowLocal: `${MON}T19:00`, utcOffsetSec: 3600 }).utcOffsetSec, 3600)
  assert.equal(summitProps({ nowLocal: `${MON}T19:00` }).utcOffsetSec, null)
})

test('read on the day it was made: everything as the copy has it', () => {
  const s = summitOn(copy, ava, MON)
  assert.equal(s.todayLocal, MON)
  assert.deepEqual(dates(s.days), [MON, TUE, WED])
  assert.deepEqual(s.windows, [{ date: MON, w: winMon }, { date: TUE, w: winTue }])
  assert.deepEqual(s.ava, [{ date: MON, level: 3 }, { date: TUE, level: 2 }])
})

test('read after midnight: yesterday is gone, and the copy\'s tomorrow is today, for the window and the avalanche danger too', () => {
  const s = summitOn(copy, ava, TUE)
  assert.equal(s.todayLocal, TUE)
  assert.deepEqual(dates(s.days), [TUE, WED])
  assert.deepEqual(s.windows, [{ date: TUE, w: winTue }])
  assert.deepEqual(s.ava, [{ date: TUE, level: 2 }])
})

test('no clock read yet (the server, the first render): no day is today, every day keeps its date', () => {
  const s = summitOn(copy, ava, null)
  assert.equal(s.todayLocal, null)
  assert.deepEqual(dates(s.days), [MON, TUE, WED])
  assert.deepEqual(dates(s.windows), [MON, TUE])
  assert.deepEqual(dates(s.ava), [MON, TUE])
})

test('"no daylight left today" is said only once the day is known to be today', () => {
  const dark = { ...copy, windows: { today: null, tomorrow: winTue } }
  assert.deepEqual(summitOn(dark, ava, MON).windows, [{ date: MON, w: null }, { date: TUE, w: winTue }])
  assert.deepEqual(summitOn(dark, ava, null).windows, [{ date: TUE, w: winTue }])
  assert.deepEqual(summitOn(dark, ava, TUE).windows, [{ date: TUE, w: winTue }])
})

test('a copy two days old keeps its last day and has no window; a clock past every day does not empty the page', () => {
  const two = summitOn(copy, ava, WED)
  assert.deepEqual([dates(two.days), two.windows, two.ava, two.todayLocal], [[WED], [], [], WED])
  const wrong = summitOn(copy, ava, '2026-12-24') // a device set to the wrong day: the copy as it is, nothing called today
  assert.deepEqual([dates(wrong.days), dates(wrong.windows), wrong.todayLocal], [[MON, TUE, WED], [MON, TUE], null])
})

test('dayWord without a known today gives the weekday, never "today" or "tomorrow"', () => {
  assert.equal(dayWord('en', MON, null), 'Monday')
  assert.equal(dayWord('en', TUE, undefined), 'Tuesday')
  assert.equal(dayWord('en', MON, MON), 'today')
})

test('the stored page as the server renders it calls no day "Today": the window and the table carry dates', () => {
  const peak = { id: 'testhorn', name: 'Testhorn', elev: 3000, lat: 47.07, lon: 12.69, region: 'tauern', country: 'Austria', grade: null }
  const html = render(h(SummitPage, { peak, avaRows: 2, nearby: [], fullList: [], ...copy }))
  assert.match(html, /Summit window Monday 09:00-14:00/)
  assert.match(html, /Summit window Tuesday 10:00-15:00/)
  assert.ok(html.includes(` ${formatCalendarDate(MON, 'en', { weekday: 'short', month: 'short', day: 'numeric' })}</td>`), 'the first row of the table is labelled with its date')
  assert.ok(!/window today|window tomorrow/i.test(html), 'no window is called today or tomorrow')
  assert.ok(!html.includes('>Today<') && !html.includes('>Tomorrow<') && !html.includes(' Today</td>'), 'no label says Today or Tomorrow')
  // the avalanche danger is read by the browser: the stored page holds its place and shows no level
  assert.ok(html.includes('Avalanche danger'), 'the section stands while the danger is read')
  assert.equal(html.match(/<li aria-hidden="true" class="h-6"><\/li>/g)?.length, 2, 'two rows hold their place')
  assert.ok(!/<span class="sr-only">\d(<!-- -->)?: <\/span>/.test(html), 'no level in the stored page')
  assert.ok(!render(h(SummitPage, { peak, avaRows: 0, nearby: [], fullList: [], ...copy })).includes('Avalanche danger'), 'no section where the area had no rating')
})

test('the avalanche danger read on opening is dated by its own days, not by the stored forecast\'s', () => {
  const read = { today: 3, tomorrow: 2, dates: { today: TUE, tomorrow: WED } } // read on Tuesday, the copy is Monday's
  assert.deepEqual(freshAva(copy, read, TUE), [{ date: TUE, level: 3 }, { date: WED, level: 2 }])
  assert.deepEqual(freshAva(copy, read, null), [{ date: TUE, level: 3 }, { date: WED, level: 2 }]) // before the clock is read
  assert.deepEqual(freshAva(copy, { ...read, tomorrow: null }, TUE), [{ date: TUE, level: 3 }]) // tomorrow's bulletin not out yet
  assert.deepEqual(freshAva(copy, undefined, TUE), []) // still being read
  assert.deepEqual(freshAva(copy, null, TUE), []) // the read failed: no level at all, never the stored one
})

test('the hiking page\'s teaser: the window of the reader\'s day at the summit, tomorrow\'s after dark, none when the copy has none for it', () => {
  const d = { nowLocal: `${MON}T19:00`, utcOffsetSec: 3600, windows: { today: winMon, tomorrow: winTue } }
  const at = iso => Date.parse(iso)
  assert.deepEqual(teaserWindow(d, at('2026-11-16T18:30:00Z')), { w: winMon, date: MON, todayLocal: MON })
  assert.deepEqual(teaserWindow({ ...d, windows: { today: null, tomorrow: winTue } }, at('2026-11-16T18:30:00Z')), { w: winTue, date: TUE, todayLocal: MON })
  assert.deepEqual(teaserWindow(d, at('2026-11-17T04:00:00Z')), { w: winTue, date: TUE, todayLocal: TUE }) // 05:00 the next morning
  assert.equal(teaserWindow(d, at('2026-11-18T04:00:00Z')), null)
  // a copy without the offset (an old kept answer) is read as before
  assert.deepEqual(teaserWindow({ nowLocal: `${MON}T19:00`, windows: { today: winMon, tomorrow: winTue } }, at('2026-11-17T04:00:00Z')), { w: winMon, date: MON, todayLocal: MON })
})
