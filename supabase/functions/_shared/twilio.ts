// Twilio Programmable Voice, the minimum we need: place one outbound call
// with inline TwiML, build that TwiML, and verify the X-Twilio-Signature on
// the callbacks Twilio sends back. No SDK — it is one POST and one HMAC.
//
// Runtime-neutral on purpose (Web Crypto only, no Deno imports) so the
// pure parts are unit-tested under Vitest alongside the notify adapter.
//
// Docs: https://www.twilio.com/docs/voice/api/call-resource
//       https://www.twilio.com/docs/usage/security#validating-requests

export interface TwilioCreds {
  accountSid: string;
  authToken: string;
}

export interface PlaceCallOptions {
  to: string; // E.164
  from: string; // E.164, a number owned by the account
  twiml: string; // ≤ 4000 chars
  statusCallback: string;
  timeoutSec?: number; // ring time before no-answer (default 30)
  fetchImpl?: typeof fetch;
}

const API = "https://api.twilio.com/2010-04-01";

// Place a call. Resolves with the call SID once Twilio has queued it; the
// outcome (answered, busy, no-answer…) arrives later on the status callback.
export async function placeCall(creds: TwilioCreds, o: PlaceCallOptions): Promise<string> {
  if (o.twiml.length > 4000) throw new Error("twiml exceeds 4000 chars");
  const body = new URLSearchParams({
    To: o.to,
    From: o.from,
    Twiml: o.twiml,
    // Voicemail gets the message after the beep instead of 3 s of it.
    MachineDetection: "DetectMessageEnd",
    StatusCallback: o.statusCallback,
    StatusCallbackMethod: "POST",
    StatusCallbackEvent: "completed",
    Timeout: String(o.timeoutSec ?? 30),
  });
  const res = await (o.fetchImpl ?? fetch)(`${API}/Accounts/${creds.accountSid}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${creds.accountSid}:${creds.authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`twilio ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { sid?: string };
  if (!json.sid) throw new Error("twilio: no call sid in response");
  return json.sid;
}

// ── TwiML ──────────────────────────────────────────────────────────────────

export function xmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c] as string,
  );
}

// Amazon Polly standard voices are in Twilio's free "basic" tier.
const VOICE = "Polly.Joanna";

// Say the script, then wait for one keypress. A voicemail hears the whole
// script (the call is placed with MachineDetection=DetectMessageEnd, so TwiML
// starts after the beep) and simply never presses anything.
export function gatherTwiml(script: string, gatherUrl: string, afterNoInput: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?><Response>` +
    `<Gather input="dtmf" numDigits="1" timeout="6" action="${xmlEscape(gatherUrl)}" method="POST">` +
    `<Say voice="${VOICE}">${xmlEscape(script)}</Say>` +
    `</Gather>` +
    `<Say voice="${VOICE}">${xmlEscape(afterNoInput)}</Say>` +
    `<Hangup/></Response>`
  );
}

export function sayAndHangupTwiml(text: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="${VOICE}">${xmlEscape(text)}</Say><Hangup/></Response>`;
}

export const TWIML_HEADERS = { "Content-Type": "text/xml; charset=utf-8" };

// ── request validation ─────────────────────────────────────────────────────

// Twilio signs: the exact URL it requested (query string included) followed
// by every POST parameter as key+value, keys sorted; HMAC-SHA1 with the auth
// token, base64. Returns the expected header value for one URL variant.
export async function twilioSignature(
  authToken: string,
  url: string,
  params: Iterable<[string, string]>,
): Promise<string> {
  const sorted = [...params].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  let data = url;
  for (const [k, v] of sorted) data += k + v;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(mac)));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Twilio has signed URLs both with and without the explicit default port
// over the years; accept either, like its own helper libraries do.
export async function verifyTwilioRequest(
  authToken: string,
  url: string,
  params: Iterable<[string, string]>,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;
  const list = [...params];
  const u = new URL(url);
  const withPort = u.port
    ? url
    : url.replace(`${u.protocol}//${u.host}`, `${u.protocol}//${u.host}:${u.protocol === "https:" ? 443 : 80}`);
  for (const candidate of [url, withPort]) {
    if (constantTimeEqual(await twilioSignature(authToken, candidate, list), signature)) return true;
  }
  return false;
}
