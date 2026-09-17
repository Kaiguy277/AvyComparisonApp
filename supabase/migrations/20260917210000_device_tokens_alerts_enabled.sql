-- 1.1: decouple push-token registration from notification (alert) permission.
--
-- Background: lib/pushNotifications.ts used to return before minting a token
-- whenever alert permission wasn't granted, so a user who declined
-- notifications also lost SILENT-push background refresh. iOS does not
-- require that — registerForRemoteNotifications() returns a device token
-- without authorization (expo-notifications' PushTokenModule.swift calls it
-- with no permission check); you simply can't DISPLAY anything. The gate was
-- ours, not the platform's.
--
-- The client now always registers, and reports whether alerts are permitted
-- so the fan-out can target correctly:
--   * silent refresh pushes  -> every token
--   * visible forecast alerts -> only alerts_enabled = true
--
-- Existing rows default to true: under the old code a token could only exist
-- if permission had been granted, so that is accurate, not an assumption.

alter table public.device_tokens
  add column if not exists alerts_enabled boolean not null default true;

-- Partial index for the daily forecast-alert fan-out, which only ever wants
-- the alerts-enabled subset.
create index if not exists device_tokens_alerts_enabled_idx
  on public.device_tokens (last_seen desc)
  where alerts_enabled;

-- New 3-arg overload. Deliberately declared WITHOUT a default for
-- p_alerts_enabled: a default would make a 2-arg call ambiguous against the
-- existing 2-arg function and PostgREST would error instead of choosing.
create or replace function public.register_device_token(
  p_token          text,
  p_platform       text,
  p_alerts_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or length(p_token) < 10 or length(p_token) > 300 then
    raise exception 'invalid token';
  end if;
  if p_platform is null or p_platform not in ('ios', 'android') then
    raise exception 'invalid platform';
  end if;

  insert into public.device_tokens (token, platform, last_seen, alerts_enabled)
  values (p_token, p_platform, now(), coalesce(p_alerts_enabled, false))
  on conflict (token) do update
    set last_seen      = now(),
        platform       = excluded.platform,
        alerts_enabled = excluded.alerts_enabled;
end;
$$;

-- The existing 2-arg function stays for clients already in the wild (1.0 /
-- build 33). Those only ever called it after permission was granted, so
-- alerts_enabled = true is the correct meaning of a 2-arg call. Do NOT drop
-- it — an installed 1.0 that loses this function silently stops refreshing.
create or replace function public.register_device_token(
  p_token    text,
  p_platform text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.register_device_token(p_token, p_platform, true);
end;
$$;

revoke all on function public.register_device_token(text, text, boolean) from public;
grant execute on function public.register_device_token(text, text, boolean) to anon, authenticated;

-- Re-assert the 2-arg grants; create or replace resets them.
revoke all on function public.register_device_token(text, text) from public;
grant execute on function public.register_device_token(text, text) to anon, authenticated;
