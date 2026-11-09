-- The city geocoder's two helpers (lib/geocode.js): town_lookup answers a city name from our towns
-- (GeoNames places of 5,000 and more, lib/places) by any of their names, the most populous first;
-- geocode_cache keeps Open-Meteo's geocoding answers for 30 days: the result list for a name our towns
-- lack (villages, misspellings, an empty list too) and the English name of a place by its GeoNames id.
-- Together a city search no longer needs Open-Meteo (the quota card of 2026-11-09); every ask that still
-- goes upstream is logged (error_log, scope geocode.upstream). Rows older than 30 days go with the
-- cleanup job. Row level security on, no policies, no grants for the public API roles, like every other
-- table. Safe to run more than once.
create index if not exists towns_names_idx on public.towns using gin (string_to_array(search, ' | '));

create or replace function public.town_lookup(q text, lim integer default 20)
returns table (id integer, name text, alt text, country text, region text, population integer, lat double precision, lon double precision)
language sql stable parallel safe
set search_path = public, extensions, pg_temp
as $$
  select t.id, t.name, t.alt, t.country, t.region, t.population, st_y(t.geog::geometry), st_x(t.geog::geometry)
    from public.towns t
   where string_to_array(t.search, ' | ') @> array[public.place_norm(btrim(q))]
   order by t.population desc
   limit least(greatest(lim, 1), 50)
$$;
revoke execute on function public.town_lookup(text, integer) from public, anon, authenticated;
grant execute on function public.town_lookup(text, integer) to service_role;

create table if not exists public.geocode_cache (
  key text primary key,            -- "<lang>|<name>" or "<lang>|w|<name>" (the wide list), or "get:<GeoNames id>"
  results jsonb not null,          -- Open-Meteo's answer: the result list, or { name, admin1 } for an id
  fetched_at timestamptz not null default now()
);
alter table public.geocode_cache enable row level security;
revoke all on public.geocode_cache from anon, authenticated;
grant select, insert, update, delete on public.geocode_cache to service_role;
