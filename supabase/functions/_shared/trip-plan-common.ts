// Shared helpers for the trip-plan edge functions: hashing, tokens,
// row → state mapping, contact share URLs, rate limiting, redacted logs.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type { PlanState } from "./trip-plan-state.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("INTERNAL_SR_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 16): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function pageBase(): string {
  return (
    Deno.env.get("TRIP_PLAN_PAGE_BASE") ??
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/trip-plan-page`
  );
}

export function shareUrl(token: string): string {
  return `${pageBase()}?t=${encodeURIComponent(token)}`;
}

export interface PlanRowFull {
  id: string;
  status: "active" | "overdue" | "closed";
  close_reason: PlanState["closeReason"];
  owner_user_id: string | null;
  owner_device_id: string;
  plan_secret_hash: string;
  timezone: string;
  depart_at: string;
  return_by: string;
  worry_by: string;
  worry_by_original: string;
  tracking_enabled?: boolean;
  packet: Record<string, unknown> & {
    draft: {
      subject: { fullName?: string; phone?: string };
      areaName: string;
      trailheadName: string;
      contacts: unknown[];
    };
  };
  nudge_1_sent_at: string | null;
  nudge_2_sent_at: string | null;
  created_at: string;
  closed_at: string | null;
  purge_after: string | null;
}

export function toState(row: PlanRowFull): PlanState {
  return {
    status: row.status,
    closeReason: row.close_reason,
    returnBy: Date.parse(row.return_by),
    worryBy: Date.parse(row.worry_by),
    nudge1SentAt: row.nudge_1_sent_at ? Date.parse(row.nudge_1_sent_at) : null,
    nudge2SentAt: row.nudge_2_sent_at ? Date.parse(row.nudge_2_sent_at) : null,
    closedAt: row.closed_at ? Date.parse(row.closed_at) : null,
  };
}

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

export function fromState(s: PlanState): Partial<PlanRowFull> {
  return {
    status: s.status,
    close_reason: s.closeReason,
    worry_by: new Date(s.worryBy).toISOString(),
    nudge_1_sent_at: iso(s.nudge1SentAt),
    nudge_2_sent_at: iso(s.nudge2SentAt),
    closed_at: iso(s.closedAt),
    purge_after: s.closedAt === null ? null : iso(s.closedAt + 7 * 24 * 3_600_000),
  };
}

export function publicPlan(row: PlanRowFull) {
  return {
    id: row.id,
    status: row.status,
    closeReason: row.close_reason,
    returnBy: row.return_by,
    worryBy: row.worry_by,
    closedAt: row.closed_at,
  };
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

// Returns true when the caller is over the limit.
export async function rateLimited(
  supabase: SupabaseClient,
  scope: string,
  ip: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  const windowStart = Math.floor(Date.now() / 1000 / windowSec) * windowSec;
  const bucket = `${scope}:${ip}:${windowStart}`;
  const { data, error } = await supabase.rpc("trip_plan_rate_bump", {
    p_bucket: bucket,
    p_ttl: `${windowSec * 2} seconds`,
  });
  if (error) {
    console.error(JSON.stringify({ fn: "rate", outcome: "error", msg: error.message }));
    return false; // fail open — rate limiting is defense in depth
  }
  return Number(data) > limit;
}

export function log(fields: Record<string, unknown>): void {
  // Never log packet contents, tokens, secrets, emails, phones.
  const { packet: _p, plan_secret: _s, share_token: _t, contacts: _c, ...safe } = fields;
  console.log(JSON.stringify(safe));
}

export async function loadPlan(
  supabase: SupabaseClient,
  planId: string,
): Promise<PlanRowFull | null> {
  const { data } = await supabase.from("trip_plans").select("*").eq("id", planId).maybeSingle();
  return (data as PlanRowFull | null) ?? null;
}

export interface ContactRowFull {
  id: string;
  plan_id: string;
  client_id: string;
  display_name: string;
  phone_e164: string | null;
  email: string | null;
  share_token: string;
  last_opened_at: string | null;
}

export async function loadContacts(
  supabase: SupabaseClient,
  planId: string,
): Promise<ContactRowFull[]> {
  const { data } = await supabase
    .from("trip_plan_contacts")
    .select("*")
    .eq("plan_id", planId)
    .order("created_at");
  return (data as ContactRowFull[] | null) ?? [];
}

// Live tracking trail, newest first. Only populated when the owner turned
// tracking on for this trip; empty otherwise.
export async function loadLocations(
  supabase: SupabaseClient,
  planId: string,
  limit = 200,
) {
  const { data } = await supabase
    .from("trip_plan_locations")
    .select("at, lat, lng, accuracy_m")
    .eq("plan_id", planId)
    .order("at", { ascending: false })
    .limit(limit);
  return (data ?? []) as {
    at: string;
    lat: number;
    lng: number;
    accuracy_m: number | null;
  }[];
}

export async function loadEvents(supabase: SupabaseClient, planId: string, limit = 50) {
  const { data } = await supabase
    .from("trip_plan_events")
    .select("id, type, actor, contact_id, payload, at")
    .eq("plan_id", planId)
    .order("at", { ascending: false })
    .limit(limit);
  return (data ?? []) as {
    id: number;
    type: string;
    actor: "user" | "contact" | "system";
    contact_id: string | null;
    payload: Record<string, unknown>;
    at: string;
  }[];
}

export async function insertEvent(
  supabase: SupabaseClient,
  planId: string,
  type: string,
  actor: "user" | "contact" | "system",
  contactId: string | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await supabase.from("trip_plan_events").insert({ plan_id: planId, type, actor, contact_id: contactId, payload });
}
