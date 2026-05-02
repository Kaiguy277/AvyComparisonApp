import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchMultipleStations } from "../_shared/synoptic-api.ts";
import { getStationsForZone } from "../_shared/weather-station-config.ts";

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
    const zoneIds: string[] = body?.zoneIds || [];

    if (zoneIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No zone IDs provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Fetching SNOTEL observations for ${zoneIds.length} zones`);

    // Build the union of every station across all requested zones, plus a
    // back-reference so we can redistribute observations to zones afterward.
    // This lets us fire ONE batched Synoptic call even when many zones share
    // stations or when 92 zones each have a few — instead of 92 parallel
    // requests that Synoptic throttles, we get one (or a small handful at
    // 50-stid chunks) call total.
    const stationMeta = new Map<
      string,
      { triplet: string; name: string; elevation: number }
    >();
    const zoneStations = new Map<string, string[]>(); // zoneId -> [triplet]

    for (const zoneId of zoneIds) {
      const stations = getStationsForZone(zoneId);
      const triplets: string[] = [];
      for (const s of stations) {
        triplets.push(s.triplet);
        if (!stationMeta.has(s.triplet)) {
          stationMeta.set(s.triplet, {
            triplet: s.triplet,
            name: s.name,
            elevation: s.elevation,
          });
        }
      }
      zoneStations.set(zoneId, triplets);
    }

    // One batched fetch for every unique station across the request.
    const allStations = Array.from(stationMeta.values());
    console.log(
      `Batched Synoptic request: ${allStations.length} unique stations across ${zoneIds.length} zones`,
    );
    const observations = await fetchMultipleStations(allStations);
    const obsByTriplet = new Map(
      observations.map((o) => [o.stationTriplet, o]),
    );

    // Redistribute results back to zones (a station can serve multiple zones).
    const results: Record<string, any[]> = {};
    for (const zoneId of zoneIds) {
      const triplets = zoneStations.get(zoneId) || [];
      results[zoneId] = triplets
        .map((t) => obsByTriplet.get(t))
        .filter((o): o is NonNullable<typeof o> => o !== undefined);
    }

    const populated = Object.values(results).filter((v) => v.length > 0).length;
    console.log(
      `SNOTEL fetch complete. Zones with data: ${populated}/${zoneIds.length}`,
    );

    return new Response(
      JSON.stringify({ success: true, observations: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in get-snotel-observations:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
