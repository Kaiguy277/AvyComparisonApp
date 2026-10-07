// Notification adapters for trip plans: email (Resend), an automated
// VOICE call (Twilio) for the overdue templates only, and push to the
// user's device via the existing Expo push path.
//
// Every attempt is recorded as a trip_plan_events row (nudge_sent /
// nudge_failed) so the sweeper can retry and operators can audit
// delivery without provider dashboards. Packet contents never go in a
// message body — only status, the link, and what to do.
//
// Channels come from the TRIP_NUDGE_CHANNELS secret (default `email`).
// `voice` adds the call, which fires ONLY for nudge_1 / nudge_2 / expired —
// never for heading_out, extended, checked_in and the rest. A contact
// without a phone number is simply not called; they still get the email.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type { NotifyTemplate } from "./trip-plan-state.ts";
import { gatherTwiml, placeCall } from "./twilio.ts";

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
  // True when the voice channel is on: the heading-out email then tells the
  // contact up front that an overdue plan will also ring their phone. That
  // notice is part of the TCPA posture — see docs/TRIP_PLAN_OPS.md.
  voice = false,
): { subject: string; text: string; html: string } {
  const name = firstName(plan.packet.draft.subject.fullName);
  const area = plan.packet.draft.areaName;
  const phone = plan.packet.draft.subject.phone ?? "";
  const back = fmt(plan.return_by, plan.timezone);
  const worry = fmt(plan.worry_by, plan.timezone);
  const link = contact.share_url;
  const who = actorName ?? "A contact";
  const noteLine = note ? `\nNote: "${note}"` : "";
  const callNotice = voice && contact.phone_e164
    ? `\n\nIf ${name} is overdue, Whumpf will also call you at ${contact.phone_e164} with an automated message so you don't miss it. Press 1 on that call to confirm you got it. The call is only ever made when ${name} is overdue.`
    : "";

  const bodies: Record<NotifyTemplate, { subject: string; text: string }> = {
    heading_out: {
      subject: `${name} is heading out — ${area}`,
      text:
        `${name} is heading to ${area} and listed you as someone to tell.\n\n` +
        `Back by: ${back}\n` +
        `If you haven't heard from ${name} by ${worry}, open this page — it tells you what to do and has everything Search and Rescue will ask for:\n${link}\n\n` +
        `Nothing to do right now, and you don't need the app. Just keep this — the same page updates itself if plans change, and you'll get another email when ${name} checks in.` +
        callNotice,
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

// ── voice (Twilio) ─────────────────────────────────────────────────────────

// The only templates that may ring a phone. Everything else is informational
// and goes by email alone. Keep this list short on purpose: an automated call
// to a number the callee never gave us is defensible for "your person is
// overdue in the backcountry" and for nothing else.
export const VOICE_TEMPLATES: ReadonlySet<NotifyTemplate> = new Set<NotifyTemplate>([
  "nudge_1",
  "nudge_2",
  "expired",
]);

// A call that was not answered (busy / no-answer / failed) is retried once
// through the nudge_failed path; two rings ten minutes apart is enough, and
// a third would start to look like harassment on a number that may be wrong.
export const VOICE_MAX_ATTEMPTS = 2;
const EMAIL_MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 10 * 60_000;

export function nudgeChannels(): string[] {
  return (Deno.env.get("TRIP_NUDGE_CHANNELS") ?? "email").split(",").map((c) => c.trim()).filter(Boolean);
}

export function voiceEnabled(): boolean {
  return nudgeChannels().includes("voice");
}

// Public URL of the trip-plan-voice function, as Twilio must reach it. Both
// the callback URLs we hand to Twilio and the signature check on the way
// back are built from this one value, so they always agree. Override with
// TRIP_PLAN_VOICE_BASE if the callbacks are routed via the Deno proxy.
export function voiceBase(): string {
  return (
    Deno.env.get("TRIP_PLAN_VOICE_BASE") ??
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/trip-plan-voice`
  );
}

export function voiceCallbackUrl(
  kind: "gather" | "status",
  planId: string,
  contactId: string,
  template: NotifyTemplate,
): string {
  const q = new URLSearchParams({ a: kind, p: planId, c: contactId, tpl: template });
  return `${voiceBase()}?${q.toString()}`;
}

// "+19075550100" → "9 0 7, 5 5 5, 0 1 0 0": digits read one at a time, with
// pauses, so the listener can write the number down.
export function spokenPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  const groups = national.length === 10
    ? [national.slice(0, 3), national.slice(3, 6), national.slice(6)]
    : [national];
  return groups.map((g) => g.split("").join(" ")).join(", ");
}

// What the call says. Short, no packet contents, ends with the single
// keypress we ask for. The email with the page link has already gone out.
export function renderVoiceScript(
  template: NotifyTemplate,
  plan: PlanRow,
): { script: string; afterNoInput: string } | null {
  if (!VOICE_TEMPLATES.has(template)) return null;
  const name = firstName(plan.packet.draft.subject.fullName);
  const area = plan.packet.draft.areaName;
  const phone = plan.packet.draft.subject.phone ?? "";
  const back = fmt(plan.return_by, plan.timezone);
  const intro = `This is an automated call from Whumpf, the trip plan app, on behalf of ${name}. `;
  const press = ` Press 1 to confirm you got this call.`;
  const scripts: Record<string, string> = {
    nudge_1:
      intro +
      `${name} listed you as an emergency contact for a backcountry trip to ${area}. ` +
      `${name} was due back by ${back} and has not checked in, and it is now past the worry-by time. ` +
      (phone ? `First, try ${name}'s phone at ${spokenPhone(phone)}. ` : "") +
      `If you can't reach them, call 9 1 1 and say you are reporting an overdue backcountry party. ` +
      `We emailed you a page with everything rescuers will ask for.` +
      press,
    nudge_2:
      `This is a second automated call from Whumpf about ${name}. ` +
      `It has been an hour since the worry-by time and ${name} still has not checked in from ${area}. ` +
      `If you haven't already, call 9 1 1 now and report an overdue backcountry party. ` +
      `The page we emailed you has everything they will ask for.` +
      press,
    expired:
      intro +
      `${name}'s trip plan for ${area} has expired. 72 hours have passed since the worry-by time and no check-in was ever recorded. ` +
      `If you know ${name} is fine, no action is needed. If not, call 9 1 1 now.` +
      press,
  };
  return {
    script: scripts[template],
    afterNoInput: `We didn't get a key press. Please check your email for ${name}'s trip page. Goodbye.`,
  };
}

function twilioCreds(): { accountSid: string; authToken: string; from: string } {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_E164");
  if (!accountSid || !authToken || !from) throw new Error("twilio not configured");
  return { accountSid, authToken, from };
}

// Place the call. Resolves with the Twilio call SID; the outcome comes back
// later on the status callback into trip-plan-voice.
async function callContact(
  plan: PlanRow,
  contact: ContactRow,
  template: NotifyTemplate,
): Promise<string> {
  if (!contact.phone_e164) throw new Error("no phone");
  const voice = renderVoiceScript(template, plan);
  if (!voice) throw new Error(`template ${template} is not a voice template`);
  const creds = twilioCreds();
  const twiml = gatherTwiml(
    voice.script,
    voiceCallbackUrl("gather", plan.id, contact.id, template),
    voice.afterNoInput,
  );
  return await placeCall(creds, {
    to: contact.phone_e164,
    from: creds.from,
    twiml,
    statusCallback: voiceCallbackUrl("status", plan.id, contact.id, template),
  });
}

// ── fan-out ────────────────────────────────────────────────────────────────

export async function notifyAll(ctx: NotifyContext): Promise<{ sent: number; failed: number }> {
  const channels = nudgeChannels();
  const voice = channels.includes("voice");
  let sent = 0;
  let failed = 0;
  for (const contact of ctx.contacts) {
    const msg = renderTemplate(ctx.template, ctx.plan, contact, ctx.actorName, ctx.note, voice);
    for (const channel of channels) {
      let attempt: (() => Promise<string>) | null = null;
      if (channel === "email" && contact.email) {
        const to = contact.email;
        attempt = () => sendEmail(to, msg.subject, msg.text, msg.html);
      } else if (channel === "voice" && VOICE_TEMPLATES.has(ctx.template) && contact.phone_e164) {
        attempt = () => callContact(ctx.plan, contact, ctx.template);
      }
      if (!attempt) continue;
      try {
        const id = await attempt();
        await ctx.supabase.from("trip_plan_events").insert({
          plan_id: ctx.plan.id,
          type: "nudge_sent",
          actor: "system",
          contact_id: contact.id,
          payload: {
            channel,
            template: ctx.template,
            provider_id: id,
            attempts: 1,
            // A call is only "sent" once Twilio reports how it ended; the
            // status callback (trip-plan-voice) fills this in.
            ...(channel === "voice" ? { call_status: "queued" } : {}),
          },
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
            next_attempt_at: new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
            actor_name: ctx.actorName ?? null,
            note: ctx.note ?? null,
          },
        });
      }
    }
  }
  return { sent, failed };
}

// Retry a single failed nudge (called by the sweeper). Channel-aware: a
// voice row re-places the call, an email row re-sends the email. `attempts`
// counts deliveries tried so far on this row; the voice cap is lower.
export async function retryFailed(
  supabase: SupabaseClient,
  event: { id: number; plan_id: string; contact_id: string | null; payload: Record<string, unknown> },
  plan: PlanRow,
  contact: ContactRow,
): Promise<void> {
  const attempts = Number(event.payload.attempts ?? 1);
  const template = event.payload.template as NotifyTemplate;
  const channel = (event.payload.channel as string | undefined) ?? "email";
  const max = channel === "voice" ? VOICE_MAX_ATTEMPTS : EMAIL_MAX_ATTEMPTS;
  const next = attempts + 1;
  try {
    let id: string;
    if (channel === "voice") {
      id = await callContact(plan, contact, template);
    } else {
      if (!contact.email) throw new Error("no email");
      const msg = renderTemplate(
        template,
        plan,
        contact,
        (event.payload.actor_name as string | null) ?? null,
        (event.payload.note as string | null) ?? null,
        voiceEnabled(),
      );
      id = await sendEmail(contact.email, msg.subject, msg.text, msg.html);
    }
    await supabase.from("trip_plan_events").update({
      type: "nudge_sent",
      payload: {
        ...event.payload,
        provider_id: id,
        attempts: next,
        retried: true,
        next_attempt_at: null,
        ...(channel === "voice" ? { call_status: "queued" } : {}),
      },
    }).eq("id", event.id);
  } catch (err) {
    await supabase.from("trip_plan_events").update({
      payload: {
        ...event.payload,
        attempts: next,
        error: err instanceof Error ? err.message.slice(0, 200) : String(err),
        next_attempt_at:
          next >= max ? null : new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
      },
    }).eq("id", event.id);
  }
}
