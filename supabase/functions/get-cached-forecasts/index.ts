// Mobile-facing read endpoint. Joins forecast_cache + stations_cache by
// zone_id and returns the same shape the app already understands. Falls
// back to "missing" so the client can decide whether to hit live.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    // Pull from both caches in parallel.
    const [fc, sc] = await Promise.all([
      supabase
        .from("forecast_cache")
        .select("zone_id, center_id, fetched_at, payload")
        .in("zone_id", zoneIds),
      supabase
        .from("stations_cache")
        .select("zone_id, center_id, fetched_at, payload")
        .in("zone_id", zoneIds),
    ]);

    if (fc.error) console.error("forecast_cache read error", fc.error);
    if (sc.error) console.error("stations_cache read error", sc.error);

    const stationsByZone = new Map<string, any>();
    for (const r of sc.data || []) {
      stationsByZone.set(r.zone_id, { fetched_at: r.fetched_at, payload: r.payload });
    }

    // Merge: each forecast row joins its matching stations row. Forecast
    // freshness and stations freshness are reported separately so the
    // client can show the user how old each layer is.
    const zones: any[] = [];
    const centerWeather: Record<string, any> = {};
    const zoneNwsForecasts: Record<string, any> = {};
    const centerAvgDiscussions: Record<string, any> = {};
    const zoneAvgLocations: Record<string, any[]> = {};

    let mostRecentForecastFetched: string | null = null;
    let mostRecentStationsFetched: string | null = null;

    for (const row of fc.data || []) {
      const stations = stationsByZone.get(row.zone_id);
      const zone = {
        ...row.payload,
        weatherObservations: stations?.payload?.stations || row.payload.weatherObservations,
        // freshness fields stay as the forecast's freshness; stations
        // freshness is at the top level so the UI can report it independently.
      };
      zones.push(zone);
      if (!mostRecentForecastFetched || row.fetched_at > mostRecentForecastFetched) {
        mostRecentForecastFetched = row.fetched_at;
      }
      if (stations) {
        if (!mostRecentStationsFetched || stations.fetched_at > mostRecentStationsFetched) {
          mostRecentStationsFetched = stations.fetched_at;
        }
        const w = stations.payload?.weather || {};
        if (w.nacWeather) centerWeather[row.center_id] = w.nacWeather;
        if (w.nwsForecast) zoneNwsForecasts[row.zone_id] = w.nwsForecast;
        if (w.avgDiscussion) centerAvgDiscussions[row.center_id] = w.avgDiscussion;
        if (w.avgLocations) zoneAvgLocations[row.zone_id] = w.avgLocations;
      }
    }

    const presentZoneIds = new Set(zones.map((z) => z.id));
    const missingZoneIds = zoneIds.filter((id) => !presentZoneIds.has(id));

    return new Response(
      JSON.stringify({
        success: true,
        zones,
        missingZoneIds,
        forecastFetchedAt: mostRecentForecastFetched,
        stationsFetchedAt: mostRecentStationsFetched,
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
