// The client-side send / check-in / sync flows. Screens call these; the
// outbox does the retrying.
import {
  clearTrackingBuffer,
  flushTrackingBuffer,
  startTripTracking,
  stopTripTracking,
} from "./tracking";

import {
  tripPlanDraftSchema,
  type PacketSnapshot,
  type TripPlanDraftInput,
} from "./schema";
import { buildPacket, packetBytes } from "./packet";
import { TRIP_LIMITS } from "./schema";
import { newId, newSecret } from "./ids";
import {
  enqueue,
  flushOutbox,
  pendingFor,
  type FlushOutcome,
  type OutboxEntry,
} from "./outbox";
import { callTripPlans, type CreateResponse, type StatusResponse } from "./api";
import {
  deletePlanSecret,
  getDeviceId,
  loadActivePlan,
  loadPlanSecret,
  recordTripAsTemplate,
  saveActivePlan,
  saveDraft,
  savePlanSecret,
  updateActivePlan,
  type ActivePlan,
} from "./store";

export class PacketTooLargeError extends Error {}

// Validate, freeze the packet, mint ids, persist locally, enqueue the
// create. Returns immediately; call flushTripPlanOutbox() to send.
export async function createPlan(
  input: TripPlanDraftInput,
  forecast: PacketSnapshot["forecast"],
): Promise<ActivePlan> {
  const draft = tripPlanDraftSchema.parse(input);
  const packet = buildPacket(draft, forecast);
  if (packetBytes(packet) > TRIP_LIMITS.maxPacketBytes) {
    throw new PacketTooLargeError("Your plan is too long to send. Trim the longer notes.");
  }

  const planId = newId();
  const secret = newSecret();
  await savePlanSecret(planId, secret);
  const deviceId = await getDeviceId(newId);
  const now = new Date().toISOString();

  const active: ActivePlan = {
    planId,
    sync: "pending",
    status: "active",
    closeReason: null,
    areaName: draft.areaName,
    trailheadName: draft.trailheadName,
    subjectName: draft.subject.fullName ?? "",
    timezone: draft.timezone,
    departAt: draft.departAt,
    returnBy: draft.returnBy,
    worryBy: draft.worryBy,
    contacts: draft.contacts.map((c) => ({
      id: c.id,
      displayName: c.displayName,
      email: c.email,
    })),
    createdAt: now,
    trackingEnabled: draft.trackingEnabled,
  };
  await saveActivePlan(active);

  await enqueue({
    id: planId, // create is idempotent by plan id
    action: "create",
    planId,
    body: {
      action: "create",
      plan_id: planId,
      plan_secret: secret,
      owner_device_id: deviceId,
      timezone: draft.timezone,
      depart_at: draft.departAt,
      return_by: draft.returnBy,
      worry_by: draft.worryBy,
      contacts: draft.contacts.map((c) => ({
        client_id: c.id,
        display_name: c.displayName,
        phone_e164: c.phone ?? null,
        email: c.email,
      })),
      packet,
      tracking_enabled: draft.trackingEnabled,
    },
  });

  // Start background location only once the plan exists locally and only
  // when the user asked for it on THIS trip. A failure here (permission
  // declined) must not fail trip creation — the plan and its packet are the
  // safety-critical part; tracking is an addition to it.
  if (draft.trackingEnabled) {
    const started = await startTripTracking();
    if (started !== "started") {
      console.warn("[trip] tracking requested but not started:", started);
      await updateActivePlan((p) => ({ ...p, trackingEnabled: false }));
    }
  }

  await recordTripAsTemplate(input, { id: newId });
  await saveDraft(null);
  return active;
}

async function userAction(
  planId: string,
  action: "check_in" | "cancel",
): Promise<OutboxEntry | null> {
  const secret = await loadPlanSecret(planId);
  if (!secret) return null;
  const at = new Date().toISOString();
  const entry = await enqueue({
    id: `${planId}:${action}`,
    action,
    planId,
    body: {
      action,
      plan_id: planId,
      plan_secret: secret,
      client_at: at,
      idempotency_key: `${planId}:${action}`,
    },
  });
  await updateActivePlan((p) => ({ ...p, checkInQueuedAt: at, trackingEnabled: false }));

  // The trip is over as far as the user is concerned, so stop recording
  // immediately rather than waiting for the server round trip. One last
  // flush pushes anything still queued — the final positions are the ones
  // that matter most if the check-in itself is the thing that's late.
  await flushTrackingBuffer().catch(() => {});
  await stopTripTracking();
  await clearTrackingBuffer();

  return entry;
}

export const queueCheckIn = (planId: string) => userAction(planId, "check_in");
export const queueCancel = (planId: string) => userAction(planId, "cancel");

// Apply a server response to the local active plan.
async function applyServer(
  planId: string,
  body: CreateResponse | StatusResponse,
): Promise<void> {
  await updateActivePlan((p) => {
    if (p.planId !== planId) return p;
    const contacts = p.contacts.map((c) => {
      const s = body.contacts.find((x) => x.clientId === c.id);
      return s
        ? { ...c, serverId: s.id, shareUrl: s.shareUrl || c.shareUrl, lastOpenedAt: s.lastOpenedAt }
        : c;
    });
    return {
      ...p,
      sync: "created",
      syncError: undefined,
      status: body.plan.status,
      closeReason: body.plan.closeReason,
      worryBy: body.plan.worryBy,
      returnBy: body.plan.returnBy,
      contacts,
      lastSyncAt: new Date().toISOString(),
      events: "events" in body ? body.events : p.events,
      checkInQueuedAt: body.plan.status === "closed" ? undefined : p.checkInQueuedAt,
    };
  });
}

// Drain the outbox. Safe to call often (foreground, reconnect, timer).
export async function flushTripPlanOutbox(): Promise<FlushOutcome> {
  const outcome = await flushOutbox((entry) => callTripPlans(entry.body));

  for (const entry of outcome.sent) {
    const res = outcome.results.get(entry.id);
    if (res?.body && typeof res.body === "object" && "plan" in res.body) {
      await applyServer(entry.planId, res.body as CreateResponse);
    }
  }
  for (const { entry, result } of outcome.dropped) {
    if (entry.action === "create") {
      await updateActivePlan((p) =>
        p.planId === entry.planId
          ? { ...p, sync: "failed", syncError: result.error ?? `HTTP ${result.status}` }
          : p,
      );
    } else if (result.status === 404 || result.status === 410) {
      // Plan is gone server-side; nothing left to check in to.
      await updateActivePlan((p) =>
        p.planId === entry.planId ? { ...p, status: "closed", closeReason: "expired" } : p,
      );
    }
  }
  return outcome;
}

// Pull status (open receipts, contact actions) for the active plan.
export async function refreshActivePlan(): Promise<ActivePlan | null> {
  const plan = await loadActivePlan();
  if (!plan || plan.sync !== "created") return plan;
  const secret = await loadPlanSecret(plan.planId);
  if (!secret) return plan;
  const res = await callTripPlans(
    { action: "get_status", plan_id: plan.planId, plan_secret: secret },
    { timeoutMs: 10_000 },
  );
  if (res.ok && res.body && typeof res.body === "object" && "plan" in res.body) {
    await applyServer(plan.planId, res.body as StatusResponse);
  } else if (res.status === 404 || res.status === 410) {
    await updateActivePlan((p) => ({ ...p, status: "closed", closeReason: "expired" }));
  }
  return loadActivePlan();
}

export async function markShared(planId: string, contactId: string): Promise<void> {
  await updateActivePlan((p) => ({
    ...p,
    contacts: p.contacts.map((c) =>
      c.id === contactId ? { ...c, sharedAt: new Date().toISOString() } : c,
    ),
  }));
}

// Dismiss a closed plan from the home card. Keeps the secret until the
// server purges (7 days) in case a late status check is needed — cheap.
export async function dismissActivePlan(): Promise<void> {
  const plan = await loadActivePlan();
  if (!plan) return;
  const pending = await pendingFor(plan.planId);
  if (pending.length > 0) return; // don't orphan a queued check-in
  await saveActivePlan(null);
  if (plan.status === "closed") await deletePlanSecret(plan.planId);
}
