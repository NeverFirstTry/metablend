-- One weight lesson per city per window, checked and recorded in one step
-- (app/api/feedback/route.js). Until 2026-11-01 the route read "when did this
-- city last learn" and marked it only after updating the weights, so a burst
-- of reports sent at the same moment all passed and all moved the weights.
-- The row lock queues callers for the same city; only the first in a window
-- gets true. RLS on, no grants for the public API roles: only the API
-- (service-role key) calls it. Safe to run more than once.

create table if not exists public.feedback_lessons (
  city text primary key,
  learned_at timestamptz not null default now()
);

-- The app passes the window (lib/feedback.js), so it can change without new SQL.
create or replace function public.claim_feedback_lesson(p_city text, window_ms integer)
returns boolean
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into feedback_lessons as l (city, learned_at) values (p_city, now())
  on conflict (city) do update set learned_at = excluded.learned_at
   where l.learned_at <= now() - make_interval(secs => window_ms / 1000.0);
  return found;
end
$$;

alter table public.feedback_lessons enable row level security;
revoke all on public.feedback_lessons from anon, authenticated;
grant select, insert, update on public.feedback_lessons to service_role;
revoke execute on function public.claim_feedback_lesson(text, integer) from public, anon, authenticated;
grant execute on function public.claim_feedback_lesson(text, integer) to service_role;
