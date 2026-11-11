// The app forgets a phone whose notifications were turned off in the phone's settings (lib/push-client.js
// forgetWhenOff): only a phone that said yes here and no longer has the permission; the note that it said yes
// stays when the server could not delete, so the next start asks again. The two Capacitor plugins are
// stand-ins (a phone's stored values and its notification permission); the route is tested in
// lib/push-register-delete.test.js.
import './test-jsx-hooks.js'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const standIn = name => 'data:text/javascript,' + encodeURIComponent(`export const ${name} = globalThis.__phone.${name}`)
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === '@capacitor/preferences') return { url: standIn('Preferences'), shortCircuit: true }
    if (spec === '@capacitor/push-notifications') return { url: standIn('PushNotifications'), shortCircuit: true }
    return next(spec, ctx)
  },
})

const OPTED = 'mb_push_on'
const phone = { stored: new Map(), receive: 'granted', server: 200, sent: [] }
globalThis.__phone = {
  Preferences: {
    get: async ({ key }) => ({ value: phone.stored.get(key) ?? null }),
    set: async ({ key, value }) => { phone.stored.set(key, value) },
    remove: async ({ key }) => { phone.stored.delete(key) },
  },
  PushNotifications: { checkPermissions: async () => ({ receive: phone.receive }) },
}
globalThis.window = { Capacitor: { isNativePlatform: () => true } }
globalThis.fetch = async (url, init = {}) => {
  phone.sent.push({ url: String(url), method: init.method ?? 'GET', key: init.headers?.['x-device-key'] })
  return new Response('{}', { status: phone.server })
}
const { forgetWhenOff, disablePush } = await import('./push-client.js')

const as = ({ opted, receive, server = 200 }) => {
  phone.stored = new Map(opted ? [[OPTED, '1']] : [])
  Object.assign(phone, { receive, server, sent: [] })
}

for (const receive of ['denied', 'prompt', 'prompt-with-rationale']) {
  test(`said yes, permission now "${receive}": the server is asked to forget this phone, the note goes`, async () => {
    as({ opted: true, receive })
    await forgetWhenOff()
    assert.deepEqual(phone.sent.map(s => [s.method, s.url]), [['DELETE', '/api/push/register']])
    assert.match(phone.sent[0].key, /^[A-Za-z0-9_-]{32,}$/, 'with this phone\'s device key')
    assert.equal(phone.stored.has(OPTED), false)
  })
}

test('said yes and still allowed: nothing is deleted', async () => {
  as({ opted: true, receive: 'granted' })
  await forgetWhenOff()
  assert.deepEqual(phone.sent, [])
  assert.equal(phone.stored.get(OPTED), '1')
})

test('never said yes here: nothing stored on the server, nothing asked', async () => {
  as({ opted: false, receive: 'denied' })
  await forgetWhenOff()
  assert.deepEqual(phone.sent, [])
})

test('the server could not delete: the note stays, the next start asks again', async () => {
  as({ opted: true, receive: 'denied', server: 500 })
  await forgetWhenOff()
  assert.equal(phone.sent.length, 1)
  assert.equal(phone.stored.get(OPTED), '1')
})

test('on the website (no app): nothing at all', async () => {
  as({ opted: true, receive: 'denied' })
  const app = globalThis.window
  globalThis.window = {}
  try { await forgetWhenOff() } finally { globalThis.window = app }
  assert.deepEqual(phone.sent, [])
})

// the off switch in the notification settings (disablePush): deletes whatever the permission says
test('the off switch, notifications still allowed: the server deletes this phone, the note goes', async () => {
  as({ opted: true, receive: 'granted' })
  assert.equal(await disablePush(), true)
  assert.deepEqual(phone.sent.map(s => [s.method, s.url]), [['DELETE', '/api/push/register']])
  assert.equal(phone.stored.has(OPTED), false)
})

test('the off switch, the server could not delete: false, and the note stays', async () => {
  as({ opted: true, receive: 'granted', server: 500 })
  assert.equal(await disablePush(), false)
  assert.equal(phone.stored.get(OPTED), '1')
})

test('the off switch on the website (no app): nothing sent', async () => {
  as({ opted: true, receive: 'granted' })
  const app = globalThis.window
  globalThis.window = {}
  try { assert.equal(await disablePush(), false) } finally { globalThis.window = app }
  assert.deepEqual(phone.sent, [])
})
