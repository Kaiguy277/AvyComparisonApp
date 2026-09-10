// Client transport for the `trip-plans` edge function.
//
// Plain fetch rather than supabase.functions.invoke: the outbox needs the
// HTTP status to decide retry-vs-drop, and invoke() folds non-2xx into a
// thrown FunctionsHttpError.

import type { SendResult } from "./outbox";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const TRIP_PLANS_URL = `${SUPABASE_URL}/functions/v1/trip-plans`;
export const TRIP_PLAN_PAGE_BASE =
  process.env.EXPO_PUBLIC_TRIP_PLAN_PAGE_BASE ??
  `${SUPABASE_URL}/functions/v1/trip-plan-page`;

export interface ServerContact {
  id: string;
  clientId: string;
  displayName: string;
  shareUrl: string;
  lastOpenedAt: string | null;
}

export interface ServerPlan {
  id: string;
  status: "active" | "overdue" | "closed";
  closeReason: string | null;
  returnBy: string;
  worryBy: string;
  closedAt: string | null;
}

export interface ServerEvent {
  type: string;
  actor: "user" | "contact" | "system";
  contactName: string | null;
  at: string;
  note: string | null;
}

export interface CreateResponse {
  plan: ServerPlan;
  contacts: ServerContact[];
  warnings?: string[];
}

export interface StatusResponse {
  plan: ServerPlan;
  contacts: ServerContact[];
  events: ServerEvent[];
}

export async function callTripPlans(
  body: Record<string, unknown>,
  opts: { timeoutMs?: number } = {},
): Promise<SendResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20_000);
  try {
    const res = await fetch(TRIP_PLANS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    let parsed: unknown = undefined;
    try {
      parsed = await res.json();
    } catch {}
    const errMsg =
      parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : undefined;
    return { ok: res.ok, status: res.status, body: parsed, error: res.ok ? undefined : errMsg };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
