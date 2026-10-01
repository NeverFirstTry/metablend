import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runDispatch } from './dispatch.js'

const VIE = 7200
const at = (hhmm, date = '2026-10-01') => Date.parse(`${date}T${hhmm}:00Z`) - VIE * 1000
const NOW = at('13:05')
const rainy = {
  city: 'Wien', utcOffsetSec: VIE, nowLocal: '2026-10-01T13:00', sun: { sunrise: '07:00', sunset: '18:40' },
  hourly: ['13:00', '14:00', '15:00'].map((h, i) => ({ t: `2026-10-01T${h}`, temp: 15, rainPct: i === 2 ? 80 : 5, windKmh: 10, code: 1 })),
  days: [{ date: '2026-10-01', tempMax: 20, tempMin: 12 }],
}
const dev = (id, over = {}) => ({ id, token: `tok-${id}`, platform: 'android', apns_env: null, lang: 'de', unit: 'C', home_name: 'Wien', alert_rain: true, alert_storm: false, alert_severe: false, alert_heat: false, briefing: false, briefing_hour: 7, ...over })

function fakeStore({ devices = [], plans = [], log = [] } = {}) {
  const calls = { logged: [], deleted: [], plans: [], env: [] }
  return {
    calls,
    devicesForDispatch: async () => devices,
    openPlans: async () => plans,
    recentLog: async () => log,
    logSent: async (id, kind, ref) => calls.logged.push([id, kind, ref]),
    deleteDevice: async id => calls.deleted.push(id),
    updatePlan: async (id, patch) => calls.plans.push([id, patch]),
    setApnsEnv: async (id, env) => calls.env.push([id, env]),
  }
}

test('dispatch — one forecast per city and language, a message per phone, logged', async () => {
  const urls = []
  const getJson = async url => { urls.push(url); return rainy }
  const sent = []
  const sender = { send: async (d, m) => { sent.push([d.id, m.title, m.url]); return { ok: true } } }
  const store = fakeStore({ devices: [dev('a'), dev('b'), dev('c', { home_name: ' wien ' })] })
  const r = await runDispatch({ store, getJson, sender, now: NOW })
  assert.deepEqual(urls, ['https://metablend.app/api/outlook?city=wien&lang=de'])
  assert.deepEqual(sent.map(s => s[0]), ['a', 'b', 'c'])
  assert.equal(sent[0][1], '🌧 Regen in Wien')
  assert.equal(sent[0][2], '/?city=Wien')
  assert.deepEqual(store.calls.logged.map(l => l[1]), ['rain', 'rain', 'rain'])
  assert.equal(r.sent, 3)
})

test('dispatch — an unknown home city skips only its group; gone tokens remove the phone', async () => {
  const getJson = async url => (url.includes('city=atlantis') ? null : rainy)
  const sender = { send: async d => (d.id === 'b' ? { ok: false, gone: true } : { ok: true }) }
  const store = fakeStore({ devices: [dev('a'), dev('b'), dev('x', { home_name: 'Atlantis' })] })
  const r = await runDispatch({ store, getJson, sender, now: NOW })
  assert.deepEqual(store.calls.deleted, ['b'])
  assert.deepEqual(store.calls.logged.map(l => l[0]), ['a'])
  assert.equal(r.removed, 1)
})

test('dispatch — dry run lists messages, sends and stores nothing', async () => {
  const store = fakeStore({ devices: [dev('a')] })
  let sends = 0
  const r = await runDispatch({ store, getJson: async () => rainy, sender: { send: async () => { sends++; return { ok: true } } }, now: NOW, dry: true })
  assert.equal(sends, 0)
  assert.deepEqual(store.calls.logged, [])
  assert.equal(r.messages[0].title, '🌧 Regen in Wien')
})

test('dispatch — hike evening alert, then the plan is marked sent', async () => {
  const win = { window: { from: '2026-10-02T07:00', to: '2026-10-02T11:00', hours: 4 }, next: null }
  const hike = { utcOffsetSec: VIE, nowLocal: '2026-10-01T18:00', notes: [], windows: { today: null, tomorrow: win } }
  const plan = { id: 'p1', device_id: 'h', name: 'Triglav', lat: 46.378, lon: 13.837, elev: 2864, date: '2026-10-02', sent_evening: false, sent_morning: false, last_window: null }
  const store = fakeStore({ devices: [dev('h', { alert_rain: false, home_name: null })], plans: [plan] })
  const sent = []
  await runDispatch({ store, getJson: async url => (url.includes('/api/hike') ? hike : null), sender: { send: async (d, m) => { sent.push(m); return { ok: true } } }, now: at('18:05') })
  assert.equal(sent[0].title, '⛰ Triglav')
  assert.match(sent[0].url, /^\/hike\?lat=46\.378/)
  assert.deepEqual(store.calls.plans, [['p1', { sent_evening: true, last_window: win }]])
})

test('dispatch — the home city is looked up in the language it was picked in, texts in the phone\'s', async () => {
  const urls = [], sent = []
  const store = fakeStore({ devices: [dev('a', { lang: 'en', home_lang: 'de' }), dev('b', { lang: 'de', home_lang: 'de' })] })
  await runDispatch({ store, getJson: async url => { urls.push(url); return rainy }, sender: { send: async (d, m) => { sent.push(m.title); return { ok: true } } }, now: NOW })
  assert.deepEqual(urls, ['https://metablend.app/api/outlook?city=wien&lang=de']) // one lookup, the picking language
  assert.deepEqual(sent, ['🌧 Rain in Wien', '🌧 Regen in Wien'])
})

test('dispatch — a hike plan is marked sent right after its message, and the log stops a repeat', async () => {
  const win = { window: { from: '2026-10-02T07:00', to: '2026-10-02T11:00', hours: 4 }, next: null }
  const hike = { utcOffsetSec: VIE, nowLocal: '2026-10-01T18:00', notes: [], windows: { today: null, tomorrow: win } }
  const plan = (id, device_id) => ({ id, device_id, name: 'Triglav', lat: 46.378, lon: 13.837, elev: 2864, date: '2026-10-02', sent_evening: false, sent_morning: false, last_window: null })
  const quiet = over => dev(over.id, { alert_rain: false, home_name: null, ...over })
  // the run dies on the second send: the first plan must already be marked
  const store = fakeStore({ devices: [quiet({ id: 'h1' }), quiet({ id: 'h2' })], plans: [plan('p1', 'h1'), plan('p2', 'h2')] })
  let n = 0
  await assert.rejects(runDispatch({ store, getJson: async () => hike, sender: { send: async () => { if (++n === 2) throw new Error('killed'); return { ok: true } } }, now: at('18:05') }))
  assert.deepEqual(store.calls.plans.map(p => p[0]), ['p1'])
  // a later run with the plan row not updated still skips it: the log has the slot
  const again = fakeStore({ devices: [quiet({ id: 'h1' })], plans: [plan('p1', 'h1')], log: [{ device_id: 'h1', kind: 'hike_evening', ref: 'p1:evening', sent_at: at('18:05') }] })
  let sends = 0
  await runDispatch({ store: again, getJson: async () => hike, sender: { send: async () => { sends++; return { ok: true } } }, now: at('19:05') })
  assert.equal(sends, 0)
})
