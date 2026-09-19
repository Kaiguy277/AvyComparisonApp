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
  loadActivePlan,
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
