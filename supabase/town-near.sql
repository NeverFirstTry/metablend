-- "My location" (lib/geocode.js placeNear, /api/place): the town at a position the phone has rounded
-- to 0.1°, about 10 km; the exact position never leaves the device. A rounded position cannot tell
-- neighbours apart, and our towns (GeoNames places of 5,000 and more) list city districts beside the
-- cities, so neither the nearest (a district: Mühlau for Innsbruck) nor the largest in reach (a Vienna
-- district for Mödling) is the place meant. So: of the towns within radius_km, the one with the most
-- people for its distance, population / (km + 1)². Only places of 500 people and more (2026-11-13: the list
-- holds every hamlet of Austria now, and a hamlet of 100 people beside the rounded position is not where
-- the phone is). No row: no town that close, and the API asks
-- OpenStreetMap's Nominatim with the same rounded position. Only the API (service-role key) calls it.
-- Safe to run more than once.
create or replace function public.town_near(lat double precision, lon double precision, radius_km double precision default 10)
returns table (id integer, name text, country text, population integer, km double precision)
language sql stable parallel safe
set search_path = public, extensions, pg_temp
as $$
  select c.id, c.name, c.country, c.population, c.km
    from (select t.id, t.name, t.country, t.population,
                 st_distance(t.geog, st_makepoint(town_near.lon, town_near.lat)::geography) / 1000 as km
            from public.towns t
           where t.population >= 500
             and st_dwithin(t.geog, st_makepoint(town_near.lon, town_near.lat)::geography, least(greatest(radius_km, 1), 50) * 1000)) c
   order by c.population / power(c.km + 1, 2) desc, c.id
   limit 1
$$;
revoke execute on function public.town_near(double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.town_near(double precision, double precision, double precision) to service_role;
