-- Shadow run for the weighting formula: each hourly airport scoring
-- (/api/station-calibrate) stores every source's raw temperature error, so other
-- formulas can be replayed on all sources. Nothing live reads it. One row per
-- scored city, at most 360 a day; the cleanup job removes them after 30 days,
-- like the consensus snapshots. Drop the table once the formula is decided.
-- Row level security on, no policies, no grants for the public API roles, like
-- every other table. Safe to run more than once.
create table if not exists public.station_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  city text not null,
  region text not null,
  actual real not null,   -- the airports' median reading, in °C
  shown real,             -- the consensus visitors saw that hour, if one was stored
  errors jsonb not null   -- { source id: forecast minus reading, in °C }
);
alter table public.station_errors enable row level security;
revoke all on public.station_errors from anon, authenticated;
-- the server routes' role, not left to the project's default grants
grant select, insert, delete on public.station_errors to service_role;
