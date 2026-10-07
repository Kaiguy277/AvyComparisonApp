// Twilio webhooks for the overdue voice call. Deployed --no-verify-jwt
// (Twilio sends no Supabase headers); every POST is gated by the
// X-Twilio-Signature HMAC instead, so only Twilio, holding our auth token,
// can reach the handlers.
//
//   POST ?a=gather&p=<plan>&c=<contact>&tpl=<template>
//        the <Gather> action: Digits=1 means "I got the call" → a
//        call_acknowledged event on the plan (shown on the packet page). It
//        does NOT mean "heard from them" — that stays a deliberate tap on
//        the page, because it closes the trip for everyone.
//   POST ?a=status&p=&c=&tpl=
//        the StatusCallback for the call's final state. completed → the
//        nudge_sent row records how it ended (answered / voicemail);
//        busy / no-answer / failed / canceled → the row becomes
//        nudge_failed and the sweeper retries once (see retryFailed).
//   GET  ?a=ping
//        static TwiML, unauthenticated, no data — exists so we can check
//        from outside whether this host delivers text/xml unmodified.
//
// Responses to Twilio are TwiML (text/xml). The sweeper/trip-plans
// functions build these URLs from voiceBase(); the signature check here
// rebuilds the same URL, so the two never disagree.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { insertEvent, json, log, serviceClient } from "../_shared/trip-plan-common.ts";
import { VOICE_MAX_ATTEMPTS, voiceBase } from "../_shared/trip-plan-notify.ts";
import { sayAndHangupTwiml, TWIML_HEADERS, verifyTwilioRequest } from "../_shared/twilio.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FINAL_FAILURES = new Set(["busy", "no-answer", "failed", "canceled"]);
const RETRY_DELAY_MS = 10 * 60_000;

function twiml(body: string): Response {
  return new Response(body, { status: 200, headers: TWIML_HEADERS });
}

serve(async (req) => {
  const url = new URL(req.url);
  const a = url.searchParams.get("a");
  const t0 = Date.now();

  if (req.method === "GET" && a === "ping") {
    return twiml(`<?xml version="1.0" encoding="UTF-8"?><Response/>`);
  }
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!authToken) return json(503, { error: "voice_not_configured" });

  const params = new URLSearchParams(await req.text());
  // Verify against the URL Twilio was given, not req.url — behind the
  // Supabase gateway (or the Deno proxy) the two differ.
  const publicUrl = `${voiceBase()}${url.search}`;
  const ok = await verifyTwilioRequest(
    authToken,
    publicUrl,
    params.entries(),
    req.headers.get("x-twilio-signature"),
  );
  if (!ok) {
    log({ fn: "trip-plan-voice", a, outcome: "bad_signature", status: 403 });
    return json(403, { error: "bad_signature" });
  }

  const planId = url.searchParams.get("p") ?? "";
  const contactId = url.searchParams.get("c") ?? "";
  const template = url.searchParams.get("tpl") ?? "";
  if (!UUID.test(planId) || !UUID.test(contactId) || !/^[a-z_0-9]{1,32}$/.test(template)) {
    return json(400, { error: "invalid_params" });
  }
  const callSid = params.get("CallSid") ?? "";
  const supabase = serviceClient();

  try {
    if (a === "gather") {
      const digits = params.get("Digits") ?? "";
      if (digits === "1") {
        // Twilio may deliver a webhook more than once; one row per call.
        const { data: dup } = await supabase
          .from("trip_plan_events")
          .select("id")
          .eq("plan_id", planId)
          .eq("type", "call_acknowledged")
          .eq("payload->>call_sid", callSid)
          .limit(1);
        if (!dup || dup.length === 0) {
          await insertEvent(supabase, planId, "call_acknowledged", "contact", contactId, {
            channel: "voice",
            template,
            call_sid: callSid,
          });
        }
        log({ fn: "trip-plan-voice", a, plan_id: planId, outcome: "acknowledged", duration_ms: Date.now() - t0 });
        return twiml(
          sayAndHangupTwiml(
            "Thank you. We've recorded that you got this call. The email we sent you has the page with everything rescuers will ask for. Goodbye.",
          ),
        );
      }
      log({ fn: "trip-plan-voice", a, plan_id: planId, outcome: "other_digit", duration_ms: Date.now() - t0 });
      return twiml(sayAndHangupTwiml("Okay. Please check your email for the details. Goodbye."));
    }

    if (a === "status") {
      const status = params.get("CallStatus") ?? "";
      const answeredBy = params.get("AnsweredBy");
      const duration = params.get("CallDuration");

      // The nudge_sent row for this call is written right after Twilio
      // accepts the call; an immediate "failed" can beat it here.
      let ev = await findCallEvent(supabase, planId, callSid);
      if (!ev) {
        await new Promise((r) => setTimeout(r, 1500));
        ev = await findCallEvent(supabase, planId, callSid);
      }
      if (!ev) {
        log({ fn: "trip-plan-voice", a, plan_id: planId, outcome: "event_missing", call_status: status });
        return new Response(null, { status: 204 });
      }

      const payload = ev.payload ?? {};
      if (FINAL_FAILURES.has(status)) {
        const attempts = Number(payload.attempts ?? 1);
        const terminal = attempts >= VOICE_MAX_ATTEMPTS;
        await supabase.from("trip_plan_events").update({
          type: "nudge_failed",
          payload: {
            ...payload,
            call_status: status,
            answered_by: answeredBy ?? null,
            error: `call ${status}`,
            next_attempt_at: terminal ? null : new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
          },
        }).eq("id", ev.id);
      } else {
        await supabase.from("trip_plan_events").update({
          payload: {
            ...payload,
            call_status: status,
            answered_by: answeredBy ?? null,
            duration_s: duration ? Number(duration) : null,
          },
        }).eq("id", ev.id);
      }
      log({ fn: "trip-plan-voice", a, plan_id: planId, call_status: status, answered_by: answeredBy, duration_ms: Date.now() - t0 });
      return new Response(null, { status: 204 });
    }

    return json(404, { error: "unknown_action" });
  } catch (err) {
    log({ fn: "trip-plan-voice", a, outcome: "internal", msg: err instanceof Error ? err.message : String(err) });
    return json(500, { error: "internal" });
  }
});

async function findCallEvent(
  supabase: ReturnType<typeof serviceClient>,
  planId: string,
  callSid: string,
) {
  if (!callSid) return null;
  const { data } = await supabase
    .from("trip_plan_events")
    .select("id, type, payload")
    .eq("plan_id", planId)
    .in("type", ["nudge_sent", "nudge_failed"])
    .eq("payload->>provider_id", callSid)
    .order("at", { ascending: false })
    .limit(1);
  const row = data?.[0] as { id: number; type: string; payload: Record<string, unknown> } | undefined;
  return row ?? null;
}
