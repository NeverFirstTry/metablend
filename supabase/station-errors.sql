-- Shadow run for the weighting formula: each hourly check (/api/station-calibrate)
-- stores every source's raw temperature error, so other formulas can be replayed
-- on all sources, MetaBlend Local (the per-city correction) included. Nothing live
-- reads it. At most 20 rows an hour; the cleanup job removes them after 30 days,
-- like the consensus snapshots. Drop the table once the formula is decided.
-- Row level security on, no policies, no grants for the public API roles, like
-- every other table. Safe to run more than once.
create table if not exists public.station_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  city text not null,
  region text not null,
  actual real not null,   -- the reading it is compared with, in °C
  shown real,             -- the consensus visitors saw that hour, if one was stored
  errors jsonb not null   -- { source id: forecast minus reading, in °C }
);
-- which reading: 'metar' (airports), 'station' (an official station in town) or 'summit'
alter table public.station_errors add column if not exists truth text not null default 'metar';
-- how far away that reading was taken, in km
alter table public.station_errors add column if not exists truth_km real;
alter table public.station_errors enable row level security;
revoke all on public.station_errors from anon, authenticated;
-- the server routes' role, not left to the project's default grants
grant select, insert, delete on public.station_errors to service_role;
