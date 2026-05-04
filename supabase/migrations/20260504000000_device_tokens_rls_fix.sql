-- The original 20260503 device_tokens migration created RLS policies
-- but the anon role still hits "new row violates row-level security
-- policy" when the mobile client tries to upsert its push token.
-- Re-establish the policies idempotently and ensure table grants
-- include INSERT + UPDATE for anon (Supabase's default grants don't
-- always cover anon on user-created tables created via migrations).

-- Make sure RLS is on.
alter table public.device_tokens enable row level security;

-- Drop and recreate policies in case the prior CREATE silently
-- registered something that didn't take.
drop policy if exists "anon can upsert own token"   on public.device_tokens;
drop policy if exists "anon can refresh own token"  on public.device_tokens;
drop policy if exists "anon insert"                 on public.device_tokens;
drop policy if exists "anon update"                 on public.device_tokens;
drop policy if exists "anon select"                 on public.device_tokens;

-- Anon needs INSERT (initial registration), UPDATE (last_seen refresh),
-- and SELECT (so supabase-js's upsert can return the row, and so the
-- client can detect duplicate-token-with-different-platform cases if
-- needed). Reads are unrestricted but the public.device_tokens table
-- only contains opaque Expo push tokens — no PII.
create policy "anon insert" on public.device_tokens
  for insert to anon with check (true);

create policy "anon update" on public.device_tokens
  for update to anon using (true) with check (true);

create policy "anon select" on public.device_tokens
  for select to anon using (true);

-- Belt-and-suspenders: explicit grants. RLS only kicks in once the
-- role has the underlying privilege. Without these grants, even a
-- permissive policy gets short-circuited at the privilege check.
grant select, insert, update on public.device_tokens to anon;
grant select, insert, update on public.device_tokens to authenticated;
