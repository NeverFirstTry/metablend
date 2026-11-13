-- last_answers keeps the last good answer per place (lib/last-answer.js), for the hours our own
-- Open-Meteo server gives nothing and the public service may not be asked: the 7-day outlook and a
-- summit's forecast are served up to 24 hours old, the rain forecast up to 1 hour, each with its time.
-- Written when a route builds a good answer (only requests the CDN could not answer reach a route),
-- read only when a build fails.
-- place is the answer's own key and holds no text a visitor typed: the town's or the peak's rounded
-- coordinates (a summit: with its height and "core" for the summit pages' three-model copy).
-- body is the answer as JSON, gzip-compressed and base64-encoded (measured 2026-11-12: an outlook is
-- 26 KB as JSON and 4.6 KB kept, a summit forecast 35 KB and 6.5 KB, rain 0.7 KB and 0.2 KB).
-- At most 3,000 rows (about 20 MB at the very most; a normal day has under 1,000): a new place is not
-- kept while the table is full, a place already there is always renewed. Rows older than 24 hours go
-- when the table is full and at the nightly cleanup.
-- Run on dev, then on production (safe to run again).

create table if not exists public.last_answers (
  kind text not null check (kind in ('outlook', 'summit', 'rain')),
  place text not null,
  made_at timestamptz not null default now(),
  body text not null,
  primary key (kind, place)
);
alter table public.last_answers enable row level security;
revoke all on public.last_answers from anon, authenticated;
grant select, insert, update, delete on public.last_answers to service_role;

-- true when the answer was kept, false when the table is full of answers younger than 24 hours
create or replace function public.keep_last_answer(p_kind text, p_place text, p_body text, p_max integer default 3000)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.last_answers set body = p_body, made_at = now() where kind = p_kind and place = p_place;
  if found then return true; end if;
  if (select count(*) from public.last_answers) >= p_max then
    delete from public.last_answers where made_at < now() - interval '24 hours';
    if (select count(*) from public.last_answers) >= p_max then return false; end if;
  end if;
  insert into public.last_answers (kind, place, body) values (p_kind, p_place, p_body)
    on conflict (kind, place) do update set body = excluded.body, made_at = now();
  return true;
end $$;
revoke execute on function public.keep_last_answer(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.keep_last_answer(text, text, text, integer) to service_role;
