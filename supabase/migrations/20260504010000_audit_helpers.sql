-- Read-only audit helpers used by the audit-push-pipeline edge
-- function. Wrapping the pg_cron lookups in security-definer
-- functions because pg_cron.job and pg_cron.job_run_details require
-- elevated privileges.

create or replace function public.audit_pipeline_jobs()
returns table (
  jobid     bigint,
  jobname   text,
  schedule  text,
  active    boolean,
  command   text
)
language sql
security definer
set search_path = cron, public
as $$
  select jobid, jobname, schedule, active, command
  from cron.job
  where jobname like 'avy-%'
  order by jobname;
$$;

create or replace function public.audit_pipeline_runs()
returns table (
  jobname        text,
  start_time     timestamptz,
  end_time       timestamptz,
  status         text,
  return_message text
)
language sql
security definer
set search_path = cron, public
as $$
  select j.jobname, r.start_time, r.end_time, r.status, r.return_message
  from cron.job_run_details r
  join cron.job j using (jobid)
  where j.jobname like 'avy-%'
  order by r.start_time desc
  limit 10;
$$;

grant execute on function public.audit_pipeline_jobs() to service_role;
grant execute on function public.audit_pipeline_runs() to service_role;
