// Planning a hike without notifications (owner, 2026-11-22): someone who only wants the "Next hike" widget can plan.
// Without notifications the plan stays on the phone (no server write) and shows in the Mountains tab and the widget;
// the plan screen says in one line that alerts need notifications, with a way to turn them on. With notifications
// on, nothing changes.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { makePlansStore } from './plans.js'
import { widgetSettings } from './app-widget-sync.js'

const LANGS = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko']
const phone = (saved = []) => ({ read: async () => saved, write: async list => { saved = list; return list }, saved: () => saved })
// the server: records every call; GET answers its plans (or 404 for a phone it does not know), POST hands back a plan
const server = ({ known = true, plans = [] } = {}) => {
  const calls = []
  const api = async (path, { method = 'GET', body } = {}) => {
    calls.push(`${method} ${path}`)
    if (!known) return { status: 404, json: { error: 'Unknown device' } }
    if (method === 'POST') return { status: 200, json: { plan: { id: '00000000-0000-4000-8000-00000000000' + calls.length, ...body, route_name: body.route?.name ?? null } } }
    if (method === 'DELETE') return { status: 200, json: {} }
    return { status: 200, json: { plans } }
  }
  return { api, calls }
}
const hochstein = { name: 'Hochstein', lat: 46.8436, lon: 12.7489, elev: 2057, date: '2026-11-29' }

test('without notifications a plan stays on the phone: no server call, shown at once and after a restart, cancelled there', async () => {
  const s0 = server(), local = phone()
  const store = makePlansStore({ permission: async () => 'prompt', api: s0.api, local })
  assert.deepEqual(await store.load(), [])
  assert.equal(store.alertsOn(), false)
  const p = await store.addLocal(hochstein)
  assert.equal(p.local, true)
  assert.match(p.id, /^local-/)
  assert.deepEqual(store.get().map(x => x.name), ['Hochstein'])
  assert.equal(local.saved().length, 1, 'kept on the phone')
  // the next app run reads it back
  const again = makePlansStore({ permission: async () => 'prompt', api: s0.api, local })
  assert.deepEqual((await again.load()).map(x => [x.name, x.date]), [['Hochstein', '2026-11-29']])
  assert.equal(await again.cancel(p.id), true)
  assert.deepEqual(local.saved(), [])
  assert.deepEqual(s0.calls, [], 'never a server call')
})

test('with notifications on: the server\'s plans as before, and any kept on the phone beside them, by date', async () => {
  const s1 = server({ plans: [{ id: 'a', name: 'Zugspitze', lat: 47.42, lon: 10.98, date: '2026-11-30' }] })
  const store = makePlansStore({ permission: async () => 'granted', api: s1.api, local: phone([{ ...hochstein, id: 'local-1', local: true }]) })
  assert.deepEqual((await store.load()).map(x => x.name), ['Hochstein', 'Zugspitze'])
  assert.equal(store.alertsOn(), true)
  assert.deepEqual(s1.calls, ['GET plans'])
})

test('allowed by the phone but off in the app (the server does not know the phone): alerts off, the phone\'s plans only', async () => {
  const s2 = server({ known: false })
  const store = makePlansStore({ permission: async () => 'granted', api: s2.api, local: phone([{ ...hochstein, id: 'local-1', local: true }]) })
  assert.deepEqual((await store.load()).map(x => x.name), ['Hochstein'])
  assert.equal(store.alertsOn(), false)
})

test('turning alerts on moves the phone\'s plans to the server, so they get their alerts', async () => {
  const s3 = server(), local = phone([{ ...hochstein, id: 'local-1', local: true, body: { name: 'Hochstein', lat: 46.8436, lon: 12.7489, elev: 2057, date: '2026-11-29' } }])
  const store = makePlansStore({ permission: async () => 'granted', api: s3.api, local })
  await store.load() // the phone's plan only: the server asked first (an empty list)
  assert.equal(await store.promote(), 1)
  assert.deepEqual(s3.calls, ['GET plans', 'POST plans'])
  assert.deepEqual(local.saved(), [], 'no longer only on the phone')
  assert.equal(store.get().length, 1)
  assert.equal(store.get()[0].local, undefined, 'now the server\'s')
  assert.equal(store.alertsOn(), true)
})

test('the "Next hike" widget gets a plan kept on the phone like any other: name, place, height and day only', () => {
  const s = widgetSettings({ lang: 'de', unit: 'C', plans: [{ ...hochstein, id: 'local-1', local: true, body: {} }], today: '2026-11-22' })
  assert.deepEqual(s.hikes, [{ name: 'Hochstein', lat: 46.8436, lon: 12.7489, elev: 2057, date: '2026-11-29' }])
})

// source-match-ok: the plan screen and the widget sync run in the app after its bridge answers, which a static render cannot drive
test('the plan screen plans without asking for notifications; the widget sync reads the phone\'s plans', () => {
  const screen = readFileSync(new URL('../app/components/hike/PlanHike.jsx', import.meta.url), 'utf8')
  const plan = screen.slice(screen.indexOf('async function plan('), screen.indexOf('async function cancel('))
  assert.doesNotMatch(plan, /enablePush/, 'picking a day never asks for notifications')
  assert.match(plan, /plansStore\.addLocal\(/)
  assert.match(plan, /r\.status === 404/, 'off in the app: kept on the phone too')
  // one line and a way to turn them on, only while alerts are off
  assert.match(screen, /!alertsOn && \(/)
  assert.match(screen, /t\(lang, 'planAlertsNeedNotif'\)/)
  assert.match(screen, /onClick=\{turnOnAlerts\}[^>]*>\{t\(lang, 'promptOn'\)\}/)
  const sync = readFileSync(new URL('./app-widget-client.js', import.meta.url), 'utf8')
  assert.match(sync, /readLocalPlans\(\)/)
})

test('the new texts in every language', async () => {
  for (const l of LANGS) {
    const p = (await import(`./i18n/${l}.js`)).default
    assert.ok(p.planAlertsNeedNotif && p.promptOn, `${l}: the line and Turn on`)
    assert.ok(p.planSavedLocal?.includes('{tab}'), `${l}: planSavedLocal names the tab`)
  }
})
