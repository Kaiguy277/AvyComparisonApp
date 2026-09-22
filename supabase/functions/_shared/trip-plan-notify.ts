// Notification adapters for trip plans: email (Resend) now, push to the
// user's device via the existing Expo push path, SMS (Twilio) later.
//
// Every attempt is recorded as a trip_plan_events row (nudge_sent /
// nudge_failed) so the sweeper can retry and operators can audit
// delivery without provider dashboards. Packet contents never go in a
// message body — only status, the link, and what to do.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type { NotifyTemplate } from "./trip-plan-state.ts";

export interface PlanRow {
  id: string;
  status: string;
  close_reason: string | null;
  timezone: string;
  return_by: string;
  worry_by: string;
  packet: { draft: { subject: { fullName?: string; phone?: string }; areaName: string } };
}

export interface ContactRow {
  id: string;
  display_name: string;
  email: string | null;
  phone_e164: string | null;
  share_url: string; // rebuilt from the token at send time by the caller
}

export interface NotifyContext {
  supabase: SupabaseClient;
  plan: PlanRow;
  contacts: ContactRow[];
  template: NotifyTemplate;
  actorName?: string | null;
  note?: string | null;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function firstName(full: string | undefined): string {
  return (full ?? "").trim().split(/\s+/)[0] || "Your friend";
}

function fmt(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function renderTemplate(
  template: NotifyTemplate,
  plan: PlanRow,
  contact: ContactRow,
  actorName?: string | null,
  note?: string | null,
): { subject: string; text: string; html: string } {
  const name = firstName(plan.packet.draft.subject.fullName);
  const area = plan.packet.draft.areaName;
  const phone = plan.packet.draft.subject.phone ?? "";
  const back = fmt(plan.return_by, plan.timezone);
  const worry = fmt(plan.worry_by, plan.timezone);
  const link = contact.share_url;
  const who = actorName ?? "A contact";
  const noteLine = note ? `\nNote: "${note}"` : "";

  const bodies: Record<NotifyTemplate, { subject: string; text: string }> = {
    heading_out: {
      subject: `${name} is heading out — ${area}`,
      text:
        `${name} is heading to ${area} and listed you as someone to tell.\n\n` +
        `Back by: ${back}\n` +
        `If you haven't heard from ${name} by ${worry}, open this page — it tells you what to do and has everything Search and Rescue will ask for:\n${link}\n\n` +
        `Nothing to do right now, and you don't need the app. Just keep this — the same page updates itself if plans change, and you'll get another email when ${name} checks in.`,
    },
    nudge_1: {
      subject: `${name} is overdue — ${area}`,
      text:
        `${name} was due back by ${back} and hasn't checked in. It's now past the worry-by time (${worry}).\n\n` +
        `1. Try ${name}'s phone: ${phone}\n` +
        `2. If you can't reach them, call 911 (or the nearest Alaska State Troopers post) and say "I'm reporting an overdue backcountry party." Then read them this page from the top:\n${link}\n\n` +
        `Do not wait — there is no waiting period to report a missing person in Alaska.`,
    },
    nudge_2: {
      subject: `Still no check-in from ${name} — ${area}`,
      text:
        `It's been an hour since the worry-by time and ${name} still hasn't checked in.\n\n` +
        `If you haven't already: call 911 and report an overdue backcountry party. Everything they'll ask for is here:\n${link}`,
    },
    extended: {
      subject: `${name}'s worry-by time was extended`,
      text: `${who} extended ${name}'s worry-by time to ${worry}.${noteLine}\n\n${link}`,
    },
    heard_from: {
      subject: `${who} heard from ${name} — all good`,
      text: `${who} marked that they heard from ${name}.${noteLine}\n\nNothing more to do. ${link}`,
    },
    search_started: {
      subject: `${who} has called for a search for ${name}`,
      text:
        `${who} reported ${name} overdue to the authorities.${noteLine}\n\n` +
        `Keep this page open — it has everything rescuers will ask for. Stay reachable.\n${link}`,
    },
    checked_in: {
      subject: `${name} checked in — back safe from ${area}`,
      text: `${name} checked in from the app. Trip plan closed. ${link}`,
    },
    cancelled: {
      subject: `${name} cancelled the ${area} trip plan`,
      text: `${name} cancelled this trip plan. No action needed. ${link}`,
    },
    expired: {
      subject: `${name}'s trip plan expired with no check-in`,
      text:
        `72 hours have passed since the worry-by time and no check-in or contact action was ever recorded for ${name}'s ${area} plan.\n\n` +
        `If you know they're fine, no action is needed. If not, call 911 now. ${link}`,
    },
    late_check_in: {
      subject: `${name}'s phone just checked in`,
      text: `${name}'s phone reported a check-in after the plan had already been closed. ${link}`,
    },
  };

  const b = bodies[template];
  const html = `<pre style="font: 15px/1.5 -apple-system, system-ui, sans-serif; white-space: pre-wrap">${escapeHtml(b.text)}</pre>`;
  return { subject: b.subject, text: b.text, html };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

// ── email (Resend) ─────────────────────────────────────────────────────────

async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<string> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("TRIP_PLAN_EMAIL_FROM") ?? "Whumpf <trips@avycomparison.kaiconsulting.ai>";
  if (!key) throw new Error("RESEND_API_KEY not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { id?: string };
  return body.id ?? "";
}

// ── push to the plan owner's device ────────────────────────────────────────

export async function pushUser(
  supabase: SupabaseClient,
  ownerDeviceId: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  // Owner device id → push token mapping is opt-in (post-v1: the app
  // registers its device id alongside its token). Until then this is a
  // best-effort lookup that no-ops when the column is absent.
  const { data: rows, error } = await supabase
    .from("device_tokens")
    .select("token")
    .eq("trip_device_id", ownerDeviceId)
    .limit(3);
  if (error || !rows?.length) return;
  await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      rows.map((r: { token: string }) => ({ to: r.token, title, body, data, priority: "high" })),
    ),
  }).catch(() => {});
}

// ── fan-out ────────────────────────────────────────────────────────────────

export async function notifyAll(ctx: NotifyContext): Promise<{ sent: number; failed: number }> {
  const channels = (Deno.env.get("TRIP_NUDGE_CHANNELS") ?? "email").split(",");
  let sent = 0;
  let failed = 0;
  for (const contact of ctx.contacts) {
    const msg = renderTemplate(ctx.template, ctx.plan, contact, ctx.actorName, ctx.note);
    for (const channel of channels) {
      if (channel === "email" && contact.email) {
        try {
          const id = await sendEmail(contact.email, msg.subject, msg.text, msg.html);
          await ctx.supabase.from("trip_plan_events").insert({
            plan_id: ctx.plan.id,
            type: "nudge_sent",
            actor: "system",
            contact_id: contact.id,
            payload: { channel, template: ctx.template, provider_id: id },
          });
          sent++;
        } catch (err) {
          failed++;
          await ctx.supabase.from("trip_plan_events").insert({
            plan_id: ctx.plan.id,
            type: "nudge_failed",
            actor: "system",
            contact_id: contact.id,
            payload: {
              channel,
              template: ctx.template,
              attempts: 1,
              error: err instanceof Error ? err.message.slice(0, 200) : String(err),
              next_attempt_at: new Date(Date.now() + 10 * 60_000).toISOString(),
              actor_name: ctx.actorName ?? null,
              note: ctx.note ?? null,
            },
          });
        }
      }
      // "sms" channel: implement in trip-plan-notify-sms.ts once Twilio
      // 10DLC clears; contacts without phone_e164 fall back to email.
    }
  }
  return { sent, failed };
}

// Retry a single failed nudge (called by the sweeper).
export async function retryFailed(
  supabase: SupabaseClient,
  event: { id: number; plan_id: string; contact_id: string | null; payload: Record<string, unknown> },
  plan: PlanRow,
  contact: ContactRow,
): Promise<void> {
  const attempts = Number(event.payload.attempts ?? 1);
  const template = event.payload.template as NotifyTemplate;
  const msg = renderTemplate(
    template,
    plan,
    contact,
    (event.payload.actor_name as string | null) ?? null,
    (event.payload.note as string | null) ?? null,
  );
  try {
    if (!contact.email) throw new Error("no email");
    const id = await sendEmail(contact.email, msg.subject, msg.text, msg.html);
    await supabase.from("trip_plan_events").update({
      type: "nudge_sent",
      payload: { ...event.payload, provider_id: id, retried: true },
    }).eq("id", event.id);
  } catch (err) {
    const next = attempts + 1;
    await supabase.from("trip_plan_events").update({
      payload: {
        ...event.payload,
        attempts: next,
        error: err instanceof Error ? err.message.slice(0, 200) : String(err),
        next_attempt_at:
          next >= 3 ? null : new Date(Date.now() + 10 * 60_000).toISOString(),
      },
    }).eq("id", event.id);
  }
}
