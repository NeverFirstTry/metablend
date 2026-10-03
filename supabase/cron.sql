-- Hourly station calibration, fired from the database.
--
-- Vercel's sub-daily crons need a Pro plan, and GitHub Actions' "hourly"
-- schedule only ran every 6-8 hours in practice, so pg_cron calls the endpoint
-- through pg_net instead. Applied live as migration hourly_station_calibrate_cron.
--
-- Before running: add a Vault secret named calibrate_secret with the same value
-- as CALIBRATE_SECRET in the Vercel env (Project Settings -> Vault). The job
-- reads it at run time, so the key never appears in cron.job.
--
-- Idempotent: cron.schedule upserts by job name.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'station-calibrate-hourly',
  '17 * * * *',
  $job$
  select net.http_get(
    url := 'https://metablend.app/api/station-calibrate',
    headers := jsonb_build_object(
      'x-calibrate-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'calibrate_secret')
    ),
    -- generous: an early disconnect could cancel the function mid-scoring
    timeout_milliseconds := 300000
  );
  $job$
);

-- pg_cron never prunes its own run log; keep a week of it.
select cron.schedule(
  'cron-history-prune',
  '43 3 * * *',
  $job$ delete from cron.job_run_details where end_time < now() - interval '7 days' $job$
);

-- Checking on it:
--   select start_time, status, return_message from cron.job_run_details
--   order by start_time desc limit 10;
--   select created, status_code, left(content, 200) from net._http_response
--   order by created desc limit 10;

-- Push notifications: weather alerts, briefings and hike alerts, hourly at :05.
-- Same Vault secret as the station calibration.
select cron.schedule(
  'push-dispatch-hourly',
  '5 * * * *',
  $job$
  select net.http_get(
    url := 'https://metablend.app/api/push/dispatch',
    headers := jsonb_build_object(
      'x-calibrate-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'calibrate_secret')
    ),
    timeout_milliseconds := 300000
  );
  $job$
);

-- Rain in the next 2 hours: the "Rain soon" alert from the 15-minute
-- nowcast, every quarter hour (the hourly job above covers everything else).
select cron.schedule(
  'push-dispatch-nowcast',
  '2,17,32,47 * * * *',
  $job$
  select net.http_get(
    url := 'https://metablend.app/api/push/dispatch?only=rain',
    headers := jsonb_build_object(
      'x-calibrate-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'calibrate_secret')
    ),
    timeout_milliseconds := 120000
  );
  $job$
);
