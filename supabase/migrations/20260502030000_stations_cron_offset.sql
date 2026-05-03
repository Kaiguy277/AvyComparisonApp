-- Shift the stations cache cron from :15 to :45 of each hour.
--
-- Why: SNOTEL / RAWS stations typically transmit on the hour (e.g. 13:00 UTC)
-- and Synoptic's ingestion adds a few minutes of latency. A :15 cron was
-- missing the freshest reading every hour — observations would land in
-- Synoptic at ~13:05–13:20 UTC, just after the cron had already snapshotted
-- 12:00-era data. Shifting to :45 gives a comfortable 45-minute buffer for
-- propagation, so a 13:45 cron run reliably picks up the 13:00 observations.

do $$
declare
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmdnhoc2d3cnd2ZW5kcm5icmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzEwMDAsImV4cCI6MjA5MzI0NzAwMH0._BJZScuuEF0w-5eebiCGryCI0RL5jg0kZ6EyZRgaUOI';
  base_url text := 'https://tfvxhsgwrwvendrnbrgf.supabase.co/functions/v1';
begin
  perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'avy-refresh-stations-cache';

  perform cron.schedule(
    'avy-refresh-stations-cache',
    '45 * * * *',  -- 45 min past every hour — gives stations time to propagate
    format($f$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object('Authorization', 'Bearer ' || %L),
        timeout_milliseconds := 120000
      );
    $f$, base_url || '/refresh-stations-cache', anon_key)
  );
end $$;
