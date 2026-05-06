// Read-side counterpart of refresh-observations-cache. Takes a list of
// zone IDs and returns recent observations bucketed per zone. We trim
// the verbose NAC payload to a slim ObservationSummary shape so the
// mobile app can render the tile + screen without re-parsing HTML soup.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MediaItem {
  id?: number | string;
  type?: string;
  url?: {
    thumbnail?: string;
    medium?: string;
    large?: string;
    original?: string;
  };
  caption?: string | null;
}

interface AvalancheItem {
  // NAC ships a verbose nested object — we only surface a couple of
  // signals the tile needs. The rest stays on `payload` for callers
  // that want to render the long form later.
  observed_terrain?: unknown;
  start_zone_aspect?: string | null;
  destructive_size?: string | null;
}

interface NacObsPayload {
  id: string;
  center_id?: string;
  start_date?: string | null;
  end_date?: string | null;
  observer_type?: string | null;
  obs_source?: string | null;
  organization?: string | null;
  organization_url?: string | null;
  name?: string | null;
  show_name?: boolean;
  location_name?: string | null;
  location_point?: { lat: number; lng: number } | null;
  observation_summary?: string | null;
  instability_summary?: string | null;
  avalanches_summary?: string | null;
  zone_id?: string | null;
  zone_name?: string | null;
  media?: MediaItem[];
  avalanches?: AvalancheItem[];
  instability?: {
    cracking?: boolean;
    collapsing?: boolean;
    avalanches_caught?: boolean;
    avalanches_observed?: boolean;
    avalanches_triggered?: boolean;
  };
}

function summarize(payload: NacObsPayload, mappedZoneId: string | null) {
  const media = Array.isArray(payload.media) ? payload.media : [];
  const thumbnails = media
    .map((m) => m?.url?.thumbnail || m?.url?.medium || m?.url?.large)
    .filter((u): u is string => typeof u === "string")
    .slice(0, 4);
  const inst = payload.instability ?? {};
  const hasAvalanches =
    (Array.isArray(payload.avalanches) && payload.avalanches.length > 0) ||
    !!inst.avalanches_observed ||
    !!inst.avalanches_triggered ||
    !!inst.avalanches_caught;

  return {
    id: payload.id,
    zoneId: mappedZoneId,
    zoneName: payload.zone_name ?? null,
    centerId: (payload.center_id ?? "").toUpperCase() || null,
    startDate: payload.start_date ?? null,
    observerType: payload.observer_type ?? null,
    obsSource: payload.obs_source ?? null,
    observerName:
      payload.show_name === false ? null : payload.name?.trim() || null,
    organization: payload.organization?.trim() || null,
    locationName: payload.location_name?.trim() || null,
    locationPoint: payload.location_point ?? null,
    summaryHtml: payload.observation_summary ?? null,
    instabilitySummary: payload.instability_summary?.trim() || null,
    avalanchesSummary: payload.avalanches_summary?.trim() || null,
    instabilityFlags: {
      cracking: !!inst.cracking,
      collapsing: !!inst.collapsing,
      avalanchesCaught: !!inst.avalanches_caught,
      avalanchesObserved: !!inst.avalanches_observed,
      avalanchesTriggered: !!inst.avalanches_triggered,
    },
    hasAvalanches,
    thumbnails,
    // Public viewer URL on avalanche.org. The widget links to
    // /observations/#/view/observation/<id> so we mirror that.
    viewerUrl: `https://avalanche.org/observations/#/view/observation/${payload.id}`,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const zoneIds: string[] = Array.isArray(body?.zoneIds) ? body.zoneIds : [];
    const limit: number = Math.min(Math.max(Number(body?.limit) || 50, 1), 200);

    if (zoneIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No zone IDs provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("INTERNAL_SR_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // One query per zone so each zone gets its own top-N regardless of
    // how the global ordering would have skewed things. PostgREST has
    // no window-function shortcut, so the per-zone fan-out is the
    // cleanest path. ~10 parallel selects is well under the connection
    // pool budget.
    const buckets: Record<string, ReturnType<typeof summarize>[]> = {};
    for (const zid of zoneIds) buckets[zid] = [];

    const results = await Promise.all(
      zoneIds.map(async (zid) => {
        const { data, error } = await supabase
          .from("observations_cache")
          .select("id, zone_id, center_id, start_date, observer_type, payload")
          .eq("zone_id", zid)
          .order("start_date", { ascending: false })
          .limit(limit);
        return { zid, data, error };
      }),
    );

    for (const r of results) {
      if (r.error) {
        console.error(`[get-cached-observations] ${r.zid} failed`, r.error);
        continue;
      }
      for (const row of r.data ?? []) {
        buckets[r.zid].push(summarize(row.payload as NacObsPayload, r.zid));
      }
    }

    return new Response(
      JSON.stringify({ success: true, observations: buckets }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[get-cached-observations] crashed", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
