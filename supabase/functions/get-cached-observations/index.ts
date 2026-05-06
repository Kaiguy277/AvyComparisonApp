// Read-side counterpart of refresh-observations-cache. Takes a list of
// zone IDs and returns recent observations bucketed per zone — but
// pulls the WHOLE center's recent obs (not just the in-zone subset),
// tagging each with `inZone`. Snowpack and weather don't respect zone
// boundaries, so the user gets a more useful neighbor view + a clear
// IN-ZONE marker for the obs that landed in their slug specifically.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { ALL_ZONES } from "../_shared/zones-list.ts";

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
  title?: string | null;
}

// NAC ships a deeply nested avalanche record. We pass the whole thing
// through to the client so the detail screen can render trigger,
// destructive size, depth, width, vertical, aspect, elevation, etc.
type AvalancheItem = Record<string, unknown>;

interface NacObsPayload {
  id: string;
  center_id?: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
  last_updated?: string | null;
  observer_type?: string | null;
  obs_source?: string | null;
  organization?: string | null;
  organization_url?: string | null;
  name?: string | null;
  show_name?: boolean;
  activity?: string[] | null;
  route?: string | null;
  location_name?: string | null;
  location_point?: { lat: number; lng: number } | null;
  observation_summary?: string | null;
  instability_summary?: string | null;
  avalanches_summary?: string | null;
  zone_id?: string | null;
  zone_name?: string | null;
  zone_center_id?: string[] | null;
  media?: MediaItem[];
  avalanches?: AvalancheItem[];
  instability?: {
    cracking?: boolean;
    collapsing?: boolean;
    avalanches_caught?: boolean;
    avalanches_observed?: boolean;
    avalanches_triggered?: boolean;
    cracking_description?: string | null;
    collapsing_description?: string | null;
  };
  advanced_fields?: {
    observed_terrain?: unknown;
    weather_summary?: string | null;
    weather?: Record<string, unknown> | null;
    snowpack?: Record<string, unknown> | null;
    snowpack_summary?: string | null;
  };
  urls?: unknown[];
}

// Built once at import time from the shared zones-list. Eliminates a
// per-request loop.
const ZONE_TO_CENTER = new Map<string, string>(
  ALL_ZONES.map((z) => [z.id, z.centerId]),
);

function shapeMedia(media: MediaItem[] | undefined) {
  if (!Array.isArray(media)) return [];
  return media
    .map((m) => {
      const url = m?.url ?? {};
      const thumbnail = url.thumbnail || url.medium || url.large || url.original;
      const full = url.original || url.large || url.medium || url.thumbnail;
      if (!thumbnail || !full) return null;
      return {
        id: m.id ?? null,
        type: m.type ?? "image",
        thumbnail,
        full,
        caption: typeof m.caption === "string" ? m.caption : null,
        title: typeof m.title === "string" ? m.title : null,
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);
}

function summarize(
  payload: NacObsPayload,
  inZoneSlug: string,
) {
  const inst = payload.instability ?? {};
  const hasAvalanches =
    (Array.isArray(payload.avalanches) && payload.avalanches.length > 0) ||
    !!inst.avalanches_observed ||
    !!inst.avalanches_triggered ||
    !!inst.avalanches_caught;

  const media = shapeMedia(payload.media);
  const ourCenter = (payload.center_id ?? "").toUpperCase() || null;

  return {
    id: payload.id,
    zoneId: payload.zone_id ?? null,
    zoneName: payload.zone_name ?? null,
    centerId: ourCenter,
    inZone:
      // The cache stores our slug in the row's zone_id column; but since
      // we passed `payload` not the row, we don't have it here. Caller
      // resolves inZone via the row column instead. This stub stays for
      // shape — callers overwrite.
      false,
    startDate: payload.start_date ?? null,
    endDate: payload.end_date ?? null,
    createdAt: payload.created_at ?? null,
    lastUpdated: payload.last_updated ?? null,
    observerType: payload.observer_type ?? null,
    obsSource: payload.obs_source ?? null,
    observerName:
      payload.show_name === false ? null : payload.name?.trim() || null,
    organization: payload.organization?.trim() || null,
    organizationUrl: payload.organization_url ?? null,
    activity: Array.isArray(payload.activity) ? payload.activity : [],
    route: payload.route?.trim() || null,
    locationName: payload.location_name?.trim() || null,
    locationPoint: payload.location_point ?? null,
    summaryHtml: payload.observation_summary ?? null,
    instabilitySummary: payload.instability_summary?.trim() || null,
    avalanchesSummary: payload.avalanches_summary?.trim() || null,
    instability: {
      cracking: !!inst.cracking,
      collapsing: !!inst.collapsing,
      avalanchesCaught: !!inst.avalanches_caught,
      avalanchesObserved: !!inst.avalanches_observed,
      avalanchesTriggered: !!inst.avalanches_triggered,
      crackingDescription: inst.cracking_description?.trim() || null,
      collapsingDescription: inst.collapsing_description?.trim() || null,
    },
    advancedFields: payload.advanced_fields ?? null,
    avalanches: Array.isArray(payload.avalanches) ? payload.avalanches : [],
    hasAvalanches,
    media,
    // Convenience: top-4 thumbnail URLs for the list card. Detail screen
    // reads from `media` for the full set.
    thumbnails: media.slice(0, 4).map((m) => m.thumbnail),
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

    // For each requesting zone we want:
    //   1. ALL in-zone obs (regardless of how far back)
    //   2. The N most recent center-wide obs
    // Unioned + de-duped, with in-zone pinned to top.
    // A pure "newest 50 from center" query would silently drop in-zone
    // obs that fell outside the recency window.
    const inZoneCap = Math.min(limit, 50);
    const centerCap = limit;

    const buckets: Record<string, ReturnType<typeof summarize>[]> = {};
    for (const zid of zoneIds) buckets[zid] = [];

    await Promise.all(
      zoneIds.map(async (zid) => {
        const center = ZONE_TO_CENTER.get(zid);
        if (!center) {
          console.warn(`[get-cached-observations] no center for ${zid}`);
          return;
        }

        const [inZoneRes, centerRes] = await Promise.all([
          supabase
            .from("observations_cache")
            .select("zone_id, center_id, payload")
            .eq("zone_id", zid)
            .order("start_date", { ascending: false })
            .limit(inZoneCap),
          supabase
            .from("observations_cache")
            .select("zone_id, center_id, payload")
            .eq("center_id", center)
            .order("start_date", { ascending: false })
            .limit(centerCap),
        ]);

        if (inZoneRes.error) {
          console.error(
            `[get-cached-observations] in-zone ${zid} failed: ${inZoneRes.error.message}`,
          );
        }
        if (centerRes.error) {
          console.error(
            `[get-cached-observations] center ${center} failed: ${centerRes.error.message}`,
          );
          return;
        }

        const seen = new Set<string>();
        const merged: Array<{
          payload: NacObsPayload;
          rowZoneId: string | null;
        }> = [];
        // In-zone first so they keep their precedence after de-dup.
        for (const r of inZoneRes.data ?? []) {
          const p = r.payload as NacObsPayload;
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          merged.push({ payload: p, rowZoneId: r.zone_id as string | null });
        }
        for (const r of centerRes.data ?? []) {
          const p = r.payload as NacObsPayload;
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          merged.push({ payload: p, rowZoneId: r.zone_id as string | null });
        }

        for (const m of merged) {
          const summary = summarize(m.payload, zid);
          summary.inZone = m.rowZoneId === zid;
          buckets[zid].push(summary);
        }
        buckets[zid].sort((a, b) => {
          if (a.inZone !== b.inZone) return a.inZone ? -1 : 1;
          return (b.startDate ?? "").localeCompare(a.startDate ?? "");
        });
      }),
    );

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
