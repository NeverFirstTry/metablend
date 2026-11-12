-- Our own place search (owner, 2026-11-12): the towns table answers every place name by itself, so
-- Open-Meteo's geocoder is asked no more, neither by our server nor by a visitor's browser
-- (lib/geocode.js, /api/places/search). For that a town carries its name in each of our 13 languages
-- (names, for example {"de": "Wien", "zh": "维也纳"}, only where it differs from the main name; the English
-- one is what everything learned about a place is filed under), and the functions hand it out.
-- This file is the change alone, for a database that already has the places tables; the full definitions
-- are in places.sql and geocode-cache.sql (supabase/place-search.test.js keeps the two in step).
-- Run on dev, then on production, as ONE script (safe to run again). It changes no row. Until the
-- towns are loaded again (scripts/places/load.mjs --towns) names is empty and every answer is as before.

begin;

alter table public.towns add column if not exists names jsonb; -- its name in our 13 languages, where it differs from the main name

-- the loader writes names too
create or replace function public.towns_upsert(batch jsonb)
returns integer
language sql volatile
set search_path = public, extensions, pg_temp
as $$
  with r as (
    select * from jsonb_to_recordset(batch) as x(id integer, name text, alt text, names jsonb, country text, region text, population integer,
                                                 lat double precision, lon double precision)
  ), w as (
    insert into public.towns as t (id, name, alt, names, country, region, population, geog, loaded_at)
    select r.id, r.name, r.alt, r.names, r.country, r.region, coalesce(r.population, 0), st_makepoint(r.lon, r.lat)::geography, now()
      from r
    on conflict (id) do update
       set name = excluded.name, alt = excluded.alt, names = excluded.names, country = excluded.country, region = excluded.region,
           population = excluded.population, geog = excluded.geog, loaded_at = excluded.loaded_at
     where (t.name, t.alt, t.names, t.country, t.region, t.population, st_asbinary(t.geog))
           is distinct from
           (excluded.name, excluded.alt, excluded.names, excluded.country, excluded.region, excluded.population, st_asbinary(excluded.geog))
    returning 1
  )
  select count(*)::integer from w
$$;

-- the exact lookup hands out names
do $$ begin
  if exists (select 1 from pg_proc p where p.oid = to_regprocedure('public.town_lookup(text, integer)') and pg_get_function_result(p.oid) not like '%names jsonb%') then
    drop function public.town_lookup(text, integer);
  end if;
end $$;
create or replace function public.town_lookup(q text, lim integer default 20)
returns table (id integer, name text, alt text, names jsonb, country text, region text, population integer, lat double precision, lon double precision)
language sql stable parallel safe
set search_path = public, extensions, pg_temp
as $$
  select t.id, t.name, t.alt, t.names, t.country, t.region, t.population, st_y(t.geog::geometry), st_x(t.geog::geometry)
    from public.towns t
   where string_to_array(t.search, ' | ') @> array[public.place_norm(btrim(q))]
   order by t.population desc
   limit least(greatest(lim, 1), 50)
$$;

-- the search for suggestions and the peak search hands out names
do $$ begin
  if exists (select 1 from pg_proc p where p.oid = to_regprocedure('public.towns_search(text, integer)') and pg_get_function_result(p.oid) not like '%names jsonb%') then
    drop function public.towns_search(text, integer);
  end if;
end $$;
create or replace function public.towns_search(q text, lim integer default 5)
returns table (id integer, name text, names jsonb, country text, region text, population integer, lat double precision, lon double precision, exact boolean, prefix boolean)
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
  select h.id, h.name, h.names, h.country, h.region, h.population, st_y(h.geog::geometry), st_x(h.geog::geometry),
         h.n = any(string_to_array(h.search, ' | ')) as exact,
         exists (select 1 from unnest(string_to_array(h.search, ' | ')) as a(v) where a.v like h.n || '%') as prefix
    from hits h
   order by exact desc, prefix desc, round(word_similarity(h.n, h.search)::numeric, 1) desc, h.population desc
   limit least(greatest(lim, 1), 20)
$$;

revoke execute on function public.towns_upsert(jsonb), public.town_lookup(text, integer), public.towns_search(text, integer) from public, anon, authenticated;
grant execute on function public.towns_upsert(jsonb), public.town_lookup(text, integer), public.towns_search(text, integer) to service_role;

commit;
