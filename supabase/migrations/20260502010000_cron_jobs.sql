-- Schedule the two cache refresh crons.
-- Forecast cache: every 2 hours (forecasts update 1–2× per day)
-- Stations cache: every hour (Synoptic / NWS update hourly)
--
-- pg_net.http_post is async; the cron job kicks off the request and the
-- edge function does the actual work.

-- The edge function calls require the project's anon key as the bearer
-- token (the Supabase function gateway accepts anon, authenticated, or
-- service_role JWTs — anon is enough to invoke, the function uses its
-- own internal service-role secret for DB writes).
-- Replace with your project's anon key on first run; rotation just needs
-- another `select cron.unschedule` + re-schedule.
do $$
declare
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmdnhoc2d3cnd2ZW5kcm5icmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzEwMDAsImV4cCI6MjA5MzI0NzAwMH0._BJZScuuEF0w-5eebiCGryCI0RL5jg0kZ6EyZRgaUOI';
  base_url text := 'https://tfvxhsgwrwvendrnbrgf.supabase.co/functions/v1';
begin
  -- Drop existing schedules so this migration is idempotent.
  perform cron.unschedule(jobid)
    from cron.job
    where jobname in ('avy-refresh-forecast-cache', 'avy-refresh-stations-cache');

  perform cron.schedule(
    'avy-refresh-forecast-cache',
    '0 */2 * * *',  -- top of every 2nd hour
    format($f$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object('Authorization', 'Bearer ' || %L),
        timeout_milliseconds := 240000
      );
    $f$, base_url || '/refresh-forecast-cache', anon_key)
  );

  perform cron.schedule(
    'avy-refresh-stations-cache',
    '15 * * * *',  -- 15 min past every hour (offset from forecast cron)
    format($f$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object('Authorization', 'Bearer ' || %L),
        timeout_milliseconds := 120000
      );
    $f$, base_url || '/refresh-stations-cache', anon_key)
  );
end $$;
