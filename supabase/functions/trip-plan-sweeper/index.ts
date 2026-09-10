// pg_cron target. {action:"sweep"} every 5 minutes: flips overdue plans,
// sends nudges, expires stale ones, retries failed notifications.
// {action:"purge"} daily: hard-deletes closed plans past their retention.
// Gated by the cron shared secret like the other maintenance functions.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { requireCronKey } from "../_shared/cron-auth.ts";
import { transition } from "../_shared/trip-plan-state.ts";
import { notifyAll, retryFailed } from "../_shared/trip-plan-notify.ts";
import {
  corsHeaders,
  fromState,
  json,
  loadContacts,
  loadPlan,
  log,
  serviceClient,
  shareUrl,
  toState,
  type PlanRowFull,
} from "../_shared/trip-plan-common.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const denied = await requireCronKey(req, corsHeaders);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const action = body?.action ?? "sweep";
  const supabase = serviceClient();
  const t0 = Date.now();

  try {
    if (action === "purge") {
      const { data, error } = await supabase
        .from("trip_plans")
        .delete()
        .lte("purge_after", new Date().toISOString())
        .select("id");
      if (error) throw new Error(error.message);
      await supabase.from("trip_plan_rate_limits").delete().lte("expires_at", new Date().toISOString());
      log({ fn: "trip-plan-sweeper", action, purged: data?.length ?? 0, duration_ms: Date.now() - t0 });
      return json(200, { purged: data?.length ?? 0 });
    }

    const now = Date.now();
    const { data: due, error } = await supabase
      .from("trip_plans")
      .select("id")
      .in("status", ["active", "overdue"])
      .lte("worry_by", new Date(now).toISOString());
    if (error) throw new Error(error.message);

    let transitions = 0;
    for (const { id } of due ?? []) {
      // Optimistic lock: re-read, transition, update only if the row still
      // matches what we read (status + nudge stamps). Two overlapping sweeps
      // can't both win the conditional update.
      const plan = await loadPlan(supabase, id);
      if (!plan) continue;
      const r = transition(toState(plan), { type: "sweep", at: now });
      if (r.effects.length === 0) continue;
      const patch = fromState(r.state);
      let q = supabase.from("trip_plans").update(patch).eq("id", id).eq("status", plan.status);
      q = plan.nudge_1_sent_at === null ? q.is("nudge_1_sent_at", null) : q.eq("nudge_1_sent_at", plan.nudge_1_sent_at);
      q = plan.nudge_2_sent_at === null ? q.is("nudge_2_sent_at", null) : q.eq("nudge_2_sent_at", plan.nudge_2_sent_at);
      const { data: updated } = await q.select("id");
      if (!updated || updated.length === 0) continue; // lost the race
      transitions++;
      const fresh = (await loadPlan(supabase, id)) as PlanRowFull;
      const contacts = await loadContacts(supabase, id);
      for (const e of r.effects) {
        if (e.kind === "notify_all") {
          await notifyAll({
            supabase,
            plan: fresh,
            contacts: contacts.map((c) => ({
              id: c.id,
              display_name: c.display_name,
              email: c.email,
              phone_e164: c.phone_e164,
              share_url: shareUrl(c.share_token),
            })),
            template: e.template,
          });
        }
      }
    }

    // Retry failed notifications (≤3 attempts, 10 min apart).
    const { data: failed } = await supabase
      .from("trip_plan_events")
      .select("id, plan_id, contact_id, payload")
      .eq("type", "nudge_failed")
      .lte("payload->>next_attempt_at", new Date(now).toISOString())
      .limit(50);
    let retried = 0;
    for (const ev of failed ?? []) {
      if (!ev.payload?.next_attempt_at) continue;
      const plan = await loadPlan(supabase, ev.plan_id);
      const contact = (await loadContacts(supabase, ev.plan_id)).find((c) => c.id === ev.contact_id);
      if (!plan || !contact) continue;
      await retryFailed(supabase, ev, plan, {
        id: contact.id,
        display_name: contact.display_name,
        email: contact.email,
        phone_e164: contact.phone_e164,
        share_url: shareUrl(contact.share_token),
      });
      retried++;
    }

    log({ fn: "trip-plan-sweeper", action, due: due?.length ?? 0, transitions, retried, duration_ms: Date.now() - t0 });
    return json(200, { due: due?.length ?? 0, transitions, retried });
  } catch (err) {
    log({ fn: "trip-plan-sweeper", action, outcome: "internal", msg: err instanceof Error ? err.message : String(err) });
    return json(500, { error: "internal" });
  }
});
