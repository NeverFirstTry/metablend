// Open-Meteo refuses bursts of parallel summit requests (429 "Too many concurrent requests", 2026-11-09).
// The gate keeps at most `max` requests in flight per instance and lets callers asking for the same URL
// share one request while it is in flight.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeGate } from './gate.js'

// a fake getter whose answers are released by hand, counting how many run at once
function slowGetter() {
  const pending = []
  let running = 0, peak = 0, calls = 0
  const get = url => new Promise(resolve => {
    calls++; running++; peak = Math.max(peak, running)
    pending.push(() => { running--; resolve({ url }) })
  })
  return { get, release: () => pending.shift()?.(), releaseAll: () => { while (pending.length) pending.shift()() }, stats: () => ({ running, peak, calls }) }
}
const tick = () => new Promise(r => setTimeout(r, 0))

test('makeGate — at most max requests in flight; the rest wait their turn and all still get their answer', async () => {
  const g = slowGetter()
  const gated = makeGate(g.get, 4)
  const all = Promise.all(Array.from({ length: 10 }, (_, i) => gated(`https://api.open-meteo.com/v1/forecast?latitude=${i}`)))
  await tick()
  assert.equal(g.stats().running, 4)
  g.release(); await tick()
  assert.equal(g.stats().running, 4) // a waiting request took the freed slot
  g.releaseAll(); await tick(); g.releaseAll(); await tick(); g.releaseAll()
  const answers = await all
  assert.equal(answers.length, 10)
  assert.equal(g.stats().peak, 4)
  assert.equal(g.stats().calls, 10)
})

test('makeGate — the same URL asked twice while in flight is fetched once and answered twice; afterwards it is fetched again', async () => {
  const g = slowGetter()
  const gated = makeGate(g.get, 4)
  const a = gated('https://api.open-meteo.com/v1/forecast?latitude=47.075'), b = gated('https://api.open-meteo.com/v1/forecast?latitude=47.075')
  await tick()
  assert.equal(g.stats().calls, 1)
  g.release()
  assert.deepEqual(await Promise.all([a, b]), [{ url: 'https://api.open-meteo.com/v1/forecast?latitude=47.075' }, { url: 'https://api.open-meteo.com/v1/forecast?latitude=47.075' }])
  const c = gated('https://api.open-meteo.com/v1/forecast?latitude=47.075')
  await tick()
  assert.equal(g.stats().calls, 2)
  g.release(); await c
})

test('makeGate — a failed request frees its slot and is not kept as the shared answer', async () => {
  let calls = 0
  const gated = makeGate(async () => { calls++; return null }, 1)
  assert.equal(await gated('https://api.open-meteo.com/x'), null)
  assert.equal(await gated('https://api.open-meteo.com/x'), null)
  assert.equal(calls, 2)
})

test('makeGate — with a wait limit, a request with no turn in time gives up its place unsent; one that gets its turn in time is not cut off, and the gate carries on', async () => {
  const g = slowGetter()
  const gated = makeGate(g.get, 1, 30)
  const at = n => `https://api.open-meteo.com/v1/forecast?latitude=${n}`
  const first = gated(at(1)), late = gated(at(2))
  await assert.rejects(late, { name: 'GateWaitError' })
  assert.equal(g.stats().calls, 1, 'the one that gave up was never sent')
  g.release()
  assert.deepEqual(await first, { url: at(1) })
  const next = gated(at(3)), queued = gated(at(4))
  await tick(); g.release(); await next
  await new Promise(r => setTimeout(r, 50)) // past the limit: it had its turn by then, so it stays
  g.release()
  assert.deepEqual(await queued, { url: at(4) })
  assert.deepEqual(g.stats(), { running: 0, peak: 1, calls: 3 })
})
// The summit path no longer has a gate of its own: its requests go through the one every Open-Meteo
// request shares (lib/open-meteo.js; lib/open-meteo.test.js calls fetchSummitRaw for real).
