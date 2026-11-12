-- route_heights keeps a route's heights for good (lib/route/height-store.js). The terrain does not change,
-- and Open-Meteo's elevation API charges one call per point: asking every point of every route again each
-- week cost 22,705 calls in one hour on 2026-11-12. A route's line is sampled to at most 100 points; their
-- heights are stored once under the route's id and the fingerprint of that sampled line, so a route that
-- changes gets a new row and an unchanged one never asks again. route_id is the route's own id ("osm-…"),
-- or "saved" for a route a user saved. One row is about 0.3 KB.
-- Run on dev, then on production (safe to run again).

create table if not exists public.route_heights (
  route_id text not null,          -- the route's id, or 'saved'
  geom text not null,              -- fingerprint of the sampled line (20 hex characters)
  heights smallint[] not null,     -- metres, one per sampled point, in order along the way
  created_at timestamptz not null default now(),
  primary key (route_id, geom)
);
alter table public.route_heights enable row level security;
revoke all on public.route_heights from anon, authenticated;
grant select, insert, update, delete on public.route_heights to service_role;
