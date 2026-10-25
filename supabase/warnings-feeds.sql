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
begin
  -- both: the extension's own timeout setting and curl's
  perform set_config('http.timeout_msec', '15000', true);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '15');
  perform extensions.http_set_curlopt('CURLOPT_USERAGENT', 'MetaBlend/1.0 github.com/NeverFirstTry/metablend');
  for f in select country, slug, hash from public.warning_feeds order by checked_at nulls first, country loop
    status := null;
    begin
      res := extensions.http_get('https://feeds.meteoalarm.org/api/v1/warnings/feeds-' || f.slug);
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
