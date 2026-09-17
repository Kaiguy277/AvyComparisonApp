-- Schedule the daily user-visible forecast alert (send-forecast-alerts).
--
-- Two passes, an hour apart. The function only alerts on zones that have
-- TODAY's forecast cached — a center that hasn't published yet is skipped
-- rather than alerted with yesterday's danger rating — and
-- device_tokens.last_alert_date dedupes per device per day. So the second
-- pass is a safe retry that picks up late-publishing centers without
-- double-notifying anyone who was already reached.
--
-- Timing: 16:00 UTC is 07:00 AKST (avalanche season is winter, UTC-9);
-- 17:00 UTC is 08:00 AKST. Most centers publish by 07:00 local. NOTE this
-- is fixed UTC, so during AKDT (UTC-8) it lands an hour later, at 08:00/
-- 09:00 local. Acceptable for now; revisit if the app expands to centers
-- whose local mornings differ sharply from Alaska's.
--
-- Same secret pattern as the refresh and trip-plan jobs: the shared key is
-- read from function_secrets inside the DO block so it never enters SQL
-- text or git.

do $$
declare
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmdnhoc2d3cnd2ZW5kcm5icmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzEwMDAsImV4cCI6MjA5MzI0NzAwMH0._BJZScuuEF0w-5eebiCGryCI0RL5jg0kZ6EyZRgaUOI';
  base_url text := 'https://tfvxhsgwrwvendrnbrgf.supabase.co/functions/v1';
  cron_key text;
begin
  select value into cron_key from public.function_secrets where name = 'cron_shared_secret';
  if cron_key is null then
    raise notice 'function_secrets.cron_shared_secret missing — forecast-alert cron NOT scheduled';
    return;
  end if;

  perform cron.unschedule(jobid)
    from cron.job
    where jobname in ('avy-forecast-alerts-early', 'avy-forecast-alerts-late');

  perform cron.schedule(
    'avy-forecast-alerts-early',
    '0 16 * * *',
    format($f$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L,
          'x-cron-key', %L),
        timeout_milliseconds := 120000
      );
    $f$, base_url || '/send-forecast-alerts', anon_key, cron_key)
  );

  perform cron.schedule(
    'avy-forecast-alerts-late',
    '0 17 * * *',
    format($f$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L,
          'x-cron-key', %L),
        timeout_milliseconds := 120000
      );
    $f$, base_url || '/send-forecast-alerts', anon_key, cron_key)
  );
end $$;
