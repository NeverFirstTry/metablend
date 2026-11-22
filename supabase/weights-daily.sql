-- The weights as the forecasts use them, once a day: one row per region, written by the nightly job
-- (app/api/cleanup/route.js) from api_weights. For the weighting shadow run's final report of 2026-12-05:
-- today's formula could not be replayed because the weights of each day were not kept (interim report of
-- 2026-11-21). Nothing live reads it. About 7 rows and 5 KB a day. Drop the table once the formula is decided,
-- together with station_errors.
-- Row level security on, no policies, no grants for the public API roles, like every other table. Safe to
-- run more than once.
create table if not exists public.weights_daily (
  day date not null,
  region text not null,
  weights jsonb not null,   -- { source id: weight }
  created_at timestamptz not null default now(),
  primary key (day, region)
);
alter table public.weights_daily enable row level security;
revoke all on public.weights_daily from anon, authenticated;
-- the server routes' role, not left to the project's default grants
grant select, insert on public.weights_daily to service_role;
