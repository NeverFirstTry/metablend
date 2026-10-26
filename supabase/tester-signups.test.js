import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

// supabase/tester-signups.sql in a real Postgres (PGlite), as it runs on Supabase.
const sql = fs.readFileSync(new URL('./tester-signups.sql', import.meta.url), 'utf8')
const db = new PGlite()
await db.exec('create role anon; create role authenticated; create role service_role;')
await db.exec(sql)
await db.exec(sql) // safe to run twice

const fails = (q, re) => assert.rejects(db.query(q), re)

test('tester_signups — one row per address, new by default, timestamps set', async () => {
  await db.query("insert into public.tester_signups (email, phone_model, country, language) values ('anna@gmail.com', 'Pixel 8', 'Austria', 'de')")
  const { rows } = await db.query("select * from public.tester_signups where email = 'anna@gmail.com'")
  assert.equal(rows[0].status, 'new')
  assert.ok(rows[0].created_at && rows[0].updated_at)
  await fails("insert into public.tester_signups (email) values ('anna@gmail.com')", /duplicate key/)
  // what the route's upsert does with a second sign-up: nothing
  await db.query("insert into public.tester_signups (email, country) values ('anna@gmail.com', 'Peru') on conflict (email) do nothing")
  assert.equal((await db.query("select country from public.tester_signups where email = 'anna@gmail.com'")).rows[0].country, 'Austria')
})

test('tester_signups — the database refuses what the route would never send', async () => {
  await fails("insert into public.tester_signups (email) values ('Anna@Gmail.com')", /check/)
  await fails("insert into public.tester_signups (email) values (' bob@gmail.com')", /check/)
  await fails("insert into public.tester_signups (email, status) values ('c@gmail.com', 'vip')", /check/)
  await fails(`insert into public.tester_signups (email, country) values ('d@gmail.com', '${'x'.repeat(61)}')`, /check/)
})

test('tester_signups — row level security on, nothing for the public API roles', async () => {
  assert.equal((await db.query("select relrowsecurity from pg_class where oid = 'public.tester_signups'::regclass")).rows[0].relrowsecurity, true)
  assert.equal((await db.query("select count(*)::int n from pg_policies where tablename = 'tester_signups'")).rows[0].n, 0)
  for (const role of ['anon', 'authenticated']) {
    for (const priv of ['select', 'insert', 'update', 'delete']) {
      assert.equal((await db.query('select has_table_privilege($1, $2, $3) as ok', [role, 'public.tester_signups', priv])).rows[0].ok, false, `${role} ${priv}`)
    }
  }
})
