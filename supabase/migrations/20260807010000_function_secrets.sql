-- Shared-secret store for gating the publicly-invokable maintenance
-- functions (refresh-forecast-cache, refresh-stations-cache,
-- refresh-observations-cache, send-snapshot-pushes).
--
-- These functions run with verify_jwt on, but the only JWT the app
-- carries is the anon key baked into the bundle — so the JWT check
-- alone lets anyone invoke them (upstream quota burn, push spam). We
-- add a second factor: an x-cron-key header the caller must present,
-- compared against the secret stored here.
--
-- The table lives in `public` (not a private schema) because the edge
-- functions read it through PostgREST via their service-role client,
-- and PostgREST only exposes `public`. It is locked down instead: RLS
-- on with no policies, and all privileges revoked from anon/
-- authenticated. Reading a row requires BOTH a table grant and a
-- passing RLS policy — anon has neither. service_role bypasses RLS and
-- keeps its default privileges, so the functions (and pg_cron, which
-- runs as superuser) can read it while the public anon key cannot.
--
-- The row VALUE is inserted out-of-band (not in this tracked migration)
-- so the secret never lands in git. See LOG.md 2026-08-07.

create table if not exists public.function_secrets (
  name       text primary key,
  value      text not null,
  created_at timestamptz not null default now()
);

alter table public.function_secrets enable row level security;
revoke all on public.function_secrets from anon, authenticated;
