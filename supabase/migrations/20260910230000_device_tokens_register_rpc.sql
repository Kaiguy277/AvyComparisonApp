-- Push registration had been failing since the 2026-08-07 lockdown with
-- "permission denied for table device_tokens" (visible in the app's own
-- diagnostic banner on TestFlight builds). Restoring the INSERT grant is
-- not enough: PostgREST needs SELECT on the table to resolve an upsert's
-- ON CONFLICT target, and SELECT is exactly what the lockdown removed —
-- tokens were world-readable, which let anyone push to every device.
--
-- Fix: keep the table completely closed to anon and expose one
-- SECURITY DEFINER function instead. anon can register a token and can
-- still neither read nor enumerate them. This also brings back the
-- last_seen refresh the lockdown had to give up.

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
  -- Cheap shape check so the function can't be used to stuff junk rows.
  if p_token is null or length(p_token) < 10 or length(p_token) > 300 then
    raise exception 'invalid token';
  end if;
  if p_platform is null or p_platform not in ('ios', 'android') then
    raise exception 'invalid platform';
  end if;

  insert into public.device_tokens (token, platform, last_seen)
  values (p_token, p_platform, now())
  on conflict (token) do update
    set last_seen = now(),
        platform  = excluded.platform;
end;
$$;

revoke all on function public.register_device_token(text, text) from public;
grant execute on function public.register_device_token(text, text) to anon, authenticated;

-- The table itself goes back to service-role only: the RPC is the only
-- write path, and there is no read path for anon at all.
revoke insert, select, update, delete on public.device_tokens from anon, authenticated;
