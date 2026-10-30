-- Our own summits, huts and towns for the Hiking screen — so search (also as
-- you type), "Near you" and "around a town" don't depend on public geocoders.
-- Summits and huts from OpenStreetMap (ODbL), towns from GeoNames (CC BY 4.0);
-- loaded by scripts/places (load.mjs), read only through the functions below
-- by our API (service-role key). RLS on, no policies, no grants for the
-- public API roles. Safe to run more than once.
-- Changed 2026-10-30 (run it again): loads write only rows that changed and
-- delete by id (summits_upsert, towns_upsert, summits_ids, towns_ids,
-- places_delete) instead of rewriting every row; places_ready says a load has
-- finished (places_loads) — until then the API keeps the outside services.

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Names compared without case or accents: "Hà Nội" = "ha noi", ß = ss.
create or replace function public.place_norm(t text)
returns text
language sql immutable parallel safe strict
set search_path = public, extensions, pg_temp
as $$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, t)) $$;

-- A summit's names in our languages ({ "de": …, "ja": … }) as one text.
create or replace function public.place_names_text(j jsonb)
returns text
language sql immutable parallel safe
set search_path = public, pg_temp
as $$ select coalesce(string_agg(v, ' | '), '') from jsonb_each_text(coalesce(j, '{}'::jsonb)) as e(k, v) $$;

create table if not exists public.summits (
  id text primary key,                -- osm-N123 / osm-W45
  kind text not null check (kind in ('peak', 'hut')),
  name text not null,
  names jsonb,                        -- name in our 13 languages, where OSM has it
  ele smallint,                       -- metres; null where OSM has none
  notability smallint not null default 0, -- Wikipedia 2 + Wikidata 1 + summit cross 1
  wikidata text,
  country text,                       -- ISO code, from the nearest town
  region text,
  geog extensions.geography(point, 4326) not null,
  search text generated always as (public.place_norm(name || ' | ' || public.place_names_text(names))) stored,
  loaded_at timestamptz not null default now() -- when a load last changed it
);

create table if not exists public.towns (
  id integer primary key,             -- GeoNames id
  name text not null,
  alt text,                           -- other names (Hanoi, Hà Nội, Wien, …), ' | ' between them
  country text,
  region text,
  population integer not null default 0,
  geog extensions.geography(point, 4326) not null,
  search text generated always as (public.place_norm(name || ' | ' || coalesce(alt, ''))) stored,
  loaded_at timestamptz not null default now()
);

create index if not exists summits_geog_idx on public.summits using gist (geog);
-- names: GIN for substrings and typos, a sorted one for how a name starts.
-- (A GiST trigram index was here first: on 568 000 names it read nearly all
-- of itself per query — 90–126 ms; GIN finds the same in 1–4 ms.)
drop index if exists public.summits_search_idx;
create index if not exists summits_search_gin on public.summits using gin (search extensions.gin_trgm_ops);
create index if not exists summits_search_c on public.summits (search collate "C");
-- the 6% with a Wikipedia article (or Wikidata and a summit cross): how
-- their names start, on their own — "mont" sorts 1 500 of them, not 18 000 —
-- with height and id in the index, so that step reads no table rows
-- (on Supabase those row reads were most of the 65 ms "mont" took)
do $$ begin
  if exists (select 1 from pg_indexes where indexname = 'summits_search_notable' and indexdef not like '%INCLUDE%') then
    drop index public.summits_search_notable;
  end if;
end $$;
create index if not exists summits_search_notable on public.summits (search collate "C") include (ele, id) where notability >= 2;
create index if not exists towns_geog_idx on public.towns using gist (geog);
create index if not exists towns_search_idx on public.towns using gist (search extensions.gist_trgm_ops);
-- (loads no longer prune by time: those indexes only took space)
drop index if exists public.summits_loaded_idx;
drop index if exists public.towns_loaded_idx;

-- Each finished load: when, and what it left. The API uses our tables only
-- once there is one (places_ready) — never half of a first load.
create table if not exists public.places_loads (
  finished_at timestamptz primary key default now(),
  summits integer not null,
  towns integer not null,
  written integer not null,
  deleted integer not null
);

-- Summits and huts whose name, in any of our languages, is like the query —
-- as you type, typos and accents forgiven. Candidates in three steps: names
-- that start with it (sorted index; with Wikipedia articles, highest first),
-- names that contain it (GIN), and — only when those found too few, from
-- four letters on — near misses (GIN, word similarity). Then: starting with
-- the query first, the closer matches, nearer (with a position), the ones
-- with a Wikipedia article, higher. (A summit cross counts for Near you's
-- notability, not for fame: "mont" is Mont Blanc.)
-- (near_lat / near_lon: PL/pgSQL won't have input and output both named lat)
drop function if exists public.places_search(text, double precision, double precision, integer);
create or replace function public.places_search(q text, near_lat double precision default null, near_lon double precision default null, lim integer default 10)
returns table (id text, kind text, name text, names jsonb, ele smallint, notability smallint, country text, region text, lat double precision, lon double precision, km double precision)
language plpgsql stable parallel safe
set search_path = public, extensions, pg_temp
as $$
declare
  n text := public.place_norm(q);
  cand text[];
begin
  cand := array(select s.id from public.summits s
                 where s.notability >= 2 and s.search collate "C" >= n and s.search collate "C" < n || chr(1114111)
                 order by s.ele desc nulls last limit 40);
  if coalesce(array_length(cand, 1), 0) < 40 then
    cand := cand || array(select s.id from public.summits s
                 where s.search collate "C" >= n and s.search collate "C" < n || chr(1114111)
                 order by s.search collate "C" limit 40);
  end if;
  if length(n) >= 3 then
    cand := cand || array(select s.id from public.summits s where s.search like '%' || n || '%' limit 200);
  end if;
  if coalesce(array_length(cand, 1), 0) < lim and length(n) >= 4 then
    cand := cand || array(select s.id from public.summits s where n <% s.search order by word_similarity(n, s.search) desc limit 40);
  end if;
  return query
    select s.id, s.kind, s.name, s.names, s.ele, s.notability, s.country, s.region,
           st_y(s.geog::geometry), st_x(s.geog::geometry),
           case when near_lat is null or near_lon is null then null
                else st_distance(s.geog, st_makepoint(near_lon, near_lat)::geography) / 1000 end as km
      from public.summits s
     where s.id = any(cand)
     order by (s.search like n || '%' or s.search like '% | ' || n || '%') desc,
              round(word_similarity(n, s.search)::numeric, 1) desc,
              km nulls last, (s.notability >= 2) desc, s.ele desc nulls last
     limit least(greatest(lim, 1), 50);
end
$$;

-- Towns by name or another name of theirs (cities with 5 000+ people).
-- exact: the query is one of its names; prefix: one of its names starts so.
create or replace function public.towns_search(q text, lim integer default 5)
returns table (id integer, name text, country text, region text, population integer, lat double precision, lon double precision, exact boolean, prefix boolean)
language sql stable parallel safe
set search_path = public, extensions, pg_temp
as $$
  with hits as (
    select t.*, public.place_norm(q) as n
      from public.towns t
     where public.place_norm(q) <% t.search
     order by t.search <->> public.place_norm(q)
     limit 40
  )
  select h.id, h.name, h.country, h.region, h.population, st_y(h.geog::geometry), st_x(h.geog::geometry),
         h.n = any(string_to_array(h.search, ' | ')) as exact,
         exists (select 1 from unnest(string_to_array(h.search, ' | ')) as a(v) where a.v like h.n || '%') as prefix
    from hits h
   order by exact desc, prefix desc, round(word_similarity(h.n, h.search)::numeric, 1) desc, h.population desc
   limit least(greatest(lim, 1), 20)
$$;

-- Summits and/or huts around a point, nearest first.
create or replace function public.summits_near(lat double precision, lon double precision, radius_km double precision default 25, lim integer default 12, kinds text[] default array['peak', 'hut'])
returns table (id text, kind text, name text, names jsonb, ele smallint, notability smallint, country text, region text, lat double precision, lon double precision, km double precision)
language sql stable parallel safe
set search_path = public, extensions, pg_temp
as $$
  select s.id, s.kind, s.name, s.names, s.ele, s.notability, s.country, s.region,
         st_y(s.geog::geometry), st_x(s.geog::geometry),
         st_distance(s.geog, st_makepoint(summits_near.lon, summits_near.lat)::geography) / 1000
    from public.summits s
   where s.kind = any(kinds)
     and st_dwithin(s.geog, st_makepoint(summits_near.lon, summits_near.lat)::geography, radius_km * 1000)
   order by s.geog <-> st_makepoint(summits_near.lon, summits_near.lat)::geography
   limit least(greatest(lim, 1), 300)
$$;

-- "Near you": the 150 nearest summits within 15 km and the 150 most notable
-- (then highest) within 50 km — the phone picks its ten from these
-- (lib/hike/near.js pickNearPeaks).
create or replace function public.summits_pool(lat double precision, lon double precision)
returns table (id text, kind text, name text, names jsonb, ele smallint, notability smallint, country text, region text, lat double precision, lon double precision, km double precision)
language sql stable parallel safe
set search_path = public, extensions, pg_temp
as $$
  select * from public.summits_near(lat, lon, 15, 150, array['peak'])
  union
  select s.id, s.kind, s.name, s.names, s.ele, s.notability, s.country, s.region,
         st_y(s.geog::geometry), st_x(s.geog::geometry),
         st_distance(s.geog, st_makepoint(summits_pool.lon, summits_pool.lat)::geography) / 1000
    from (select * from public.summits s
           where s.kind = 'peak' and st_dwithin(s.geog, st_makepoint(summits_pool.lon, summits_pool.lat)::geography, 50000)
           order by s.notability desc, s.ele desc nulls last
           limit 150) s
$$;

-- A batch of a load (jsonb rows as in data/places/*.ndjson): new rows in,
-- changed rows updated, unchanged rows left as they are — not rewritten, so
-- a reload every few months adds only what changed, not a second copy of
-- 200 MB until vacuum (the free tier has 500 MB). Returns the rows written.
create or replace function public.summits_upsert(batch jsonb)
returns integer
language sql volatile
set search_path = public, extensions, pg_temp
as $$
  with r as (
    select * from jsonb_to_recordset(batch) as x(id text, kind text, name text, names jsonb, ele smallint, notability smallint,
                                                 wikidata text, country text, region text, lat double precision, lon double precision)
  ), w as (
    insert into public.summits as s (id, kind, name, names, ele, notability, wikidata, country, region, geog, loaded_at)
    select r.id, r.kind, r.name, r.names, r.ele, coalesce(r.notability, 0), r.wikidata, r.country, r.region,
           st_makepoint(r.lon, r.lat)::geography, now()
      from r
    on conflict (id) do update
       set kind = excluded.kind, name = excluded.name, names = excluded.names, ele = excluded.ele, notability = excluded.notability,
           wikidata = excluded.wikidata, country = excluded.country, region = excluded.region, geog = excluded.geog, loaded_at = excluded.loaded_at
     where (s.kind, s.name, s.names, s.ele, s.notability, s.wikidata, s.country, s.region, st_asbinary(s.geog))
           is distinct from
           (excluded.kind, excluded.name, excluded.names, excluded.ele, excluded.notability, excluded.wikidata, excluded.country, excluded.region, st_asbinary(excluded.geog))
    returning 1
  )
  select count(*)::integer from w
$$;

create or replace function public.towns_upsert(batch jsonb)
returns integer
language sql volatile
set search_path = public, extensions, pg_temp
as $$
  with r as (
    select * from jsonb_to_recordset(batch) as x(id integer, name text, alt text, country text, region text, population integer,
                                                 lat double precision, lon double precision)
  ), w as (
    insert into public.towns as t (id, name, alt, country, region, population, geog, loaded_at)
    select r.id, r.name, r.alt, r.country, r.region, coalesce(r.population, 0), st_makepoint(r.lon, r.lat)::geography, now()
      from r
    on conflict (id) do update
       set name = excluded.name, alt = excluded.alt, country = excluded.country, region = excluded.region,
           population = excluded.population, geog = excluded.geog, loaded_at = excluded.loaded_at
     where (t.name, t.alt, t.country, t.region, t.population, st_asbinary(t.geog))
           is distinct from
           (excluded.name, excluded.alt, excluded.country, excluded.region, excluded.population, st_asbinary(excluded.geog))
    returning 1
  )
  select count(*)::integer from w
$$;

-- The ids we have, in order, n at a time (after: the last id of the page
-- before) — the loader finds what the new data no longer has.
create or replace function public.summits_ids(after text default null, n integer default 50000)
returns text[]
language sql stable
set search_path = public, pg_temp
as $$ select coalesce(array_agg(id order by id), '{}') from (select id from public.summits where id > coalesce(after, '') order by id limit n) x $$;

create or replace function public.towns_ids(after integer default null, n integer default 50000)
returns integer[]
language sql stable
set search_path = public, pg_temp
as $$ select coalesce(array_agg(id order by id), '{}') from (select id from public.towns where id > coalesce(after, -1) order by id limit n) x $$;

-- Rows the new data no longer has, by id (the loader sends a few thousand a
-- call, each within the API's time limit).
create or replace function public.places_delete(summit_ids text[] default '{}', town_ids integer[] default '{}')
returns table (summits bigint, towns bigint)
language sql volatile
set search_path = public, pg_temp
as $$
  with a as (delete from public.summits where id = any(summit_ids) returning 1),
       b as (delete from public.towns where id = any(town_ids) returning 1)
  select (select count(*) from a), (select count(*) from b)
$$;

-- A load finished: what it left, and from now on the API reads our tables.
create or replace function public.places_mark_loaded(rows_written integer, rows_deleted integer)
returns void
language sql volatile
set search_path = public, pg_temp
as $$
  insert into public.places_loads (summits, towns, written, deleted)
  select (select count(*) from public.summits), (select count(*) from public.towns), rows_written, rows_deleted
$$;

create or replace function public.places_ready()
returns boolean
language sql stable
set search_path = public, pg_temp
as $$ select exists (select 1 from public.places_loads) $$;

-- (loads used to mark every row and drop the unmarked ones after)
drop function if exists public.places_prune(timestamptz);
drop function if exists public.places_prune(timestamptz, integer);

-- Fresh statistics for the planner right after a load (security definer:
-- only the tables' owner may analyze them, not the API's role).
create or replace function public.places_analyze()
returns void
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
begin
  analyze public.summits;
  analyze public.towns;
end
$$;

-- How long each query takes inside the database (average ms over n runs) —
-- without the network in between — and how big the tables are.
create or replace function public.places_bench(n integer default 20)
returns table (query text, avg_ms numeric)
language plpgsql volatile
set search_path = public, extensions, pg_temp
as $$
declare
  t0 timestamptz;
  i integer;
  probe text;
  probes text[] := array[
    'select count(*) from places_search(''fansi'')', 'select count(*) from places_search(''matterhron'')',
    'select count(*) from places_search(''mont'')', 'select count(*) from places_search(''zug'', 47.42, 10.98)',
    'select count(*) from places_search(''富士'')', 'select count(*) from towns_search(''hà nội'')',
    'select count(*) from towns_search(''wien'')', 'select count(*) from summits_near(46.02, 7.75, 25, 12)',
    'select count(*) from summits_pool(47.27, 11.40)', 'select count(*) from summits_pool(21.03, 105.85)'];
begin
  foreach probe in array probes loop
    execute probe; -- warm
    t0 := clock_timestamp();
    for i in 1..n loop execute probe; end loop;
    query := probe;
    avg_ms := round((extract(epoch from clock_timestamp() - t0) * 1000 / n)::numeric, 2);
    return next;
  end loop;
end
$$;

-- Where a name search spends its time: each step on its own, the whole
-- search, and how much of the table is all-visible (index-only reads need it;
-- autovacuum sets it some time after a load).
create or replace function public.places_search_stages(q text)
returns table (stage text, row_count integer, ms numeric)
language plpgsql volatile
set search_path = public, extensions, pg_temp
as $$
declare
  n text := public.place_norm(q);
  t0 timestamptz;
  a text[];
begin
  t0 := clock_timestamp();
  a := array(select s.id from public.summits s
              where s.notability >= 2 and s.search collate "C" >= n and s.search collate "C" < n || chr(1114111)
              order by s.ele desc nulls last limit 40);
  stage := 'start, notable'; row_count := coalesce(array_length(a, 1), 0);
  ms := round((extract(epoch from clock_timestamp() - t0) * 1000)::numeric, 2); return next;
  t0 := clock_timestamp();
  a := array(select s.id from public.summits s
              where s.search collate "C" >= n and s.search collate "C" < n || chr(1114111)
              order by s.search collate "C" limit 40);
  stage := 'start, any'; row_count := coalesce(array_length(a, 1), 0);
  ms := round((extract(epoch from clock_timestamp() - t0) * 1000)::numeric, 2); return next;
  t0 := clock_timestamp();
  a := array(select s.id from public.summits s where s.search like '%' || n || '%' limit 200);
  stage := 'contains'; row_count := coalesce(array_length(a, 1), 0);
  ms := round((extract(epoch from clock_timestamp() - t0) * 1000)::numeric, 2); return next;
  t0 := clock_timestamp();
  a := array(select s.id from public.summits s where n <% s.search order by word_similarity(n, s.search) desc limit 40);
  stage := 'near misses'; row_count := coalesce(array_length(a, 1), 0);
  ms := round((extract(epoch from clock_timestamp() - t0) * 1000)::numeric, 2); return next;
  t0 := clock_timestamp();
  select count(*) into row_count from public.places_search(q);
  stage := 'whole search';
  ms := round((extract(epoch from clock_timestamp() - t0) * 1000)::numeric, 2); return next;
  stage := 'table pages all-visible (%)';
  select c.relallvisible, round(100.0 * c.relallvisible / greatest(c.relpages, 1), 1) into row_count, ms
    from pg_class c where c.oid = 'public.summits'::regclass;
  return next;
end
$$;

create or replace function public.places_size()
returns table (relation text, row_count bigint, total_mb numeric)
language sql stable
set search_path = public, pg_temp
as $$
  select 'summits', (select count(*) from public.summits), round(pg_total_relation_size('public.summits') / 1048576.0, 1)
  union all
  select 'towns', (select count(*) from public.towns), round(pg_total_relation_size('public.towns') / 1048576.0, 1)
  union all
  select 'whole database', null, round(pg_database_size(current_database()) / 1048576.0, 1)
$$;

alter table public.summits enable row level security;
alter table public.towns enable row level security;
alter table public.places_loads enable row level security;
revoke all on public.summits, public.towns, public.places_loads from anon, authenticated;
grant select, insert, update, delete on public.summits, public.towns, public.places_loads to service_role;
revoke execute on function public.place_norm(text), public.place_names_text(jsonb),
  public.places_search(text, double precision, double precision, integer), public.towns_search(text, integer),
  public.summits_near(double precision, double precision, double precision, integer, text[]), public.summits_pool(double precision, double precision),
  public.summits_upsert(jsonb), public.towns_upsert(jsonb), public.summits_ids(text, integer), public.towns_ids(integer, integer),
  public.places_delete(text[], integer[]), public.places_mark_loaded(integer, integer), public.places_ready(),
  public.places_analyze(), public.places_bench(integer), public.places_search_stages(text), public.places_size() from public, anon, authenticated;
grant execute on function public.place_norm(text), public.place_names_text(jsonb),
  public.places_search(text, double precision, double precision, integer), public.towns_search(text, integer),
  public.summits_near(double precision, double precision, double precision, integer, text[]), public.summits_pool(double precision, double precision),
  public.summits_upsert(jsonb), public.towns_upsert(jsonb), public.summits_ids(text, integer), public.towns_ids(integer, integer),
  public.places_delete(text[], integer[]), public.places_mark_loaded(integer, integer), public.places_ready(),
  public.places_analyze(), public.places_bench(integer), public.places_search_stages(text), public.places_size() to service_role;
