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
