// Shared-secret gate for the publicly-invokable maintenance functions.
//
// These functions run with verify_jwt on, but the only JWT the app
// carries is the anon key baked into the bundle — so the JWT check
// alone lets anyone invoke them (quota burn, push spam). We require a
// second factor: an `x-cron-key` header matching the secret stored in
// private.function_secrets (which the anon PostgREST role cannot read).
//
// The caller (pg_cron) sends the header; the function reads the
// expected value with its service-role client and compares in constant
// time. One extra DB read per invocation — negligible at cron cadence.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SECRET_NAME = "cron_shared_secret";

// Constant-time string compare — avoids leaking the secret's length/
// prefix through response timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Returns null when the request is authorized; otherwise a 401 Response
// the caller should return immediately.
export async function requireCronKey(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const presented = req.headers.get("x-cron-key");
  if (!presented) {
    return unauthorized(corsHeaders, "missing x-cron-key");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("INTERNAL_SR_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("function_secrets")
    .select("value")
    .eq("name", SECRET_NAME)
    .single();

  if (error || !data?.value) {
    // Fail closed — if we can't read the secret, deny.
    console.error("[cron-auth] could not load secret", error?.message);
    return unauthorized(corsHeaders, "auth unavailable");
  }

  if (!timingSafeEqual(presented, data.value)) {
    return unauthorized(corsHeaders, "bad x-cron-key");
  }

  return null;
}

function unauthorized(
  corsHeaders: Record<string, string>,
  reason: string,
): Response {
  return new Response(JSON.stringify({ success: false, error: reason }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
