import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { buildDevSchema } from '../scripts/lib/dev-schema.mjs'

// supabase/dev-schema.sql: the whole schema for a fresh dev project, built
// from the files production was set up with — minus the cron jobs (they call
// the production site).
const file = fs.readFileSync(new URL('./dev-schema.sql', import.meta.url), 'utf8')

test('dev-schema.sql — in sync with the schema files (node scripts/dev-db.mjs build)', () => {
  assert.equal(file.replace(/\r\n/g, '\n'), buildDevSchema())
})

test('dev-schema.sql — no scheduled jobs and nothing that calls the production site', () => {
  assert.doesNotMatch(file, /cron\.schedule|net\.http_|metablend\.app/)
})

test('dev-schema.sql — applies to a fresh Postgres, twice, with every table and function the code uses', async () => {
  const db = new PGlite()
  // what a Supabase project has before any SQL runs (PGlite has no `http` extension)
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema extensions;
    create type extensions.http_response as (status integer, content_type varchar, headers text, content varchar);
    create function extensions.http_get(u varchar) returns extensions.http_response language sql as 'select null::extensions.http_response';
    create function extensions.http_set_curlopt(n text, v text) returns boolean language sql as 'select true';`)
  const sql = file.replace(/create extension[^;]*;/g, '')
  await db.exec(sql)
  await db.exec(sql)
  const used = ['api_weights', 'forecasts', 'feedback', 'city_bias', 'consensus_history', 'api_stats', 'outlook_snapshots', 'outlook_weights',
    'error_log', 'push_devices', 'push_log', 'hike_plans', 'route_cache', 'warnings', 'warning_feeds', 'tester_signups']
  for (const t of used) assert.ok((await db.query(`select to_regclass('public.${t}') as r`)).rows[0].r, t)
  for (const v of ['warning_feeds_pending', 'warning_feeds_behind']) assert.ok((await db.query(`select to_regclass('public.${v}') as r`)).rows[0].r, v)
  for (const f of ['bump_api_stats', 'mark_outlook_verified', 'refresh_warning_feeds', 'trim_warning_feed']) {
    assert.ok((await db.query(`select 1 from pg_proc where proname = '${f}'`)).rows.length, f)
  }
  assert.ok((await db.query("select 1 from information_schema.columns where table_name = 'hike_plans' and column_name = 'route'")).rows.length)
})
