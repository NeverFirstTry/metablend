-- place_climate keeps a place's climate reference for a year (lib/climate-store.js): the normal high
-- and low and the rainy days per calendar day, and the planner's months, reduced from Open-Meteo's
-- 10-year archive answer. That request weighs about 104 of their calls and its answer changes once a
-- year, so it is asked once per place and year; the outlook and the planner read the kept table.
-- One row per place, about 4 KB. Run on dev, then on production (safe to run again).

create table if not exists public.place_climate (
  key text primary key,            -- "<lat>,<lon>" to 0.01 degree, as the archive is asked
  data jsonb not null,             -- { v, years, max[365], min[365], wet[365], months[12] } (lib/outlook/climate.js, climateTable)
  fetched_at timestamptz not null default now()
);
alter table public.place_climate enable row level security;
revoke all on public.place_climate from anon, authenticated;
grant select, insert, update, delete on public.place_climate to service_role;
