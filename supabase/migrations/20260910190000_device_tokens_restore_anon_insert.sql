-- Push registration was failing on device with
--   "permission denied for table device_tokens"
-- The 2026-08-07 lockdown revoked select/update from anon and kept the
-- "anon insert" RLS policy, but the table-level INSERT grant was gone, so
-- the policy never got evaluated. RLS needs BOTH a grant and a passing
-- policy; restoring the grant is what the lockdown intended.
grant insert on public.device_tokens to anon, authenticated;

-- Re-assert the rest of the posture so this migration is self-contained.
revoke select, update, delete on public.device_tokens from anon, authenticated;
