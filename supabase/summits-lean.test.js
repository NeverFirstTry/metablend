// supabase/summits-lean.sql (the emergency thinning of the summits table; run nowhere yet) in a real
// Postgres (PGlite with PostGIS, pg_trgm and unaccent, as on Supabase): its DELETE removes exactly
// the rows keepLean() in lib/places/rows.js would not keep, its count names the same rows first,
// and the search and "Near you" still answer afterwards.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { postgis } from '@electric-sql/pglite-postgis'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'
import { keepLean, LEAN, LEAN_COUNTRIES } from '../lib/places/rows.js'

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const lean = read('./summits-lean.sql')
// the statements that are not commented out
const countSql = lean.match(/^select count\(\*\) as would_go[\s\S]*?;/m)[0]
const deleteSql = lean.match(/^delete from public\.summits[\s\S]*?;/m)[0]
const afterSql = lean.match(/^analyze public\.summits;[\s\S]*?from public\.summits;/m)[0]

const db = new PGlite({ extensions: { postgis, pg_trgm, unaccent } })
await db.exec('create role anon; create role authenticated; create role service_role; create schema extensions;')
await db.exec('alter default privileges in schema public grant all on tables to anon, authenticated, service_role;')
await db.exec(read('./places.sql'))

const ROWS = [
  { id: 'osm-N1', kind: 'peak', name: 'Plainhill Colorado', ele: 3200, notability: 0, country: 'US' },
  { id: 'osm-N2', kind: 'peak', name: 'Markedpeak Colorado', ele: 4300, notability: 1, country: 'US' },
  { id: 'osm-N3', kind: 'peak', name: 'Crosspeak Norway', ele: 1500, notability: 1, country: 'NO' },
  { id: 'osm-N4', kind: 'peak', name: 'Wikipeak Nepal', ele: 8000, notability: 3, country: 'NP' },
  { id: 'osm-W5', kind: 'hut', name: 'Barehut Colorado', ele: null, notability: 0, country: 'US' },
  { id: 'osm-N6', kind: 'peak', name: 'Nocountry Seamount', ele: 900, notability: 0, country: null },
  { id: 'osm-N7', kind: 'peak', name: 'Plainhill Spain', ele: 800, notability: 0, country: 'ES' },
  { id: 'osm-W8', kind: 'hut', name: 'Barehut Nowhere', ele: null, notability: 0, country: null },
  // an unmarked peak in each of the seven countries
  ...LEAN_COUNTRIES.map((country, i) => ({ id: `osm-N${20 + i}`, kind: 'peak', name: `Plainkogel ${country}`, ele: 2000 + i, notability: 0, country })),
]
for (const [i, r] of ROWS.entries()) {
  await db.query(
    'insert into public.summits (id, kind, name, ele, notability, country, geog) values ($1, $2, $3, $4, $5, $6, extensions.st_makepoint($7, $8)::extensions.geography)',
    [r.id, r.kind, r.name, r.ele, r.notability, r.country, 10 + i * 0.01, 47 + i * 0.01],
  )
}
const ids = async () => (await db.query('select id from public.summits order by id')).rows.map(r => r.id)

test('summits-lean.sql: the rule is off until the owner decides', () => {
  // switch it on only in the same hour supabase/summits-lean.sql runs on production
  assert.equal(LEAN, false)
})

test('summits-lean.sql: every statement names the same seven countries as keepLean()', () => {
  const lists = [...lean.matchAll(/not in \(([^)]*)\)/g)].map(m => m[1].split(',').map(c => c.trim().replace(/'/g, '')))
  assert.equal(lists.length, 3, 'the count, the trial and the delete')
  for (const list of lists) assert.deepEqual(list, LEAN_COUNTRIES)
})

test('summits-lean.sql: the count names what the delete removes, and that is what keepLean() would not keep', async () => {
  const before = await ids()
  const keep = ROWS.filter(keepLean).map(r => r.id).sort()
  const go = ROWS.filter(r => !keepLean(r)).map(r => r.id).sort()
  assert.deepEqual(go, ['osm-N1', 'osm-N6', 'osm-N7'], 'an unmarked peak outside the seven countries or without a country')
  const counted = (await db.query(countSql)).rows[0]
  assert.equal(Number(counted.would_go), go.length)
  assert.equal(Number(counted.all_rows), before.length)
  const gone = await db.query(deleteSql)
  assert.equal(gone.affectedRows, go.length)
  assert.deepEqual(await ids(), keep)
})

test('summits-lean.sql: afterwards the space comes back, and the search and "Near you" still answer', async () => {
  await db.exec('vacuum full public.summits;')
  const [, sizes] = await db.exec(afterSql)
  assert.equal(Number(sizes.rows[0].rows_left), ROWS.filter(keepLean).length)
  const found = async q => (await db.query('select id from public.places_search($1)', [q])).rows.map(r => r.id)
  assert.equal((await found('Plainkogel AT'))[0], 'osm-N20', 'an unmarked peak in Austria is still found, first (the search also offers its similar neighbours)')
  assert.ok((await found('Barehut Colorado')).includes('osm-W5'), 'a hut without a height or a mark stays everywhere')
  assert.ok(!(await found('Plainhill Colorado')).includes('osm-N1'), 'the unmarked peak in the US is gone')
  const near = (await db.query('select id from public.summits_near($1, $2)', [47, 10])).rows.map(r => r.id)
  assert.ok(near.includes('osm-N20') && !near.includes('osm-N1'))
})
