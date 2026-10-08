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

test('dispatch — a plan on a route: the route weather, not the summit forecast; a failure skips only that plan', async () => {
  const route = { id: 'osm-14622955', name: '712 Alter Kalser Weg', pace: 'normal', roundTrip: true, points: [[47.02, 12.69, 1920], [47.07, 12.69, 3798]] }
  const plan = (id, device_id, over = {}) => ({ id, device_id, name: 'Großglockner', lat: 47.0745, lon: 12.6941, elev: 3798, date: '2026-10-02', route, sent_evening: false, sent_morning: false, last_window: null, ...over })
  const quiet = id => dev(id, { alert_rain: false, home_name: null, lang: 'en' })
  const store = fakeStore({ devices: [quiet('r1'), quiet('r2')], plans: [plan('p1', 'r1'), plan('p2', 'r2', { route: { ...route, id: 'gpx-1' } })] })
  const asked = [], urls = [], sent = []
  const routeWeather = async q => {
    asked.push(q)
    if (asked.length === 2) throw new Error('upstream')
    return { utcOffsetSec: VIE, suggestion: { start: '07:30', latest: '09:00', highAt: '10:45', finish: '14:10' } }
  }
  await runDispatch({ store, getJson: async url => { urls.push(url); return null }, routeWeather, sender: { send: async (d, m) => { sent.push(m); return { ok: true } } }, now: at('18:05') })
  assert.deepEqual(urls, [])
  assert.deepEqual(asked[0], { points: [{ lat: 47.02, lon: 12.69, ele: 1920 }, { lat: 47.07, lon: 12.69, ele: 3798 }], date: '2026-10-02', pace: 'normal', roundTrip: true, now: at('18:05') })
  assert.equal(asked.length, 2)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].title, '⛰ 712 Alter Kalser Weg')
  assert.equal(sent[0].body, 'Start by 07:30 — summit ~10:45 (safe to start until 09:00)')
  assert.equal(sent[0].url, '/hike?route=osm-14622955')
  assert.deepEqual(store.calls.plans, [['p1', { sent_evening: true, last_window: { start: '07:30', latest: '09:00' } }]])
})

test('dispatch only=rain — nowcast per home city, rain alerts only, no hike work; nowcast down → hourly rule', async () => {
  const off = 7200
  const q = (base, i) => new Date(base + off * 1000 + i * 15 * 60e3).toISOString().slice(0, 16)
  const now = at('13:05')
  const nc = { precision: 'fine', models: 3, utcOffsetSec: off, steps: Array.from({ length: 10 }, (_, i) => ({ t: q(now, i), mm: i === 2 ? 0.4 : 0, wet: i === 2, agree: 1 })) }
  const urls = []
  const getJson = async url => { urls.push(url); return url.includes('/api/nowcast') ? nc : { ...rainy, lat: 48.21, lon: 16.37 } }
  const sent = []
  const store = fakeStore({ devices: [dev('a', { lang: 'en' })], plans: [{ id: 'p1', device_id: 'a', name: 'X', lat: 1, lon: 1, elev: 1, date: '2026-10-01' }] })
  await runDispatch({ store, getJson, only: 'rain', sender: { send: async (d, m) => { sent.push(m); return { ok: true } } }, now })
  assert.ok(urls.some(u => u.includes('/api/nowcast?lat=48.21&lon=16.37')))
  assert.ok(!urls.some(u => u.includes('/api/hike')))
  assert.equal(sent.length, 1)
  assert.match(sent[0].body, /^In ~\d+ min/)
  const down = fakeStore({ devices: [dev('b', { lang: 'en' })] })
  const sent2 = []
  await runDispatch({ store: down, getJson: async url => (url.includes('/api/nowcast') ? null : { ...rainy, lat: 48.21, lon: 16.37 }), only: 'rain', sender: { send: async (d, m) => { sent2.push(m); return { ok: true } } }, now })
  assert.equal(sent2.length, 1) // the hourly rule's message
  assert.doesNotMatch(sent2[0].body, /^In ~/)
})

test('dispatch — the quarter-hourly run also sends official warnings for the home city', async () => {
  const now = at('10:00', '2026-10-08')
  const calls = []
  const r = await runDispatch({
    store: fakeStore({ devices: [dev('a', { lang: 'en', alert_rain: false, alert_severe: true })] }),
    getJson: async url => (url.includes('/api/outlook') ? { ...rainy, lat: 48.21, lon: 16.37, cc: 'AT', nowLocal: '2026-10-08T10:00', hourly: [] } : null),
    warningsAt: async (lat, lon, cc) => { calls.push([lat, lon, cc]); return [{ id: 'w', level: 3, type: 'wind', onset: '2026-10-08T12:00:00+02:00', expires: '2026-10-08T18:00:00+02:00' }] },
    sender: { send: async () => ({ ok: true }) }, now, dry: true, only: 'rain',
  })
  assert.deepEqual(calls, [[48.21, 16.37, 'AT']])
  assert.deepEqual(r.messages.map(m => [m.kind, m.ref]), [['warning', 'w@3']])
})

test('dispatch — a city outside MeteoAlarm (warningsAt → null) keeps the model-based alerts', async () => {
  const r = await runDispatch({
    store: fakeStore({ devices: [dev('a', { lang: 'en' })] }), getJson: async () => rainy,
    warningsAt: async () => null, sender: { send: async () => ({ ok: true }) }, now: NOW, dry: true,
  })
  assert.ok(r.messages.some(m => m.kind === 'rain'))
})

test('dispatch — a warning lasting days is not sent again after 24 h', async () => {
  const now = at('10:00', '2026-10-09')
  const log = [{ device_id: 'a', kind: 'warning', ref: 'w@3', sent_at: now - 30 * 3600e3 }]
  const store = { ...fakeStore({ devices: [dev('a', { lang: 'en', alert_rain: false, alert_severe: true })] }), recentLog: async (ids, since, kind) => log.filter(e => e.sent_at >= since && (!kind || e.kind === kind)) }
  const r = await runDispatch({
    store, getJson: async url => (url.includes('/api/outlook') ? { ...rainy, lat: 48.21, lon: 16.37, nowLocal: '2026-10-09T10:00', hourly: [] } : null),
    warningsAt: async () => [{ id: 'w', level: 3, type: 'heat', onset: '2026-10-08T00:00:00+02:00', expires: '2026-10-11T00:00:00+02:00' }],
    sender: { send: async () => ({ ok: true }) }, now, dry: true, only: 'rain',
  })
  assert.deepEqual(r.messages, [])
})
