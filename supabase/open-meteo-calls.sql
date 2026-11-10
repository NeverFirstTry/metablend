-- Our own count of requests to Open-Meteo (lib/open-meteo.js), per UTC day and hour: how many HTTP
-- requests we made and how many "API calls" they are the way Open-Meteo counts them. Their page: one
-- call per request; more than 10 weather variables or more than two weeks for one location count
-- fractionally (15 variables over 2 weeks = 1.5 calls, over 4 weeks = 3.0). Several locations in one
-- request and several models are not covered by their page; here every location, and every model's
-- set of variables, counts as its own (the conservative reading). The free tier allows 10,000 calls a
-- day per IP; the error log gets an entry at 70 % and 90 % of that (scope open-meteo.quota). Rows are
-- kept 90 days (cleanup job). Row level security on, no policies, no grants for the public API roles.
-- Safe to run more than once.
create table if not exists public.open_meteo_calls (
  day date not null,
  hour smallint not null check (hour between 0 and 23),
  requests integer not null default 0,
  calls numeric(12,2) not null default 0,
  primary key (day, hour)
);
-- one request more in its hour; answers the day's total so the caller can raise the alert
create or replace function public.bump_open_meteo_calls(p_day date, p_hour integer, p_calls numeric)
returns numeric
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.open_meteo_calls (day, hour, requests, calls) values (p_day, p_hour, 1, p_calls)
  on conflict (day, hour) do update set requests = public.open_meteo_calls.requests + 1, calls = public.open_meteo_calls.calls + excluded.calls;
  select coalesce(sum(calls), 0) from public.open_meteo_calls where day = p_day;
$$;
alter table public.open_meteo_calls enable row level security;
revoke all on public.open_meteo_calls from anon, authenticated;
grant select, insert, update, delete on public.open_meteo_calls to service_role;
revoke execute on function public.bump_open_meteo_calls(date, integer, numeric) from public, anon, authenticated;
grant execute on function public.bump_open_meteo_calls(date, integer, numeric) to service_role;
