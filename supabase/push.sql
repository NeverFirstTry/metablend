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
