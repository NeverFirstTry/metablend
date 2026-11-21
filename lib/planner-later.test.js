// The day's budget for new places (lib/climate-store.js) as a visitor meets it. The planner needs a place's
// climate table; when the place has none and the day's budget is used up, the planner says so in the
// reader's language ("try again tomorrow") instead of "Historical data unavailable", asks nobody, and its
// answer is not kept anywhere. The outlook hands the same budget its visitor's address; it simply goes
// without the comparison with the normal. The route is called for real with every outside call faked.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { seen, reset, answerWith, json } from './test-route-fakes.js'
import { LANGUAGES } from './i18n.js'
import { CLIMATE_DAILY } from './climate-store.js'

const { GET: planner } = await import('../app/api/planner/route.js')
const LIENZ = { id: 2772807, name: 'Lienz', alt: null, names: null, country: 'AT', region: 'Tyrol', population: 11800, lat: 46.8294, lon: 12.7698 }
const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

test('the day\'s budget for new places is used up: the planner answers "later" for a place without a table and asks nobody', async () => {
  reset()
  answerWith(call => {
    if (call.url.includes('/rest/v1/rpc/town_lookup')) return json([LIENZ])
    if (call.url.includes('/rest/v1/open_meteo_calls')) return json([{ calls: CLIMATE_DAILY }]) // today's climate calls so far
  })
  const res = await planner(new Request('https://metablend.app/api/planner?city=Lienz', { headers: { 'x-forwarded-for': '203.0.113.90' } }))
  assert.equal(res.status, 503)
  assert.equal((await res.json()).code, 'later')
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.deepEqual(seen.filter(c => c.url.includes('open-meteo.com')).map(c => c.url), [], 'the archive is not asked')
})

test('the planner page says it in the reader\'s language, in all 13', async () => {
  assert.match(read('app/planner/page.js'), /json\.code === 'later' \? t\(lang, 'plLater'\)/)
  for (const { code } of LANGUAGES) {
    const { default: pack } = await import(`./i18n/${code}.js`)
    assert.ok(pack.plLater && !/[–—]/.test(pack.plLater), `${code}.plLater`)
  }
})

test('the outlook and the planner say who asks, so the budget can count by address', () => {
  assert.match(read('app/api/outlook/route.js'), /loadClimate\(geo\.lat, geo\.lon, \{ by: asker\(request\) \}\)/)
  assert.match(read('app/api/planner/route.js'), /loadClimate\(geo\.lat, geo\.lon, \{ by: asker\(request\), note \}\)/)
})
