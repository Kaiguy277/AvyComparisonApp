-- Two-tier offline cache for the AvyComparison mobile app.
--
-- forecast_cache  — slow-changing avalanche forecasts. Refreshed every 2h.
-- stations_cache  — fast-changing weather data (Synoptic + NWS). Refreshed every 1h.
--
-- The mobile app's get-cached-forecasts function joins these two tables by
-- zone_id so the client always receives the freshest weather data alongside
-- whatever the latest forecast is, even if the forecast hasn't been re-issued.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

create table if not exists public.forecast_cache (
  zone_id      text        primary key,
  center_id    text        not null,
  fetched_at   timestamptz not null default now(),
  payload      jsonb       not null
);

create index if not exists forecast_cache_center_idx on public.forecast_cache (center_id);
create index if not exists forecast_cache_fetched_idx on public.forecast_cache (fetched_at desc);

create table if not exists public.stations_cache (
  zone_id      text        primary key,
  center_id    text        not null,
  fetched_at   timestamptz not null default now(),
  -- Bundles SNOTEL/Synoptic observations + NWS mountain-weather + AVG
  -- discussion under one row per zone for cheap reads.
  payload      jsonb       not null
);

create index if not exists stations_cache_center_idx on public.stations_cache (center_id);
create index if not exists stations_cache_fetched_idx on public.stations_cache (fetched_at desc);

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
