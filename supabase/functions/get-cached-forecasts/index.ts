// Mobile-facing read endpoint. Joins forecast_cache + stations_cache by
// (zone_id, date) and returns the same shape the app already understands.
// Falls back to "missing" so the client can decide whether to hit live.
//
// Optional `forecastDate` parameter (YYYY-MM-DD) lets the client scroll
// back through history. Default = latest row per zone (which usually means
// today, but if NAC hasn't published today's issue yet we'll fall through
// to whatever's most recent for that zone).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const zoneIds: string[] = Array.isArray(body?.zoneIds) ? body.zoneIds : [];
    if (zoneIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No zone IDs provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const requestedDate: string | null =
      typeof body?.forecastDate === "string" && DATE_RE.test(body.forecastDate)
        ? body.forecastDate
        : null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    // When the client doesn't pin a specific date we want each zone's most
    // recent row (which is usually today's, but might be yesterday's for
    // zones that haven't been re-issued yet). Pull a window and pick the
    // newest per zone in code — Postgres DISTINCT ON would also work but
    // a window of ~14 rows × N zones stays small enough that an in-memory
    // pick keeps the query simple.
    let fcQuery = supabase
      .from("forecast_cache")
      .select("zone_id, forecast_date, center_id, fetched_at, payload")
      .in("zone_id", zoneIds);
    let scQuery = supabase
      .from("stations_cache")
      .select("zone_id, snapshot_date, center_id, fetched_at, payload")
      .in("zone_id", zoneIds);

    if (requestedDate) {
      fcQuery = fcQuery.eq("forecast_date", requestedDate);
      scQuery = scQuery.eq("snapshot_date", requestedDate);
    } else {
      // Cap the lookback so we don't pull the full retention window.
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - 14);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      fcQuery = fcQuery.gte("forecast_date", cutoffStr);
      scQuery = scQuery.gte("snapshot_date", cutoffStr);
    }

    const [fc, sc] = await Promise.all([fcQuery, scQuery]);

    if (fc.error) console.error("forecast_cache read error", fc.error);
    if (sc.error) console.error("stations_cache read error", sc.error);

    // Pick the most recent row per zone unless a specific date was requested.
    const newestForecastByZone = new Map<string, any>();
    for (const r of fc.data || []) {
      const cur = newestForecastByZone.get(r.zone_id);
      if (!cur || r.forecast_date > cur.forecast_date) {
        newestForecastByZone.set(r.zone_id, r);
      }
    }
    const newestStationsByZone = new Map<string, any>();
    for (const r of sc.data || []) {
      const cur = newestStationsByZone.get(r.zone_id);
      if (!cur || r.snapshot_date > cur.snapshot_date) {
        newestStationsByZone.set(r.zone_id, r);
      }
    }

    const zones: any[] = [];
    // Zones with stations data but no forecast row in the lookback window —
    // off-season, freshly added zones, or zones where the avalanche center
    // has stopped issuing. The cron is still updating their station and
    // weather data hourly; we surface that to the client so the device
    // snapshot can keep showing fresh wx info even without a forecast.
    const stationsOnlyZones: any[] = [];
    const centerWeather: Record<string, any> = {};
    const zoneNwsForecasts: Record<string, any> = {};
    const centerAvgDiscussions: Record<string, any> = {};
    const zoneAvgLocations: Record<string, any[]> = {};

    let mostRecentForecastFetched: string | null = null;
    let mostRecentStationsFetched: string | null = null;
    let resolvedForecastDate: string | null = null;
    let resolvedStationsDate: string | null = null;

    // Helper: pull the weather bundle off a stations row into the response
    // maps, keyed by center / zone the same way the live endpoint does.
    const ingestStationsWeather = (
      stationsRow: { center_id: string; zone_id: string; payload: any },
    ): void => {
      const w = stationsRow.payload?.weather || {};
      if (w.nacWeather) centerWeather[stationsRow.center_id] = w.nacWeather;
      if (w.nwsForecast) zoneNwsForecasts[stationsRow.zone_id] = w.nwsForecast;
      if (w.avgDiscussion) centerAvgDiscussions[stationsRow.center_id] = w.avgDiscussion;
      if (w.avgLocations) zoneAvgLocations[stationsRow.zone_id] = w.avgLocations;
    };

    // Iterate the union of zones that have either a forecast row or a
    // stations row. Forecast rows carry full zone metadata; stations-only
    // rows ship a minimal stub so the client can still surface fresh wx.
    const unionZoneIds = new Set<string>([
      ...newestForecastByZone.keys(),
      ...newestStationsByZone.keys(),
    ]);

    for (const zoneId of unionZoneIds) {
      const forecastRow = newestForecastByZone.get(zoneId);
      const stationsRow = newestStationsByZone.get(zoneId);

      if (forecastRow) {
        const zone = {
          ...forecastRow.payload,
          weatherObservations: stationsRow?.payload?.stations || forecastRow.payload.weatherObservations,
        };
        zones.push(zone);
        if (!mostRecentForecastFetched || forecastRow.fetched_at > mostRecentForecastFetched) {
          mostRecentForecastFetched = forecastRow.fetched_at;
        }
        if (!resolvedForecastDate || forecastRow.forecast_date > resolvedForecastDate) {
          resolvedForecastDate = forecastRow.forecast_date;
        }
        if (stationsRow) ingestStationsWeather(stationsRow);
      } else if (stationsRow) {
        // No forecast for this zone — emit a stations-only stub. The client
        // already has the zone name in its catalog; we just need id +
        // centerId + the actual observation array.
        stationsOnlyZones.push({
          id: stationsRow.zone_id,
          centerId: stationsRow.center_id,
          weatherObservations: stationsRow.payload?.stations || [],
        });
        ingestStationsWeather(stationsRow);
      }

      if (stationsRow) {
        if (!mostRecentStationsFetched || stationsRow.fetched_at > mostRecentStationsFetched) {
          mostRecentStationsFetched = stationsRow.fetched_at;
        }
        if (!resolvedStationsDate || stationsRow.snapshot_date > resolvedStationsDate) {
          resolvedStationsDate = stationsRow.snapshot_date;
        }
      }
    }

    const presentZoneIds = new Set([
      ...zones.map((z) => z.id),
      ...stationsOnlyZones.map((z) => z.id),
    ]);
    const missingZoneIds = zoneIds.filter((id) => !presentZoneIds.has(id));

    return new Response(
      JSON.stringify({
        success: true,
        zones,
        stationsOnlyZones,
        missingZoneIds,
        forecastFetchedAt: mostRecentForecastFetched,
        stationsFetchedAt: mostRecentStationsFetched,
        forecastDate: resolvedForecastDate,
        stationsDate: resolvedStationsDate,
        requestedDate,
        centerWeather,
        zoneNwsForecasts,
        centerAvgDiscussions,
        zoneAvgLocations,
        cached: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[get-cached-forecasts] error", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
