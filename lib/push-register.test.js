// How many new phones one address may register: ten an hour (per server copy, in memory, like every
// count by address). Until 2026-11-20 anyone could register phones that do not exist, twenty a minute,
// and each one with an alert switched on made the hourly push run longer. A phone that is already
// known registers again at every app start and is not counted. The route is called for real with
// every outside call faked (lib/test-route-fakes.js).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seen, reset, answerWith, json } from './test-route-fakes.js'

const { POST: register } = await import('../app/api/push/register/route.js')
const TOKEN = 'f'.repeat(64)
const key = n => `${'k'.repeat(40)}${String(n).padStart(3, '0')}`
const ask = (ip, n) => register(new Request('https://metablend.app/api/push/register', {
  method: 'POST', headers: { 'x-forwarded-for': ip, 'x-device-key': key(n), 'content-type': 'application/json' },
  body: JSON.stringify({ token: TOKEN, platform: 'ios', lang: 'de', unit: 'C' }),
}))
const row = { id: 'd1', home_name: null, home_lang: null, alert_rain: false, alert_storm: false, alert_severe: false, alert_heat: false, briefing: false, briefing_hour: 7, lang: 'de', unit: 'C' }
// the database: a phone is known when `known` says so; a write answers with the phone's row
const database = known => call => {
  if (!call.url.includes('/rest/v1/push_devices')) return
  if (call.method === 'GET') return json(known(call) ? [row] : [])
  if (call.method === 'POST') return json(row, 201)
}
const writes = () => seen.filter(c => c.method === 'POST' && c.url.includes('/rest/v1/push_devices'))

test('the eleventh new phone from one address within an hour is refused, and nothing is written for it', async () => {
  reset(); answerWith(database(() => false))
  for (let n = 1; n <= 10; n++) assert.equal((await ask('203.0.113.70', n)).status, 200, `new phone ${n}`)
  const res = await ask('203.0.113.70', 11)
  assert.equal(res.status, 429)
  assert.match((await res.json()).error, /hour/)
  assert.equal(writes().length, 10)
})

test('a phone that is already known registers again from an address that is over its count', async () => {
  reset(); answerWith(database(() => false))
  for (let n = 20; n <= 30; n++) await ask('203.0.113.71', n) // ten accepted, the eleventh refused
  reset(); answerWith(database(() => true))
  assert.equal((await ask('203.0.113.71', 20)).status, 200)
  assert.equal(writes().length, 1)
})

test('another address has its own count, and the addresses of one IPv6 line count as one', async () => {
  reset(); answerWith(database(() => false))
  for (let n = 40; n <= 50; n++) await ask('203.0.113.72', n)
  assert.equal((await ask('203.0.113.73', 51)).status, 200)
  for (let n = 60; n < 70; n++) assert.equal((await ask(`2001:db8:1:2::${n}`, n)).status, 200)
  assert.equal((await ask('2001:db8:1:2:aaaa:bbbb:cccc:dddd', 70)).status, 429)
})
