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
