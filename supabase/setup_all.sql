-- ════════════════════════════════════════════════════════════════════════════
-- MetaBlend — complete one-shot setup.
-- Paste into the Supabase SQL editor and press Run.
--
-- Idempotent: safe on a fresh database OR your existing one. It never wipes
-- weights/scores you've already collected (all seeds use ON CONFLICT DO NOTHING).
-- Consolidates migration.sql … migration6.sql and fixes two schema bugs:
--   • drops the forecasts.api_id foreign key that blocked storing forecasts
--   • adds forecasts.created_at so /api/cleanup works
-- ════════════════════════════════════════════════════════════════════════════
begin;

-- ── Base tables (no-ops if they already exist) ──────────────────────────────
create table if not exists api_weights (
  id            text    not null,
  region        text    not null default 'global',
  name          text,
  weight        double precision default 0.25,
  score         integer default 0,
  reports       integer default 0,
  delta_history jsonb   default '[]'::jsonb,
  updated_at    timestamptz default now(),
  primary key (id, region)
);

create table if not exists forecasts (
  id         bigserial primary key,
  city       text,
  lat        double precision,
  lon        double precision,
  api_id     text,
  valid_for  date,
  temp       real,
  rain_pct   integer,
  wind_kmh   integer,
  condition  text,
  region     text        default 'global',
  fetched_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists feedback (
  id          bigserial primary key,
  city        text,
  actual_temp real,
  actual_cond text,
  report_date date,
  processed   boolean default false,
  lat         double precision,
  lon         double precision,
  accuracy    real,
  created_at  timestamptz default now()
);

-- ── Columns added by later migrations (idempotent) ──────────────────────────
alter table api_weights add column if not exists region        text not null default 'global';
alter table api_weights add column if not exists name          text;
alter table api_weights add column if not exists delta_history jsonb default '[]'::jsonb;
alter table api_weights add column if not exists updated_at    timestamptz default now();

alter table forecasts   add column if not exists region        text default 'global';
alter table forecasts   add column if not exists created_at    timestamptz default now();

alter table feedback    add column if not exists lat        double precision;
alter table feedback    add column if not exists lon        double precision;
alter table feedback    add column if not exists accuracy   real;
alter table feedback    add column if not exists created_at timestamptz default now();

-- ── Drop the api_id foreign key so a forecast can be stored for ANY source ──
--    (it blocked inserts whenever a source row wasn't seeded yet; api_id is
--     only a label, so no referential integrity is lost.)
alter table forecasts drop constraint if exists forecasts_api_id_fkey;

-- ── Composite primary key on api_weights (id, region) ───────────────────────
alter table api_weights drop constraint if exists api_weights_pkey;
alter table api_weights add  primary key (id, region);

-- ── Seed the global sources across every region (existing scores preserved) ──
insert into api_weights (id, region, weight, score, reports, name, delta_history)
select a.id, r.region, 0.25, 0, 0, a.name, '[]'::jsonb
from (values
  ('open-meteo',           'Open-Meteo'),
  ('owm',                  'OpenWeatherMap'),
  ('weatherapi',           'WeatherAPI'),
  ('tomorrow',             'Tomorrow.io'),
  ('met-norway',           'MET Norway'),
  ('visual-crossing',      'Visual Crossing'),
  ('world-weather-online', 'World Weather Online'),
  ('weatherstack',         'Weatherstack'),
  ('nasa-power',           'NASA POWER')
) as a(id, name)
cross join (values
  ('global'), ('europe'), ('north_america'), ('south_america'),
  ('asia'), ('africa'), ('oceania')
) as r(region)
on conflict (id, region) do nothing;

-- GeoSphere only covers Austria, so seed it just for europe + the global pool.
insert into api_weights (id, region, weight, score, reports, name, delta_history)
values
  ('geosphere', 'global', 0.25, 0, 0, 'GeoSphere Austria', '[]'::jsonb),
  ('geosphere', 'europe', 0.25, 0, 0, 'GeoSphere Austria', '[]'::jsonb)
on conflict (id, region) do nothing;

-- ── Consensus history (RSS feed + intraday chart) ───────────────────────────
create table if not exists consensus_history (
  id             bigserial primary key,
  city           text not null,
  country        text,
  region         text default 'global',
  temp           real,
  feels_like     real,
  rain_pct       integer,
  wind_kmh       integer,
  confidence_pct integer,
  condition      text,
  source_count   integer,
  created_at     timestamptz default now()
);

-- ── Per-API response time + uptime stats ────────────────────────────────────
create table if not exists api_stats (
  api_id          text primary key,
  avg_response_ms real,
  success_count   bigint default 0,
  fail_count      bigint default 0,
  last_checked    timestamptz default now()
);

-- Atomic stats bump (EMA on response time, running up/down counts). One call
-- per forecast request instead of a read-modify-write round trip, so
-- concurrent requests can't clobber each other's counts.
-- rows: [{ "api_id": "...", "ms": 123, "up": true }, ...]
create or replace function bump_api_stats(rows jsonb)
returns void
language sql
as $$
  insert into api_stats (api_id, avg_response_ms, success_count, fail_count, last_checked)
  select r->>'api_id',
         (r->>'ms')::real,
         case when (r->>'up')::boolean then 1 else 0 end,
         case when (r->>'up')::boolean then 0 else 1 end,
         now()
  from jsonb_array_elements(rows) r
  on conflict (api_id) do update set
    avg_response_ms = round((coalesce(api_stats.avg_response_ms, excluded.avg_response_ms) * 0.7
                             + excluded.avg_response_ms * 0.3)::numeric),
    success_count   = api_stats.success_count + excluded.success_count,
    fail_count      = api_stats.fail_count   + excluded.fail_count,
    last_checked    = now();
$$;

-- Server-only: the anon key must not be able to pollute the stats via
-- PostgREST's /rpc endpoint. The service role keeps access.
revoke execute on function bump_api_stats(jsonb) from public, anon, authenticated;
grant  execute on function bump_api_stats(jsonb) to service_role;

-- ── Server-side error log (best-effort; written by lib/log.js) ──────────────
create table if not exists error_log (
  id         bigserial primary key,
  scope      text,
  message    text,
  meta       jsonb,
  created_at timestamptz default now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists feedback_latlon_idx        on feedback (lat, lon);
create index if not exists consensus_history_city_time on consensus_history (city, created_at desc);
create index if not exists forecasts_valid_for_idx     on forecasts (valid_for);
create index if not exists error_log_time              on error_log (created_at desc);

-- ── RLS is managed separately, NOT here ─────────────────────────────────────
--    This script is RLS-neutral so re-running it never changes your security
--    posture. Choose one:
--      • Locked down (recommended): set SUPABASE_SERVICE_ROLE_KEY in the server
--        env, then run supabase/enable_rls.sql.
--      • Open beta: leave RLS off (a fresh `create table` defaults to RLS off).
--    Earlier versions of this file disabled RLS at the end — that silently
--    re-opened the database if it was run after enable_rls.sql. Removed.

commit;
