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
  ('met-norway',           'MET Norway'),
  ('visual-crossing',      'Visual Crossing'),
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

-- ═══ nominatim.sql ═════════════════════════════════════════════════════════
-- Nominatim (OpenStreetMap's geocoder) for the hiking screen. Its usage policy:
-- at most one request a second for the whole application — "the sum of
-- traffic by all your users" — and results cached on our side. Every server
-- instance passes the one-row gate below (lib/hike/nominatim.js); answers are
-- kept 30 days in nominatim_cache. RLS on, no policies, no grants for the
-- public API roles: only the API (service-role key) uses them. Safe to run
-- more than once.

create table if not exists public.nominatim_gate (
  id boolean primary key default true check (id),
  next_at timestamptz not null default now()
);
insert into public.nominatim_gate (id) values (true) on conflict (id) do nothing;

-- Reserves the next free slot (gap_ms apart, across every caller — the row
-- lock queues them) and returns how many milliseconds to wait for it; null
-- when the queue is longer than max_wait_ms (the caller gives up instead).
-- 1.25 s, not 1: the caller sleeps from when this call *returns*, and that
-- takes 50–150 ms, differently for each instance. The app passes gap_ms, so
-- it can be widened without new SQL. (The first version, 2026-10-29, took
-- only max_wait_ms with a fixed 1.1 s.)
drop function if exists public.nominatim_slot(integer);
create or replace function public.nominatim_slot(max_wait_ms integer default 4000, gap_ms integer default 1250)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  slot timestamptz;
begin
  update nominatim_gate
     set next_at = greatest(next_at, clock_timestamp()) + make_interval(secs => gap_ms / 1000.0)
   where id
     and greatest(next_at, clock_timestamp()) <= clock_timestamp() + make_interval(secs => max_wait_ms / 1000.0)
  returning next_at - make_interval(secs => gap_ms / 1000.0) into slot;
  if slot is null then
    return null;
  end if;
  return greatest(0, ceil(extract(epoch from (slot - clock_timestamp())) * 1000))::integer;
end
$$;

create table if not exists public.nominatim_cache (
  key text primary key,
  body jsonb not null,
  fetched_at timestamptz not null default now()
);
-- when the request went out (the app's clock): the record that they stay apart
alter table public.nominatim_cache add column if not exists asked_at timestamptz;
create index if not exists nominatim_cache_fetched_idx on public.nominatim_cache (fetched_at);

alter table public.nominatim_gate enable row level security;
alter table public.nominatim_cache enable row level security;
revoke all on public.nominatim_gate, public.nominatim_cache from anon, authenticated;
grant select, update on public.nominatim_gate to service_role;
grant select, insert, update, delete on public.nominatim_cache to service_role;
revoke execute on function public.nominatim_slot(integer, integer) from public, anon, authenticated;
grant execute on function public.nominatim_slot(integer, integer) to service_role;

-- ═══ places.sql ════════════════════════════════════════════════════════════
-- Our own summits, huts and towns for the Hiking screen — so search (also as
-- you type), "Near you" and "around a town" don't depend on public geocoders.
-- Summits and huts from OpenStreetMap (ODbL), towns from GeoNames (CC BY 4.0);
-- loaded by scripts/places (load.mjs), read only through the functions below
-- by our API (service-role key). RLS on, no policies, no grants for the
-- public API roles. Safe to run more than once.
-- Changed 2026-10-30 (run it again): loads write only rows that changed and
-- delete by id (summits_upsert, towns_upsert, summits_ids, towns_ids,
-- places_delete) instead of rewriting every row; places_ready says a load has
-- finished (places_loads) — until then the API keeps the outside services.

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Names compared without case or accents: "Hà Nội" = "ha noi", ß = ss.
create or replace function public.place_norm(t text)
returns text
language sql immutable parallel safe strict
set search_path = public, extensions, pg_temp
as $$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, t)) $$;

-- A summit's names in our languages ({ "de": …, "ja": … }) as one text.
create or replace function public.place_names_text(j jsonb)
returns text
language sql immutable parallel safe
set search_path = public, pg_temp
as $$ select coalesce(string_agg(v, ' | '), '') from jsonb_each_text(coalesce(j, '{}'::jsonb)) as e(k, v) $$;

create table if not exists public.summits (
  id text primary key,                -- osm-N123 / osm-W45
  kind text not null check (kind in ('peak', 'hut')),
  name text not null,
  names jsonb,                        -- name in our 13 languages, where OSM has it
  ele smallint,                       -- metres; null where OSM has none
  notability smallint not null default 0, -- Wikipedia 2 + Wikidata 1 + summit cross 1
  wikidata text,
  country text,                       -- ISO code of the country the summit lies in (we follow OpenStreetMap's country boundaries); null in a disputed area; the nearest town's where no outline holds it
  region text,
  geog extensions.geography(point, 4326) not null,
  search text generated always as (public.place_norm(name || ' | ' || public.place_names_text(names))) stored,
  loaded_at timestamptz not null default now() -- when a load last changed it
);

create table if not exists public.towns (
  id integer primary key,             -- GeoNames id
  name text not null,
  alt text,                           -- other names (Hanoi, Hà Nội, Wien, …), ' | ' between them
  country text,
  region text,
  population integer not null default 0,
  geog extensions.geography(point, 4326) not null,
  search text generated always as (public.place_norm(name || ' | ' || coalesce(alt, ''))) stored,
  loaded_at timestamptz not null default now()
);
-- since 2026-11-12 (our own place search, supabase/place-search.sql): what a reader of each language sees,
-- and in English what everything learned about a place is filed under
alter table public.towns add column if not exists names jsonb; -- its name in our 13 languages, where it differs from the main name

create index if not exists summits_geog_idx on public.summits using gist (geog);
-- names: GIN for substrings and typos, a sorted one for how a name starts.
-- (A GiST trigram index was here first: on 568 000 names it read nearly all
-- of itself per query — 90–126 ms; GIN finds the same in 1–4 ms.)
drop index if exists public.summits_search_idx;
create index if not exists summits_search_gin on public.summits using gin (search extensions.gin_trgm_ops);
create index if not exists summits_search_c on public.summits (search collate "C");
-- the 6% with a Wikipedia article (or Wikidata and a summit cross): how
-- their names start, on their own — "mont" sorts 1 500 of them, not 18 000 —
-- with height and id in the index, so that step reads no table rows
-- (on Supabase those row reads were most of the 65 ms "mont" took)
do $$ begin
  if exists (select 1 from pg_indexes where indexname = 'summits_search_notable' and indexdef not like '%INCLUDE%') then
    drop index public.summits_search_notable;
  end if;
end $$;
create index if not exists summits_search_notable on public.summits (search collate "C") include (ele, id) where notability >= 2;
create index if not exists towns_geog_idx on public.towns using gist (geog);
create index if not exists towns_search_idx on public.towns using gist (search extensions.gist_trgm_ops);
-- (loads no longer prune by time: those indexes only took space)
drop index if exists public.summits_loaded_idx;
drop index if exists public.towns_loaded_idx;

-- Each finished load: when, and what it left. The API uses our tables only
-- once there is one (places_ready) — never half of a first load.
create table if not exists public.places_loads (
  finished_at timestamptz primary key default now(),
  summits integer not null,
  towns integer not null,
  written integer not null,
  deleted integer not null
);

-- Summits and huts whose name, in any of our languages, is like the query —
-- as you type, typos and accents forgiven. Candidates in three steps: names
-- that start with it (sorted index; with Wikipedia articles, highest first),
-- names that contain it (GIN), and — only when those found too few, from
-- four letters on — near misses (GIN, word similarity). Then: starting with
-- the query first, the closer matches, nearer (with a position), the ones
-- with a Wikipedia article, higher. (A summit cross counts for Near you's
-- notability, not for fame: "mont" is Mont Blanc.)
-- (near_lat / near_lon: PL/pgSQL won't have input and output both named lat)
drop function if exists public.places_search(text, double precision, double precision, integer);
create or replace function public.places_search(q text, near_lat double precision default null, near_lon double precision default null, lim integer default 10)
returns table (id text, kind text, name text, names jsonb, ele smallint, notability smallint, country text, region text, lat double precision, lon double precision, km double precision)
language plpgsql stable parallel safe
set search_path = public, extensions, pg_temp
as $$
declare
  n text := public.place_norm(q);
  cand text[];
begin
  cand := array(select s.id from public.summits s
                 where s.notability >= 2 and s.search collate "C" >= n and s.search collate "C" < n || chr(1114111)
                 order by s.ele desc nulls last limit 40);
  if coalesce(array_length(cand, 1), 0) < 40 then
    cand := cand || array(select s.id from public.summits s
                 where s.search collate "C" >= n and s.search collate "C" < n || chr(1114111)
                 order by s.search collate "C" limit 40);
  end if;
  if length(n) >= 3 then
    cand := cand || array(select s.id from public.summits s where s.search like '%' || n || '%' limit 200);
  end if;
  if coalesce(array_length(cand, 1), 0) < lim and length(n) >= 4 then
    cand := cand || array(select s.id from public.summits s where n <% s.search order by word_similarity(n, s.search) desc limit 40);
  end if;
  return query
    select s.id, s.kind, s.name, s.names, s.ele, s.notability, s.country, s.region,
           st_y(s.geog::geometry), st_x(s.geog::geometry),
           case when near_lat is null or near_lon is null then null
                else st_distance(s.geog, st_makepoint(near_lon, near_lat)::geography) / 1000 end as km
      from public.summits s
     where s.id = any(cand)
     order by (s.search like n || '%' or s.search like '% | ' || n || '%') desc,
              round(word_similarity(n, s.search)::numeric, 1) desc,
              km nulls last, (s.notability >= 2) desc, s.ele desc nulls last
     limit least(greatest(lim, 1), 50);
end
$$;

-- Towns by name or another name of theirs. exact: the query is one of its names; prefix: one of its names
-- starts so. Two ways into the answer (2026-11-13): the towns one of whose names begins with what was typed,
-- the biggest first ("wie" offers Wien; before, the forty most alike of over a thousand were taken at random),
-- and the towns whose names are most like it. A name that is so, or begins so, comes before the look-alikes,
-- the bigger town first; the API then puts the names in the reader's language first (app/api/places/search).
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
  with n as (
    select v.n, replace(replace(replace(v.n, '\', '\\'), '%', '\%'), '_', '\_') as pattern -- typed text is no wildcard
      from (select public.place_norm(q) as n) v
  ),
  starts as ( -- one of its names begins with what was typed: the biggest towns first
    select t.id from public.towns t, n
     where t.search like n.pattern || '%' or t.search like '% | ' || n.pattern || '%'
     order by t.population desc
     limit 40
  ),
  alike as ( -- its names are most like it: a slip of the finger
    select t.id from public.towns t, n
     where n.n <% t.search
     order by t.search <->> n.n
     limit 40
  ),
  hits as (
    select t.*, n.n,
           n.n = any(string_to_array(t.search, ' | ')) as exact,
           exists (select 1 from unnest(string_to_array(t.search, ' | ')) as a(v) where a.v like n.pattern || '%') as prefix
      from public.towns t, n
     where t.id in (select s.id from starts s union select a.id from alike a)
  )
  select h.id, h.name, h.names, h.country, h.region, h.population, st_y(h.geog::geometry), st_x(h.geog::geometry), h.exact, h.prefix
    from hits h
   order by h.exact desc, h.prefix desc, (case when h.exact or h.prefix then h.population else 0 end) desc,
            round(word_similarity(h.n, h.search)::numeric, 1) desc, h.population desc
   limit least(greatest(lim, 1), 20)
$$;

-- Summits and/or huts around a point, nearest first.
create or replace function public.summits_near(lat double precision, lon double precision, radius_km double precision default 25, lim integer default 12, kinds text[] default array['peak', 'hut'])
returns table (id text, kind text, name text, names jsonb, ele smallint, notability smallint, country text, region text, lat double precision, lon double precision, km double precision)
language sql stable parallel safe
set search_path = public, extensions, pg_temp
as $$
  select s.id, s.kind, s.name, s.names, s.ele, s.notability, s.country, s.region,
         st_y(s.geog::geometry), st_x(s.geog::geometry),
         st_distance(s.geog, st_makepoint(summits_near.lon, summits_near.lat)::geography) / 1000
    from public.summits s
   where s.kind = any(kinds)
     and st_dwithin(s.geog, st_makepoint(summits_near.lon, summits_near.lat)::geography, radius_km * 1000)
   order by s.geog <-> st_makepoint(summits_near.lon, summits_near.lat)::geography
   limit least(greatest(lim, 1), 300)
$$;

-- "Near you": the 150 nearest summits within 15 km and the 150 most notable
-- (then highest) within 50 km — the phone picks its ten from these
-- (lib/hike/near.js pickNearPeaks).
create or replace function public.summits_pool(lat double precision, lon double precision)
returns table (id text, kind text, name text, names jsonb, ele smallint, notability smallint, country text, region text, lat double precision, lon double precision, km double precision)
language sql stable parallel safe
set search_path = public, extensions, pg_temp
as $$
  select * from public.summits_near(lat, lon, 15, 150, array['peak'])
  union
  select s.id, s.kind, s.name, s.names, s.ele, s.notability, s.country, s.region,
         st_y(s.geog::geometry), st_x(s.geog::geometry),
         st_distance(s.geog, st_makepoint(summits_pool.lon, summits_pool.lat)::geography) / 1000
    from (select * from public.summits s
           where s.kind = 'peak' and st_dwithin(s.geog, st_makepoint(summits_pool.lon, summits_pool.lat)::geography, 50000)
           order by s.notability desc, s.ele desc nulls last
           limit 150) s
$$;

-- A batch of a load (jsonb rows as in data/places/*.ndjson): new rows in,
-- changed rows updated, unchanged rows left as they are — not rewritten, so
-- a reload every few months adds only what changed, not a second copy of
-- 200 MB until vacuum (the free tier has 500 MB). Returns the rows written.
create or replace function public.summits_upsert(batch jsonb)
returns integer
language sql volatile
set search_path = public, extensions, pg_temp
as $$
  with r as (
    select * from jsonb_to_recordset(batch) as x(id text, kind text, name text, names jsonb, ele smallint, notability smallint,
                                                 wikidata text, country text, region text, lat double precision, lon double precision)
  ), w as (
    insert into public.summits as s (id, kind, name, names, ele, notability, wikidata, country, region, geog, loaded_at)
    select r.id, r.kind, r.name, r.names, r.ele, coalesce(r.notability, 0), r.wikidata, r.country, r.region,
           st_makepoint(r.lon, r.lat)::geography, now()
      from r
    on conflict (id) do update
       set kind = excluded.kind, name = excluded.name, names = excluded.names, ele = excluded.ele, notability = excluded.notability,
           wikidata = excluded.wikidata, country = excluded.country, region = excluded.region, geog = excluded.geog, loaded_at = excluded.loaded_at
     where (s.kind, s.name, s.names, s.ele, s.notability, s.wikidata, s.country, s.region, st_asbinary(s.geog))
           is distinct from
           (excluded.kind, excluded.name, excluded.names, excluded.ele, excluded.notability, excluded.wikidata, excluded.country, excluded.region, st_asbinary(excluded.geog))
    returning 1
  )
  select count(*)::integer from w
$$;

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

-- The ids we have, in order, n at a time (after: the last id of the page
-- before) — the loader finds what the new data no longer has.
create or replace function public.summits_ids(after text default null, n integer default 50000)
returns text[]
language sql stable
set search_path = public, pg_temp
as $$ select coalesce(array_agg(id order by id), '{}') from (select id from public.summits where id > coalesce(after, '') order by id limit n) x $$;

create or replace function public.towns_ids(after integer default null, n integer default 50000)
returns integer[]
language sql stable
set search_path = public, pg_temp
as $$ select coalesce(array_agg(id order by id), '{}') from (select id from public.towns where id > coalesce(after, -1) order by id limit n) x $$;

-- Rows the new data no longer has, by id (the loader sends a few thousand a
-- call, each within the API's time limit).
create or replace function public.places_delete(summit_ids text[] default '{}', town_ids integer[] default '{}')
returns table (summits bigint, towns bigint)
language sql volatile
set search_path = public, pg_temp
as $$
  with a as (delete from public.summits where id = any(summit_ids) returning 1),
       b as (delete from public.towns where id = any(town_ids) returning 1)
  select (select count(*) from a), (select count(*) from b)
$$;

-- A load finished: what it left, and from now on the API reads our tables.
create or replace function public.places_mark_loaded(rows_written integer, rows_deleted integer)
returns void
language sql volatile
set search_path = public, pg_temp
as $$
  insert into public.places_loads (summits, towns, written, deleted)
  select (select count(*) from public.summits), (select count(*) from public.towns), rows_written, rows_deleted
$$;

create or replace function public.places_ready()
returns boolean
language sql stable
set search_path = public, pg_temp
as $$ select exists (select 1 from public.places_loads) $$;

-- (loads used to mark every row and drop the unmarked ones after)
drop function if exists public.places_prune(timestamptz);
drop function if exists public.places_prune(timestamptz, integer);

-- Fresh statistics for the planner right after a load (security definer:
-- only the tables' owner may analyze them, not the API's role).
create or replace function public.places_analyze()
returns void
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
begin
  analyze public.summits;
  analyze public.towns;
end
$$;

-- How long each query takes inside the database (average ms over n runs) —
-- without the network in between — and how big the tables are.
create or replace function public.places_bench(n integer default 20)
returns table (query text, avg_ms numeric)
language plpgsql volatile
set search_path = public, extensions, pg_temp
as $$
declare
  t0 timestamptz;
  i integer;
  probe text;
  probes text[] := array[
    'select count(*) from places_search(''fansi'')', 'select count(*) from places_search(''matterhron'')',
    'select count(*) from places_search(''mont'')', 'select count(*) from places_search(''zug'', 47.42, 10.98)',
    'select count(*) from places_search(''富士'')', 'select count(*) from towns_search(''hà nội'')',
    'select count(*) from towns_search(''wien'')', 'select count(*) from summits_near(46.02, 7.75, 25, 12)',
    'select count(*) from summits_pool(47.27, 11.40)', 'select count(*) from summits_pool(21.03, 105.85)'];
begin
  foreach probe in array probes loop
    execute probe; -- warm
    t0 := clock_timestamp();
    for i in 1..n loop execute probe; end loop;
    query := probe;
    avg_ms := round((extract(epoch from clock_timestamp() - t0) * 1000 / n)::numeric, 2);
    return next;
  end loop;
end
$$;

-- Where a name search spends its time: each step on its own, the whole
-- search, and how much of the table is all-visible (index-only reads need it;
-- autovacuum sets it some time after a load).
create or replace function public.places_search_stages(q text)
returns table (stage text, row_count integer, ms numeric)
language plpgsql volatile
set search_path = public, extensions, pg_temp
as $$
declare
  n text := public.place_norm(q);
  t0 timestamptz;
  a text[];
begin
  t0 := clock_timestamp();
  a := array(select s.id from public.summits s
              where s.notability >= 2 and s.search collate "C" >= n and s.search collate "C" < n || chr(1114111)
              order by s.ele desc nulls last limit 40);
  stage := 'start, notable'; row_count := coalesce(array_length(a, 1), 0);
  ms := round((extract(epoch from clock_timestamp() - t0) * 1000)::numeric, 2); return next;
  t0 := clock_timestamp();
  a := array(select s.id from public.summits s
              where s.search collate "C" >= n and s.search collate "C" < n || chr(1114111)
              order by s.search collate "C" limit 40);
  stage := 'start, any'; row_count := coalesce(array_length(a, 1), 0);
  ms := round((extract(epoch from clock_timestamp() - t0) * 1000)::numeric, 2); return next;
  t0 := clock_timestamp();
  a := array(select s.id from public.summits s where s.search like '%' || n || '%' limit 200);
  stage := 'contains'; row_count := coalesce(array_length(a, 1), 0);
  ms := round((extract(epoch from clock_timestamp() - t0) * 1000)::numeric, 2); return next;
  t0 := clock_timestamp();
  a := array(select s.id from public.summits s where n <% s.search order by word_similarity(n, s.search) desc limit 40);
  stage := 'near misses'; row_count := coalesce(array_length(a, 1), 0);
  ms := round((extract(epoch from clock_timestamp() - t0) * 1000)::numeric, 2); return next;
  t0 := clock_timestamp();
  select count(*) into row_count from public.places_search(q);
  stage := 'whole search';
  ms := round((extract(epoch from clock_timestamp() - t0) * 1000)::numeric, 2); return next;
  stage := 'table pages all-visible (%)';
  select c.relallvisible, round(100.0 * c.relallvisible / greatest(c.relpages, 1), 1) into row_count, ms
    from pg_class c where c.oid = 'public.summits'::regclass;
  return next;
end
$$;

create or replace function public.places_size()
returns table (relation text, row_count bigint, total_mb numeric)
language sql stable
set search_path = public, pg_temp
as $$
  select 'summits', (select count(*) from public.summits), round(pg_total_relation_size('public.summits') / 1048576.0, 1)
  union all
  select 'towns', (select count(*) from public.towns), round(pg_total_relation_size('public.towns') / 1048576.0, 1)
  union all
  select 'whole database', null, round(pg_database_size(current_database()) / 1048576.0, 1)
$$;

alter table public.summits enable row level security;
alter table public.towns enable row level security;
alter table public.places_loads enable row level security;
revoke all on public.summits, public.towns, public.places_loads from anon, authenticated;
grant select, insert, update, delete on public.summits, public.towns, public.places_loads to service_role;
revoke execute on function public.place_norm(text), public.place_names_text(jsonb),
  public.places_search(text, double precision, double precision, integer), public.towns_search(text, integer),
  public.summits_near(double precision, double precision, double precision, integer, text[]), public.summits_pool(double precision, double precision),
  public.summits_upsert(jsonb), public.towns_upsert(jsonb), public.summits_ids(text, integer), public.towns_ids(integer, integer),
  public.places_delete(text[], integer[]), public.places_mark_loaded(integer, integer), public.places_ready(),
  public.places_analyze(), public.places_bench(integer), public.places_search_stages(text), public.places_size() from public, anon, authenticated;
grant execute on function public.place_norm(text), public.place_names_text(jsonb),
  public.places_search(text, double precision, double precision, integer), public.towns_search(text, integer),
  public.summits_near(double precision, double precision, double precision, integer, text[]), public.summits_pool(double precision, double precision),
  public.summits_upsert(jsonb), public.towns_upsert(jsonb), public.summits_ids(text, integer), public.towns_ids(integer, integer),
  public.places_delete(text[], integer[]), public.places_mark_loaded(integer, integer), public.places_ready(),
  public.places_analyze(), public.places_bench(integer), public.places_search_stages(text), public.places_size() to service_role;

-- ═══ feedback-lessons.sql ══════════════════════════════════════════════════
-- One weight lesson per city per window, and at most daily_cap lessons per
-- region per day — checked and recorded in one step (app/api/feedback/route.js).
-- Until 2026-11-01 the route read "when did this city last learn" and marked
-- it only after updating the weights, so a burst of reports sent at the same
-- moment all passed and all moved the weights. The row locks queue callers for
-- the same city and the same region: only the first in a window gets true, and
-- nobody once the region's day is full. Every lesson moves each source of the
-- region once, so the regional cap is also each source's daily cap from
-- feedback. RLS on, no grants for the public API roles: only the API
-- (service-role key) calls it. Safe to run more than once.

create table if not exists public.feedback_lessons (
  city text primary key,
  learned_at timestamptz not null default now()
);

-- how many lessons a region learned on a (UTC) day
create table if not exists public.feedback_lesson_days (
  day date not null,
  region text not null,
  n integer not null default 0,
  primary key (day, region)
);

-- The app passes the window and the cap (lib/feedback.js), so they can change without new SQL.
drop function if exists public.claim_feedback_lesson(text, integer);
create or replace function public.claim_feedback_lesson(p_city text, window_ms integer, p_region text, daily_cap integer)
returns boolean
language plpgsql
set search_path = public, pg_temp
as $$
declare today_n integer;
begin
  insert into feedback_lesson_days (day, region) values (current_date, p_region) on conflict do nothing;
  -- the region's counter row stays locked until the call ends: parallel reports queue here
  select n into today_n from feedback_lesson_days where day = current_date and region = p_region for update;
  if today_n >= daily_cap then return false; end if;
  insert into feedback_lessons as l (city, learned_at) values (p_city, now())
  on conflict (city) do update set learned_at = excluded.learned_at
   where l.learned_at <= now() - make_interval(secs => window_ms / 1000.0);
  if not found then return false; end if;
  update feedback_lesson_days set n = n + 1 where day = current_date and region = p_region;
  return true;
end
$$;

alter table public.feedback_lessons enable row level security;
alter table public.feedback_lesson_days enable row level security;
revoke all on public.feedback_lessons, public.feedback_lesson_days from anon, authenticated;
grant select, insert, update, delete on public.feedback_lessons, public.feedback_lesson_days to service_role;
revoke execute on function public.claim_feedback_lesson(text, integer, text, integer) from public, anon, authenticated;
grant execute on function public.claim_feedback_lesson(text, integer, text, integer) to service_role;

-- ═══ station-errors.sql ════════════════════════════════════════════════════
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

-- ═══ job-runs.sql ══════════════════════════════════════════════════════════
-- One row per run of a scheduled job (/api/cleanup, /api/calibrate, /api/push/dispatch,
-- /api/warnings/refresh, /api/station-calibrate; lib/job-log.js): when it started, how long it
-- took, the status it answered, the error text if it threw, and a compact summary of its answer
-- (counts; for the station calibration a tally of the skip reasons). pg_net keeps the HTTP
-- answers of pg_cron's calls only a few hours, so a failed night run was invisible by morning
-- (2026-11-09); with this table a read-only check covers any night. The cleanup job removes
-- rows after 14 days. Row level security on, no policies, no grants for the public API roles,
-- like every other table. Safe to run more than once.
create table if not exists public.job_runs (
  id bigint generated always as identity primary key,
  job text not null,
  started_at timestamptz not null,
  duration_ms integer not null,
  status_code integer not null,
  error text,
  summary jsonb
);
create index if not exists job_runs_job_started_at on public.job_runs (job, started_at desc);
alter table public.job_runs enable row level security;
revoke all on public.job_runs from anon, authenticated;
-- the server routes' role, not left to the project's default grants
grant select, insert, delete on public.job_runs to service_role;

-- ═══ open-meteo-calls.sql ══════════════════════════════════════════════════
-- Our own count of requests to Open-Meteo (lib/open-meteo.js), per UTC day, hour and kind of request:
-- how many HTTP requests we made and how many "API calls" they are the way Open-Meteo counts them.
-- Their page: one call per request; more than 10 weather variables or more than two weeks for one
-- location count fractionally (15 variables over 2 weeks = 1.5 calls, over 4 weeks = 3.0). Several
-- locations in one request and several models are not covered by their page; here every location, and
-- every model's set of variables, counts as its own (the conservative reading; asked of Open-Meteo
-- 2026-11-10). `requests` is the plain number, `calls` the weighted one: read both.
-- `kind` is who asked (forecast, geocoding, outlook, summit, nowcast, route, heights, planner, shadow);
-- rows from before the split (2026-11-10), and requests counted by code that names no kind, are
-- 'unsplit'. The free tier allows 10,000 calls a day per IP; the error log gets an entry at 70 % and
-- 90 % of that over all kinds (scope open-meteo.quota). Rows are kept 90 days (cleanup job). Row level
-- security on, no policies, no grants for the public API roles. Safe to run more than once, also on a
-- database that has the table without `kind`.
begin;

create table if not exists public.open_meteo_calls (
  day date not null,
  hour smallint not null check (hour between 0 and 23),
  kind text not null default 'unsplit',
  requests integer not null default 0,
  calls numeric(12,2) not null default 0,
  primary key (day, hour, kind)
);
alter table public.open_meteo_calls
  add column if not exists kind text not null default 'unsplit';

-- the key was (day, hour); it becomes (day, hour, kind)
do $$ begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.open_meteo_calls'::regclass and contype = 'p' and array_length(conkey, 1) = 2
  ) then
    alter table public.open_meteo_calls drop constraint open_meteo_calls_pkey;
    alter table public.open_meteo_calls add primary key (day, hour, kind);
  end if;
end $$;

-- one request more in its hour and kind; answers the day's total over all kinds (the quota alert reads it)
drop function if exists public.bump_open_meteo_calls(date, integer, numeric);
create or replace function public.bump_open_meteo_calls(p_day date, p_hour integer, p_calls numeric, p_kind text default 'unsplit')
returns numeric
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.open_meteo_calls (day, hour, kind, requests, calls)
  values (p_day, p_hour, left(coalesce(nullif(p_kind, ''), 'unsplit'), 24), 1, p_calls)
  on conflict (day, hour, kind) do update
    set requests = public.open_meteo_calls.requests + 1,
        calls = public.open_meteo_calls.calls + excluded.calls;
  select coalesce(sum(calls), 0) from public.open_meteo_calls where day = p_day;
$$;

alter table public.open_meteo_calls enable row level security;
revoke all on public.open_meteo_calls from anon, authenticated;
grant select, insert, update, delete on public.open_meteo_calls to service_role;
revoke execute on function public.bump_open_meteo_calls(date, integer, numeric, text) from public, anon, authenticated;
grant execute on function public.bump_open_meteo_calls(date, integer, numeric, text) to service_role;

commit;

notify pgrst, 'reload schema';

-- ═══ geocode-cache.sql ═════════════════════════════════════════════════════
-- The city geocoder's two helpers (lib/geocode.js): town_lookup answers a city name from our towns
-- (GeoNames places of 5,000 and more, lib/places) by any of their names, the most populous first;
-- geocode_cache keeps Open-Meteo's geocoding answers for 30 days: the result list for a name our towns
-- lack (villages, misspellings, an empty list too) and the English name of a place by its GeoNames id.
-- Together a city search no longer needs Open-Meteo (the quota card of 2026-11-09); every ask that still
-- goes upstream is logged (error_log, scope geocode.upstream). Rows older than 30 days go with the
-- cleanup job. Row level security on, no policies, no grants for the public API roles, like every other
-- table. Safe to run more than once.
create index if not exists towns_names_idx on public.towns using gin (string_to_array(search, ' | '));

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

-- ═══ town-near.sql ═════════════════════════════════════════════════════════
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

-- ═══ place-climate.sql ═════════════════════════════════════════════════════
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

-- ═══ route-heights.sql ═════════════════════════════════════════════════════
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

-- ═══ last-answers.sql ══════════════════════════════════════════════════════
-- last_answers keeps the last good answer per place (lib/last-answer.js), for the hours our own
-- Open-Meteo server gives nothing and the public service may not be asked: the 7-day outlook and a
-- summit's forecast are served up to 24 hours old, the rain forecast up to 1 hour, each with its time.
-- Since 2026-11-13 the forecast's blend ("right now") is kept too, kind forecast: served up to 2 hours
-- old when every Open-Meteo source of a build failed, instead of a blend of the few other sources.
-- Written when a route builds a good answer (only requests the CDN could not answer reach a route),
-- read only when a build fails.
-- place is the answer's own key and holds no text a visitor typed: the town's or the peak's rounded
-- coordinates (a summit: with its height and "core" for the summit pages' three-model copy).
-- body is the answer as JSON, gzip-compressed and base64-encoded (measured 2026-11-12: an outlook is
-- 26 KB as JSON and 4.6 KB kept, a summit forecast 35 KB and 6.5 KB, rain 0.7 KB and 0.2 KB; a blend,
-- measured 2026-11-13, 4.2 KB and 1.6 KB).
-- Since 2026-11-14 nobody can fill the table for the others (the rain and summit addresses take any
-- coordinates, so anyone could write 3,000 made-up places, after which no new place was kept for a day):
-- each kind has its own room, a full room no longer refuses a new place but gives up a place asked for
-- only once before one that visitors came back to (the function below), and the app lets one visitor
-- address add only a few new places an hour (lib/last-answer.js). The rooms hold 5,500 rows, about
-- 17 MB at the very most (production on 2026-11-14: 363 rows). Rows older than 24 hours go at the
-- nightly cleanup.
-- Run on dev, then on production (safe to run again).

create table if not exists public.last_answers (
  kind text not null check (kind in ('outlook', 'summit', 'rain', 'forecast')),
  place text not null,
  made_at timestamptz not null default now(),
  body text not null,
  primary key (kind, place)
);
-- a table made before 2026-11-13 knows three kinds: the rule is replaced by the one above
alter table public.last_answers drop constraint if exists last_answers_kind_check;
alter table public.last_answers add constraint last_answers_kind_check check (kind in ('outlook', 'summit', 'rain', 'forecast'));
-- since when the place has had a row without a break (a row that is there when this runs: since now)
alter table public.last_answers add column if not exists first_at timestamptz not null default now();
alter table public.last_answers enable row level security;
revoke all on public.last_answers from anon, authenticated;
grant select, insert, update, delete on public.last_answers to service_role;

-- Keeps a place's answer. True: a place that had no row got one (the app counts those per visitor
-- address); false: the place's row was renewed, or the caller was given no room for a new place.
-- A place already there is always renewed in place. A full room never refuses a new place: it pushes
-- one out, in this order:
--   1. an answer older than 24 hours (none is served that old),
--   2. a place asked for only once, the one asked longest ago first,
--   3. the place in use whose answer is oldest.
-- "In use": built again half an hour or more after it was first kept. A place visitors come back to
-- does that at its next build (no address is rebuilt sooner than its CDN copy lasts, 10 minutes to
-- 2 hours); a flood of made-up places never does, so it only ever pushes out its own places and
-- others asked for once. Each kind has its own room: a flood through the rain address (any
-- coordinates, one request each) cannot touch forecasts, outlooks or summits.
-- p_max: a smaller room for the kind. The app sends none, or 0 for a visitor address that has added
-- its share of new places this hour: then a place already there is still renewed and nothing new is
-- kept. The tests send small rooms. The app of before 2026-11-14 sends 3000, which is above every room.
create or replace function public.keep_last_answer(p_kind text, p_place text, p_body text, p_max integer default null)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  room integer := case p_kind when 'forecast' then 1500 when 'outlook' then 1500 when 'summit' then 1000 when 'rain' then 1500 end; -- another kind: the table's rule refuses it below
  n integer;
begin
  update public.last_answers set body = p_body, made_at = now() where kind = p_kind and place = p_place;
  if found then return false; end if;
  room := least(room, coalesce(p_max, room));
  if room <= 0 then return false; end if;
  select count(*) into n from public.last_answers where kind = p_kind;
  if n >= room then
    -- skip locked: two new places at the same moment push out two different rows
    delete from public.last_answers where (kind, place) in (
      select kind, place from public.last_answers where kind = p_kind
      order by (made_at >= now() - interval '24 hours'), (made_at - first_at >= interval '30 minutes'), made_at
      limit n - room + 1
      for update skip locked);
  end if;
  insert into public.last_answers (kind, place, body) values (p_kind, p_place, p_body)
    on conflict (kind, place) do update set body = excluded.body, made_at = now();
  return true;
end $$;
revoke execute on function public.keep_last_answer(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.keep_last_answer(text, text, text, integer) to service_role;

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

-- 3. Belt and braces: the anon and authenticated roles keep no table grants
--    at all (Supabase grants them on every new table by default). RLS already
--    denies them every row; this makes a table someone later reopens with
--    `disable row level security` still unreadable through the public key.
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
