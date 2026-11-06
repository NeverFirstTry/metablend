import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

// supabase/station-errors.sql in a real Postgres (PGlite), as it runs on Supabase.
const sql = fs.readFileSync(new URL('./station-errors.sql', import.meta.url), 'utf8')
const db = new PGlite()
await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
// what a Supabase project grants on every new table: the SQL must take it back from the API roles
await db.exec('alter default privileges in schema public grant all on tables to anon, authenticated, service_role;')
await db.exec(sql)
await db.exec(sql) // safe to run twice

test('station_errors: the hourly scoring can write and the analysis can read, as the service role only', async () => {
  await db.exec('set role service_role')
  await db.query(`insert into public.station_errors (city, region, actual, shown, errors)
    values ('Vienna', 'europe', 10.5, 11, '{"icon": 0.3, "gfs": -1.2}')`)
  const { rows } = await db.query("select * from public.station_errors where city = 'Vienna'")
  await db.exec('reset role')
  assert.equal(rows[0].errors.gfs, -1.2)
  assert.equal(rows[0].shown, 11)
  assert.ok(rows[0].created_at)
})

test('station_errors: says which reading a row was compared with, the airports unless told otherwise', async () => {
  await db.query(`insert into public.station_errors (city, region, actual, errors) values ('Graz', 'europe', 4, '{}')`)
  await db.query(`insert into public.station_errors (city, region, actual, errors, truth, truth_km) values ('Hoher Sonnblick', 'europe', -9, '{"icon": 1}', 'summit', 0)`)
  const { rows } = await db.query("select city, truth, truth_km from public.station_errors where city in ('Graz', 'Hoher Sonnblick') order by id")
  assert.deepEqual(rows, [{ city: 'Graz', truth: 'metar', truth_km: null }, { city: 'Hoher Sonnblick', truth: 'summit', truth_km: 0 }])
})

test('station_errors: the SQL also upgrades a table made before the truth columns', async () => {
  const old = new PGlite()
  await old.exec('create role anon; create role authenticated; create role service_role bypassrls;')
  await old.exec("create table public.station_errors (id bigint generated always as identity primary key, created_at timestamptz not null default now(), city text not null, region text not null, actual real not null, shown real, errors jsonb not null)")
  await old.query("insert into public.station_errors (city, region, actual, errors) values ('Vienna', 'europe', 3, '{}')")
  await old.exec(sql)
  assert.equal((await old.query('select truth from public.station_errors')).rows[0].truth, 'metar')
})

test('station_errors: a run with no stored consensus still saves its errors', async () => {
  await db.query(`insert into public.station_errors (city, region, actual, errors) values ('Lienz', 'europe', 2, '{"icon": 1}')`)
  assert.equal((await db.query("select shown from public.station_errors where city = 'Lienz'")).rows[0].shown, null)
})

test('station_errors: row level security on, nothing for the public API roles', async () => {
  assert.equal((await db.query("select relrowsecurity from pg_class where oid = 'public.station_errors'::regclass")).rows[0].relrowsecurity, true)
  assert.equal((await db.query("select count(*)::int n from pg_policies where tablename = 'station_errors'")).rows[0].n, 0)
  for (const role of ['anon', 'authenticated']) {
    for (const priv of ['select', 'insert', 'update', 'delete']) {
      assert.equal((await db.query('select has_table_privilege($1, $2, $3) as ok', [role, 'public.station_errors', priv])).rows[0].ok, false, `${role} ${priv}`)
    }
  }
})

test('station_errors: the service role can write without the project default grants', async () => {
  const bare = new PGlite()
  await bare.exec('create role anon; create role authenticated; create role service_role bypassrls;')
  await bare.exec(sql)
  await bare.exec('set role service_role')
  await bare.query(`insert into public.station_errors (city, region, actual, errors) values ('Oslo', 'europe', 1, '{}')`)
  assert.equal((await bare.query('select count(*)::int n from public.station_errors')).rows[0].n, 1)
  // the cleanup job's 30-day delete
  await bare.query("delete from public.station_errors where created_at < now() - interval '30 days'")
})
