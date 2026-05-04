-- Per-device Expo push tokens, used by the silent-push fan-out so the
-- stations cron can wake every installed device to refresh its on-device
-- snapshot. We don't link to auth.users — the app is anonymous-by-design.

create table if not exists public.device_tokens (
  token        text primary key,
  platform     text not null check (platform in ('ios', 'android', 'web')),
  last_seen    timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists device_tokens_last_seen_idx
  on public.device_tokens (last_seen desc);

-- RLS on, with a permissive insert/update policy from the anon role so the
-- mobile client can register itself without authenticating. Reads are
-- restricted to the service role only — the fan-out function reads via
-- service key, no client ever needs to list tokens.
alter table public.device_tokens enable row level security;

drop policy if exists "anon can upsert own token" on public.device_tokens;
create policy "anon can upsert own token"
  on public.device_tokens
  for insert
  to anon
  with check (true);

drop policy if exists "anon can refresh own token" on public.device_tokens;
create policy "anon can refresh own token"
  on public.device_tokens
  for update
  to anon
  using (true)
  with check (true);
