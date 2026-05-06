-- Per-zone field observations from the NAC public API
-- (https://api.avalanche.org/obs/v1/public/observation/).
--
-- The list endpoint requires center_id + date range and does NOT include
-- per-obs zone info; only the detail endpoint does. So the cron writes
-- one row per observation here, and the per-zone read does a simple
-- SELECT … WHERE zone_id IN (…). Detail responses are kept verbatim in
-- `payload` so we can extend the UI without re-fetching from upstream.

create table public.observations_cache (
  id              text         primary key,   -- NAC observation UUID
  zone_id         text,                       -- our slug; null if NAC zone unmapped
  nac_zone_id     text,                       -- NAC numeric id (whatever detail returned)
  center_id       text         not null,      -- our center code (e.g. NWAC)
  start_date      date,
  observer_type   text,                       -- 'public' | 'forecaster' | 'professional'
  payload         jsonb        not null,
  fetched_at      timestamptz  not null default now()
);

create index observations_cache_zone_idx
  on public.observations_cache (zone_id, start_date desc);
create index observations_cache_center_idx
  on public.observations_cache (center_id);
create index observations_cache_start_date_idx
  on public.observations_cache (start_date desc);

alter table public.observations_cache enable row level security;

drop policy if exists observations_cache_read on public.observations_cache;
create policy observations_cache_read on public.observations_cache
  for select using (true);

-- Retention. Keep ~120 days so end-of-season obs stay browsable into
-- summer. Cleanup re-uses the existing cache cleanup cron slot; we just
-- extend the function rather than scheduling a separate job.
create or replace function public.cleanup_old_cache()
returns void language sql as $$
  delete from public.forecast_cache
    where forecast_date < (current_date - interval '14 days');
  delete from public.stations_cache
    where snapshot_date < (current_date - interval '14 days');
  delete from public.observations_cache
    where start_date < (current_date - interval '120 days');
$$;
