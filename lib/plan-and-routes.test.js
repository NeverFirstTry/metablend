// Hiking, two small entries of the UX review of 2026-11-20 (owner: before submission on 3 Dec):
// N1, Plan a hike says what it does before a day is picked; G1, removing a route can be undone.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pendingRemoval } from './pending-removal.js'

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
// a clock that runs only when told to
const clock = () => {
  let now = 0, next = 1
  const due = new Map()
  return {
    setTimeout: (fn, ms) => { due.set(next, [now + ms, fn]); return next++ },
    clearTimeout: id => due.delete(id),
    run: ms => { now += ms; for (const [id, [at, fn]] of [...due]) if (at <= now) { due.delete(id); fn() } },
  }
}

test('G1: a removed route goes for good only after the pause; Undo within it keeps it', async () => {
  const gone = [], c = clock()
  const p = pendingRemoval(async id => { gone.push(id) }, 6000, c)
  p.start('a')
  c.run(5999)
  assert.deepEqual(gone, [], 'still there while Undo is offered')
  assert.equal(p.undo(), 'a', 'Undo hands back the route')
  c.run(10000)
  assert.deepEqual(gone, [], 'and it is never removed')
  p.start('b')
  c.run(6000)
  assert.deepEqual(gone, ['b'], 'removed once the pause is over')
})

test('G1: a second removal, or leaving the screen, makes the first one final at once', async () => {
  const gone = [], c = clock()
  const p = pendingRemoval(async id => { gone.push(id) }, 6000, c)
  p.start('a')
  await p.start('b')
  assert.deepEqual(gone, ['a'])
  await p.commit() // the screen is left
  assert.deepEqual(gone, ['a', 'b'])
  assert.equal(p.undo(), null, 'nothing left to undo')
})

test('G1: the bin is a 44 px target and a removal offers Undo', () => {
  // source-match-ok: the list fills from the phone after mount and Undo needs a tap, no DOM here (the timing is tested above)
  const src = read('app/components/hike/MyRoutes.jsx')
  assert.match(src, /<Trash2[\s\S]{0,40}<\/button>|size-11[\s\S]*Trash2/)
  assert.match(src, /size-11/)
  assert.match(src, /t\(lang, 'undo'\)/)
  assert.match(src, /t\(lang, 'routeRemoved'\)/)
})

test('N1: the plan panel says what a plan brings before a day is picked', () => {
  // source-match-ok: the panel opens only on a tap and these tests have no DOM to tap in
  const src = read('app/components/hike/PlanHike.jsx')
  const explain = src.indexOf("t(lang, 'planExplain')"), days = src.indexOf('planDays(lang, todayLocal).map') // the chips; the direct button asks planDays too
  assert.ok(explain > 0 && explain < days, 'the sentence stands above the day chips')
})
