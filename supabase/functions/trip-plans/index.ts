// Trip Plan API. One function, `action` discriminator, POST only.
//
//   user actions    create · check_in · cancel · get_status   (plan_secret)
//   contact actions opened · extend · heard_from · search_started · note (share_token)
//
// State transitions come from the shared pure state machine; this file
// does auth, validation, persistence, and notification fan-out.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@4.1.5";

import {
  TransitionError,
  transition,
  type PlanEvent,
  type SideEffect,
} from "../_shared/trip-plan-state.ts";
import { notifyAll, pushUser } from "../_shared/trip-plan-notify.ts";
import {
  clientIp,
  corsHeaders,
  fromState,
  insertEvent,
  json,
  loadContacts,
  loadEvents,
  loadPlan,
  log,
  publicPlan,
  randomToken,
  rateLimited,
  serviceClient,
  sha256Hex,
  shareUrl,
  timingSafeEqual,
  toState,
  type ContactRowFull,
  type PlanRowFull,
} from "../_shared/trip-plan-common.ts";

const LIMITS = {
  maxContacts: 5,
  maxWorryOffsetMs: 48 * 3_600_000,
  maxPacketBytes: 393_216,
  createPerMin: 10,
  contactPer5Min: 30,
  // A tracking client posts a batch every few minutes; this is generous
  // enough for several parties behind one NAT and still bounds abuse.
  locationPer5Min: 120,
  maxTrailPoints: 1000,
  maxPointsPerPost: 200,
};

const instant = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "bad instant");

const createSchema = z.object({
  action: z.literal("create"),
  plan_id: z.string().uuid(),
  plan_secret: z.string().min(16).max(64),
  owner_device_id: z.string().min(8).max(80),
  timezone: z.string().min(1).max(64),
  depart_at: instant,
  return_by: instant,
  worry_by: instant,
  contacts: z
    .array(
      z.object({
        client_id: z.string().min(1).max(80),
        display_name: z.string().min(1).max(80),
        phone_e164: z.string().regex(/^\+[1-9]\d{6,14}$/).nullable(),
        email: z.string().email().max(254),
      }),
    )
    .min(1)
    .max(LIMITS.maxContacts),
  packet: z.object({
    version: z.literal(1),
    createdAt: instant,
    draft: z.object({
      areaName: z.string().min(1),
      trailheadName: z.string().min(1),
      route: z.string().min(1),
      subject: z.object({ fullName: z.string().min(1), phone: z.string().min(1) }).passthrough(),
      contacts: z.array(z.unknown()),
    }).passthrough(),
    forecast: z.unknown().nullable(),
  }),
});

const userActionSchema = z.object({
  action: z.enum(["check_in", "cancel", "get_status"]),
  plan_id: z.string().uuid(),
  plan_secret: z.string().min(16).max(64),
  client_at: instant.optional(),
  idempotency_key: z.string().max(120).optional(),
});

// Live trip tracking. Authenticated with plan_secret exactly like the other
// user actions — a share_token holder can READ the trail on the packet page
// but can never write to it.
const locationActionSchema = z.object({
  action: z.literal("location"),
  plan_id: z.string().uuid(),
  plan_secret: z.string().min(16).max(64),
  points: z
    .array(
      z.object({
        at: instant,
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        accuracy_m: z.number().nonnegative().max(100_000).optional(),
      }),
    )
    .min(1)
    .max(LIMITS.maxPointsPerPost),
});

const contactActionSchema = z.object({
  action: z.enum(["opened", "extend", "heard_from", "search_started", "note"]),
  share_token: z.string().min(16).max(64),
  new_worry_by: instant.optional(),
  note: z.string().max(1000).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_body" });
  }
  const action = (body as { action?: string })?.action;
  const supabase = serviceClient();
  const ip = clientIp(req);
  const t0 = Date.now();

  try {
    let res: Response;
    if (action === "create") {
      if (await rateLimited(supabase, "create", ip, LIMITS.createPerMin, 60)) {
        return json(429, { error: "rate_limited" });
      }
      res = await handleCreate(supabase, body);
    } else if (action === "check_in" || action === "cancel" || action === "get_status") {
      res = await handleUser(supabase, body);
    } else if (action === "location") {
      if (await rateLimited(supabase, "location", ip, LIMITS.locationPer5Min, 300)) {
        return json(429, { error: "rate_limited" });
      }
      res = await handleLocation(supabase, body);
    } else if (
      action === "opened" || action === "extend" || action === "heard_from" ||
      action === "search_started" || action === "note"
    ) {
      if (await rateLimited(supabase, "contact", ip, LIMITS.contactPer5Min, 300)) {
        return json(429, { error: "rate_limited" });
      }
      res = await handleContact(supabase, body);
    } else {
      res = json(400, { error: "unknown_action" });
    }
    log({ fn: "trip-plans", action, status: res.status, duration_ms: Date.now() - t0 });
    return res;
  } catch (err) {
    log({ fn: "trip-plans", action, outcome: "internal", msg: err instanceof Error ? err.message : String(err) });
    return json(500, { error: "internal" });
  }
});

// ── create ─────────────────────────────────────────────────────────────────

async function handleCreate(supabase: ReturnType<typeof serviceClient>, raw: unknown) {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return json(400, { error: "invalid_body", issues: parsed.error.issues.slice(0, 5) });
  }
  const b = parsed.data;
  const depart = Date.parse(b.depart_at);
  const ret = Date.parse(b.return_by);
  const worry = Date.parse(b.worry_by);
  if (!(depart < ret && ret <= worry && worry - ret <= LIMITS.maxWorryOffsetMs)) {
    return json(400, { error: "invalid_times" });
  }
  if (new TextEncoder().encode(JSON.stringify(b.packet)).length > LIMITS.maxPacketBytes) {
    return json(400, { error: "packet_too_large" });
  }

  const secretHash = await sha256Hex(b.plan_secret);

  // Idempotent replay.
  const existing = await loadPlan(supabase, b.plan_id);
  if (existing) {
    if (!timingSafeEqual(existing.plan_secret_hash, secretHash)) return json(403, { error: "unauthorized" });
    const contacts = await loadContacts(supabase, b.plan_id);
    return json(200, { plan: publicPlan(existing), contacts: contactsPublic(contacts) });
  }

  // One live plan per owner.
  const { data: open } = await supabase
    .from("trip_plans")
    .select("id")
    .eq("owner_device_id", b.owner_device_id)
    .in("status", ["active", "overdue"])
    .limit(1);
  if (open && open.length > 0) {
    return json(409, { error: "active_plan_exists", plan_id: open[0].id });
  }

  const contactRows = b.contacts.map((c) => ({
    plan_id: b.plan_id,
    client_id: c.client_id,
    display_name: c.display_name,
    phone_e164: c.phone_e164,
    email: c.email,
    share_token: randomToken(16),
  }));

  const { error: planErr } = await supabase.from("trip_plans").insert({
    id: b.plan_id,
    status: "active",
    owner_device_id: b.owner_device_id,
    plan_secret_hash: secretHash,
    timezone: b.timezone,
    depart_at: b.depart_at,
    return_by: b.return_by,
    worry_by: b.worry_by,
    worry_by_original: b.worry_by,
    packet: b.packet,
  });
  if (planErr) throw new Error(`insert plan: ${planErr.message}`);

  const { error: cErr } = await supabase.from("trip_plan_contacts").insert(contactRows);
  if (cErr) {
    await supabase.from("trip_plans").delete().eq("id", b.plan_id);
    throw new Error(`insert contacts: ${cErr.message}`);
  }
  await insertEvent(supabase, b.plan_id, "created", "user", null, { contacts: b.contacts.length });

  const plan = (await loadPlan(supabase, b.plan_id))!;
  const contacts = await loadContacts(supabase, b.plan_id);
  return json(201, { plan: publicPlan(plan), contacts: contactsPublic(contacts) });
}

// ── user actions ───────────────────────────────────────────────────────────

async function handleUser(supabase: ReturnType<typeof serviceClient>, raw: unknown) {
  const parsed = userActionSchema.safeParse(raw);
  if (!parsed.success) return json(400, { error: "invalid_body" });
  const b = parsed.data;
  const plan = await loadPlan(supabase, b.plan_id);
  if (!plan) return json(404, { error: "plan_not_found" });
  if (!timingSafeEqual(plan.plan_secret_hash, await sha256Hex(b.plan_secret))) {
    return json(403, { error: "unauthorized" });
  }
  const contacts = await loadContacts(supabase, b.plan_id);

  if (b.action === "get_status") {
    return json(200, await statusResponse(supabase, plan, contacts));
  }

  const now = Date.now();
  const ev: PlanEvent = b.action === "check_in" ? { type: "check_in", at: now } : { type: "cancel", at: now };
  const r = transition(toState(plan), ev);
  const late = r.effects.some((e) => e.kind === "record_late");
  if (!late) {
    const { error } = await supabase.from("trip_plans").update(fromState(r.state)).eq("id", plan.id);
    if (error) throw new Error(error.message);
  }
  await insertEvent(supabase, plan.id, b.action === "check_in" ? "checked_in" : "cancelled", "user", null, {
    client_at: b.client_at ?? null,
    late,
  });
  const updated = (await loadPlan(supabase, plan.id))!;
  await runEffects(supabase, updated, contacts, r.effects, null, null);
  return json(200, { plan: publicPlan(updated), contacts: contactsPublic(contacts), late });
}

// ── live tracking ──────────────────────────────────────────────────────────

async function handleLocation(supabase: ReturnType<typeof serviceClient>, raw: unknown) {
  const parsed = locationActionSchema.safeParse(raw);
  if (!parsed.success) return json(400, { error: "invalid_body" });
  const b = parsed.data;

  const plan = await loadPlan(supabase, b.plan_id);
  if (!plan) return json(404, { error: "plan_not_found" });
  if (!timingSafeEqual(plan.plan_secret_hash, await sha256Hex(b.plan_secret))) {
    return json(403, { error: "unauthorized" });
  }

  // Two hard stops, both privacy guarantees the UI promises the user:
  // tracking only happens for a trip they opted in on, and it stops the
  // moment the trip closes. A client that keeps posting after check-in (a
  // stale background task that hasn't been torn down yet) is refused here
  // rather than quietly recorded.
  if (!plan.tracking_enabled) return json(409, { error: "tracking_disabled" });
  if (plan.status === "closed") return json(409, { error: "plan_closed" });

  const rows = b.points.map((p) => ({
    plan_id: plan.id,
    at: new Date(p.at).toISOString(),
    lat: p.lat,
    lng: p.lng,
    accuracy_m: p.accuracy_m ?? null,
  }));

  const { error } = await supabase.from("trip_plan_locations").insert(rows);
  if (error) throw new Error(error.message);

  // Bound the trail. Best-effort: the points are already stored, and a
  // failed trim must not make the client retry and duplicate them.
  const { error: trimErr } = await supabase.rpc("trim_trip_plan_locations", {
    p_plan_id: plan.id,
    p_keep: LIMITS.maxTrailPoints,
  });
  if (trimErr) console.warn("[trip-plans] trail trim failed", trimErr.message);

  return json(200, { ok: true, accepted: rows.length });
}

// ── contact actions ────────────────────────────────────────────────────────

async function handleContact(supabase: ReturnType<typeof serviceClient>, raw: unknown) {
  const parsed = contactActionSchema.safeParse(raw);
  if (!parsed.success) return json(400, { error: "invalid_body" });
  const b = parsed.data;
  const { data: contact } = await supabase
    .from("trip_plan_contacts")
    .select("*")
    .eq("share_token", b.share_token)
    .maybeSingle();
  if (!contact) return json(404, { error: "not_found" });
  const c = contact as ContactRowFull;
  const plan = await loadPlan(supabase, c.plan_id);
  if (!plan) return json(410, { error: "plan_gone" });
  if (plan.purge_after && Date.parse(plan.purge_after) <= Date.now()) return json(410, { error: "plan_gone" });
  const contacts = await loadContacts(supabase, plan.id);
  const now = Date.now();

  if (b.action === "opened") {
    const last = c.last_opened_at ? Date.parse(c.last_opened_at) : 0;
    if (now - last > 6 * 3_600_000) {
      await supabase.from("trip_plan_contacts").update({ last_opened_at: new Date(now).toISOString() }).eq("id", c.id);
      await insertEvent(supabase, plan.id, "opened", "contact", c.id);
      await pushUser(supabase, plan.owner_device_id, "Trip plan opened", `${c.display_name} opened your trip plan.`, { planId: plan.id });
    }
    return json(200, { plan: publicPlan(plan) });
  }

  if (b.action === "note") {
    await insertEvent(supabase, plan.id, "note", "contact", c.id, { note: b.note ?? "" });
    return json(200, { plan: publicPlan(plan) });
  }

  let ev: PlanEvent;
  if (b.action === "extend") {
    if (!b.new_worry_by) return json(400, { error: "invalid_body" });
    ev = { type: "extend", at: now, newWorryBy: Date.parse(b.new_worry_by) };
  } else if (b.action === "heard_from") {
    ev = { type: "heard_from", at: now };
  } else {
    ev = { type: "search_started", at: now };
  }

  let r;
  try {
    r = transition(toState(plan), ev);
  } catch (err) {
    if (err instanceof TransitionError) return json(400, { error: err.code, message: err.message });
    throw err;
  }
  const { error } = await supabase.from("trip_plans").update(fromState(r.state)).eq("id", plan.id);
  if (error) throw new Error(error.message);
  await insertEvent(supabase, plan.id, b.action === "extend" ? "extended" : b.action, "contact", c.id, {
    note: b.note ?? null,
    new_worry_by: b.new_worry_by ?? null,
  });
  const updated = (await loadPlan(supabase, plan.id))!;
  await runEffects(supabase, updated, contacts, r.effects, c.display_name, b.note ?? null);
  return json(200, { plan: publicPlan(updated) });
}

// ── shared ─────────────────────────────────────────────────────────────────

function contactsPublic(contacts: ContactRowFull[]) {
  return contacts.map((c) => ({
    id: c.id,
    clientId: c.client_id,
    displayName: c.display_name,
    shareUrl: shareUrl(c.share_token),
    lastOpenedAt: c.last_opened_at,
  }));
}

async function statusResponse(
  supabase: ReturnType<typeof serviceClient>,
  plan: PlanRowFull,
  contacts: ContactRowFull[],
) {
  const events = await loadEvents(supabase, plan.id, 30);
  const nameOf = (id: string | null) => contacts.find((c) => c.id === id)?.display_name ?? null;
  return {
    plan: publicPlan(plan),
    contacts: contactsPublic(contacts),
    events: events
      .filter((e) => e.type !== "nudge_failed")
      .map((e) => ({
        type: e.type,
        actor: e.actor,
        contactName: nameOf(e.contact_id),
        at: e.at,
        note: (e.payload?.note as string | null) ?? null,
      })),
  };
}

async function runEffects(
  supabase: ReturnType<typeof serviceClient>,
  plan: PlanRowFull,
  contacts: ContactRowFull[],
  effects: SideEffect[],
  actorName: string | null,
  note: string | null,
) {
  const withUrls = contacts.map((c) => ({
    id: c.id,
    display_name: c.display_name,
    email: c.email,
    phone_e164: c.phone_e164,
    share_url: shareUrl(c.share_token),
  }));
  for (const e of effects) {
    if (e.kind === "notify_all") {
      await notifyAll({ supabase, plan, contacts: withUrls, template: e.template, actorName, note });
    } else if (e.kind === "push_user") {
      const name = actorName ?? "A contact";
      const text =
        e.template === "extended" ? `${name} extended your worry-by time.` :
        e.template === "heard_from" ? `${name} marked that they heard from you.` :
        e.template === "search_started" ? `${name} has started a search.` : "Trip plan update";
      await pushUser(supabase, plan.owner_device_id, "Trip plan", text, { planId: plan.id });
    }
  }
}
