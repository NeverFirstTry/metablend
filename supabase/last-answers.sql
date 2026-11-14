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
