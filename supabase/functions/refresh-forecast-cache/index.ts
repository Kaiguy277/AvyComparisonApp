// Scheduled cron: refresh the forecast cache for every zone, grouped by
// avalanche center to keep individual avalanche-summary calls small.
//
// Runs every 2 hours (configured in pg_cron). Forecasts update 1–2× per
// day; this cadence is generous.

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
  // Use the JWT-format service_role key (set as a secret) for both DB
  // writes and internal function-to-function calls. The auto-injected
  // SUPABASE_SERVICE_ROLE_KEY on this project's runtime isn't a JWT and
  // function gateways reject it with UNAUTHORIZED_INVALID_JWT_FORMAT.
  const serviceKey = Deno.env.get("INTERNAL_SR_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const start = Date.now();
  const groups = groupByCenter(ALL_ZONES);
  const centerEntries = Array.from(groups.entries());
  let written = 0;
  const errors: string[] = [];

  // Process centers sequentially (each call to avalanche-summary already
  // batches all zones for that center). Sequential keeps load on NAC's API
  // gentle and stays well under any per-call rate limit.
  for (const [centerId, zoneIds] of centerEntries) {
    try {
      const r = await fetch(`${supabaseUrl}/functions/v1/avalanche-summary`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ zoneIds }),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        errors.push(`${centerId}: HTTP ${r.status} ${text.slice(0, 120)}`);
        continue;
      }
      const data = await r.json();
      const zones: any[] = data?.summary?.zones || [];
      if (zones.length === 0) {
        errors.push(`${centerId}: no zones returned`);
        continue;
      }
      // forecast_date = the day the cron wrote this row (UTC). Some zones
      // ship `freshness.issueDate` as a display string ("May 1") that
      // mis-parses, so we use the wall-clock date instead — matches the
      // cadence of the cron and is what the phone needs for archive lookup.
      // The actual NAC issue timestamp is preserved inside the payload.
      const todayUtc = new Date().toISOString().slice(0, 10);
      const rows = zones.map((z: any) => ({
        zone_id: z.id,
        forecast_date: todayUtc,
        center_id: centerId,
        fetched_at: new Date().toISOString(),
        payload: z,
      }));
      const { error } = await supabase
        .from("forecast_cache")
        .upsert(rows, { onConflict: "zone_id,forecast_date" });
      if (error) {
        errors.push(`${centerId}: upsert ${error.message}`);
        continue;
      }
      written += rows.length;
    } catch (err) {
      errors.push(`${centerId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const elapsed = Date.now() - start;
  console.log(
    `[refresh-forecast-cache] wrote=${written} centers=${centerEntries.length} errors=${errors.length} took=${elapsed}ms`,
  );
  if (errors.length) console.error("[refresh-forecast-cache] errors:", errors);

  return new Response(
    JSON.stringify({
      success: true,
      written,
      centers: centerEntries.length,
      errors,
      elapsedMs: elapsed,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
