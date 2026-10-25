import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { trimFeed } from '../lib/warnings/trim.js'

// refresh_warning_feeds() in a real Postgres (PGlite). PGlite has no `http`
// extension, so a stand-in serves canned answers per URL; the rest is the
// SQL exactly as it runs on Supabase (minus `create extension`).
const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8')
const germany = read('../lib/warnings/__fixtures__/feed-germany.json')

// the stand-in also notes the curl options and the timeout each download ran with
const STAND_IN = `
  create role anon; create role authenticated;
  create schema extensions;
  create type extensions.http_response as (status integer, content_type varchar, headers text, content varchar);
  create table answers (url text primary key, status integer, content text);
  create table curlopts (name text primary key, value text);
  create table downloads (url text, timeout_msec text, at timestamptz default clock_timestamp());
  create function extensions.http_set_curlopt(n text, v text) returns boolean language sql as
    'insert into curlopts values (n, v) on conflict (name) do update set value = v returning true';
  create function extensions.http_get(u varchar) returns extensions.http_response language plpgsql as $$
    declare a answers;
    begin
      insert into downloads (url, timeout_msec) values (u, current_setting('http.timeout_msec', true));
      select * into a from answers where url = u;
      if a is null then raise exception 'timeout: %', u; end if;
      return row(a.status, 'application/json', null, a.content)::extensions.http_response;
    end $$;
`
const feedsSql = read('./warnings-feeds.sql').replace(/create extension[^;]*;/, '')
const db = new PGlite()
await db.exec(STAND_IN)
await db.exec(read('./warnings-trim.sql'))
await db.exec(feedsSql)
const url = slug => `https://feeds.meteoalarm.org/api/v1/warnings/feeds-${slug}`
const answer = (slug, status, content) => db.query('insert into answers values ($1, $2, $3) on conflict (url) do update set status = $2, content = $3', [url(slug), status, content])
const pending = async () => (await db.query('select country from public.warning_feeds_pending order by country')).rows.map(r => r.country)

test('refresh_warning_feeds — changed feeds are trimmed and pending; failures keep what we had; unchanged feeds are skipped', async () => {
  await answer('germany', 200, germany)
  await answer('austria', 200, '{"warnings": []}')
  await answer('spain', 503, 'busy')
  await answer('italy', 200, '{"message": "maintenance"}') // not a feed
  // every other country: no answer → "timeout"
  assert.equal((await db.query('select public.refresh_warning_feeds() as n')).rows[0].n, 2)
  assert.deepEqual(await pending(), ['AT', 'DE'])

  const de = (await db.query("select body, hash, last_status from public.warning_feeds where country = 'DE'")).rows[0]
  const json = JSON.parse(germany)
  const kept = de.body.warnings.filter(w => w.alert.info).length
  assert.equal(de.body.warnings.length, json.warnings.length) // every alert there, stubs included
  assert.ok(kept <= json.warnings.length)
  assert.equal(de.last_status, 200)
  const es = (await db.query("select body, last_status from public.warning_feeds where country = 'ES'")).rows[0]
  assert.deepEqual([es.body, es.last_status], [null, 503])
  const fi = (await db.query("select last_error from public.warning_feeds where country = 'FI'")).rows[0]
  assert.match(fi.last_error, /timeout/)

  // Vercel applied them → nothing pending; same feeds again → nothing changes
  await db.exec("update public.warning_feeds set processed_hash = hash where country in ('AT', 'DE')")
  assert.deepEqual(await pending(), [])
  assert.equal((await db.query('select public.refresh_warning_feeds() as n')).rows[0].n, 0)
  assert.deepEqual(await pending(), [])

  // Austria changes → only Austria pending
  await answer('austria', 200, germany.replace(/"DE/g, '"AT'))
  assert.equal((await db.query('select public.refresh_warning_feeds() as n')).rows[0].n, 1)
  assert.deepEqual(await pending(), ['AT'])
})

test('the trimmed body the database stores is what trimFeed makes (an hour before now)', async () => {
  const de = (await db.query("select body, fetched_at from public.warning_feeds where country = 'DE'")).rows[0]
  assert.deepEqual(de.body, trimFeed(JSON.parse(germany), new Date(de.fetched_at).getTime() - 3600e3))
})

const behind = async () => (await db.query('select country from public.warning_feeds_behind order by country')).rows.map(r => r.country)
const row = async cc => (await db.query('select * from public.warning_feeds where country = $1', [cc])).rows[0]

test('warnings-feeds.sql refuses to install before warnings-trim.sql (every feed would fail quietly otherwise)', async () => {
  const fresh = new PGlite()
  await fresh.exec(STAND_IN)
  await assert.rejects(fresh.exec(feedsSql), /warnings-trim\.sql/)
})

test('refresh_warning_feeds — every failure says why, and feeds without a good download lately are listed as behind', async () => {
  // from the first test: Germany and Austria answered, Spain 503, Italy a maintenance page, the rest timed out
  assert.equal((await row('ES')).last_error, 'HTTP 503')
  assert.equal((await row('ES')).last_status, 503)
  assert.equal((await row('IT')).last_error, 'not a feed')
  assert.match((await row('FI')).last_error, /timeout/)
  assert.equal((await row('DE')).last_error, null)
  const late = await behind()
  assert.ok(!late.includes('DE') && !late.includes('AT'))
  assert.ok(['ES', 'IT', 'FI', 'SE'].every(cc => late.includes(cc)))

  // a feed whose last good download is over 40 minutes old is behind too
  await db.exec("update public.warning_feeds set ok_at = now() - interval '41 minutes' where country = 'AT'")
  assert.ok((await behind()).includes('AT'))
  await db.exec("update public.warning_feeds set ok_at = now() - interval '39 minutes' where country = 'AT'")
  assert.ok(!(await behind()).includes('AT'))
})

test('refresh_warning_feeds — downloads with a 15 s timeout and our user agent; a \\u0000 in a feed does not break it', async () => {
  await db.exec('delete from downloads; delete from curlopts')
  await answer('austria', 200, '{"warnings": [], "note": "a\\u0000b"}')
  await db.query('select public.refresh_warning_feeds()')
  const opts = Object.fromEntries((await db.query('select name, value from curlopts')).rows.map(r => [r.name, r.value]))
  assert.equal(opts.CURLOPT_TIMEOUT, '15')
  assert.match(opts.CURLOPT_USERAGENT, /^MetaBlend\//)
  assert.ok((await db.query('select timeout_msec from downloads')).rows.every(r => r.timeout_msec === '15000'))
  const at = await row('AT')
  assert.equal(at.last_error, null)
  assert.deepEqual(at.body, { warnings: [] })
})

test('refresh_warning_feeds — stops when its time is up; the feeds asked longest ago go first next time', async () => {
  await db.exec("update public.warning_feeds set checked_at = now(); update public.warning_feeds set checked_at = now() - interval '1 hour' where country = 'SE'")
  await db.exec('delete from downloads')
  await answer('sweden', 200, '{"warnings": []}') // (a timed-out download's note rolls back with it)
  // a budget already spent: exactly one feed (the clock here can be too coarse to see 0 s pass)
  await db.query("select public.refresh_warning_feeds(interval '-1 second')")
  const urls = (await db.query('select url from downloads')).rows.map(r => r.url)
  assert.deepEqual(urls, [url('sweden')])
})

// The pg_cron job (supabase/cron.sql), run against stand-ins for pg_cron, pg_net and Vault.
const cronSql = read('./cron.sql').replace(/\r\n/g, '\n')
const jobEnd = cronSql.indexOf('$job$\n);', cronSql.indexOf("'warnings-refresh'")) + '$job$\n);'.length
const jobSql = cronSql.slice(cronSql.indexOf('-- Official warnings'), jobEnd)
await db.exec(`
  create schema cron; create schema net; create schema vault;
  create table cron.jobs (name text primary key, schedule text, command text);
  create function cron.schedule(n text, s text, c text) returns bigint language sql as
    'insert into cron.jobs values (n, s, c) on conflict (name) do update set schedule = s, command = c returning 1::bigint';
  create table net.calls (url text, key text);
  create function net.http_get(url text, headers jsonb default null, timeout_milliseconds integer default null) returns bigint language sql as
    'insert into net.calls values (url, headers->>''x-calibrate-key'') returning 1::bigint';
  create table vault.decrypted_secrets (name text, decrypted_secret text);
  insert into vault.decrypted_secrets values ('calibrate_secret', 'k');
`)
await db.exec(jobSql)
const runJob = async () => {
  await db.exec('delete from net.calls')
  await db.exec((await db.query("select command from cron.jobs where name = 'warnings-refresh'")).rows[0].command)
  return (await db.query('select url, key from net.calls')).rows
}
const ALL_SLUGS = ['austria', 'bosnia-herzegovina', 'cyprus', 'denmark', 'finland', 'germany', 'greece', 'italy', 'latvia', 'lithuania', 'montenegro', 'netherlands', 'poland', 'portugal', 'serbia', 'slovakia', 'spain', 'estonia', 'israel', 'norway', 'slovenia', 'sweden']

test('the warnings-refresh job calls Vercel when a feed changed or one is behind — and only then', async () => {
  assert.equal((await db.query("select schedule from cron.jobs where name = 'warnings-refresh'")).rows[0].schedule, '0,15,30,45 * * * *')
  // everything answered and applied → no call
  for (const slug of ALL_SLUGS) await answer(slug, 200, '{"warnings": []}')
  await db.query('select public.refresh_warning_feeds()')
  await db.exec('update public.warning_feeds set processed_hash = hash')
  assert.deepEqual(await runJob(), [])
  // a feed changes → one call, with the key
  await answer('austria', 200, '{"warnings": [], "v": 2}')
  assert.deepEqual(await runJob(), [{ url: 'https://metablend.app/api/warnings/refresh', key: 'k' }])
  await db.exec('update public.warning_feeds set processed_hash = hash')
  // the database can't get Spain any more → called once it is behind
  await answer('spain', 503, 'busy')
  await db.exec("update public.warning_feeds set ok_at = now() - interval '1 hour' where country = 'ES'")
  assert.equal((await runJob()).length, 1)
})

test('the warnings-refresh job still calls Vercel when the database download itself breaks', async () => {
  await db.exec("create or replace function public.refresh_warning_feeds(budget interval default interval '75 seconds') returns integer language plpgsql as $f$ begin raise exception 'broken'; end $f$")
  await db.exec("update public.warning_feeds set ok_at = now() - interval '1 hour'")
  assert.equal((await runJob()).length, 1)
})

test('cron.sql refuses to schedule the warnings job before the warnings SQL exists', async () => {
  const fresh = new PGlite()
  await fresh.exec("create schema cron; create function cron.schedule(n text, s text, c text) returns bigint language sql as 'select 1::bigint';")
  await assert.rejects(fresh.exec(jobSql), /warnings-feeds\.sql/)
})
