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

const db = new PGlite()
await db.exec(`
  create role anon; create role authenticated;
  create schema extensions;
  create type extensions.http_response as (status integer, content_type varchar, headers text, content varchar);
  create table answers (url text primary key, status integer, content text);
  create function extensions.http_set_curlopt(text, text) returns boolean language sql as 'select true';
  create function extensions.http_get(u varchar) returns extensions.http_response language plpgsql as $$
    declare a answers;
    begin
      select * into a from answers where url = u;
      if a is null then raise exception 'timeout: %', u; end if;
      return row(a.status, 'application/json', null, a.content)::extensions.http_response;
    end $$;
`)
await db.exec(read('./warnings-trim.sql'))
await db.exec(read('./warnings-feeds.sql').replace(/create extension[^;]*;/, ''))
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
