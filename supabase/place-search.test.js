// supabase/place-search.sql in a real Postgres (PGlite with PostGIS, pg_trgm and unaccent, as on Supabase):
// the change alone, run on a database in the shape production has before it (towns without names, town_lookup
// and towns_search answering without them), and on one that already has the full definitions. Its functions
// are the same text as in places.sql and geocode-cache.sql, so the change and the full schema cannot drift apart.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { postgis } from '@electric-sql/pglite-postgis'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'

const read = name => fs.readFileSync(new URL(`./${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const change = read('place-search.sql'), places = read('places.sql'), cache = read('geocode-cache.sql'), near = read('town-near.sql')

async function database() {
  const db = new PGlite({ extensions: { postgis, pg_trgm, unaccent } })
  await db.exec('create role anon; create role authenticated; create role service_role; create schema extensions;')
  await db.exec(places)
  await db.exec(cache)
  return db
}
const VIENNA = `(2761369, 'Vienna', 'Wien | 維也納 | 维也纳', 'AT', 'Vienna', 1691468, extensions.st_makepoint(16.3721, 48.2085)::extensions.geography)`
// the shape before the change: no names column, and the two functions with their old answers (a function
// whose answer gains a column cannot be replaced in place, which is what the change's guarded drop is for)
const BEFORE = `
  drop function public.town_lookup(text, integer);
  drop function public.towns_search(text, integer);
  alter table public.towns drop column names;
  create function public.town_lookup(q text, lim integer default 20)
    returns table (id integer, name text, alt text, country text, region text, population integer, lat double precision, lon double precision)
    language sql stable as $$ select t.id, t.name, t.alt, t.country, t.region, t.population, 0::double precision, 0::double precision from public.towns t where false $$;
  create function public.towns_search(q text, lim integer default 5)
    returns table (id integer, name text, country text, region text, population integer, lat double precision, lon double precision, exact boolean, prefix boolean)
    language sql stable as $$ select t.id, t.name, t.country, t.region, t.population, 0::double precision, 0::double precision, false, false from public.towns t where false $$;
  insert into public.towns (id, name, alt, country, region, population, geog) values ${VIENNA};
`
const rows = async (db, q, args = []) => (await db.query(q, args)).rows

test('the change on a database of before: the row is untouched, the functions answer with names, and the loader writes them; a second run changes nothing', async () => {
  const db = await database()
  await db.exec(BEFORE)
  await db.exec(change)
  const [found] = await rows(db, `select * from public.town_lookup('Wien')`)
  assert.equal(found.id, 2761369)
  assert.equal(found.names, null, 'no names until the towns are loaded again')
  assert.ok(Math.abs(found.lat - 48.2085) < 1e-6 && Math.abs(found.lon - 16.3721) < 1e-6)

  const town = { id: 2761369, name: 'Vienna', alt: 'Wien | 維也納 | 维也纳', names: { de: 'Wien', zh: '维也纳' }, country: 'AT', region: 'Vienna', population: 1691468, lat: 48.2085, lon: 16.3721 }
  const load = async () => (await rows(db, `select public.towns_upsert($1::jsonb) as n`, [JSON.stringify([town])]))[0].n
  assert.equal(await load(), 1, 'the names are new: the row is written')
  assert.equal(await load(), 0, 'the same again: nothing to write')
  // found by its name in either Chinese script, and answered with its names
  for (const q of ['Wien', 'vienna', '維也納', '维也纳']) assert.deepEqual((await rows(db, `select names from public.town_lookup($1)`, [q]))[0]?.names, { de: 'Wien', zh: '维也纳' }, q)
  const [hit] = await rows(db, `select * from public.towns_search('wien')`)
  assert.deepEqual([hit.id, hit.names, hit.exact, hit.prefix], [2761369, { de: 'Wien', zh: '维也纳' }, true, true])

  await db.exec(change) // safe to run again
  assert.deepEqual((await rows(db, `select names from public.town_lookup('Wien')`))[0].names, { de: 'Wien', zh: '维也纳' }, 'the names stay')
  // still out of reach of the API roles
  await db.exec('set role anon')
  await assert.rejects(rows(db, `select * from public.town_lookup('wien')`), /permission denied/)
  await assert.rejects(rows(db, `select * from public.towns_search('wien')`), /permission denied/)
  await assert.rejects(rows(db, `select public.towns_upsert('[]'::jsonb)`), /permission denied/)
  await db.exec('reset role')
})

test('the change on a database that already has the full definitions: nothing to drop, no error', async () => {
  const db = await database()
  await db.exec(`insert into public.towns (id, name, alt, country, region, population, geog) values ${VIENNA};`)
  await db.exec(change)
  assert.equal((await rows(db, `select id from public.town_lookup('wien')`))[0].id, 2761369)
})

test('the change is the same text as the full definitions in places.sql and geocode-cache.sql', () => {
  const part = (start, end) => { const a = change.indexOf(start), b = change.indexOf(end, a); assert.ok(a >= 0 && b > a, start); return change.slice(a, b + end.length) }
  const fn = name => part(`create or replace function public.${name}(`, '$$;\n')
  const drop = name => part(`do $$ begin\n  if exists (select 1 from pg_proc p where p.oid = to_regprocedure('public.${name}(text, integer)')`, 'end $$;\n')
  for (const text of [fn('towns_upsert'), drop('towns_search'), fn('towns_search')]) assert.ok(places.includes(text), `places.sql holds: ${text.slice(0, 60)}`)
  for (const text of [drop('town_lookup'), fn('town_lookup')]) assert.ok(cache.includes(text), `geocode-cache.sql holds: ${text.slice(0, 60)}`)
  assert.ok(near.includes(fn('town_near')), 'town-near.sql holds the same town_near')
  assert.ok(places.includes('alter table public.towns add column if not exists names jsonb;'))
})
