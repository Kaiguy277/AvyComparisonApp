-- 1.1: per-device favourite zones, so the daily forecast alert can name the
-- user's zones and today's danger rating instead of a generic "forecasts are
-- posted" nudge.
--
-- Favourites have always lived only in the app's AsyncStorage
-- (lib/offlineCache.ts loadFavorites) and were never sent anywhere. This is a
-- deliberate, reviewed change to that: the server now stores
--   push token -> [zone ids]
-- against an anonymous token with no account, name or device id beyond the
-- token itself. It is still not linked to identity, but it IS new collected
-- data and the App Privacy answers must be updated before this ships.

alter table public.device_tokens
  add column if not exists zones text[] not null default '{}',
  -- Dedupe guard: at most one forecast alert per device per day, so a retried
  -- or double-scheduled cron can't fire twice.
  add column if not exists last_alert_date date;

-- Lightweight zone sync. Separate from register_device_token because
-- favourites change far more often than registration does, and re-running
-- registration would mean a round trip to Expo's token service on every
-- star tap.
create or replace function public.set_device_zones(
  p_token text,
  p_zones text[]
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
  -- Bound the array so this can't be used to stuff arbitrary data. Zone ids
  -- are short slugs ("turnagain-girdwood").
  if p_zones is not null and (
       array_length(p_zones, 1) > 100
       or exists (select 1 from unnest(p_zones) z where length(z) > 80)
     ) then
    raise exception 'invalid zones';
  end if;

  -- Only touches an EXISTING row: registration owns row creation. A no-op
  -- here simply means the device hasn't registered a token yet.
  update public.device_tokens
     set zones     = coalesce(p_zones, '{}'),
         last_seen = now()
   where token = p_token;
end;
$$;

revoke all on function public.set_device_zones(text, text[]) from public;
grant execute on function public.set_device_zones(text, text[]) to anon, authenticated;
