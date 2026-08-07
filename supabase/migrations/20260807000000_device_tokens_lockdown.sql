-- Lock down device_tokens: 20260504's "anon select"/"anon update"
-- policies made every install's Expo push token world-readable and
-- world-writable with the anon key that ships in the app bundle.
-- Expo's push endpoint accepts unauthenticated sends, so readable
-- tokens = anyone can push arbitrary notifications to every device of
-- an avalanche-safety app. Writable = anyone can corrupt every row.
--
-- New posture:
--   * anon INSERT only. The client registers with ON CONFLICT DO
--     NOTHING (ignoreDuplicates) — re-registering an existing token is
--     a no-op, so no UPDATE arm is needed. last_seen no longer
--     refreshes; dead tokens are pruned by the fan-out's
--     DeviceNotRegistered handling, which is the mechanism that
--     actually works.
--   * Reads/updates/deletes: service role only (fan-out + pruning),
--     which bypasses RLS.

drop policy if exists "anon select" on public.device_tokens;
drop policy if exists "anon update" on public.device_tokens;

revoke select, update on public.device_tokens from anon;
revoke select, update on public.device_tokens from authenticated;

-- Keep: create policy "anon insert" (insert-only registration path).
-- Explicit grant retained from 20260504 for insert; re-assert so this
-- migration is self-contained if 20260504 is ever squashed away.
grant insert on public.device_tokens to anon;
grant insert on public.device_tokens to authenticated;
