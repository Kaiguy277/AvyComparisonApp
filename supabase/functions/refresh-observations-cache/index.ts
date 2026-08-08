// Scheduled cron: pull field observations from the NAC public API and
// persist them per-zone for the mobile app's Observations tile.
//
// The NAC public list endpoint
// (https://api.avalanche.org/obs/v1/public/observation/) requires
// center_id + start_date + end_date and does NOT return zone info on
// list rows — only the per-id detail does. So we list per-center, then
// fetch detail for any IDs we haven't seen before. Existing rows aren't
// re-fetched; obs are immutable once published.
//
// The list endpoint is also Origin-gated, so we set Origin/Referer
// headers to match what the avalanche.org widget sends.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { ALL_ZONES } from "../_shared/zones-list.ts";
import { NAC_ZONE_TO_SLUG } from "../_shared/nac-zone-map.ts";
import { requireCronKey } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// API enforces a CORS-style allow-list against Origin/Referer.
const NAC_OBS_BASE = "https://api.avalanche.org/obs/v1/public/observation";
const NAC_HEADERS = {
  "Accept": "application/json",
  "Origin": "https://avalanche.org",
  "Referer": "https://avalanche.org/",
  "User-Agent": "AvyComparisonApp/1.0 (kaimyers@alaskapacific.edu)",
};

// Pull from mid-March so the offseason still has real data to render.
// The list endpoint will accept any range.
const START_DATE = "2026-03-15";

interface ObsListItem {
  id: string;
  // … other fields exist but the list response doesn't include zone_id
}

interface ObsDetail {
  id: string;
  center_id: string;
  start_date: string | null;
  observer_type: string | null;
  zone_id: string | null;
  zone_name: string | null;
  // payload retained verbatim; the rest of the schema lives in the
  // mobile client's ObservationSummary type.
  [k: string]: unknown;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchList(centerId: string, end: string): Promise<ObsListItem[]> {
  const url =
    `${NAC_OBS_BASE}/?center_id=${encodeURIComponent(centerId)}` +
    `&start_date=${START_DATE}&end_date=${end}`;
  const r = await fetch(url, { headers: NAC_HEADERS });
  if (!r.ok) {
    console.warn(`[obs] list ${centerId} HTTP ${r.status}`);
    return [];
  }
  const arr = (await r.json()) as ObsListItem[];
  return Array.isArray(arr) ? arr : [];
}

async function fetchDetail(id: string): Promise<ObsDetail | null> {
  const r = await fetch(`${NAC_OBS_BASE}/${id}`, { headers: NAC_HEADERS });
  if (!r.ok) {
    console.warn(`[obs] detail ${id} HTTP ${r.status}`);
    return null;
  }
  return (await r.json()) as ObsDetail;
}

// Throttled detail fetch — keeps concurrent in-flight requests bounded
// so we don't hammer api.avalanche.org. NAC has no published rate limit,
// so 6-wide is a courteous default.
async function mapWithConcurrency<T, U>(
  items: T[],
  width: number,
  fn: (t: T, i: number) => Promise<U>,
): Promise<U[]> {
  const out: U[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(width, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try {
        out[i] = await fn(items[i], i);
      } catch (err) {
        console.warn(`[obs] worker ${i} failed`, err);
      }
    }
  });
  await Promise.all(workers);
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = await requireCronKey(req, corsHeaders);
  if (denied) return denied;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("INTERNAL_SR_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const start = Date.now();
  const end = todayIso();
  const centers = Array.from(new Set(ALL_ZONES.map((z) => z.centerId)));

  // 1. Fetch existing IDs once per refresh, indexed in a Set.
  const { data: existingRows, error: existingErr } = await supabase
    .from("observations_cache")
    .select("id");
  if (existingErr) {
    console.error("[obs] failed reading existing IDs", existingErr);
    return new Response(
      JSON.stringify({ success: false, error: existingErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const existingIds = new Set((existingRows ?? []).map((r) => r.id as string));

  // 2. List per center in parallel; collect new IDs.
  const lists = await mapWithConcurrency(centers, 4, async (centerId) => {
    const items = await fetchList(centerId, end);
    return { centerId, items };
  });

  const newPairs: { centerId: string; id: string }[] = [];
  let totalListed = 0;
  for (const { centerId, items } of lists) {
    totalListed += items.length;
    for (const it of items) {
      if (!existingIds.has(it.id)) newPairs.push({ centerId, id: it.id });
    }
  }

  // 3. Fetch detail only for new IDs (avoids N+1 every cron tick).
  const details = await mapWithConcurrency(
    newPairs,
    6,
    async ({ id }) => fetchDetail(id),
  );

  const rows: Array<{
    id: string;
    zone_id: string | null;
    nac_zone_id: string | null;
    center_id: string;
    start_date: string | null;
    observer_type: string | null;
    payload: ObsDetail;
  }> = [];
  for (let i = 0; i < details.length; i++) {
    const d = details[i];
    if (!d) continue;
    const { centerId } = newPairs[i];
    const nacZoneId = d.zone_id ?? null;
    const slug = nacZoneId ? NAC_ZONE_TO_SLUG[nacZoneId]?.slug ?? null : null;
    rows.push({
      id: d.id,
      zone_id: slug,
      nac_zone_id: nacZoneId,
      center_id: centerId,
      start_date: d.start_date ?? null,
      observer_type: d.observer_type ?? null,
      payload: d,
    });
  }

  let written = 0;
  if (rows.length > 0) {
    // Chunk inserts so a single big payload doesn't trip Supabase row
    // size limits. 100 rows × ~10 KB = ~1 MB per request.
    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      const { error } = await supabase
        .from("observations_cache")
        .upsert(slice, { onConflict: "id" });
      if (error) {
        console.error(`[obs] upsert chunk ${i} failed`, error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message,
            written,
            elapsedMs: Date.now() - start,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      written += slice.length;
    }
  }

  const elapsed = Date.now() - start;
  console.log(
    `[refresh-observations-cache] centers=${centers.length} listed=${totalListed} new=${newPairs.length} written=${written} took=${elapsed}ms`,
  );

  return new Response(
    JSON.stringify({
      success: true,
      centers: centers.length,
      listed: totalListed,
      new: newPairs.length,
      written,
      elapsedMs: elapsed,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
