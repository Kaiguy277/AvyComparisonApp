import { beforeEach, describe, expect, it, vi } from "vitest";

// store.ts imports SecureStore for plan secrets; nothing here touches it,
// but it must resolve at import time in a node environment.
vi.mock("expo-secure-store", () => ({
  setItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import { __store } from "../../test/mocks/asyncStorage";
import {
  HISTORY_LIMIT,
  loadActivePlan,
  loadTripHistory,
  mergeHistory,
  removeFromHistory,
  saveActivePlan,
  subscribeActivePlan,
  updateActivePlan,
  type ActivePlan,
} from "./store";

function plan(over: Partial<ActivePlan> = {}): ActivePlan {
  return {
    planId: "p1",
    sync: "created",
    status: "active",
    closeReason: null,
    areaName: "Turnagain Pass",
    trailheadName: "Tincan",
    subjectName: "Kai",
    timezone: "America/Anchorage",
    departAt: "2026-09-18T16:00:00Z",
    returnBy: "2026-09-18T23:00:00Z",
    worryBy: "2026-09-19T02:00:00Z",
    contacts: [],
    createdAt: "2026-09-18T15:00:00Z",
    ...over,
  };
}

beforeEach(() => {
  __store.clear();
});

// The bug these guard: every screen held its own copy of the trip, refreshed
// only on mount/foreground/reconnect. The home screen stays mounted under the
// trip screens, so after creating a trip it still said HEADING OUT, and the
// composer then blocked with "you already have a live trip" and no way out.
describe("active plan change notification", () => {
  it("notifies subscribers when a plan is saved", async () => {
    const fn = vi.fn();
    const off = subscribeActivePlan(fn);
    await saveActivePlan(plan());
    expect(fn).toHaveBeenCalledTimes(1);
    off();
  });

  it("notifies when the plan is cleared, too", async () => {
    await saveActivePlan(plan());
    const fn = vi.fn();
    const off = subscribeActivePlan(fn);
    await saveActivePlan(null);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(await loadActivePlan()).toBeNull();
    off();
  });

  it("notifies on updateActivePlan, which is how server responses land", async () => {
    await saveActivePlan(plan());
    const fn = vi.fn();
    const off = subscribeActivePlan(fn);
    await updateActivePlan((p) => ({ ...p, status: "closed", closeReason: "contact_heard_from" }));
    expect(fn).toHaveBeenCalledTimes(1);
    expect((await loadActivePlan())?.status).toBe("closed");
    off();
  });

  it("stops notifying after unsubscribe", async () => {
    const fn = vi.fn();
    const off = subscribeActivePlan(fn);
    off();
    await saveActivePlan(plan());
    expect(fn).not.toHaveBeenCalled();
  });

  it("reaches every subscriber — one per mounted screen", async () => {
    const home = vi.fn();
    const hub = vi.fn();
    const offA = subscribeActivePlan(home);
    const offB = subscribeActivePlan(hub);
    await saveActivePlan(plan());
    expect(home).toHaveBeenCalledTimes(1);
    expect(hub).toHaveBeenCalledTimes(1);
    offA();
    offB();
  });

  it("a throwing subscriber does not stop the others hearing about it", async () => {
    const bad = vi.fn(() => {
      throw new Error("boom");
    });
    const good = vi.fn();
    const offA = subscribeActivePlan(bad);
    const offB = subscribeActivePlan(good);
    await expect(saveActivePlan(plan())).resolves.toBeUndefined();
    expect(good).toHaveBeenCalledTimes(1);
    offA();
    offB();
  });
});

// Kai: "there should be a way to navigate to my old trips." The app used to
// keep exactly one trip and DISMISS deleted it.
describe("trip history", () => {
  const closed = (id: string, departAt: string, over: Partial<ActivePlan> = {}) =>
    plan({ planId: id, status: "closed", closeReason: "checked_in", departAt, ...over });

  it("mergeHistory ignores trips that are not closed", () => {
    expect(mergeHistory([], plan({ status: "active" }))).toEqual([]);
  });

  it("mergeHistory orders newest departure first", () => {
    let h: ActivePlan[] = [];
    h = mergeHistory(h, closed("old", "2026-09-01T16:00:00Z"));
    h = mergeHistory(h, closed("new", "2026-09-15T16:00:00Z"));
    h = mergeHistory(h, closed("mid", "2026-09-08T16:00:00Z"));
    expect(h.map((p) => p.planId)).toEqual(["new", "mid", "old"]);
  });

  // A closed plan keeps being saved as late status polls land; each save must
  // update the entry, not add another copy.
  it("mergeHistory replaces an existing entry instead of duplicating it", () => {
    let h = mergeHistory([], closed("a", "2026-09-10T16:00:00Z", { events: [] }));
    h = mergeHistory(h, closed("a", "2026-09-10T16:00:00Z", {
      events: [{ type: "heard_from", at: "2026-09-10T20:00:00Z", contactName: "Sam", note: null }],
    }));
    expect(h.length).toBe(1);
    expect(h[0].events?.length).toBe(1);
  });

  it("mergeHistory caps the list, dropping the oldest", () => {
    let h: ActivePlan[] = [];
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      h = mergeHistory(h, closed(`p${i}`, new Date(Date.UTC(2026, 0, 1 + i)).toISOString()));
    }
    expect(h.length).toBe(HISTORY_LIMIT);
    expect(h[0].planId).toBe(`p${HISTORY_LIMIT + 4}`); // newest kept
    expect(h.some((p) => p.planId === "p0")).toBe(false); // oldest dropped
  });

  // The integration that matters: every close path funnels through a save of
  // a closed plan, so saving one must archive it.
  it("saving a closed plan archives it; saving a live one does not", async () => {
    await saveActivePlan(plan({ planId: "live" }));
    expect(await loadTripHistory()).toEqual([]);
    await saveActivePlan(plan({ planId: "live", status: "closed", closeReason: "contact_heard_from" }));
    const h = await loadTripHistory();
    expect(h.map((p) => p.planId)).toEqual(["live"]);
    expect(h[0].closeReason).toBe("contact_heard_from");
  });

  it("dismissing (clearing the active plan) keeps the trip in history", async () => {
    await saveActivePlan(plan({ planId: "t1", status: "closed", closeReason: "checked_in" }));
    await saveActivePlan(null);
    expect(await loadActivePlan()).toBeNull();
    expect((await loadTripHistory()).map((p) => p.planId)).toEqual(["t1"]);
  });

  it("removeFromHistory deletes one entry and notifies", async () => {
    await saveActivePlan(plan({ planId: "a", status: "closed", departAt: "2026-09-01T16:00:00Z" }));
    await saveActivePlan(plan({ planId: "b", status: "closed", departAt: "2026-09-02T16:00:00Z" }));
    const fn = vi.fn();
    const off = subscribeActivePlan(fn);
    await removeFromHistory("a");
    expect((await loadTripHistory()).map((p) => p.planId)).toEqual(["b"]);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
  });
});
