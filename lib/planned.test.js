// Planned hikes where they are made (UX review N2, owner: before launch): the peak says "Planned for Saturday"
// with a way to cancel, and the Hiking tab lists the plans at the top. They were only under More, Notifications.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makePlansStore, plansAt, upcoming } from './plans.js'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const en = (await import('./i18n/en.js')).default

const GLOCKNER = { id: 'grossglockner', name: 'Großglockner', lat: 47.07455, lon: 12.69388, elev: 3798 }
const plan = (id, date, extra = {}) => ({ id, name: 'Großglockner', lat: 47.07455, lon: 12.69388, elev: 3798, date, route_name: null, ...extra })

test('the store reads the plans once per run, and only with notifications on', async () => {
  let asked = 0
  const api = async () => { asked++; return { status: 200, json: { plans: [plan('a', '2026-11-22')] } } }
  const on = makePlansStore({ permission: async () => 'granted', api })
  const [x, y] = await Promise.all([on.load(), on.load()])
  assert.equal(asked, 1)
  assert.deepEqual(x, y)
  await on.load()
  assert.equal(asked, 1, 'kept for the run')
  const off = makePlansStore({ permission: async () => 'prompt', api })
  assert.deepEqual(await off.load(), [])
  assert.equal(asked, 1, 'no device on the server without notifications: nothing asked')
  const broken = makePlansStore({ permission: async () => 'granted', api: async () => { throw new Error('offline') } })
  assert.deepEqual(await broken.load(), [])
})

test('a new plan joins in date order; a cancel leaves only when the server took it', async () => {
  let answer = 200
  const store = makePlansStore({ permission: async () => 'granted', api: async (path, o) => (o?.method === 'DELETE' ? { status: answer, json: {} } : { status: 200, json: { plans: [plan('b', '2026-11-24')] } }) })
  await store.load()
  let told = 0
  const off = store.subscribe(() => told++)
  store.add(plan('a', '2026-11-22'))
  assert.deepEqual(store.get().map(p => p.id), ['a', 'b'])
  answer = 500
  assert.equal(await store.cancel('a'), false)
  assert.deepEqual(store.get().map(p => p.id), ['a', 'b'])
  answer = 200
  assert.equal(await store.cancel('a'), true)
  assert.deepEqual(store.get().map(p => p.id), ['b'])
  assert.equal(told, 2)
  off()
})

test('plansAt: this peak\'s plans, a route\'s by its name; upcoming: from today on', () => {
  const list = [plan('a', '2026-11-22'), plan('r', '2026-11-23', { route_name: 'Alter Kalser Weg 712' }), plan('o', '2026-11-22', { name: 'Ortler', lat: 46.5087, lon: 10.5448 }), plan('old', '2026-11-19')]
  assert.deepEqual(plansAt(list, GLOCKNER).map(p => p.id), ['a', 'old'])
  assert.deepEqual(plansAt(list, GLOCKNER, 'Alter Kalser Weg 712').map(p => p.id), ['r'])
  assert.deepEqual(upcoming(list, '2026-11-20').map(p => p.id), ['a', 'r', 'o'])
})

test('the peak says "Planned for Sunday" with a way to cancel it', async () => {
  const { plansStore } = await import('./plans-client.js')
  plansStore.set([plan('a', '2026-11-22')])
  const { default: PlanHike } = await import('../app/components/hike/PlanHike.jsx')
  const html = render(h(PlanHike, { peak: GLOCKNER, lang: 'en', unit: 'C', todayLocal: '2026-11-20' }))
  assert.match(html, /Planned for Sunday/)
  assert.ok(html.includes(en.planCancel))
  assert.match(html, /aria-label="Cancel plan: Planned for Sunday"/)
  // on a route of that peak, the peak's own plan is not the route's
  const onRoute = render(h(PlanHike, { peak: GLOCKNER, lang: 'en', unit: 'C', todayLocal: '2026-11-20', route: { id: 'osm-1', name: 'Alter Kalser Weg 712', points: [[47, 12, 2000], [47.1, 12.1, 3000]] } }))
  assert.doesNotMatch(onRoute, /Planned for/)
  plansStore.set(null)
})

test('the Hiking tab lists the plans at the top, each opening its peak; nothing when none', async () => {
  const { plansStore } = await import('./plans-client.js')
  const { default: PlannedHikes } = await import('../app/components/hike/PlannedHikes.jsx')
  const hrefFor = p => (p.id ? `/hike?peak=${p.id}` : `/hike?lat=${p.lat}`)
  plansStore.set([plan('a', '2026-11-22'), plan('r', '2026-11-21', { route_name: 'Alter Kalser Weg 712' }), plan('old', '2026-11-19')])
  const html = render(h(PlannedHikes, { lang: 'en', hrefFor, featured: [GLOCKNER], todayLocal: '2026-11-20' }))
  assert.ok(html.includes(en.plannedTitle))
  assert.match(html, /href="\/hike\?peak=grossglockner"/)
  assert.match(html, /Alter Kalser Weg 712/)
  assert.match(html, /tomorrow · Großglockner/)
  assert.doesNotMatch(html, /old|Wednesday/)
  plansStore.set([])
  assert.equal(render(h(PlannedHikes, { lang: 'en', hrefFor, featured: [GLOCKNER], todayLocal: '2026-11-20' })), '')
  plansStore.set(null)
})
