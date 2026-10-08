-- Official weather warnings (spec 2026-10-08): MeteoAlarm country feeds,
-- refreshed every 15 minutes by /api/warnings/refresh. RLS on, no policies:
-- only the API (service-role key) reads and writes.
create table if not exists public.warnings (
  id text primary key,
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
alter table public.warnings enable row level security;
