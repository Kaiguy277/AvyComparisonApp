import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PLAN_TIMING,
  TransitionError,
  displayStatus,
  purgeAfter,
  transition,
  type PlanState,
} from "./state";

const H = 3_600_000;
const T0 = Date.parse("2026-12-06T17:00:00Z");

function active(overrides: Partial<PlanState> = {}): PlanState {
  return {
    status: "active",
    closeReason: null,
    returnBy: T0 + 8 * H,
    worryBy: T0 + 11 * H,
    nudge1SentAt: null,
    nudge2SentAt: null,
    closedAt: null,
    ...overrides,
  };
}

describe("drift guard", () => {
  it("the Deno copy of the state machine is byte-identical", () => {
    const a = readFileSync(path.resolve("lib/tripPlan/state.ts"), "utf8");
    const b = readFileSync(
      path.resolve("supabase/functions/_shared/trip-plan-state.ts"),
      "utf8",
    );
    expect(b).toBe(a);
  });
});

describe("check_in / cancel", () => {
  it("closes an active plan and notifies everyone", () => {
    const r = transition(active(), { type: "check_in", at: T0 + 7 * H });
    expect(r.state.status).toBe("closed");
    expect(r.state.closeReason).toBe("checked_in");
    expect(r.effects).toEqual([{ kind: "notify_all", template: "checked_in" }]);
  });
  it("closes an overdue plan too", () => {
    const r = transition(active({ status: "overdue", nudge1SentAt: T0 + 11 * H }), {
      type: "check_in",
      at: T0 + 12 * H,
    });
    expect(r.state.closeReason).toBe("checked_in");
  });
  it("late check-in after search_started records + notifies, does not reopen", () => {
    const closed = transition(active(), { type: "search_started", at: T0 + 12 * H }).state;
    const r = transition(closed, { type: "check_in", at: T0 + 13 * H });
    expect(r.state).toBe(closed);
    expect(r.effects).toEqual([
      { kind: "record_late", type: "check_in" },
      { kind: "notify_all", template: "late_check_in" },
    ]);
  });
  it("cancel closes with cancelled_by_user", () => {
    const r = transition(active(), { type: "cancel", at: T0 + 1 * H });
    expect(r.state.closeReason).toBe("cancelled_by_user");
  });
});

describe("extend", () => {
  it("rejects extending backwards", () => {
    expect(() =>
      transition(active(), { type: "extend", at: T0, newWorryBy: T0 + 10 * H }),
    ).toThrowError(TransitionError);
  });
  it("rejects beyond 48h after return", () => {
    expect(() =>
      transition(active(), { type: "extend", at: T0, newWorryBy: T0 + 8 * H + 49 * H }),
    ).toThrow(/48 hours/);
  });
  it("from overdue to a future time re-arms as active and resets nudges", () => {
    const overdue = active({ status: "overdue", nudge1SentAt: T0 + 11 * H });
    const r = transition(overdue, { type: "extend", at: T0 + 11.5 * H, newWorryBy: T0 + 14 * H });
    expect(r.state.status).toBe("active");
    expect(r.state.nudge1SentAt).toBeNull();
    expect(r.state.worryBy).toBe(T0 + 14 * H);
    expect(r.effects.map((e) => e.kind)).toEqual(["notify_all", "push_user"]);
  });
  it("on a closed plan throws plan_closed", () => {
    const closed = transition(active(), { type: "check_in", at: T0 }).state;
    expect(() =>
      transition(closed, { type: "extend", at: T0, newWorryBy: T0 + 20 * H }),
    ).toThrow(/closed/);
  });
});

describe("sweep", () => {
  it("does nothing before worry-by", () => {
    const r = transition(active(), { type: "sweep", at: T0 + 10 * H });
    expect(r.state.status).toBe("active");
    expect(r.effects).toEqual([]);
  });
  it("flips to overdue and sends nudge 1 at worry-by", () => {
    const r = transition(active(), { type: "sweep", at: T0 + 11 * H });
    expect(r.state.status).toBe("overdue");
    expect(r.state.nudge1SentAt).toBe(T0 + 11 * H);
    expect(r.effects).toEqual([{ kind: "notify_all", template: "nudge_1" }]);
  });
  it("sends nudge 2 exactly once, 60 minutes after nudge 1", () => {
    const s1 = transition(active(), { type: "sweep", at: T0 + 11 * H }).state;
    const early = transition(s1, { type: "sweep", at: T0 + 11 * H + PLAN_TIMING.nudge2DelayMs - 60_000 });
    expect(early.effects).toEqual([]);
    const s2 = transition(s1, { type: "sweep", at: T0 + 11 * H + PLAN_TIMING.nudge2DelayMs });
    expect(s2.effects).toEqual([{ kind: "notify_all", template: "nudge_2" }]);
    const again = transition(s2.state, { type: "sweep", at: T0 + 13 * H });
    expect(again.effects).toEqual([]);
  });
  it("expires 72h after worry-by, only from overdue", () => {
    const s1 = transition(active(), { type: "sweep", at: T0 + 11 * H }).state;
    const s2 = transition(s1, { type: "sweep", at: T0 + 12 * H }).state;
    const before = transition(s2, { type: "sweep", at: T0 + 11 * H + PLAN_TIMING.expireAfterMs - 1 });
    expect(before.state.status).toBe("overdue");
    const r = transition(s2, { type: "sweep", at: T0 + 11 * H + PLAN_TIMING.expireAfterMs });
    expect(r.state.status).toBe("closed");
    expect(r.state.closeReason).toBe("expired");
    expect(r.effects).toEqual([{ kind: "notify_all", template: "expired" }]);
  });
  it("is a no-op on a closed plan", () => {
    const closed = transition(active(), { type: "check_in", at: T0 }).state;
    expect(transition(closed, { type: "sweep", at: T0 + 100 * H }).effects).toEqual([]);
  });
});

describe("display + purge", () => {
  it("displayStatus derives overdue from time even if the sweeper is late", () => {
    expect(displayStatus(active(), T0 + 11 * H + 1)).toBe("overdue");
    expect(displayStatus(active(), T0)).toBe("active");
  });
  it("purgeAfter is closedAt + 7 days", () => {
    const closed = transition(active(), { type: "check_in", at: T0 }).state;
    expect(purgeAfter(closed)).toBe(T0 + PLAN_TIMING.retentionMs);
    expect(purgeAfter(active())).toBeNull();
  });
});
