import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, verify } from 'node:crypto'
import { signJwt } from './jwt.js'
import { createFcm } from './fcm.js'
import { createApns } from './apns.js'
import { createSender, senderFromEnv } from './send.js'

const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 })
const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pem = k => k.export({ type: 'pkcs8', format: 'pem' })
const part = (jwt, i) => JSON.parse(Buffer.from(jwt.split('.')[i], 'base64url'))

test('signJwt — RS256 and ES256 (raw r||s) signatures verify', () => {
  for (const [alg, pair, opts] of [['RS256', rsa, {}], ['ES256', ec, { dsaEncoding: 'ieee-p1363' }]]) {
    const jwt = signJwt(alg, { alg, kid: 'k1' }, { iss: 'me', iat: 1 }, pem(pair.privateKey))
    const [h, p, s] = jwt.split('.')
    assert.equal(part(jwt, 0).alg, alg)
    assert.equal(verify('sha256', Buffer.from(`${h}.${p}`), { key: pair.publicKey, ...opts }, Buffer.from(s, 'base64url')), true)
  }
})

function fakeFetch(responses) {
  const calls = []
  const f = async (url, init) => { calls.push({ url, init }); const r = responses.shift(); return { ok: r.status < 300, status: r.status, json: async () => r.json } }
  f.calls = calls
  return f
}
const SA = { project_id: 'mb', client_email: 'push@mb.iam', private_key: pem(rsa.privateKey), token_uri: 'https://oauth2.googleapis.com/token' }

test('fcm — one OAuth token for many sends, channel and link in the message', async () => {
  const f = fakeFetch([{ status: 200, json: { access_token: 'AT', expires_in: 3600 } }, { status: 200, json: { name: 'm1' } }, { status: 200, json: { name: 'm2' } }])
  const fcm = createFcm({ serviceAccount: SA, fetchImpl: f, now: () => 1_700_000_000_000 })
  assert.deepEqual(await fcm.send({ token: 'T1', title: 'A', body: 'B', url: '/?city=Vienna', channel: 'alerts', collapse: 'rain' }), { ok: true })
  await fcm.send({ token: 'T2', title: 'A', body: 'B', url: '/', channel: 'briefing', collapse: 'briefing' })
  assert.equal(f.calls.length, 3) // token fetched once
  const msg = JSON.parse(f.calls[1].init.body).message
  assert.equal(f.calls[1].url, 'https://fcm.googleapis.com/v1/projects/mb/messages:send')
  assert.equal(f.calls[1].init.headers.Authorization, 'Bearer AT')
  assert.deepEqual(msg.notification, { title: 'A', body: 'B' })
  assert.deepEqual(msg.data, { url: '/?city=Vienna' })
  assert.equal(msg.android.notification.channel_id, 'alerts')
  assert.equal(msg.android.priority, 'HIGH') // the v1 API's AndroidMessagePriority enum
})

test('fcm — an unregistered token is gone, other errors are not', async () => {
  const gone = fakeFetch([{ status: 200, json: { access_token: 'AT', expires_in: 3600 } }, { status: 404, json: { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } } }])
  assert.equal((await createFcm({ serviceAccount: SA, fetchImpl: gone }).send({ token: 'T', title: 'A', body: 'B', url: '/', channel: 'alerts' })).gone, true)
  const busy = fakeFetch([{ status: 200, json: { access_token: 'AT', expires_in: 3600 } }, { status: 503, json: { error: { status: 'UNAVAILABLE' } } }])
  const r = await createFcm({ serviceAccount: SA, fetchImpl: busy }).send({ token: 'T', title: 'A', body: 'B', url: '/', channel: 'alerts' })
  assert.equal(r.ok, false); assert.equal(r.gone, false)
})

function fakeRequest(responses) {
  const calls = []
  const r = async req => { calls.push(req); return responses.shift() }
  r.calls = calls
  return r
}

test('apns — production first, sandbox when production rejects the token, 410 is gone', async () => {
  const req = fakeRequest([{ status: 400, body: '{"reason":"BadDeviceToken"}' }, { status: 200, body: '' }])
  const apns = createApns({ keyPem: pem(ec.privateKey), keyId: 'KID', teamId: 'TEAM', request: req, now: () => 1_700_000_000_000 })
  assert.deepEqual(await apns.send({ token: 'abc', env: null, title: 'A', body: 'B', url: '/', collapse: 'rain' }), { ok: true, env: 'sandbox' })
  assert.deepEqual(req.calls.map(c => c.host), ['api.push.apple.com', 'api.sandbox.push.apple.com'])
  assert.equal(req.calls[0].path, '/3/device/abc')
  assert.equal(req.calls[0].headers['apns-topic'], 'app.metablend')
  assert.equal(part(req.calls[0].headers.authorization.replace('bearer ', ''), 0).kid, 'KID')
  assert.deepEqual(JSON.parse(req.calls[0].body).aps.alert, { title: 'A', body: 'B' })

  const gone = fakeRequest([{ status: 410, body: '{"reason":"Unregistered"}' }])
  assert.equal((await createApns({ keyPem: pem(ec.privateKey), keyId: 'K', teamId: 'T', request: gone }).send({ token: 'x', env: 'prod', title: 'A', body: 'B', url: '/' })).gone, true)
})

test('sender — by platform, Android channel by kind, missing config fails softly', async () => {
  const seen = []
  const s = createSender({ fcm: { send: async m => { seen.push(m); return { ok: true } } }, apns: null })
  await s.send({ platform: 'android', token: 'T' }, { title: 'A', body: 'B', url: '/', kind: 'briefing' })
  await s.send({ platform: 'android', token: 'T' }, { title: 'A', body: 'B', url: '/', kind: 'hike_evening' })
  await s.send({ platform: 'android', token: 'T' }, { title: 'A', body: 'B', url: '/', kind: 'severe' })
  assert.deepEqual(seen.map(m => m.channel), ['briefing', 'hikes', 'alerts'])
  assert.deepEqual(await s.send({ platform: 'ios', token: 'T', apns_env: null }, { title: 'A', body: 'B', url: '/', kind: 'rain' }), { ok: false, error: 'APNs not configured' })
})

test('fcm / apns — a hung request times out instead of stalling the hourly run', async () => {
  const hang = (url, init) => (url.includes('oauth2')
    ? Promise.resolve({ ok: true, status: 200, json: async () => ({ access_token: 'AT', expires_in: 3600 }) })
    : new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))))
  const f = await createFcm({ serviceAccount: SA, fetchImpl: hang, timeoutMs: 50 }).send({ token: 'T', title: 'A', body: 'B', url: '/', channel: 'alerts' })
  assert.equal(f.ok, false); assert.equal(f.gone, false)
  const a = await createApns({ keyPem: pem(ec.privateKey), keyId: 'K', teamId: 'T', request: () => new Promise(() => {}), timeoutMs: 50 }).send({ token: 'x', env: 'prod', title: 'A', body: 'B', url: '/' })
  assert.equal(a.ok, false); assert.equal(a.gone, false)
})

test('senderFromEnv — one sender per configuration, so token caches outlive a request', () => {
  const env = { APNS_KEY: pem(ec.privateKey), APNS_KEY_ID: 'K', APNS_TEAM_ID: 'T' }
  assert.equal(senderFromEnv(env), senderFromEnv({ ...env }))
  assert.notEqual(senderFromEnv(env), senderFromEnv({ ...env, APNS_KEY_ID: 'K2' }))
})
