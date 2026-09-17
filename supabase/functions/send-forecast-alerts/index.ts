// Daily user-visible forecast alert.
//
// Why this exists: silent pushes and BGAppRefreshTask are both dropped by
// iOS once the user force-quits the app, which is exactly the user we most
// want to reach — they get no background refresh at all. A *visible*
// notification IS delivered to a force-quit app, and tapping it opens the
// app, which refreshes the cache. So this is both the safety nudge and the
// force-quit freshness path, and it needs no location permission.
//
// Targets device_tokens.zones, synced from the app's local favourites by
// lib/deviceZoneSync.ts. Only devices with alerts_enabled can receive it.
//
// Safe to run more than once a day: last_alert_date dedupes per device, so
// the cron can retry later in the morning if a center hadn't published yet.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireCronKey } from "../_shared/cron-auth.ts";
import {
  composeAlert,
  zoneDangerFor,
  type ZoneDanger,
  type ZonePayload,
} from "../_shared/forecast-alert-copy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const STALE_TOKEN_DAYS = 60;
const CHUNK_SIZE = 100;

interface ExpoPushMessage {
  to: string;
  title?: string;
  body?: string;
  priority?: "default" | "high";
  sound?: string | null;
  data?: Record<string, unknown>;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
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

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });

  // Match the writer's convention: refresh-forecast-cache stores rows under
  // today's UTC date.
  const today = new Date().toISOString().slice(0, 10);

  const staleCutoff = new Date();
  staleCutoff.setUTCDate(staleCutoff.getUTCDate() - STALE_TOKEN_DAYS);

  const { data: devices, error: devErr } = await supabase
    .from("device_tokens")
    .select("token, zones, last_alert_date")
    .eq("alerts_enabled", true)
    .gte("last_seen", staleCutoff.toISOString())
    .or(`last_alert_date.is.null,last_alert_date.lt.${today}`);

  if (devErr) {
    console.error("[forecast-alerts] device query failed", devErr);
    return json({ success: false, error: devErr.message }, 500);
  }

  const targets = (devices || []).filter(
    (d) => Array.isArray(d.zones) && d.zones.length > 0,
  );
  if (targets.length === 0) return json({ success: true, sent: 0 });

  // One query for every zone anyone follows.
  const allZones = [...new Set(targets.flatMap((d) => d.zones as string[]))];
  const { data: rows, error: fcErr } = await supabase
    .from("forecast_cache")
    .select("zone_id, payload")
    .eq("forecast_date", today)
    .in("zone_id", allZones);

  if (fcErr) {
    console.error("[forecast-alerts] forecast query failed", fcErr);
    return json({ success: false, error: fcErr.message }, 500);
  }

  // zone_id -> { name, danger }. A zone with no row for TODAY is absent, and
  // absent zones are skipped below: sending yesterday's danger rating in a
  // notification is worse than sending nothing.
  const byZone = new Map<string, ZoneDanger>();
  for (const r of rows || []) {
    const zd = zoneDangerFor(r.payload as ZonePayload, today, r.zone_id);
    if (zd) byZone.set(r.zone_id, zd);
  }

  if (byZone.size === 0) {
    console.log("[forecast-alerts] no zones have today's forecast yet");
    return json({ success: true, sent: 0, reason: "no-forecast-yet" });
  }

  const messages: ExpoPushMessage[] = [];
  for (const d of targets) {
    const parts = (d.zones as string[])
      .map((z) => byZone.get(z))
      .filter((v): v is ZoneDanger => !!v);
    // None of their zones have published yet — skip rather than send a
    // stale or empty alert. A later cron pass retries.
    const copy = composeAlert(parts);
    if (!copy) continue;

    messages.push({
      to: d.token,
      title: copy.title,
      body: copy.body,
      // Visible alert: priority 10 is correct here (unlike the silent
      // refresh push in send-snapshot-pushes, which must use priority 5).
      priority: "high",
      sound: null,
      data: { kind: "forecast-alert", date: today },
    });
  }

  if (messages.length === 0) return json({ success: true, sent: 0 });

  let okCount = 0;
  let errorCount = 0;
  const deadTokens: string[] = [];
  const sentTokens: string[] = [];

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    try {
      const r = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
      const body = (await r.json()) as { data?: ExpoPushTicket[] };
      const tickets = body.data || [];
      tickets.forEach((ticket, j) => {
        if (ticket.status === "ok") {
          okCount++;
          sentTokens.push(chunk[j].to);
        } else {
          errorCount++;
          if (ticket.details?.error === "DeviceNotRegistered") {
            deadTokens.push(chunk[j].to);
          }
        }
      });
    } catch (err) {
      console.error("[forecast-alerts] chunk fetch failed", err);
      errorCount += chunk.length;
    }
  }

  // Stamp only the devices we actually reached, so a device that failed
  // today is retried by the later cron pass instead of being marked done.
  if (sentTokens.length > 0) {
    await supabase
      .from("device_tokens")
      .update({ last_alert_date: today })
      .in("token", sentTokens);
  }

  if (deadTokens.length > 0) {
    await supabase.from("device_tokens").delete().in("token", deadTokens);
    console.log(`[forecast-alerts] pruned ${deadTokens.length} dead tokens`);
  }

  return json({
    success: true,
    sent: okCount,
    errors: errorCount,
    pruned: deadTokens.length,
    zonesWithForecast: byZone.size,
  });
});
