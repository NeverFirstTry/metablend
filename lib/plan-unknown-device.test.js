// "Tour planen" answered "Unknown device", in English, in a German app (owner, 2026-11-22: an Xcode build replaced
// TestFlight build 3 on Rene's iPhone; turning notifications off and on fixed it). The server knows a phone only by the
// device key it registered with, and drops the record when Apple or Google say its token is gone, which a new build
// causes. The phone still reports notifications as allowed, so the plan screen did not register and sent the plan to a
// server that no longer knew it. Now a 404 on a push address registers the phone again through the existing
// /api/push/register and sends the request once more; limits and token checks stay as they are. And no server or
// error text reaches the screen: a translated message instead (owner: "No raw server error text in the UI ever").
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { knownOrRegister } from './push-retry.js'

const answers = (...list) => { const sent = []; return { sent, call: async () => { sent.push(1); return list.shift() } } }

test('a phone the server does not know registers again, and the plan goes through', async () => {
  const api = answers({ status: 404, json: { error: 'Unknown device' } }, { status: 200, json: { plan: { id: 'p1' } } })
  let registered = 0
  const r = await knownOrRegister(api.call, async () => { registered++; return true })
  assert.equal(r.status, 200)
  assert.equal(registered, 1)
  assert.equal(api.sent.length, 2, 'sent once more after the registration')
})

test('a known phone is not registered again', async () => {
  const api = answers({ status: 200, json: {} })
  let registered = 0
  assert.equal((await knownOrRegister(api.call, async () => { registered++; return true })).status, 200)
  assert.equal(registered, 0)
  assert.equal(api.sent.length, 1)
})

test('other refusals are not a reason to register: a limit, a bad plan, a server error', async () => {
  for (const status of [429, 400, 409, 500, 0]) {
    const api = answers({ status, json: {} })
    let registered = 0
    assert.equal((await knownOrRegister(api.call, async () => { registered++; return true })).status, status)
    assert.equal(registered, 0, String(status))
    assert.equal(api.sent.length, 1)
  }
})

test('a registration that fails or throws leaves the 404, and the request is not sent again', async () => {
  for (const reregister of [async () => false, async () => { throw new Error('server 429: Too many new phones') }]) {
    const api = answers({ status: 404, json: {} })
    assert.equal((await knownOrRegister(api.call, reregister)).status, 404)
    assert.equal(api.sent.length, 1)
  }
})

test('one more try at most: a second 404 is the answer', async () => {
  const api = answers({ status: 404, json: {} }, { status: 404, json: {} }, { status: 200, json: {} })
  let registered = 0
  assert.equal((await knownOrRegister(api.call, async () => { registered++; return true })).status, 404)
  assert.equal(registered, 1)
  assert.equal(api.sent.length, 2)
})

// source-match-ok: client components that need the native push plugin; the logic is tested above
test('the wiring: the plan is sent through the re-registering call, and no server or error text reaches the screen', () => {
  const plan = readFileSync(new URL('../app/components/hike/PlanHike.jsx', import.meta.url), 'utf8')
  const settings = readFileSync(new URL('../app/components/push/NotificationSettings.jsx', import.meta.url), 'utf8')
  assert.match(plan, /pushApiRegistered\('plans', \{ method: 'POST', body \}, \{ lang, unit \}\)/)
  for (const [name, src] of [['PlanHike', plan], ['NotificationSettings', settings]]) {
    assert.doesNotMatch(src, /json\.error/, `${name} shows the server's error text`)
    assert.doesNotMatch(src, /setMsg\([^\n]*r\.detail/, `${name} shows a registration error's text`)
  }
  const client = readFileSync(new URL('./push-client.js', import.meta.url), 'utf8')
  // the existing registration, the same endpoint and body; nothing new on the server
  assert.match(client, /export async function pushApiRegistered[\s\S]{0,600}register\(P, \{ lang, unit \}\)/)
  // only a phone that is still opted in here (mb_push_on): one switched off in More stays off (Design, 2026-11-22:
  // disablePush deletes the record and the note, while the phone's permission stays "granted")
  assert.match(client, /export async function pushApiRegistered[\s\S]{0,400}if \(!\(await optedIn\(\)\)\) return false/)
})
