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
