// Scheduled cron: refresh the fast-changing weather data (Synoptic stations
// + NWS mountain forecast + AVG discussion) and write into stations_cache.
//
// Runs every 1 hour. Stations report hourly so this cadence captures every
// new reading. Weather + station data is small (~50 KB total per zone).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { ALL_ZONES, groupByCenter } from "../_shared/zones-list.ts";
import { requireCronKey } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = await requireCronKey(req, corsHeaders);
  if (denied) return denied;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  // See refresh-forecast-cache for why we use INTERNAL_SR_KEY instead of
  // the auto-injected SUPABASE_SERVICE_ROLE_KEY.
  const serviceKey = Deno.env.get("INTERNAL_SR_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const start = Date.now();
  const allZoneIds = ALL_ZONES.map((z) => z.id);
  const groups = groupByCenter(ALL_ZONES);
  const centerToZones = new Map<string, string[]>();
  for (const [c, zs] of groups) centerToZones.set(c, zs);

  // 1. SNOTEL: one call with every zone — function batches Synoptic internally.
  let snotel: Record<string, any[]> = {};
  try {
    const r = await fetch(`${supabaseUrl}/functions/v1/get-snotel-observations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ zoneIds: allZoneIds }),
    });
    const data = await r.json();
    if (data?.success && data.observations) snotel = data.observations;
  } catch (err) {
    console.error("[stations-cache] snotel fetch failed", err);
  }

  // 2. Weather forecast: same shape — call once with every zone.
  let centerWeather: Record<string, any> = {};
  let zoneNwsForecasts: Record<string, any> = {};
  let centerAvgDiscussions: Record<string, any> = {};
  let zoneAvgLocations: Record<string, any[]> = {};
  try {
    const r = await fetch(`${supabaseUrl}/functions/v1/get-weather-forecast`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ zoneIds: allZoneIds }),
    });
    const data = await r.json();
    if (data?.success) {
      centerWeather = data.centerWeather || {};
      zoneNwsForecasts = data.zoneNwsForecasts || {};
      centerAvgDiscussions = data.centerAvgDiscussions || {};
      zoneAvgLocations = data.zoneAvgLocations || {};
    }
  } catch (err) {
    console.error("[stations-cache] weather fetch failed", err);
  }

  // 3. Bundle per zone and upsert. snapshot_date marks which "day" this row
  // represents — every cron tick within the same day overwrites the same
  // row, so the latest run before midnight is what end-of-day archive
  // viewers will see.
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const rows = ALL_ZONES.map((z) => ({
    zone_id: z.id,
    snapshot_date: today,
    center_id: z.centerId,
    fetched_at: now,
    payload: {
      stations: snotel[z.id] || [],
      weather: {
        nacWeather: centerWeather[z.centerId] || null,
        nwsForecast: zoneNwsForecasts[z.id] || null,
        avgDiscussion: centerAvgDiscussions[z.centerId] || null,
        avgLocations: zoneAvgLocations[z.id] || null,
      },
    },
  }));

  const { error } = await supabase
    .from("stations_cache")
    .upsert(rows, { onConflict: "zone_id,snapshot_date" });

  const elapsed = Date.now() - start;
  if (error) {
    console.error("[refresh-stations-cache] upsert failed", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message, elapsedMs: elapsed }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  console.log(
    `[refresh-stations-cache] wrote=${rows.length} took=${elapsed}ms`,
  );

  // Fan out a silent push to every registered device so on-device
  // snapshots refresh in the background. Best-effort — errors here don't
  // fail the cache refresh, since clients can still pull on next launch.
  let pushSent = 0;
  try {
    const r = await fetch(`${supabaseUrl}/functions/v1/send-snapshot-pushes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
        // send-snapshot-pushes is shared-secret gated; forward the key
        // this request was invoked with rather than re-reading it.
        "x-cron-key": req.headers.get("x-cron-key") ?? "",
      },
    });
    const body = await r.json();
    pushSent = body?.sent || 0;
  } catch (err) {
    console.warn("[refresh-stations-cache] push fan-out failed", err);
  }

  return new Response(
    JSON.stringify({
      success: true,
      written: rows.length,
      pushSent,
      elapsedMs: elapsed,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
