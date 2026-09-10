-- Trip Plan ("tell a loved one") — see docs/specs/2026-09-09-spec-trip-plan.md
--
-- Posture: every table here is service-role only. RLS on, no policies,
-- all privileges revoked from anon/authenticated. The edge functions
-- (trip-plans, trip-plan-page, trip-plan-sweeper) are the only readers
-- and writers, and they authorize with per-plan secrets / per-contact
-- share tokens (hashes only stored here) or the cron shared secret.

create table if not exists public.trip_plans (
  id                 uuid primary key,
  status             text not null check (status in ('active','overdue','closed')),
  close_reason       text check (close_reason in
                       ('checked_in','cancelled_by_user','contact_heard_from','search_started','expired')),
  owner_user_id      uuid,
  owner_device_id    text not null,
  plan_secret_hash   text not null,
  timezone           text not null default 'America/Anchorage',
  depart_at          timestamptz not null,
  return_by          timestamptz not null,
  worry_by           timestamptz not null,
  worry_by_original  timestamptz not null,
  packet             jsonb not null,
  nudge_1_sent_at    timestamptz,
  nudge_2_sent_at    timestamptz,
  created_at         timestamptz not null default now(),
  closed_at          timestamptz,
  purge_after        timestamptz,
  constraint trip_plans_times check (depart_at < return_by and return_by <= worry_by)
);

create index if not exists trip_plans_sweep_idx
  on public.trip_plans (worry_by) where status in ('active','overdue');
create index if not exists trip_plans_purge_idx
  on public.trip_plans (purge_after) where purge_after is not null;
create index if not exists trip_plans_owner_open_idx
  on public.trip_plans (owner_device_id) where status in ('active','overdue');

create table if not exists public.trip_plan_contacts (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid not null references public.trip_plans(id) on delete cascade,
  client_id         text not null,
  display_name      text not null,
  phone_e164        text,
  email             text,
  -- Raw share token. This table is service-role-only (no anon/authenticated
  -- grants, RLS on with no policies) and already holds the packet, so the
  -- token is at the same trust level. Storing it raw lets the server put
  -- the contact's link in nudge emails without re-minting links.
  share_token       text not null unique,
  app_device_id     text,
  last_opened_at    timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists trip_plan_contacts_plan_idx on public.trip_plan_contacts (plan_id);

create table if not exists public.trip_plan_events (
  id          bigserial primary key,
  plan_id     uuid not null references public.trip_plans(id) on delete cascade,
  type        text not null,
  actor       text not null check (actor in ('user','contact','system')),
  contact_id  uuid references public.trip_plan_contacts(id) on delete set null,
  payload     jsonb not null default '{}'::jsonb,
  at          timestamptz not null default now()
);
create index if not exists trip_plan_events_plan_idx on public.trip_plan_events (plan_id, at);
-- Failed notifications the sweeper retries.
create index if not exists trip_plan_events_retry_idx
  on public.trip_plan_events ((payload->>'next_attempt_at'))
  where type = 'nudge_failed';

-- Per-IP rate limiting for the public actions.
create table if not exists public.trip_plan_rate_limits (
  bucket      text primary key,   -- '<scope>:<ip>:<window-start-epoch>'
  count       integer not null default 0,
  expires_at  timestamptz not null
);
create index if not exists trip_plan_rate_limits_exp_idx on public.trip_plan_rate_limits (expires_at);

alter table public.trip_plans            enable row level security;
alter table public.trip_plan_contacts    enable row level security;
alter table public.trip_plan_events      enable row level security;
alter table public.trip_plan_rate_limits enable row level security;

revoke all on public.trip_plans            from anon, authenticated;
revoke all on public.trip_plan_contacts    from anon, authenticated;
revoke all on public.trip_plan_events      from anon, authenticated;
revoke all on public.trip_plan_rate_limits from anon, authenticated;
revoke all on sequence public.trip_plan_events_id_seq from anon, authenticated;

-- Atomic rate-limit bump; returns the new count for the bucket.
create or replace function public.trip_plan_rate_bump(p_bucket text, p_ttl interval)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.trip_plan_rate_limits (bucket, count, expires_at)
  values (p_bucket, 1, now() + p_ttl)
  on conflict (bucket) do update set count = trip_plan_rate_limits.count + 1
  returning count;
$$;
revoke all on function public.trip_plan_rate_bump(text, interval) from public, anon, authenticated;

-- ── cron ──────────────────────────────────────────────────────────────────
-- Sweep every 5 minutes; purge daily. Both call trip-plan-sweeper with the
-- cron shared secret pulled from function_secrets inside this DO block so
-- the value never enters SQL text (same pattern as the refresh jobs).
do $$
declare
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmdnhoc2d3cnd2ZW5kcm5icmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzEwMDAsImV4cCI6MjA5MzI0NzAwMH0._BJZScuuEF0w-5eebiCGryCI0RL5jg0kZ6EyZRgaUOI';
  base_url text := 'https://tfvxhsgwrwvendrnbrgf.supabase.co/functions/v1';
  cron_key text;
begin
  select value into cron_key from public.function_secrets where name = 'cron_shared_secret';
  if cron_key is null then
    raise notice 'function_secrets.cron_shared_secret missing — trip-plan cron NOT scheduled';
    return;
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname in ('avy-trip-plan-sweep','avy-trip-plan-purge');

  perform cron.schedule(
    'avy-trip-plan-sweep',
    '*/5 * * * *',
    format($f$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L,
          'x-cron-key', %L),
        body := '{"action":"sweep"}'::jsonb,
        timeout_milliseconds := 60000
      );
    $f$, base_url || '/trip-plan-sweeper', anon_key, cron_key)
  );

  perform cron.schedule(
    'avy-trip-plan-purge',
    '15 9 * * *',
    format($f$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L,
          'x-cron-key', %L),
        body := '{"action":"purge"}'::jsonb,
        timeout_milliseconds := 60000
      );
    $f$, base_url || '/trip-plan-sweeper', anon_key, cron_key)
  );
end $$;
