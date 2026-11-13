// supabase/last-answers.sql in a real Postgres (PGlite): the function that keeps an answer renews a
// place that is already there, refuses a new place while the table is full of young answers, and makes
// room by dropping answers older than 24 hours.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const sql = fs.readFileSync(new URL('./last-answers.sql', import.meta.url), 'utf8')
const db = new PGlite()
await db.exec('create role anon; create role authenticated; create role service_role;')
await db.exec(sql)
await db.exec(sql) // safe to run twice
const keep = async (kind, place, body, max) => (await db.query('select public.keep_last_answer($1, $2, $3, $4) as kept', [kind, place, body, max])).rows[0].kept
const rows = async () => (await db.query('select kind, place, body from public.last_answers order by kind, place')).rows

test('keep_last_answer: a new place is kept, the same place is renewed, another kind is its own row', async () => {
  assert.equal(await keep('outlook', '48.209,16.372', 'a', 3), true)
  assert.equal(await keep('outlook', '48.209,16.372', 'b', 3), true)
  assert.equal(await keep('rain', '48.21,16.37', 'r', 3), true)
  assert.deepEqual(await rows(), [{ kind: 'outlook', place: '48.209,16.372', body: 'b' }, { kind: 'rain', place: '48.21,16.37', body: 'r' }])
  await assert.rejects(keep('nonsense', 'x', 'y', 3), /check/, 'only the four kinds')
})

// 2026-11-13: the forecast's blend is kept too. Production and dev have the table with three kinds.
test('a table made with three kinds takes the forecast\'s blend after the file ran, keeps its rows, and still refuses anything else', async () => {
  const old = new PGlite()
  await old.exec('create role anon; create role authenticated; create role service_role;')
  await old.exec(`create table public.last_answers (kind text not null check (kind in ('outlook', 'summit', 'rain')), place text not null, made_at timestamptz not null default now(), body text not null, primary key (kind, place));
    insert into public.last_answers (kind, place, body) values ('outlook', '48.209,16.372', 'a');`)
  await assert.rejects(old.query("insert into public.last_answers (kind, place, body) values ('forecast', '48.209,16.372', 'f')"), /check/, 'before: refused')
  await old.exec(sql)
  await old.exec(sql) // safe to run twice
  const kept = async (kind, place) => (await old.query('select public.keep_last_answer($1, $2, $3, $4) as kept', [kind, place, 'f', 3000])).rows[0].kept
  assert.equal(await kept('forecast', '48.209,16.372'), true)
  await assert.rejects(kept('nonsense', 'x'), /check/)
  assert.deepEqual((await old.query('select kind, body from public.last_answers order by kind')).rows, [{ kind: 'forecast', body: 'f' }, { kind: 'outlook', body: 'a' }])
  assert.equal((await old.query("select count(*)::int as n from pg_constraint where conrelid = 'public.last_answers'::regclass and contype = 'c'")).rows[0].n, 1, 'one rule on kind, not two')
})

test('keep_last_answer: full of young answers, a new place is refused and a place already there is still renewed', async () => {
  assert.equal(await keep('summit', '47.075,12.694,3798', 's', 3), true) // the third row: full
  assert.equal(await keep('summit', '46.5,11.5,2500', 'new', 3), false)
  assert.equal((await rows()).length, 3)
  assert.equal(await keep('rain', '48.21,16.37', 'r2', 3), true)
  assert.equal((await rows()).find(r => r.kind === 'rain').body, 'r2')
})

test('keep_last_answer: full, but with answers older than 24 hours: those go and the new place is kept', async () => {
  await db.exec("update public.last_answers set made_at = now() - interval '25 hours' where kind = 'outlook'")
  assert.equal(await keep('summit', '46.5,11.5,2500', 'new', 3), true)
  assert.deepEqual((await rows()).map(r => `${r.kind} ${r.place}`), ['rain 48.21,16.37', 'summit 46.5,11.5,2500', 'summit 47.075,12.694,3798'])
})
