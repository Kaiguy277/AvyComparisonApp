-- Schedule the observations cache refresh.
--
-- Once per day is plenty: NAC observations are immutable once
-- published, and field obs trickle in over hours/days rather than
-- needing minute-level freshness. Running at 06:00 UTC (~22:00
-- Alaska, 23:00 Pacific) catches everything from the previous day
-- after observers finish writing up their tours.

do $$
declare
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmdnhoc2d3cnd2ZW5kcm5icmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzEwMDAsImV4cCI6MjA5MzI0NzAwMH0._BJZScuuEF0w-5eebiCGryCI0RL5jg0kZ6EyZRgaUOI';
  base_url text := 'https://tfvxhsgwrwvendrnbrgf.supabase.co/functions/v1';
begin
  perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'avy-refresh-observations-cache';

  perform cron.schedule(
    'avy-refresh-observations-cache',
    '0 6 * * *',  -- 06:00 UTC daily
    format($f$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object('Authorization', 'Bearer ' || %L),
        timeout_milliseconds := 240000
      );
    $f$, base_url || '/refresh-observations-cache', anon_key)
  );
end $$;
