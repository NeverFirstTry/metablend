-- MetaBlend dev database — the whole schema for a fresh Supabase project.
-- Built by `node scripts/dev-db.mjs build` from supabase/*.sql; don't edit it
-- here. Paste it into the dev project's SQL editor and press Run (safe to run
-- again). No scheduled jobs: production's (cron.sql) call the live site.

-- ═══ setup_all.sql ═════════════════════════════════════════════════════════
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
  ('nasa-power',           'NASA POWER'),
  ('ecmwf',                'ECMWF IFS'),
  ('gfs',                  'NOAA GFS'),
  ('icon',                 'DWD ICON'),
  ('metablend',            'MetaBlend Local')
) as a(id, name)
cross join (values
  ('global'), ('europe'), ('north_america'), ('south_america'),
  ('asia'), ('africa'), ('oceania')
) as r(region)
on conflict (id, region) do nothing;

-- Regional sources: seed only where they can actually report (plus global).
insert into api_weights (id, region, weight, score, reports, name, delta_history)
values
  ('geosphere', 'global',        0.25, 0, 0, 'GeoSphere Austria', '[]'::jsonb),
  ('geosphere', 'europe',        0.25, 0, 0, 'GeoSphere Austria', '[]'::jsonb),
  ('nws',       'global',        0.25, 0, 0, 'NWS (US)',          '[]'::jsonb),
  ('nws',       'north_america', 0.25, 0, 0, 'NWS (US)',          '[]'::jsonb),
  ('brightsky', 'global',        0.25, 0, 0, 'DWD Bright Sky',    '[]'::jsonb),
  ('brightsky', 'europe',        0.25, 0, 0, 'DWD Bright Sky',    '[]'::jsonb),
  ('smhi',      'global',        0.25, 0, 0, 'SMHI (Nordics)',    '[]'::jsonb),
  ('smhi',      'europe',        0.25, 0, 0, 'SMHI (Nordics)',    '[]'::jsonb)
on conflict (id, region) do nothing;

-- ── MetaBlend Local: learned per-city consensus bias ─────────────────────────
--    EMA of (ground truth − consensus), fed by user feedback and hourly PWS
--    calibration; served as the synthetic 'metablend' source (lib/blend.js).
--    Learned in separate day/night buckets (consensus errors are asymmetric —
--    models routinely miss nighttime cooling).
create table if not exists city_bias (
  city              text primary key,
  lat               double precision,
  lon               double precision,
  region            text default 'global',
  temp_bias         real default 0,      -- day bucket (06–21 city-local)
  samples           integer default 0,
  temp_bias_night   real default 0,      -- night bucket (21–06 city-local)
  samples_night     integer default 0,
  updated_at        timestamptz default now()
);
alter table city_bias add column if not exists temp_bias_night real default 0;
alter table city_bias add column if not exists samples_night   integer default 0;

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

-- ── Outlook (future forecast) learning ──────────────────────────────────────
--    Saved predictions per source — kind 'h' (+6/12/24/48 h, one per city per
--    6 h) and 'd' (days 1–14, one per city per local day) — checked daily
--    against METAR history by /api/cleanup; weights per region × range.
create table if not exists outlook_snapshots (
  id             bigserial primary key,
  city           text not null,
  lat            double precision,
  lon            double precision,
  region         text not null default 'global',
  source         text not null,
  kind           text not null check (kind in ('h', 'd')),
  slot           integer not null,
  issued_at      timestamptz not null default now(),
  utc_offset_sec integer not null default 0,
  checkpoints    jsonb not null default '[]'::jsonb,
  verified       jsonb not null default '{}'::jsonb,
  next_due_at    timestamptz
);
create unique index if not exists outlook_snapshots_slot on outlook_snapshots (city, source, kind, slot);
create index if not exists outlook_snapshots_due  on outlook_snapshots (next_due_at);
create index if not exists outlook_snapshots_city on outlook_snapshots (city, issued_at desc);

create table if not exists outlook_weights (
  id            text    not null,
  region        text    not null default 'global',
  horizon       text    not null check (horizon in ('h48', 'd7', 'd14')),
  name          text,
  weight        double precision default 0.25,
  score         integer default 0,
  reports       integer default 0,
  delta_history jsonb   default '[]'::jsonb,
  updated_at    timestamptz default now(),
  primary key (id, region, horizon)
);

-- Marks checkpoints done and moves next_due_at, many rows in one call.
-- rows: [{ "id": 1, "verified": {...}, "next_due_at": "…" | null }, ...]
create or replace function mark_outlook_verified(rows jsonb)
returns void
language sql
as $$
  update outlook_snapshots s
     set verified    = r->'verified',
         next_due_at = (r->>'next_due_at')::timestamptz
    from jsonb_array_elements(rows) r
   where s.id = (r->>'id')::bigint;
$$;
revoke execute on function mark_outlook_verified(jsonb) from public, anon, authenticated;
grant  execute on function mark_outlook_verified(jsonb) to service_role;

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
-- hourly station calibration + nightly cleanup both filter on created_at
create index if not exists forecasts_created_at_idx    on forecasts (created_at);
-- nightly retention prune (the city+time index above can't serve a time-only range)
create index if not exists consensus_history_time      on consensus_history (created_at);
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

-- ═══ migration7.sql ════════════════════════════════════════════════════════
-- Supabase security advisor "function_search_path_mutable": pin the search
-- path of the two batch functions so a caller's search_path can't redirect
-- the tables they touch. Applied 2026-10-02.
alter function public.bump_api_stats(rows jsonb) set search_path = public, pg_temp;
alter function public.mark_outlook_verified(rows jsonb) set search_path = public, pg_temp;

-- ═══ push.sql ══════════════════════════════════════════════════════════════
-- Push notifications (spec 2026-10-01). Applied live as migration push_tables.
-- RLS on, no policies: only the API (service-role key) reads and writes.
-- Not in the backup route's TABLES list on purpose — device tokens are not
-- learned state.

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  apns_env text check (apns_env in ('prod', 'sandbox')),
  lang text not null default 'en',
  unit text not null default 'C' check (unit in ('C', 'F')),
  home_name text,
  alert_rain boolean not null default false,
  alert_storm boolean not null default false,
  alert_severe boolean not null default false,
  alert_heat boolean not null default false,
  briefing boolean not null default false,
  briefing_hour smallint not null default 7 check (briefing_hour between 5 and 11),
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create table if not exists public.hike_plans (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.push_devices(id) on delete cascade,
  name text not null,
  lat double precision not null,
  lon double precision not null,
  elev integer not null,
  date date not null,
  sent_evening boolean not null default false,
  sent_morning boolean not null default false,
  last_window jsonb,
  created_at timestamptz not null default now()
);
create index if not exists hike_plans_date on public.hike_plans (date);
create index if not exists hike_plans_device on public.hike_plans (device_id);

create table if not exists public.push_log (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.push_devices(id) on delete cascade,
  kind text not null,
  ref text not null,
  sent_at timestamptz not null default now()
);
create index if not exists push_log_device_sent on public.push_log (device_id, sent_at);

alter table public.push_devices enable row level security;
alter table public.hike_plans enable row level security;
alter table public.push_log enable row level security;

-- home_lang (migration push_home_lang): the language the home city was picked
-- in; the hourly job looks the city up in it, texts use lang.
alter table public.push_devices add column if not exists home_lang text;

-- ═══ migration8.sql ════════════════════════════════════════════════════════
-- Hiking v2: OSM routes per peak, cached a week (OSM API usage policy), and
-- the route a planned hike is walked on.
create table if not exists public.route_cache (
  peak_key text primary key,
  routes jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.route_cache enable row level security;
alter table public.hike_plans add column if not exists route jsonb;

-- ═══ warnings.sql ══════════════════════════════════════════════════════════
-- Official weather warnings (spec 2026-10-08): MeteoAlarm country feeds,
-- refreshed every 15 minutes by /api/warnings/refresh. RLS on, no policies:
-- only the API (service-role key) reads and writes.
create table if not exists public.warnings (
  id text primary key,
  thread text, -- the first warning of its Update chain: alerts go out once per thread
  country text not null,
  regions text[] not null,
  level smallint not null check (level between 2 and 4),
  type text not null,
  onset text,
  expires text not null,
  ends_at timestamptz not null,
  texts jsonb not null default '{}'::jsonb,
  sender text,
  web text,
  fetched_at timestamptz not null default now()
);
create index if not exists warnings_regions_idx on public.warnings using gin (regions);
create index if not exists warnings_ends_idx on public.warnings (ends_at);
create index if not exists warnings_country_idx on public.warnings (country, fetched_at);
alter table public.warnings add column if not exists thread text;
-- outline warnings (countries that draw CAP polygons instead of naming regions):
-- the simplified outline and its box, for the point lookup
alter table public.warnings add column if not exists areas jsonb;
alter table public.warnings add column if not exists min_lon double precision;
alter table public.warnings add column if not exists min_lat double precision;
alter table public.warnings add column if not exists max_lon double precision;
alter table public.warnings add column if not exists max_lat double precision;
create index if not exists warnings_box_idx on public.warnings (min_lat, max_lat, min_lon, max_lon) where areas is not null;
alter table public.warnings enable row level security;

-- ═══ warnings-trim.sql ═════════════════════════════════════════════════════
-- A MeteoAlarm feed trimmed to what the warnings parser reads — the database
-- twin of lib/warnings/trim.js (supabase/warnings-trim.test.js checks they
-- agree on real feeds). Feeds keep every expired warning (Germany ~7 MB for
-- ~50 in force): only an alert the parser could still show stays whole —
-- Actual, not a Cancel, level 2–4, any info valid after `cutoff`; every other
-- alert shrinks to identifier / msgType / status / sent / references, which
-- is all update / cancel replacement and duplicate handling read.

-- the first parameter of that name in a CAP info block ("3; orange; Severe")
create or replace function public.cap_param(info jsonb, name text)
returns text language sql immutable set search_path = '' as $$
  select p->>'value'
  from jsonb_array_elements(case when jsonb_typeof(info->'parameter') = 'array' then info->'parameter' else '[]'::jsonb end)
       with ordinality as e(p, n)
  where p->>'valueName' = name
  order by n limit 1
$$;

-- a CAP time, or null when it isn't one (never an error). Stable, not
-- immutable: it reads the session time zone and takes words like 'now'.
create or replace function public.cap_time(t text)
returns timestamptz language plpgsql stable set search_path = '' as $$
begin
  return t::timestamptz;
exception when others then
  return null;
end $$;

create or replace function public.trim_warning_feed(feed jsonb, cutoff timestamptz)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  out jsonb := '[]'::jsonb;
  w jsonb;
  a jsonb;
  infos jsonb;
  main jsonb;
  level numeric; -- numeric: an absurd 11-digit level is simply not 2–4, as in JS
  keep boolean;
begin
  if jsonb_typeof(feed->'warnings') is distinct from 'array' then
    return jsonb_build_object('warnings', '[]'::jsonb);
  end if;
  for w in select value from jsonb_array_elements(feed->'warnings') with ordinality as e(value, n) order by n loop
    a := w->'alert';
    keep := false;
    if jsonb_typeof(a) = 'object' and a->>'msgType' is distinct from 'Cancel' and a->>'status' = 'Actual' then
      select coalesce(jsonb_agg(i order by n), '[]'::jsonb) into infos
      from jsonb_array_elements(case when jsonb_typeof(a->'info') = 'array' then a->'info' else '[]'::jsonb end) with ordinality as e(i, n)
      where jsonb_typeof(i) = 'object';
      -- main: the first info with an awareness level, else the first info (as the parser reads it)
      select i into main from jsonb_array_elements(infos) with ordinality as e(i, n)
      where coalesce(public.cap_param(i, 'awareness_level'), '') <> '' order by n limit 1;
      if main is null then main := infos->0; end if;
      level := substring(coalesce(public.cap_param(main, 'awareness_level'), '') from '^\s*([+-]?\d+)')::numeric;
      keep := level between 2 and 4 and exists (
        select 1 from jsonb_array_elements(infos) i where public.cap_time(i->>'expires') > cutoff
      );
    end if;
    if keep then
      out := out || jsonb_build_array(w);
    else
      out := out || jsonb_build_array(jsonb_build_object('alert', jsonb_strip_nulls(jsonb_build_object(
        'identifier', a->'identifier', 'msgType', a->'msgType', 'status', a->'status', 'sent', a->'sent', 'references', a->'references'
      ))));
    end if;
  end loop;
  return jsonb_build_object('warnings', out);
end $$;

-- only the database's own download job uses these; not callable through the API
revoke execute on function public.cap_param(jsonb, text), public.cap_time(text), public.trim_warning_feed(jsonb, timestamptz) from public, anon, authenticated;

-- ═══ warnings-feeds.sql ════════════════════════════════════════════════════
-- Official warnings: the database downloads the MeteoAlarm country feeds
-- (19 MB every run — on Vercel that was the costliest job), trims each to
-- what the parser reads (warnings-trim.sql) and calls /api/warnings/refresh
-- only when a feed changed or one couldn't be downloaded lately (Vercel then
-- downloads that one itself and logs it); Vercel parses just those countries.
-- Order: warnings-trim.sql, this file, then the warnings-refresh job in
-- cron.sql. Safe to run more than once.
--
-- The `http` extension downloads synchronously and keeps nothing; pg_net
-- would park every response (Germany ~7 MB) in net._http_response for six
-- hours — enough to fill the free plan's 500 MB.

-- without the trimmer every download would fail, quietly
do $$ begin
  perform 'public.trim_warning_feed(jsonb, timestamptz)'::regprocedure;
exception when undefined_function then
  raise exception 'Run supabase/warnings-trim.sql first: public.trim_warning_feed is missing';
end $$;

create extension if not exists http with schema extensions;

create table if not exists public.warning_feeds (
  country text primary key,
  slug text not null,
  body jsonb,                -- the trimmed feed, for the parser
  hash text,                 -- md5 of the downloaded feed: unchanged → nothing to do
  processed_hash text,       -- the hash Vercel last applied
  fetched_at timestamptz,    -- when the feed last changed
  checked_at timestamptz,    -- when it was last asked
  last_status integer,
  last_error text
);
alter table public.warning_feeds add column if not exists ok_at timestamptz; -- its last good download
alter table public.warning_feeds enable row level security;
revoke all on public.warning_feeds from anon, authenticated;

-- the same countries as lib/warnings/feeds.js (a test keeps them in step)
insert into public.warning_feeds (country, slug) values
  ('AT', 'austria'), ('BA', 'bosnia-herzegovina'), ('CY', 'cyprus'), ('DK', 'denmark'), ('FI', 'finland'),
  ('DE', 'germany'), ('GR', 'greece'), ('IT', 'italy'), ('LV', 'latvia'), ('LT', 'lithuania'),
  ('ME', 'montenegro'), ('NL', 'netherlands'), ('PL', 'poland'), ('PT', 'portugal'), ('RS', 'serbia'),
  ('SK', 'slovakia'), ('ES', 'spain'),
  ('EE', 'estonia'), ('IL', 'israel'), ('NO', 'norway'), ('SI', 'slovenia'), ('SE', 'sweden')
on conflict (country) do update set slug = excluded.slug;

-- Download the feeds, the ones asked longest ago first, until `budget` is
-- spent (the rest go first next time; one cron run stays well under
-- Supabase's two-minute statement limit). Stores the trimmed feed where it
-- changed. A failing feed (timeout, non-200, a maintenance page) keeps what
-- we have and says why in last_error. Returns how many changed.
drop function if exists public.refresh_warning_feeds();
create or replace function public.refresh_warning_feeds(budget interval default interval '75 seconds')
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  f record;
  res extensions.http_response;
  status integer;
  feed jsonb;
  h text;
  changed integer := 0;
  started timestamptz := clock_timestamp();
  tried timestamptz;
begin
  -- both: the extension's own timeout setting and curl's
  perform set_config('http.timeout_msec', '15000', true);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '15');
  perform extensions.http_set_curlopt('CURLOPT_USERAGENT', 'MetaBlend/1.0 github.com/NeverFirstTry/metablend');
  for f in select country, slug, hash from public.warning_feeds order by checked_at nulls first, country loop
    status := null;
    begin
      tried := clock_timestamp();
      begin
        res := extensions.http_get('https://feeds.meteoalarm.org/api/v1/warnings/feeds-' || f.slug);
      exception when others then
        -- broke off at once (from Supabase a few small feeds end in SSL_ERROR_SYSCALL):
        -- once more, on a fresh connection. A timeout isn't tried again.
        if clock_timestamp() - tried > interval '5 seconds' then raise; end if;
        res := extensions.http_get('https://feeds.meteoalarm.org/api/v1/warnings/feeds-' || f.slug);
      end;
      status := res.status;
      if status <> 200 then
        update public.warning_feeds set checked_at = now(), last_status = status, last_error = 'HTTP ' || status where country = f.country;
      else
        h := md5(res.content);
        -- JSON may carry \u0000, which jsonb refuses
        feed := case when h is distinct from f.hash then replace(res.content, '\u0000', '')::jsonb end;
        if feed is not null and jsonb_typeof(feed->'warnings') is distinct from 'array' then
          update public.warning_feeds set checked_at = now(), last_status = status, last_error = 'not a feed' where country = f.country;
        else
          update public.warning_feeds set checked_at = now(), ok_at = now(), last_status = status, last_error = null where country = f.country;
          if feed is not null then -- changed: store it for Vercel to parse
            update public.warning_feeds
              set body = public.trim_warning_feed(feed, now() - interval '1 hour'), hash = h, fetched_at = now()
              where country = f.country;
            changed := changed + 1;
          end if;
        end if;
      end if;
    exception when others then -- one bad feed never stops the others
      update public.warning_feeds set checked_at = now(), last_status = status, last_error = left(sqlerrm, 300) where country = f.country;
    end;
    exit when clock_timestamp() - started > budget;
  end loop;
  return changed;
end $$;
revoke all on function public.refresh_warning_feeds(interval) from public, anon, authenticated;

-- what Vercel still has to apply
create or replace view public.warning_feeds_pending with (security_invoker = true) as
  select country, body, hash from public.warning_feeds
  where body is not null and hash is distinct from processed_hash;
revoke all on public.warning_feeds_pending from anon, authenticated;

-- feeds without a good download for 40 minutes (two quarter-hour runs and
-- change): Vercel downloads these itself and logs them
create or replace view public.warning_feeds_behind with (security_invoker = true) as
  select country, slug, ok_at, last_status, last_error from public.warning_feeds
  where ok_at is null or ok_at < now() - interval '40 minutes';
revoke all on public.warning_feeds_behind from anon, authenticated;

-- ═══ tester-signups.sql ════════════════════════════════════════════════════
-- Android tester sign-ups from /testers (POST /api/testers/signup); the owner
-- exports them as a Play Console email list and marks them as they go
-- (/api/testers/export). Written only by those server routes with the
-- service-role key: row level security on, no policies, no grants for the
-- public API roles — like every other table. Safe to run more than once.
create table if not exists public.tester_signups (
  -- trimmed and lower-cased by the route; one row per address
  email text primary key check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  phone_model text check (char_length(phone_model) <= 60),
  country text check (char_length(country) <= 60),
  language text not null default 'en' check (char_length(language) <= 10),
  -- new → added (on the Play list) → opted_in; removed = taken off the list
  status text not null default 'new' check (status in ('new', 'added', 'opted_in', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tester_signups_status_idx on public.tester_signups (status, created_at);
alter table public.tester_signups enable row level security;
revoke all on public.tester_signups from anon, authenticated;
-- the server routes' role, not left to the project's default grants
grant select, insert, update, delete on public.tester_signups to service_role;

-- ═══ enable_rls.sql ════════════════════════════════════════════════════════
-- ════════════════════════════════════════════════════════════════════════════
-- MetaBlend — lock down the database (run AFTER setup_all.sql).
--
-- Prerequisite: set SUPABASE_SERVICE_ROLE_KEY in your server env
--   • locally:  add it to .env.local
--   • on Vercel: Project → Settings → Environment Variables
-- Then restart/redeploy so lib/supabase.js picks it up.
--
-- This (1) drops any lingering permissive policies — older tables like forecasts
-- and feedback often shipped with an "allow all" policy that keeps anon access
-- open even after RLS is enabled — and (2) enables RLS with NO policies, so the
-- public anon key can no longer read or write any table. The server uses the
-- service-role key, which bypasses RLS; the browser never queries Supabase
-- directly (only /api/* routes), so nothing breaks.
--
-- Safe to re-run. To reopen the beta: `alter table <t> disable row level security`.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Drop every existing policy on the app tables (so none stays permissive).
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('api_weights','forecasts','feedback','consensus_history','api_stats','error_log','city_bias','outlook_snapshots','outlook_weights')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 2. Enable RLS (no policies = deny-all for anon; service role bypasses it).
alter table api_weights       enable row level security;
alter table forecasts         enable row level security;
alter table feedback          enable row level security;
alter table consensus_history enable row level security;
alter table api_stats         enable row level security;
alter table error_log         enable row level security;
alter table city_bias         enable row level security;
alter table outlook_snapshots enable row level security;
alter table outlook_weights   enable row level security;
