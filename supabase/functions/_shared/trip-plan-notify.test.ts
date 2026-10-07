import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  VOICE_TEMPLATES,
  notifyAll,
  renderTemplate,
  renderVoiceScript,
  retryFailed,
  spokenPhone,
  voiceCallbackUrl,
  type ContactRow,
  type PlanRow,
} from "./trip-plan-notify";

// The adapter reads its configuration through Deno.env; stand that in under
// Vitest with a plain map.
const env = new Map<string, string>();
beforeEach(() => {
  env.clear();
  env.set("SUPABASE_URL", "https://proj.supabase.co");
  env.set("RESEND_API_KEY", "re_test");
  env.set("TWILIO_ACCOUNT_SID", "ACtest");
  env.set("TWILIO_AUTH_TOKEN", "tok");
  env.set("TWILIO_FROM_E164", "+19075550000");
  vi.stubGlobal("Deno", { env: { get: (k: string) => env.get(k) } });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const plan: PlanRow = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "overdue",
  close_reason: null,
  timezone: "America/Anchorage",
  return_by: "2026-12-07T01:00:00Z",
  worry_by: "2026-12-07T04:00:00Z",
  packet: { draft: { subject: { fullName: "Kai Myers", phone: "+19075550100" }, areaName: "Turnagain Pass" } },
};
const alex: ContactRow = {
  id: "22222222-2222-4222-8222-222222222222",
  display_name: "Alex",
  email: "alex@example.com",
  phone_e164: "+19075550101",
  share_url: "https://pages.test/p?t=abc",
};
const noPhone: ContactRow = { ...alex, id: "33333333-3333-4333-8333-333333333333", display_name: "Sam", phone_e164: null };

// A fake supabase client that records event inserts/updates.
function fakeDb() {
  const inserted: Record<string, unknown>[] = [];
  const updated: { id: number; patch: Record<string, unknown> }[] = [];
  const supabase = {
    from: (table: string) => {
      expect(table).toBe("trip_plan_events");
      return {
        insert: async (row: Record<string, unknown>) => {
          inserted.push(row);
          return { error: null };
        },
        update: (patch: Record<string, unknown>) => ({
          eq: async (_col: string, id: number) => {
            updated.push({ id, patch });
            return { error: null };
          },
        }),
      };
    },
  };
  // deno-lint-ignore no-explicit-any
  return { supabase: supabase as any, inserted, updated };
}

// Capture outbound provider calls by host.
function fakeFetch(opts: { twilioStatus?: number; resendStatus?: number } = {}) {
  const calls: { url: string; body: URLSearchParams | string }[] = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, body: init?.body as URLSearchParams | string });
    if (u.includes("api.twilio.com")) {
      return new Response(JSON.stringify({ sid: "CA_" + calls.length }), { status: opts.twilioStatus ?? 201 });
    }
    return new Response(JSON.stringify({ id: "re_" + calls.length }), { status: opts.resendStatus ?? 200 });
  });
  vi.stubGlobal("fetch", f);
  return calls;
}

describe("voice script", () => {
  it("exists only for the overdue templates", () => {
    expect([...VOICE_TEMPLATES].sort()).toEqual(["expired", "nudge_1", "nudge_2"]);
    for (const t of ["heading_out", "extended", "checked_in", "cancelled", "heard_from", "search_started", "late_check_in"] as const) {
      expect(renderVoiceScript(t, plan)).toBeNull();
    }
    const v = renderVoiceScript("nudge_1", plan)!;
    expect(v.script).toContain("automated call from Whumpf");
    expect(v.script).toContain("Kai");
    expect(v.script).toContain("Turnagain Pass");
    expect(v.script).toContain("9 0 7, 5 5 5, 0 1 0 0");
    expect(v.script).toContain("9 1 1");
    expect(v.script).toMatch(/Press 1 to confirm you got this call\.$/);
    expect(renderVoiceScript("nudge_2", plan)!.script).toContain("second automated call");
    expect(renderVoiceScript("expired", plan)!.script).toContain("expired");
  });
  it("reads phone numbers digit by digit", () => {
    expect(spokenPhone("+19075550100")).toBe("9 0 7, 5 5 5, 0 1 0 0");
    expect(spokenPhone("+442079460958")).toBe("4 4 2 0 7 9 4 6 0 9 5 8");
  });
  it("builds callback URLs from the voice base", () => {
    expect(voiceCallbackUrl("gather", plan.id, alex.id, "nudge_1")).toBe(
      `https://proj.supabase.co/functions/v1/trip-plan-voice?a=gather&p=${plan.id}&c=${alex.id}&tpl=nudge_1`,
    );
    env.set("TRIP_PLAN_VOICE_BASE", "https://pages.test/voice");
    expect(voiceCallbackUrl("status", plan.id, alex.id, "expired")).toMatch(/^https:\/\/pages\.test\/voice\?a=status/);
  });
});

describe("heading-out email", () => {
  it("mentions the automated call only when the channel is on and the contact has a phone", () => {
    expect(renderTemplate("heading_out", plan, alex).text).not.toContain("call you");
    const on = renderTemplate("heading_out", plan, alex, null, null, true).text;
    expect(on).toContain("call you at +19075550101");
    expect(on).toContain("Press 1");
    expect(renderTemplate("heading_out", plan, noPhone, null, null, true).text).not.toContain("call you");
    // Never on the other templates.
    expect(renderTemplate("checked_in", plan, alex, null, null, true).text).not.toContain("call you");
  });
});

describe("notifyAll with voice on", () => {
  it("emails and calls on nudge_1, logging one nudge_sent per channel", async () => {
    env.set("TRIP_NUDGE_CHANNELS", "email,voice");
    const calls = fakeFetch();
    const db = fakeDb();
    const r = await notifyAll({ supabase: db.supabase, plan, contacts: [alex, noPhone], template: "nudge_1" });
    expect(r).toEqual({ sent: 3, failed: 0 });
    const twilio = calls.filter((c) => c.url.includes("api.twilio.com"));
    expect(twilio).toHaveLength(1);
    const body = twilio[0].body as URLSearchParams;
    expect(body.get("To")).toBe("+19075550101");
    expect(body.get("From")).toBe("+19075550000");
    expect(body.get("Twiml")).toContain("<Gather");
    expect(body.get("Twiml")).toContain(`a=gather&amp;p=${plan.id}&amp;c=${alex.id}&amp;tpl=nudge_1`);
    expect(body.get("StatusCallback")).toContain(`a=status&p=${plan.id}&c=${alex.id}&tpl=nudge_1`);
    const types = db.inserted.map((e) => [e.type, (e.payload as Record<string, unknown>).channel, e.contact_id]);
    expect(types).toEqual([
      ["nudge_sent", "email", alex.id],
      ["nudge_sent", "voice", alex.id],
      ["nudge_sent", "email", noPhone.id],
    ]);
    const voiceRow = db.inserted[1].payload as Record<string, unknown>;
    expect(voiceRow.provider_id).toMatch(/^CA_/);
    expect(voiceRow.call_status).toBe("queued");
    expect(voiceRow.attempts).toBe(1);
  });

  it("never calls on heading_out, extended or checked_in", async () => {
    env.set("TRIP_NUDGE_CHANNELS", "email,voice");
    const calls = fakeFetch();
    const db = fakeDb();
    for (const template of ["heading_out", "extended", "checked_in", "cancelled", "heard_from", "search_started", "late_check_in"] as const) {
      await notifyAll({ supabase: db.supabase, plan, contacts: [alex], template });
    }
    expect(calls.some((c) => c.url.includes("api.twilio.com"))).toBe(false);
    expect(db.inserted.every((e) => (e.payload as Record<string, unknown>).channel === "email")).toBe(true);
  });

  it("does not call when the channel is off, even on nudge_1", async () => {
    const calls = fakeFetch();
    const db = fakeDb();
    await notifyAll({ supabase: db.supabase, plan, contacts: [alex], template: "nudge_1" });
    expect(calls.some((c) => c.url.includes("api.twilio.com"))).toBe(false);
    expect(db.inserted).toHaveLength(1);
  });

  it("logs a voice nudge_failed with a retry time when Twilio rejects the call", async () => {
    env.set("TRIP_NUDGE_CHANNELS", "voice");
    fakeFetch({ twilioStatus: 401 });
    const db = fakeDb();
    const r = await notifyAll({ supabase: db.supabase, plan, contacts: [alex], template: "nudge_2" });
    expect(r).toEqual({ sent: 0, failed: 1 });
    const p = db.inserted[0].payload as Record<string, unknown>;
    expect(db.inserted[0].type).toBe("nudge_failed");
    expect(p.channel).toBe("voice");
    expect(p.error).toMatch(/twilio 401/);
    expect(typeof p.next_attempt_at).toBe("string");
  });

  it("logs nudge_failed when Twilio secrets are missing rather than throwing", async () => {
    env.set("TRIP_NUDGE_CHANNELS", "voice");
    env.delete("TWILIO_AUTH_TOKEN");
    fakeFetch();
    const db = fakeDb();
    await notifyAll({ supabase: db.supabase, plan, contacts: [alex], template: "nudge_1" });
    expect(db.inserted[0].type).toBe("nudge_failed");
    expect((db.inserted[0].payload as Record<string, unknown>).error).toBe("twilio not configured");
  });
});

describe("retryFailed is channel-aware", () => {
  const base = { id: 7, plan_id: plan.id, contact_id: alex.id };

  it("re-places a voice call and marks the row sent", async () => {
    const calls = fakeFetch();
    const db = fakeDb();
    await retryFailed(db.supabase, { ...base, payload: { channel: "voice", template: "nudge_1", attempts: 1, error: "call no-answer", next_attempt_at: "x" } }, plan, alex);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("api.twilio.com");
    expect(db.updated[0].id).toBe(7);
    const patch = db.updated[0].patch;
    expect(patch.type).toBe("nudge_sent");
    const p = patch.payload as Record<string, unknown>;
    expect(p.retried).toBe(true);
    expect(p.attempts).toBe(2);
    expect(p.call_status).toBe("queued");
    expect(p.next_attempt_at).toBeNull();
  });

  it("gives up on voice after the second attempt", async () => {
    fakeFetch({ twilioStatus: 500 });
    const db = fakeDb();
    await retryFailed(db.supabase, { ...base, payload: { channel: "voice", template: "nudge_1", attempts: 1 } }, plan, alex);
    const p = db.updated[0].patch.payload as Record<string, unknown>;
    expect(db.updated[0].patch.type).toBeUndefined();
    expect(p.attempts).toBe(2);
    expect(p.next_attempt_at).toBeNull();
  });

  it("still emails for rows without a channel (pre-voice rows)", async () => {
    const calls = fakeFetch();
    const db = fakeDb();
    await retryFailed(db.supabase, { ...base, payload: { template: "nudge_1", attempts: 1 } }, plan, alex);
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(db.updated[0].patch.type).toBe("nudge_sent");
  });

  it("keeps the email cap at three attempts", async () => {
    fakeFetch({ resendStatus: 500 });
    const db = fakeDb();
    await retryFailed(db.supabase, { ...base, payload: { channel: "email", template: "nudge_1", attempts: 1 } }, plan, alex);
    expect(typeof (db.updated[0].patch.payload as Record<string, unknown>).next_attempt_at).toBe("string");
    await retryFailed(db.supabase, { ...base, payload: { channel: "email", template: "nudge_1", attempts: 2 } }, plan, alex);
    expect((db.updated[1].patch.payload as Record<string, unknown>).next_attempt_at).toBeNull();
  });
});
