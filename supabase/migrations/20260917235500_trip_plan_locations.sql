-- 1.1: live trip tracking.
--
-- While a trip is active and the user has opted in, the app posts its
-- position so the people holding a share link can see where the party is and
-- which way they were heading. This is the feature that makes an iOS
-- "location" background mode legitimate again: build 32 was rejected under
-- Guideline 2.5.4 for declaring that mode with no feature behind it.
--
-- PRIVACY: this is the first time Whumpf stores a user's location anywhere.
-- It is strictly opt-in per trip, only collected while the trip is active,
-- visible only to contacts holding that plan's share_token, and it dies with
-- the plan (ON DELETE CASCADE + the existing purge_after sweeper). The App
-- Privacy answers and the privacy policy must say so before this ships.

alter table public.trip_plans
  add column if not exists tracking_enabled boolean not null default false;

create table if not exists public.trip_plan_locations (
  id          bigserial primary key,
  plan_id     uuid not null references public.trip_plans(id) on delete cascade,
  at          timestamptz not null,
  lat         double precision not null,
  lng         double precision not null,
  accuracy_m  real,
  created_at  timestamptz not null default now()
);

-- The packet page reads "newest first for this plan"; the trail cap deletes
-- "oldest for this plan". Both are served by this index.
create index if not exists trip_plan_locations_plan_at_idx
  on public.trip_plan_locations (plan_id, at desc);

-- Same lockdown as device_tokens: RLS on with no policies and no grants, so
-- neither anon nor authenticated can read or write. The trip-plans edge
-- function is the only writer and trip-plan-page the only reader, both via
-- their service-role client. A share_token grants visibility through the
-- page, never through PostgREST.
alter table public.trip_plan_locations enable row level security;
revoke all on public.trip_plan_locations from anon, authenticated;
revoke all on sequence public.trip_plan_locations_id_seq from anon, authenticated;

-- Trail cap. Deletes the OLDEST points beyond p_keep for one plan.
--
-- Dropping oldest (rather than thinning the middle) is safe here because the
-- cap is generous relative to a real trip: at the client's ~10 minute
-- cadence, 1000 points is about a week of continuous travel, so for any
-- normal trip the cap never binds and the full trail is kept. It exists to
-- bound a pathological case (a trip left open for weeks), not to routinely
-- discard history.
create or replace function public.trim_trip_plan_locations(
  p_plan_id uuid,
  p_keep    integer default 1000
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.trip_plan_locations
   where plan_id = p_plan_id
     and id not in (
       select id from public.trip_plan_locations
        where plan_id = p_plan_id
        order by at desc
        limit greatest(p_keep, 1)
     );
$$;

revoke all on function public.trim_trip_plan_locations(uuid, integer) from public;
