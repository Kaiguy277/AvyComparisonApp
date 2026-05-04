// Diagnostic dump of the silent-push + cron pipeline. Returns a single
// JSON snapshot of every link the app's background refresh depends on:
//
//   - cron.job rows for avy-* schedules
//   - last 10 cron.job_run_details rows for those jobs
//   - count of public.device_tokens
//   - last 5 stations_cache writes (so we can see if the cron is
//     actually writing data)
//   - last 5 forecast_cache writes
//
// Read-only. Service-role internally; called via the anon key from
// outside (the function itself wraps the privileged query).

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("INTERNAL_SR_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const out: Record<string, unknown> = {};

  // 1. Cron jobs
  try {
    const { data, error } = await supabase.rpc("audit_pipeline_jobs");
    if (error) out.cronJobs = { error: error.message };
    else out.cronJobs = data;
  } catch (err) {
    out.cronJobs = { error: String(err) };
  }

  // 2. Cron run details — last 10
  try {
    const { data, error } = await supabase.rpc("audit_pipeline_runs");
    if (error) out.cronRuns = { error: error.message };
    else out.cronRuns = data;
  } catch (err) {
    out.cronRuns = { error: String(err) };
  }

  // 3. Device token count
  try {
    const { count, error } = await supabase
      .from("device_tokens")
      .select("*", { count: "exact", head: true });
    if (error) out.deviceTokens = { error: error.message };
    else out.deviceTokens = { count };
  } catch (err) {
    out.deviceTokens = { error: String(err) };
  }

  // 4. Recent stations_cache writes
  try {
    const { data, error } = await supabase
      .from("stations_cache")
      .select("zone_id, center_id, fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(5);
    if (error) out.recentStations = { error: error.message };
    else out.recentStations = data;
  } catch (err) {
    out.recentStations = { error: String(err) };
  }

  // 5. Recent forecast_cache writes
  try {
    const { data, error } = await supabase
      .from("forecast_cache")
      .select("zone_id, forecast_date, fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(5);
    if (error) out.recentForecasts = { error: error.message };
    else out.recentForecasts = data;
  } catch (err) {
    out.recentForecasts = { error: String(err) };
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
