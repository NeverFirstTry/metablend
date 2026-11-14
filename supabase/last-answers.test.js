// supabase/last-answers.sql in a real Postgres (PGlite): the function that keeps an answer renews a
// place that is already there, and a full room never refuses a new one (true: a new place got a row;
// false: renewed, or the caller was given no room). A full room gives up an answer too old to be
// served, else a place asked for only once, else the place in use whose answer is oldest; each kind has
// its own room. The last test is the flood the rule exists for: thousands of made-up places through the
// two addresses that take any coordinates.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const sql = fs.readFileSync(new URL('./last-answers.sql', import.meta.url), 'utf8')
const before = fs.readFileSync(new URL('./__fixtures__/last-answers-2026-11-13.sql', import.meta.url), 'utf8') // the file as it was
const fresh = async () => { const d = new PGlite(); await d.exec('create role anon; create role authenticated; create role service_role;'); return d }
const db = await fresh()
await db.exec(sql)
await db.exec(sql) // safe to run twice
const keepIn = d => async (kind, place, body, max = null) => (await d.query('select public.keep_last_answer($1, $2, $3, $4) as kept', [kind, place, body, max])).rows[0].kept
const keep = keepIn(db)
const rows = async () => (await db.query('select kind, place, body from public.last_answers order by kind, place')).rows
const summits = async () => (await db.query("select place from public.last_answers where kind = 'summit' order by place")).rows.map(r => r.place)
// time passes: every row is that much older
const later = (d, span) => d.exec(`update public.last_answers set made_at = made_at - interval '${span}', first_at = first_at - interval '${span}'`)

test('keep_last_answer: a new place is kept, the same place is renewed, another kind is its own row', async () => {
  assert.equal(await keep('outlook', '48.209,16.372', 'a', 3), true, 'a new place')
  assert.equal(await keep('outlook', '48.209,16.372', 'b', 3), false, 'renewed: not a new place')
  assert.equal(await keep('rain', '48.21,16.37', 'r', 3), true)
  assert.deepEqual(await rows(), [{ kind: 'outlook', place: '48.209,16.372', body: 'b' }, { kind: 'rain', place: '48.21,16.37', body: 'r' }])
  await assert.rejects(keep('nonsense', 'x', 'y', 3), /check/, 'only the four kinds')
})

// Production and dev have the table and the function of 2026-11-13 (and before that a table with three
// kinds): the file has to turn both into today's, keep their rows, and leave one function, not two.
test('a table and function of before 2026-11-14 become today\'s after the file ran: the rows stay, the blend is taken, the app of before still works', async () => {
  const old = await fresh()
  await old.exec(`create table public.last_answers (kind text not null check (kind in ('outlook', 'summit', 'rain')), place text not null, made_at timestamptz not null default now(), body text not null, primary key (kind, place));
    insert into public.last_answers (kind, place, body) values ('outlook', '48.209,16.372', 'a');`)
  await assert.rejects(old.query("insert into public.last_answers (kind, place, body) values ('forecast', '48.209,16.372', 'f')"), /check/, 'before: refused')
  await old.exec(before) // what production and dev hold today: four kinds, the function that refuses
  await old.exec(sql)
  await old.exec(sql) // safe to run twice
  const kept = async (kind, place) => (await old.query('select public.keep_last_answer($1, $2, $3, $4) as kept', [kind, place, 'f', 3000])).rows[0].kept // as the app of before sends it
  assert.equal(await kept('forecast', '48.209,16.372'), true)
  await assert.rejects(kept('nonsense', 'x'), /check/)
  assert.equal((await old.query("select public.keep_last_answer('rain', '48.21,16.37', 'r') as kept")).rows[0].kept, true, 'as the app sends it now: no limit')
  assert.deepEqual((await old.query('select kind, body, first_at is not null as since from public.last_answers order by kind')).rows,
    [{ kind: 'forecast', body: 'f', since: true }, { kind: 'outlook', body: 'a', since: true }, { kind: 'rain', body: 'r', since: true }])
  assert.equal((await old.query("select count(*)::int as n from pg_constraint where conrelid = 'public.last_answers'::regclass and contype = 'c'")).rows[0].n, 1, 'one rule on kind, not two')
  assert.equal((await old.query("select count(*)::int as n from pg_proc where proname = 'keep_last_answer'")).rows[0].n, 1, 'one function, not two')
})

test('a full room: a new place is always kept, and the place asked for only once and longest ago gives way', async () => {
  for (const p of ['a', 'b', 'c']) { await keep('summit', p, 's', 3); await later(db, '1 minute') }
  assert.equal(await keep('summit', 'd', 's', 3), true, 'not refused')
  assert.deepEqual(await summits(), ['b', 'c', 'd'], 'a was asked longest ago')
  assert.equal(await keep('summit', 'b', 's2', 3), false, 'a place already there is renewed in place')
  assert.deepEqual(await rows(), [{ kind: 'outlook', place: '48.209,16.372', body: 'b' }, { kind: 'rain', place: '48.21,16.37', body: 'r' },
    { kind: 'summit', place: 'b', body: 's2' }, { kind: 'summit', place: 'c', body: 's' }, { kind: 'summit', place: 'd', body: 's' }], 'the other kinds have their own rooms')
})

test('a place visitors came back to stays while places asked for once come and go; among places in use the oldest answer gives way', async () => {
  await later(db, '40 minutes')
  await keep('summit', 'c', 'again', 3) // built again 40 minutes after it was first kept: in use
  await later(db, '1 minute')
  for (const p of ['f1', 'f2', 'f3', 'f4', 'f5']) await keep('summit', p, 'once', 3)
  assert.deepEqual(await summits(), ['c', 'f4', 'f5'], 'five new places pushed out b, d and each other, never c')
  // the rule knows "once" from "again", not real from made up: f4 and f5, asked again later, are in use too
  await later(db, '40 minutes')
  await keep('summit', 'f4', 'again', 3)
  await keep('summit', 'f5', 'again', 3)
  await keep('summit', 'g', 'once', 3)
  assert.deepEqual(await summits(), ['f4', 'f5', 'g'], 'nothing asked for once was left: c had the oldest answer')
})

test('an answer older than 24 hours goes first, even that of a place in use', async () => {
  await db.exec("update public.last_answers set made_at = now() - interval '25 hours', first_at = now() - interval '3 days' where kind = 'summit' and place = 'f5'")
  await keep('summit', 'h', 'once', 3)
  assert.deepEqual(await summits(), ['f4', 'g', 'h'], 'f5 can no longer be served; g, asked for once, stays')
})

// the app sends 0 for a visitor address that has added its share of new places this hour (lib/last-answer.js)
test('a caller given no room: a place already there is still renewed, a new place gets no row and nothing gives way for it', async () => {
  assert.equal(await keep('summit', 'h', 'renewed', 0), false)
  assert.equal(await keep('summit', 'never-kept', 'x', 0), false)
  assert.deepEqual((await rows()).filter(r => r.kind === 'summit'), [{ kind: 'summit', place: 'f4', body: 'again' }, { kind: 'summit', place: 'g', body: 'once' }, { kind: 'summit', place: 'h', body: 'renewed' }])
})

// The finding of 2026-11-14: /api/nowcast and /api/hike take any coordinates, so anyone could write
// made-up places until the table was full, and from then on no new place was kept for a day.
test('a flood of made-up places against the real rooms: none is refused, every kind keeps its room, the places in use are all still there, and a new place is kept', async () => {
  const d = await fresh()
  await d.exec(sql)
  const k = keepIn(d)
  const count = async () => Object.fromEntries((await d.query('select kind, count(*)::int as n from public.last_answers group by kind')).rows.map(r => [r.kind, r.n]))
  const real = [['forecast', '48.209,16.372'], ['outlook', '48.209,16.372'], ['rain', '48.21,16.37'], ['summit', '47.075,12.694,3798'], ['summit', '47.075,12.694,3798,core']]
  for (const [kind, place] of real) await k(kind, place, 'real')
  await later(d, '2 hours')
  for (const [kind, place] of real) await k(kind, place, 'real') // built again two hours later: in use
  await k('summit', '47.42,13.062,2941', 'asked once') // a real summit somebody opened a single time
  await later(d, '5 minutes')
  // twice a room's size through each of the two addresses that take coordinates
  const flood = async (kind, n) => (await d.query("select count(*)::int as kept from generate_series(1, $2::int) g where public.keep_last_answer($1, 'made-up-' || g, 'x')", [kind, n])).rows[0].kept
  assert.equal(await flood('rain', 3000), 3000, 'none refused')
  assert.equal(await flood('summit', 2000), 2000)
  assert.deepEqual(await count(), { forecast: 1, outlook: 1, rain: 1500, summit: 1000 }, 'each kind within its own room')
  const left = (await d.query("select kind || ' ' || place as p from public.last_answers where body <> 'x' order by 1")).rows.map(r => r.p)
  assert.deepEqual(left, real.map(([kind, place]) => `${kind} ${place}`).sort(), 'every place in use is still there; the summit asked for once gave way like a made-up one')
  // a place asked for the first time in the middle of it
  assert.equal(await k('summit', '46.885,10.867,3768', 'new'), true)
  assert.equal((await d.query("select count(*)::int as n from public.last_answers where kind = 'summit' and place = '46.885,10.867,3768'")).rows[0].n, 1)
  assert.equal((await count()).summit, 1000)
})
