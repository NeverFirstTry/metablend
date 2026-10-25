-- Official warnings: the database downloads the MeteoAlarm country feeds
-- (19 MB every run — on Vercel that was the costliest job), trims each to
-- what the parser reads (warnings-trim.sql) and calls /api/warnings/refresh
-- only when a feed changed; Vercel then parses just those countries.
-- Needs warnings-trim.sql first. Safe to run more than once.
--
-- The `http` extension downloads synchronously and keeps nothing; pg_net
-- would park every response (Germany ~7 MB) in net._http_response for six
-- hours — enough to fill the free plan's 500 MB.
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

-- Download every feed; store the trimmed feed where it changed. A failing
-- feed (timeout, non-200, a maintenance page) keeps what we have. Returns how
-- many changed.
create or replace function public.refresh_warning_feeds()
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  f record;
  res extensions.http_response;
  feed jsonb;
  h text;
  changed integer := 0;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '30');
  for f in select country, slug, hash from public.warning_feeds order by country loop
    begin
      res := extensions.http_get('https://feeds.meteoalarm.org/api/v1/warnings/feeds-' || f.slug);
      update public.warning_feeds set checked_at = now(), last_status = res.status, last_error = null where country = f.country;
      if res.status <> 200 then continue; end if;
      h := md5(res.content);
      if h is not distinct from f.hash then continue; end if; -- unchanged: nothing to parse
      feed := res.content::jsonb;
      if jsonb_typeof(feed->'warnings') is distinct from 'array' then continue; end if;
      update public.warning_feeds
        set body = public.trim_warning_feed(feed, now() - interval '1 hour'), hash = h, fetched_at = now()
        where country = f.country;
      changed := changed + 1;
    exception when others then -- one bad feed never stops the others
      update public.warning_feeds set checked_at = now(), last_error = left(sqlerrm, 300) where country = f.country;
    end;
  end loop;
  return changed;
end $$;
revoke all on function public.refresh_warning_feeds() from public, anon, authenticated;

-- what Vercel still has to apply
create or replace view public.warning_feeds_pending with (security_invoker = true) as
  select country, body, hash from public.warning_feeds
  where body is not null and hash is distinct from processed_hash;
revoke all on public.warning_feeds_pending from anon, authenticated;
