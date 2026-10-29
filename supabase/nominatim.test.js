import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

// supabase/nominatim.sql in a real Postgres (PGlite), as it runs on Supabase.
const sql = fs.readFileSync(new URL('./nominatim.sql', import.meta.url), 'utf8')
const db = new PGlite()
await db.exec('create role anon; create role authenticated; create role service_role;')
await db.exec('alter default privileges in schema public grant all on tables to anon, authenticated, service_role;')
await db.exec(sql)
await db.exec(sql) // safe to run twice

const slot = async (max = 4000) => (await db.query(`select public.nominatim_slot(${max}) as w`)).rows[0].w
const reset = () => db.exec(`update public.nominatim_gate set next_at = clock_timestamp() - interval '1 minute'`)

test('nominatim_slot — one request a second for everyone: each caller gets the next slot, 1.1 s after the one before', async () => {
  await reset()
  const waits = [await slot(), await slot(), await slot()]
  assert.equal(waits[0], 0) // a quiet gate: go at once
  assert.ok(Math.abs(waits[1] - 1100) <= 60, String(waits[1]))
  assert.ok(Math.abs(waits[2] - 2200) <= 60, String(waits[2]))
})

test('nominatim_slot — a queue longer than the caller will wait: null, and no slot is taken', async () => {
  await reset()
  for (let i = 0; i < 4; i++) await slot() // slots up to ~3.3 s ahead
  const before = (await db.query('select next_at from public.nominatim_gate')).rows[0].next_at
  assert.equal(await slot(2000), null)
  assert.deepEqual((await db.query('select next_at from public.nominatim_gate')).rows[0].next_at, before)
  assert.ok((await slot(10000)) > 3000) // a caller willing to wait still gets one
})

test('nominatim tables — one gate row; the cache keeps one answer per request; the public API roles get nothing', async () => {
  assert.equal((await db.query('select count(*)::int as n from public.nominatim_gate')).rows[0].n, 1)
  await db.query(`insert into public.nominatim_cache (key, body) values ('q=peak', '[1]') on conflict (key) do update set body = excluded.body, fetched_at = now()`)
  await db.query(`insert into public.nominatim_cache (key, body) values ('q=peak', '[2]') on conflict (key) do update set body = excluded.body, fetched_at = now()`)
  assert.deepEqual((await db.query(`select body from public.nominatim_cache where key = 'q=peak'`)).rows[0].body, [2])
  for (const role of ['anon', 'authenticated']) {
    const { rows } = await db.query(`select has_table_privilege('${role}', 'public.nominatim_cache', 'select') as t, has_function_privilege('${role}', 'public.nominatim_slot(integer)', 'execute') as f`)
    assert.deepEqual(rows[0], { t: false, f: false }, role)
  }
  assert.equal((await db.query(`select has_function_privilege('service_role', 'public.nominatim_slot(integer)', 'execute') as f`)).rows[0].f, true)
})
