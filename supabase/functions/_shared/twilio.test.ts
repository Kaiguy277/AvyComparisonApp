import { describe, expect, it, vi } from "vitest";
import {
  gatherTwiml,
  placeCall,
  sayAndHangupTwiml,
  twilioSignature,
  verifyTwilioRequest,
  xmlEscape,
} from "./twilio";

// The worked example from Twilio's "validating requests" documentation.
const DOC_URL = "https://mycompany.com/myapp.php?foo=1&bar=2";
const DOC_PARAMS: [string, string][] = [
  ["Digits", "1234"],
  ["To", "+18005551212"],
  ["From", "+12349013030"],
  ["Caller", "+12349013030"],
  ["CallSid", "CA1234567890ABCDE"],
];
const DOC_TOKEN = "12345";
const DOC_SIG = "0/KCTR6DLpKmkAf8muzZqo1nDgQ=";

describe("twilio request signature", () => {
  it("reproduces the documented example", async () => {
    expect(await twilioSignature(DOC_TOKEN, DOC_URL, DOC_PARAMS)).toBe(DOC_SIG);
  });
  it("accepts a valid signature and rejects a tampered body or missing header", async () => {
    expect(await verifyTwilioRequest(DOC_TOKEN, DOC_URL, DOC_PARAMS, DOC_SIG)).toBe(true);
    expect(await verifyTwilioRequest(DOC_TOKEN, DOC_URL, [...DOC_PARAMS, ["Digits", "9"]], DOC_SIG)).toBe(false);
    expect(await verifyTwilioRequest(DOC_TOKEN, DOC_URL, DOC_PARAMS, null)).toBe(false);
    expect(await verifyTwilioRequest("wrong", DOC_URL, DOC_PARAMS, DOC_SIG)).toBe(false);
  });
  it("accepts the explicit-port variant Twilio sometimes signs", async () => {
    const ported = "https://mycompany.com:443/myapp.php?foo=1&bar=2";
    const sig = await twilioSignature(DOC_TOKEN, ported, DOC_PARAMS);
    expect(await verifyTwilioRequest(DOC_TOKEN, DOC_URL, DOC_PARAMS, sig)).toBe(true);
  });
});

describe("twiml", () => {
  it("escapes the script and the action URL", () => {
    const x = gatherTwiml(`Kai's trip <overdue> & "late"`, "https://x.test/v?a=gather&p=1", "Bye");
    expect(x).toContain("Kai&apos;s trip &lt;overdue&gt; &amp; &quot;late&quot;");
    expect(x).toContain('action="https://x.test/v?a=gather&amp;p=1"');
    expect(x).toContain('numDigits="1"');
    expect(x.endsWith("<Hangup/></Response>")).toBe(true);
    expect(sayAndHangupTwiml("Thanks")).toContain("<Say");
    expect(xmlEscape("a&b")).toBe("a&amp;b");
  });
});

describe("placeCall", () => {
  it("posts form-encoded params with basic auth and returns the sid", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.twilio.com/2010-04-01/Accounts/ACxxx/Calls.json");
      const h = init?.headers as Record<string, string>;
      expect(h.Authorization).toBe(`Basic ${btoa("ACxxx:tok")}`);
      const body = init?.body as URLSearchParams;
      expect(body.get("To")).toBe("+19075550101");
      expect(body.get("MachineDetection")).toBe("DetectMessageEnd");
      expect(body.get("StatusCallbackEvent")).toBe("completed");
      expect(body.get("StatusCallback")).toBe("https://cb.test/v?a=status");
      return new Response(JSON.stringify({ sid: "CA123" }), { status: 201 });
    }) as unknown as typeof fetch;
    const sid = await placeCall(
      { accountSid: "ACxxx", authToken: "tok" },
      { to: "+19075550101", from: "+19075550100", twiml: "<Response/>", statusCallback: "https://cb.test/v?a=status", fetchImpl },
    );
    expect(sid).toBe("CA123");
  });
  it("surfaces an API error with the status code", async () => {
    const fetchImpl = (async () => new Response("nope", { status: 401 })) as unknown as typeof fetch;
    await expect(
      placeCall({ accountSid: "A", authToken: "t" }, { to: "+1", from: "+2", twiml: "<Response/>", statusCallback: "https://cb", fetchImpl }),
    ).rejects.toThrow(/twilio 401/);
  });
});
