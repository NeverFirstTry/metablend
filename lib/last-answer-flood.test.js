// The finding of 2026-11-14 as one afternoon, through the public addresses: /api/nowcast and /api/hike
// take any coordinates, so anyone can write made-up places into the table of last good answers
// (lib/last-answer.js). The same afternoon runs twice against a real Postgres (PGlite): with the SQL
// file as it was (supabase/__fixtures__/last-answers-2026-11-13.sql) and as it is. The routes are called
// for real with every outside call faked (lib/test-route-fakes.js); the database's REST API is played
// by this file, which hands the routes' calls to the real function and table.
// One clock for both: PGlite's now() follows the test's Date (checked below), which is set into the
// recorded answers, so time passes in the table as it does for the routes.
import './test-jsx-hooks.js'
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const { json, answerWith, reset } = await import('./test-route-fakes.js')
const { GET: outlook } = await import('../app/api/outlook/route.js')
const { GET: hike } = await import('../app/api/hike/route.js')
const { GET: nowcast } = await import('../app/api/nowcast/route.js')

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const BEFORE = read('../supabase/__fixtures__/last-answers-2026-11-13.sql'), TODAY = read('../supabase/last-answers.sql')
// the two recorded model answers overlap on 2026-09-30, the day this afternoon is set on
const vienna = read('./outlook/__fixtures__/om-multi-vienna.json'), glockner = read('./hike/__fixtures__/om-summit-glockner.json'), rain = read('./__fixtures__/nowcast-vienna.json')
const body = text => new Response(text, { headers: { 'content-type': 'application/json' } })
const hourOf = i => { const r = JSON.parse(glockner); return Date.parse(`${r.hourly.time[i]}:00Z`) - r.utc_offset_seconds * 1000 }
const MIN = 60_000, HOUR = 60 * MIN
// the room the function is given here (its p_max): the whole table before, each kind's own room today
const ROOM = 12
const FLOOD = 3 * ROOM // made-up places through each of the two addresses

let ip = 0
const ask = (GET, path) => GET(new Request(`https://metablend.app${path}`, { headers: { 'x-forwarded-for': `198.51.${Math.floor(++ip / 250)}.${ip % 250}` } }))
const GLOCKNER = 'lat=47.0745&lon=12.6939&elev=3798&name=Glockner', HOCHKOENIG = 'lat=47.4204&lon=13.0625&elev=2941&name=Hochk%C3%B6nig', WILDSPITZE = 'lat=46.8853&lon=10.8672&elev=3768&name=Wildspitze'
const RAIN = '/api/nowcast?lat=48.21&lon=16.37', OUTLOOK = '/api/outlook?city=Wien&lang=de'

// `from`: the hour of 2026-09-30 it begins at (the rain address keeps built answers in memory for ten
// minutes, across both runs: the second run starts hours after the first)
async function afternoon(sql, from) {
  const db = new PGlite()
  await db.exec('create role anon; create role authenticated; create role service_role;')
  await db.exec(sql)
  let models = true
  reset()
  answerWith(async ({ url, method, body: sent }) => {
    if (url.includes('/rest/v1/rpc/keep_last_answer')) {
      const p = JSON.parse(sent)
      return json((await db.query('select public.keep_last_answer($1, $2, $3, $4) as kept', [p.p_kind, p.p_place, p.p_body, ROOM])).rows[0].kept)
    }
    if (url.includes('/rest/v1/last_answers') && method === 'GET') {
      const part = k => url.match(new RegExp(`${k}=(?:eq|gte)\\.([^&]+)`))?.[1]
      return json((await db.query('select body, made_at from public.last_answers where kind = $1 and place = $2 and made_at >= $3::timestamptz', [part('kind'), part('place'), part('made_at')])).rows)
    }
    if (url.includes('/rest/v1/rpc/town_lookup')) return json([{ id: 2761369, name: 'Vienna', alt: 'Wien', names: { de: 'Wien' }, country: 'AT', region: 'Vienna', population: 1691468, lat: 48.2085, lon: 16.3721 }])
    if (url.includes('api.open-meteo.com/v1/forecast')) {
      if (!models) return new Response('{"error":true,"reason":"down"}', { status: 500, headers: { 'content-type': 'application/json' } })
      return body(url.includes('minutely_15=precipitation') ? rain : url.includes('elevation=') ? glockner : vienna)
    }
  })
  const T0 = hourOf(from) + 20 * MIN
  const clock = t => mock.timers.setTime(t)
  clock(T0)
  assert.ok(Math.abs((await db.query('select now() as t')).rows[0].t - T0) < 5000, "the database's clock is the test's")

  // the Großglockner and Vienna's rain are asked for, and a summit somebody opens once
  await ask(hike, `/api/hike?${GLOCKNER}`)
  await ask(nowcast, RAIN)
  await ask(hike, `/api/hike?${HOCHKOENIG}`)
  // two hours later visitors come back to the first two: their answers are built again
  clock(T0 + 2 * HOUR)
  await ask(hike, `/api/hike?${GLOCKNER}`)
  await ask(nowcast, RAIN)
  // five minutes later the flood: made-up coordinates, three rooms' worth through each address
  clock(T0 + 2 * HOUR + 5 * MIN)
  for (let i = 0; i < FLOOD; i++) assert.equal((await ask(nowcast, `/api/nowcast?lat=${(-30 - i / 100).toFixed(2)}&lon=100`)).status, 200)
  for (let i = 0; i < FLOOD; i++) assert.equal((await ask(hike, `/api/hike?lat=${(10 + i / 100).toFixed(2)}&lon=20&elev=1000&name=x`)).status, 200)
  // after it, two places are asked for the first time: a summit, and a town's 7-day outlook
  await ask(hike, `/api/hike?${WILDSPITZE}`)
  await ask(outlook, OUTLOOK)
  const rows = Object.fromEntries((await db.query('select kind, count(*)::int as n from public.last_answers group by kind order by kind')).rows.map(r => [r.kind, r.n]))

  // a quarter of an hour later the models give nothing: who still gets an answer?
  clock(T0 + 2 * HOUR + 20 * MIN)
  models = false
  const summit = async peak => ((await (await ask(hike, `/api/hike?${peak}`)).json()).kept ? 'last good answer' : 'no forecast')
  const served = async res => (res.status === 200 && (await res.json()).kept ? 'last good answer' : `error ${res.status}`)
  return {
    rows,
    'Großglockner (in use)': await summit(GLOCKNER),
    'rain in Vienna (in use)': await served(await ask(nowcast, RAIN)),
    'Hochkönig (opened once before the flood)': await summit(HOCHKOENIG),
    'Wildspitze (first asked after the flood)': await summit(WILDSPITZE),
    'outlook for Vienna (first asked after the flood)': await served(await ask(outlook, OUTLOOK)),
  }
}

test('the flood with the function of before 2026-11-14: the table fills up through the rain address alone, and no place asked for afterwards is kept, of any kind', async () => {
  mock.timers.enable({ apis: ['Date'], now: hourOf(9) })
  try {
    const got = await afternoon(BEFORE, 9)
    if (process.env.SHOW_FLOOD) console.log('before', JSON.stringify(got, null, 1))
    assert.deepEqual(got, {
      rows: { rain: 10, summit: 2 }, // the three real places and nine made-up ones: full
      'Großglockner (in use)': 'last good answer',
      'rain in Vienna (in use)': 'last good answer',
      'Hochkönig (opened once before the flood)': 'last good answer',
      'Wildspitze (first asked after the flood)': 'no forecast',
      'outlook for Vienna (first asked after the flood)': 'error 502',
    })
  } finally { mock.timers.reset() }
})

test('the same flood with today\'s function: every place asked for afterwards is kept and served, the places in use are still served, and the flood stays in the rooms of the two addresses it came through', async () => {
  mock.timers.enable({ apis: ['Date'], now: hourOf(14) })
  try {
    const got = await afternoon(TODAY, 14)
    if (process.env.SHOW_FLOOD) console.log('today', JSON.stringify(got, null, 1))
    assert.deepEqual(got, {
      rows: { outlook: 1, rain: ROOM, summit: ROOM },
      'Großglockner (in use)': 'last good answer',
      'rain in Vienna (in use)': 'last good answer',
      // the price: a place asked for a single time looks like a made-up one and gives way to the flood
      'Hochkönig (opened once before the flood)': 'no forecast',
      'Wildspitze (first asked after the flood)': 'last good answer',
      'outlook for Vienna (first asked after the flood)': 'last good answer',
    })
  } finally { mock.timers.reset() }
})
