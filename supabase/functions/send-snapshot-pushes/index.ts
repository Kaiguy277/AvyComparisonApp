// Fan out a silent push to every registered device after the stations
// cache has been refreshed. The device picks up the wake, runs its
// background notification task, and re-pulls getCachedForecasts so the
// on-device snapshot is fresh next time the user opens the app offline.
//
// Silent push semantics:
//   iOS:     `_contentAvailable: true` — wakes the app's headless JS.
//            No banner, no sound, no badge.
//   Android: `priority: "high"` + data-only — same wake-without-UI.
//
// Cadence is bounded by the calling cron (currently hourly via
// refresh-stations-cache), but iOS still throttles per-device. Apple's
// guidance is "two or three silent pushes per hour" max — we're safely
// under that.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireCronKey } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Expo's push API endpoint. Routes to APNs/FCM under the hood — credentials
// are uploaded once per project via `eas credentials`.
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Drop tokens whose last_seen is older than this. Keeps the token list
// from accumulating dead installs forever; reinstalls re-register.
const STALE_TOKEN_DAYS = 60;

// Expo's push API rejects payloads larger than 100 messages per call. We
// chunk for safety even though we're nowhere near that today.
const CHUNK_SIZE = 100;

interface ExpoPushMessage {
  to: string;
  _contentAvailable?: boolean;
  priority?: "default" | "high";
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
  // refresh-stations-cache uses INTERNAL_SR_KEY for the same reason
  // (auto-injected SUPABASE_SERVICE_ROLE_KEY can be missing in scheduled
  // contexts depending on project age).
  const serviceKey = Deno.env.get("INTERNAL_SR_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - STALE_TOKEN_DAYS);

  const { data: tokens, error } = await supabase
    .from("device_tokens")
    .select("token, platform, last_seen")
    .gte("last_seen", cutoff.toISOString());

  if (error) {
    console.error("[send-pushes] token query failed", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }

  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ success: true, sent: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // For silent pushes (content-available: 1) Apple REQUIRES priority 5
  // (low/default). Priority 10 is for user-visible notifications and is
  // dropped by APNs when paired with content-available. The Expo Push
  // API maps "default" → APNs priority 5, which is what we want here.
  // Empirically (see thread): with "high", only ~1 in 5 silent pushes
  // actually wakes the device — Apple silently throttles the malformed
  // ones. With "default", delivery is reliable.
  const messages: ExpoPushMessage[] = tokens.map((t) => ({
    to: t.token,
    _contentAvailable: true,
    priority: "default",
    data: { kind: "refresh-favorites", at: new Date().toISOString() },
  }));

  let okCount = 0;
  let errorCount = 0;
  const deadTokens: string[] = [];

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
        } else {
          errorCount++;
          // DeviceNotRegistered → token is dead; queue for cleanup.
          if (ticket.details?.error === "DeviceNotRegistered") {
            deadTokens.push(chunk[j].to);
          }
        }
      });
    } catch (err) {
      console.error("[send-pushes] chunk fetch failed", err);
      errorCount += chunk.length;
    }
  }

  // Clean up dead tokens so they don't keep getting tried.
  if (deadTokens.length > 0) {
    await supabase.from("device_tokens").delete().in("token", deadTokens);
    console.log(`[send-pushes] pruned ${deadTokens.length} dead tokens`);
  }

  return new Response(
    JSON.stringify({
      success: true,
      sent: okCount,
      errors: errorCount,
      pruned: deadTokens.length,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
