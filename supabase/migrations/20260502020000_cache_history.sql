-- Multi-day cache history. Lets the mobile app scroll back through past
-- forecasts (10 days online, 3 days offline for favorites). Both caches
-- now key on (zone_id, date) so each cron tick either updates today's
-- row or appends a new one when the day rolls over.
--
-- Old single-row caches are dropped — data is regenerable on the next
-- cron tick, so there's nothing to migrate.

drop table if exists public.forecast_cache;
drop table if exists public.stations_cache;

create table public.forecast_cache (
  zone_id        text         not null,
  forecast_date  date         not null,
  center_id      text         not null,
  fetched_at     timestamptz  not null default now(),
  payload        jsonb        not null,
  primary key (zone_id, forecast_date)
);
create index forecast_cache_zone_recent_idx
  on public.forecast_cache (zone_id, forecast_date desc);
create index forecast_cache_date_idx
  on public.forecast_cache (forecast_date);

create table public.stations_cache (
  zone_id        text         not null,
  snapshot_date  date         not null,
  center_id      text         not null,
  fetched_at     timestamptz  not null default now(),
  payload        jsonb        not null,
  primary key (zone_id, snapshot_date)
);
create index stations_cache_zone_recent_idx
  on public.stations_cache (zone_id, snapshot_date desc);
create index stations_cache_date_idx
  on public.stations_cache (snapshot_date);

-- RLS: anon clients can only read. Writes happen exclusively from the
-- scheduled edge functions running with the service role key.
alter table public.forecast_cache enable row level security;
alter table public.stations_cache enable row level security;

drop policy if exists forecast_cache_read on public.forecast_cache;
create policy forecast_cache_read on public.forecast_cache
  for select using (true);

drop policy if exists stations_cache_read on public.stations_cache;
create policy stations_cache_read on public.stations_cache
  for select using (true);

-- Retention. 14 days keeps the 10-day "online history" window with a few
-- days of cushion. Anything older is purged daily.
create or replace function public.cleanup_old_cache()
returns void language sql as $$
  delete from public.forecast_cache
    where forecast_date < (current_date - interval '14 days');
  delete from public.stations_cache
    where snapshot_date < (current_date - interval '14 days');
$$;

-- Daily cleanup at 03:00 UTC (≈19:00 America/Anchorage). Idempotent
-- unschedule so re-running this migration doesn't duplicate jobs.
do $$
begin
  perform cron.unschedule('avy-cleanup-cache');
exception when others then null;
end $$;

select cron.schedule(
  'avy-cleanup-cache',
  '0 3 * * *',
  $$select public.cleanup_old_cache()$$
);
