import { beforeEach, describe, expect, it } from "vitest";
import { __store } from "../../test/mocks/asyncStorage";
import {
  BACKOFF,
  dropPendingFor,
  enqueue,
  flushOutbox,
  isTerminalStatus,
  loadOutbox,
  nextDelayMs,
  type OutboxEntry,
  type SendResult,
} from "./outbox";

const T0 = 1_700_000_000_000;

function entry(id: string, action: OutboxEntry["action"], planId = "p1") {
  return { id, action, planId, body: {} };
}

beforeEach(() => {
  __store.clear();
});

describe("backoff", () => {
  it("follows 5s, 15s, 45s, 2m15s and caps at 15m", () => {
    expect(nextDelayMs(1)).toBe(5_000);
    expect(nextDelayMs(2)).toBe(15_000);
    expect(nextDelayMs(3)).toBe(45_000);
    expect(nextDelayMs(4)).toBe(135_000);
    expect(nextDelayMs(10)).toBe(BACKOFF.capMs);
  });
  it("terminal statuses are the never-retry 4xx set", () => {
    expect([400, 403, 404, 409, 410].every(isTerminalStatus)).toBe(true);
    expect([0, 429, 500, 502, 503].some(isTerminalStatus)).toBe(false);
  });
});

describe("flushOutbox", () => {
  it("sends in FIFO order and removes successes", async () => {
    await enqueue(entry("a", "create"), T0);
    await enqueue(entry("b", "check_in"), T0);
    const order: string[] = [];
    const r = await flushOutbox(async (e) => {
      order.push(e.id);
      return { ok: true, status: 200 };
    }, T0 + 1);
    expect(order).toEqual(["a", "b"]);
    expect(r.sent.map((e) => e.id)).toEqual(["a", "b"]);
    expect(await loadOutbox()).toEqual([]);
  });

  it("a failed create blocks a later check-in for the same plan", async () => {
    await enqueue(entry("a", "create"), T0);
    await enqueue(entry("b", "check_in"), T0);
    const seen: string[] = [];
    const r = await flushOutbox(async (e) => {
      seen.push(e.id);
      return { ok: false, status: 503 };
    }, T0 + 1);
    expect(seen).toEqual(["a"]);
    expect(r.deferred.map((e) => e.id)).toEqual(["a", "b"]);
    const left = await loadOutbox();
    expect(left[0].attempts).toBe(1);
    expect(left[0].nextAttemptAt).toBe(T0 + 1 + 5_000);
    expect(left[1].attempts).toBe(0);
  });

  it("does not block a different plan's entries", async () => {
    await enqueue(entry("a", "create", "p1"), T0);
    await enqueue(entry("b", "check_in", "p2"), T0);
    const seen: string[] = [];
    await flushOutbox(async (e) => {
      seen.push(e.id);
      return e.planId === "p1" ? { ok: false, status: 500 } : { ok: true, status: 200 };
    }, T0 + 1);
    expect(seen).toEqual(["a", "b"]);
  });

  it("drops terminal failures and network errors retry", async () => {
    await enqueue(entry("a", "check_in", "p1"), T0);
    await enqueue(entry("b", "check_in", "p2"), T0);
    const results: Record<string, SendResult> = {
      a: { ok: false, status: 403 },
      b: { ok: false, status: 0, error: "Network request failed" },
    };
    const r = await flushOutbox(async (e) => results[e.id], T0 + 1);
    expect(r.dropped.map((d) => d.entry.id)).toEqual(["a"]);
    expect(r.deferred.map((e) => e.id)).toEqual(["b"]);
    expect((await loadOutbox()).map((e) => e.id)).toEqual(["b"]);
  });

  it("skips entries whose retry time has not come", async () => {
    await enqueue(entry("a", "check_in"), T0);
    await flushOutbox(async () => ({ ok: false, status: 500 }), T0 + 1);
    let calls = 0;
    await flushOutbox(async () => {
      calls++;
      return { ok: true, status: 200 };
    }, T0 + 2);
    expect(calls).toBe(0);
    await flushOutbox(async () => {
      calls++;
      return { ok: true, status: 200 };
    }, T0 + 1 + 5_000);
    expect(calls).toBe(1);
  });

  it("gives up on a create older than 24h but never on a check-in", async () => {
    await enqueue(entry("a", "create", "p1"), T0);
    await enqueue(entry("b", "check_in", "p2"), T0);
    const r = await flushOutbox(
      async () => ({ ok: false, status: 500 }),
      T0 + BACKOFF.createGiveUpMs + 1,
    );
    expect(r.dropped.map((d) => d.entry.id)).toEqual(["a"]);
    expect(r.dropped[0].result.error).toBe("gave_up");
    expect((await loadOutbox()).map((e) => e.id)).toEqual(["b"]);
  });

  it("enqueue is idempotent by id", async () => {
    await enqueue(entry("a", "check_in"), T0);
    await enqueue(entry("a", "check_in"), T0 + 5);
    expect((await loadOutbox()).length).toBe(1);
  });

  it("a thrown sender error counts as a network failure", async () => {
    await enqueue(entry("a", "check_in"), T0);
    const r = await flushOutbox(async () => {
      throw new Error("boom");
    }, T0 + 1);
    expect(r.deferred[0].lastError).toBe("boom");
  });
});

// DISMISS on a closed trip used to be a silent no-op whenever anything was
// still queued for it. Clearing that plan's entries must not touch another's.
describe("dropPendingFor", () => {
  it("removes only the given plan's queued actions", async () => {
    await enqueue(entry("a:check_in", "check_in", "a"));
    await enqueue(entry("b:check_in", "check_in", "b"));
    await enqueue(entry("a:cancel", "cancel", "a"));
    await dropPendingFor("a");
    const left = await loadOutbox();
    expect(left.map((e) => e.planId)).toEqual(["b"]);
  });

  it("is a no-op when the plan has nothing queued", async () => {
    await enqueue(entry("b:check_in", "check_in", "b"));
    await dropPendingFor("zzz");
    expect((await loadOutbox()).length).toBe(1);
  });
});
