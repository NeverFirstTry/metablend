// Notifications turned off on the phone: DELETE /api/push/register forgets the phone at once (token, home
// city, settings), and the database takes its planned hikes and send log with it (on delete cascade, checked
// on dev and production 2026-11-11). Called for real with every outside call faked (lib/test-route-fakes.js);
// the end-to-end check against the dev database is in the branch's report.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

const { seen, reset, answerWith, json } = await import('./test-route-fakes.js')
const { DELETE } = await import('../app/api/push/register/route.js')

const KEY = 'k'.repeat(43)
const HASH = createHash('sha256').update(KEY).digest('hex')
const DEVICE = { id: '6f1c2a3b-0000-4000-8000-000000000001', home_name: 'Lienz', token: 'fcm-token', platform: 'android' }
const forget = (key = KEY, ip = '203.0.113.7') => DELETE(new Request('https://metablend.app/api/push/register', { method: 'DELETE', headers: { 'x-device-key': key, 'x-forwarded-for': ip } }))
const deletes = () => seen.filter(c => c.method === 'DELETE' && c.url.includes('/rest/v1/push_devices'))
// the database knows this phone: the device row for its key hash
const known = ({ url, method }) => method === 'GET' && url.includes('/rest/v1/push_devices') && url.includes(`key_hash=eq.${HASH}`) ? json(DEVICE) : undefined

test('a phone the server knows is deleted by its own id', async () => {
  reset(); answerWith(known)
  const res = await forget()
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { deleted: true })
  assert.equal(deletes().length, 1)
  assert.match(deletes()[0].url, new RegExp(`id=eq\\.${DEVICE.id}$`))
})

test('a phone the server does not know: nothing to delete, still a 200', async () => {
  reset()
  const res = await forget(KEY, '203.0.113.8')
  assert.deepEqual([res.status, await res.json()], [200, { deleted: false }])
  assert.equal(deletes().length, 0)
})

test('without a valid device key nothing is looked up or deleted', async () => {
  reset(); answerWith(known)
  const res = await forget('too-short', '203.0.113.9')
  assert.deepEqual(await res.json(), { deleted: false })
  assert.equal(seen.filter(c => c.url.includes('/rest/v1/push_devices')).length, 0)
})

test('a failed delete is a 500, so the app keeps its note and asks again at the next start', async () => {
  reset()
  answerWith(call => call.method === 'DELETE' && call.url.includes('/rest/v1/push_devices') ? json({ message: 'boom' }, 500) : known(call))
  const res = await forget(KEY, '203.0.113.10')
  assert.equal(res.status, 500)
  assert.ok(seen.some(c => c.url.includes('/rest/v1/error_log')), 'the failure is logged')
})
