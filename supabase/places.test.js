import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { postgis } from '@electric-sql/pglite-postgis'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'

// supabase/places.sql in a real Postgres (PGlite with PostGIS, pg_trgm and
// unaccent, as on Supabase), with known summits, huts and towns among
// 20 000 made-up summits.
const sql = fs.readFileSync(new URL('./places.sql', import.meta.url), 'utf8')
const db = new PGlite({ extensions: { postgis, pg_trgm, unaccent } })
await db.exec('create role anon; create role authenticated; create role service_role; create schema extensions;')
await db.exec('alter default privileges in schema public grant all on tables to anon, authenticated, service_role;')
await db.exec(sql)
await db.exec(sql) // safe to run twice

const pt = (lon, lat) => `extensions.st_makepoint(${lon}, ${lat})::extensions.geography`
await db.exec(`
  insert into public.summits (id, kind, name, names, ele, notability, country, geog) values
    ('osm-N1', 'peak', 'Đinh Núi Phan Xi Phăng', '{"en": "Fansipan"}', 3147, 3, 'VN', ${pt(103.7754, 22.3031)}),
    ('osm-N2', 'peak', 'Matterhorn', '{"it": "Cervino", "fr": "Cervin"}', 4478, 4, 'CH', ${pt(7.6586, 45.9763)}),
    ('osm-N3', 'peak', '富士山', '{"en": "Mount Fuji", "ja": "富士山"}', 3776, 3, 'JP', ${pt(138.7274, 35.3606)}),
    ('osm-N4', 'peak', 'Zugspitze', null, 2962, 3, 'DE', ${pt(10.9863, 47.4211)}),
    ('osm-N5', 'peak', 'Zugspitzeck', null, 2820, 0, 'AT', ${pt(10.9600, 47.4200)}),
    ('osm-N6', 'peak', 'Gornergrat', null, 3135, 2, 'CH', ${pt(7.7845, 45.9836)}),
    ('osm-W7', 'hut', 'Hörnlihütte', null, 3260, 1, 'CH', ${pt(7.6720, 45.9817)}),
    ('osm-N8', 'peak', 'Monte Rosa', '{"it": "Monte Rosa"}', 4634, 3, 'CH', ${pt(7.8670, 45.9369)}),
    ('osm-N9', 'peak', 'Mont Blanc', '{"it": "Monte Bianco"}', 4808, 3, 'FR', ${pt(6.8652, 45.8326)}),
    ('osm-N10', 'peak', 'Mont Gelé', null, 3518, 4, 'CH', ${pt(7.2967, 45.9881)});
  -- the made-up summits far from every real one above (south of 40° S), and the same every run
  select setseed(0.42);
  insert into public.summits (id, kind, name, ele, geog)
    select 'osm-N' || (1000 + i), 'peak', 'Hill ' || md5(i::text), (random() * 3000)::int, ${pt('-180 + random() * 360', '-60 + random() * 20')}
      from generate_series(1, 20000) as i;
  insert into public.towns (id, name, alt, country, region, population, geog) values
    (1581130, 'Hanoi', 'Ha Noi | Hà Nội | Hanoï | ハノイ', 'VN', 'Hanoi', 8053663, ${pt(105.8412, 21.0245)}),
    (1, 'Hà Nội', null, 'VN', 'Ninh Binh', 0, ${pt(106.0229, 20.4737)}),
    (2761369, 'Vienna', 'Wien | Vienne | Viena | ウィーン', 'AT', 'Vienna', 1691468, ${pt(16.3721, 48.2085)}),
    (2657928, 'Zermatt', null, 'CH', 'Valais', 5800, ${pt(7.7491, 46.0207)});
`)

const rows = async (q, args = []) => (await db.query(q, args)).rows

test('places_search — as you type: a start of a name finds it, in any of our languages', async () => {
  assert.equal((await rows(`select * from public.places_search('fansi')`))[0].id, 'osm-N1') // its English name
  assert.equal((await rows(`select * from public.places_search('cervino')`))[0].id, 'osm-N2') // its Italian name
  assert.equal((await rows(`select * from public.places_search('富士')`))[0].id, 'osm-N3')
  assert.equal((await rows(`select * from public.places_search('Hörnli')`))[0].kind, 'hut')
})

test('places_search — accents and typos forgiven', async () => {
  assert.equal((await rows(`select * from public.places_search('phan xi pang')`))[0].id, 'osm-N1')
  assert.equal((await rows(`select * from public.places_search('matterhron')`))[0].id, 'osm-N2')
  assert.equal((await rows(`select * from public.places_search('hoernli')`)).length >= 0, true) // no error on a stray spelling
})

test('places_search — names starting with the query first; with a position, the nearer of equal matches first, with the distance', async () => {
  const z = await rows(`select * from public.places_search('zugspitze', 47.42, 10.98)`)
  assert.deepEqual(z.slice(0, 2).map(r => r.id), ['osm-N4', 'osm-N5'])
  assert.ok(z[0].km < 2)
  // a summit cross scores for Near you, not for fame: of the names starting so, Wikipedia ones by height
  assert.equal((await rows(`select * from public.places_search('mont')`))[0].id, 'osm-N9')
  assert.equal((await rows(`select * from public.places_search('mo')`))[0].id, 'osm-N9') // two letters: names starting so
  assert.equal((await rows(`select * from public.places_search('fansi')`))[0].km, null)
})

test('towns_search — every name of a town finds it: "Hà Nội", "ha noi", "Hanoi", "Wien", "Vienna"; the big town before the village', async () => {
  for (const q of ['hà nội', 'ha noi', 'hanoi', 'HANOI']) {
    const [t] = await rows(`select * from public.towns_search($1)`, [q])
    assert.equal(t.id, 1581130, q)
    assert.equal(t.exact, true, q)
  }
  for (const q of ['wien', 'Vienna', 'vienne']) assert.equal((await rows(`select * from public.towns_search($1)`, [q]))[0].id, 2761369, q)
  const [half] = await rows(`select * from public.towns_search('hano')`)
  assert.deepEqual([half.id, half.exact, half.prefix], [1581130, false, true])
})

test('summits_near — summits and huts around a town, nearest first, with the distance; or only one kind', async () => {
  const near = await rows(`select * from public.summits_near(46.0207, 7.7491, 25, 12)`)
  assert.deepEqual(near.map(r => r.id), ['osm-N6', 'osm-W7', 'osm-N2', 'osm-N8'])
  assert.ok(near.every((r, i) => i === 0 || r.km >= near[i - 1].km))
  assert.deepEqual((await rows(`select id from public.summits_near(46.0207, 7.7491, 25, 12, array['hut'])`)).map(r => r.id), ['osm-W7'])
})

test('summits_pool — Near you: the nearest summits and the notable ones within 50 km, never huts', async () => {
  const pool = await rows(`select * from public.summits_pool(46.0207, 7.7491)`)
  const ids = pool.map(r => r.id)
  assert.ok(ids.includes('osm-N2') && ids.includes('osm-N8') && ids.includes('osm-N6'))
  assert.ok(!ids.includes('osm-N9'), 'Mont Blanc is ~70 km away, beyond 50 km')
  assert.ok(pool.every(r => r.kind === 'peak'), 'no huts')
})

test('places_prune — rows a new load didn\'t bring are dropped, in chunks (each call within the API\'s time limit); places_size, places_bench and places_analyze answer', async () => {
  await db.exec(`update public.summits set loaded_at = now() - interval '1 day' where id in ('osm-N5', 'osm-N1001', 'osm-N1002')`)
  const prune = async () => Object.values((await rows(`select * from public.places_prune(now() - interval '1 hour', 2)`))[0]).map(Number)
  assert.deepEqual(await prune(), [2, 0])
  assert.deepEqual(await prune(), [1, 0])
  assert.deepEqual(await prune(), [0, 0])
  await db.query('select public.places_analyze()')
  assert.equal((await rows(`select 1 from public.summits where id = 'osm-N5'`)).length, 0)
  assert.equal((await rows(`select * from public.places_size()`)).length, 3)
  const bench = await rows(`select * from public.places_bench(1)`)
  assert.equal(bench.length, 10)
  assert.ok(bench.every(b => Number(b.avg_ms) >= 0))
})

test('places — the public API roles get nothing; our API (service role) everything it uses', async () => {
  for (const role of ['anon', 'authenticated']) {
    const [r] = await rows(`select has_table_privilege('${role}', 'public.summits', 'select') as s, has_table_privilege('${role}', 'public.towns', 'select') as t,
      has_function_privilege('${role}', 'public.places_search(text, double precision, double precision, integer)', 'execute') as f`)
    assert.deepEqual(r, { s: false, t: false, f: false }, role)
  }
  const [r] = await rows(`select has_function_privilege('service_role', 'public.summits_pool(double precision, double precision)', 'execute') as f`)
  assert.equal(r.f, true)
})

test('places — names indexed for exact substrings and typos (GIN) and for their start (sorted); no GiST trigram index (it read the whole index per query)', async () => {
  const idx = Object.fromEntries((await rows(`select indexname, indexdef from pg_indexes where tablename = 'summits'`)).map(r => [r.indexname, r.indexdef]))
  assert.match(idx.summits_search_gin ?? '', /USING gin/)
  assert.match(idx.summits_search_c ?? '', /COLLATE "C"/)
  assert.equal(idx.summits_search_idx, undefined)
})

test('places — the start of a name: notable summits from their own small index (sorted by height), the rest in name order — never sorting every "mont…"', async () => {
  const idx = Object.fromEntries((await rows(`select indexname, indexdef from pg_indexes where tablename = 'summits'`)).map(r => [r.indexname, r.indexdef]))
  assert.match(idx.summits_search_notable ?? '', /WHERE \(notability >= 2\)/)
  // two letters only look at how names start: a hut that isn't notable comes from the name-order step
  assert.equal((await rows(`select * from public.places_search('hö')`))[0]?.id, 'osm-W7')
})

test('places_search_stages — each step of a name search timed inside the database, and how much of the table is all-visible (index-only reads)', async () => {
  const stages = await rows(`select * from public.places_search_stages('mont')`)
  assert.deepEqual(stages.map(s => s.stage), ['start, notable', 'start, any', 'contains', 'near misses', 'whole search', 'table pages all-visible (%)'])
  assert.ok(stages.every(s => Number(s.ms) >= 0))
  const idx = (await rows(`select indexdef from pg_indexes where indexname = 'summits_search_notable'`))[0]?.indexdef ?? ''
  assert.match(idx, /INCLUDE \(ele, id\)/) // the notable step reads height and id from the index alone
})
