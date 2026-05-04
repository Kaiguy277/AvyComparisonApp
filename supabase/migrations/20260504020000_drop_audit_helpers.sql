-- Drop the diagnostic audit helpers added in 20260504010000.
-- They were used to debug why silent push delivery wasn't reaching
-- the device (turned out to be a missing UIBackgroundModes entry +
-- RLS policy gaps). Now that the pipeline's verified end-to-end and
-- the audit edge function is removed, these helpers aren't called
-- by anything in the codebase.

drop function if exists public.audit_pipeline_jobs();
drop function if exists public.audit_pipeline_runs();
