import { describe, it, expect, beforeEach } from "vitest";

import {
  getZoneSnapshotForDate,
  loadSnapshot,
  mergeZoneBundle,
  mutateSnapshot,
  pruneSnapshot,
  saveSnapshot,
  todayIsoDate,
  type FavoritesSnapshot,
  type ZoneSnapshot,
} from "./offlineCache";
import { addDaysKey } from "./dates";
import { __store } from "@/test/mocks/asyncStorage";
import type { AvalancheZone } from "./api/avalanche";

// A forecast stub — the cache functions only pass it through, so shape
// doesn't matter here.
const fc = (name: string) => ({ id: name, name }) as unknown as AvalancheZone;

const snap = (
  zones: FavoritesSnapshot["zones"],
  fetchedAt = "2026-02-14T12:00:00Z",
): FavoritesSnapshot => ({ fetchedAt, zones });

beforeEach(() => __store.clear());

describe("mergeZoneBundle", () => {
  it("inserts a new zone+date bundle", () => {
    const next = mergeZoneBundle(snap({}), "tincan", "2026-02-14", {
      forecast: fc("Tincan"),
    }, "2026-02-14T12:00:00Z");
    expect(next.zones.tincan["2026-02-14"].forecast).toBeDefined();
    expect(next.zones.tincan["2026-02-14"].cachedAt).toBe("2026-02-14T12:00:00Z");
  });

  it("preserves fields the patch doesn't supply", () => {
    const base = snap({
      tincan: {
        "2026-02-14": {
          forecast: fc("Tincan"),
          stations: [{ id: "S1" }] as any,
          cachedAt: "old",
        },
      },
    });
    // Patch only weather — forecast + stations must survive.
    const next = mergeZoneBundle(base, "tincan", "2026-02-14", {
      weather: { centerWeather: {}, zoneNwsForecasts: {}, centerAvgDiscussions: {}, zoneAvgLocations: {} } as any,
    }, "new");
    const b = next.zones.tincan["2026-02-14"];
    expect(b.forecast).toBeDefined();
    expect(b.stations).toHaveLength(1);
    expect(b.weather).toBeDefined();
    expect(b.cachedAt).toBe("new");
  });

  it("does not mutate the input snapshot", () => {
    const base = snap({});
    mergeZoneBundle(base, "tincan", "2026-02-14", { forecast: fc("t") }, "now");
    expect(base.zones.tincan).toBeUndefined();
  });
});

describe("pruneSnapshot", () => {
  it("drops zones that aren't favorites", () => {
    // Use today's key so the age filter keeps the day; we're testing the
    // favorite filter here, not the date cutoff.
    const today = todayIsoDate();
    const base = snap({
      keep: { [today]: { forecast: fc("keep"), cachedAt: "x" } },
      drop: { [today]: { forecast: fc("drop"), cachedAt: "x" } },
    });
    const pruned = pruneSnapshot(base, ["keep"]);
    expect(pruned.zones.keep).toBeDefined();
    expect(pruned.zones.drop).toBeUndefined();
  });

  it("drops archive days older than the history window", () => {
    const today = todayIsoDate();
    const old = addDaysKey(today, -10);
    const recent = addDaysKey(today, -1);
    const base = snap({
      tincan: {
        [old]: { forecast: fc("old"), cachedAt: "x" },
        [recent]: { forecast: fc("recent"), cachedAt: "x" },
        [today]: { forecast: fc("today"), cachedAt: "x" },
      },
    });
    const pruned = pruneSnapshot(base, ["tincan"], 3); // keep today + 2 back
    const dates = Object.keys(pruned.zones.tincan);
    expect(dates).toContain(today);
    expect(dates).toContain(recent);
    expect(dates).not.toContain(old);
  });
});

describe("getZoneSnapshotForDate", () => {
  const base = snap({
    tincan: {
      "2026-02-12": { forecast: fc("d12"), cachedAt: "x" },
      "2026-02-14": { forecast: fc("d14"), cachedAt: "x" },
    },
  });

  it("returns the exact-date bundle when a date is given", () => {
    expect(getZoneSnapshotForDate(base, "tincan", "2026-02-12")?.forecast).toMatchObject({ name: "d12" });
  });

  it("returns undefined for an archive date with no bundle (no silent swap)", () => {
    expect(getZoneSnapshotForDate(base, "tincan", "2026-02-13")).toBeUndefined();
  });

  it("returns the newest bundle when no date is given", () => {
    expect(getZoneSnapshotForDate(base, "tincan")?.forecast).toMatchObject({ name: "d14" });
  });
});

describe("loadSnapshot migration from the old flat shape", () => {
  it("promotes a flat {zoneId: ZoneSnapshot} map to the nested date map", async () => {
    // Old shape: zones keyed by id straight to a ZoneSnapshot.
    const flat = {
      fetchedAt: "2026-02-14T00:00:00Z",
      zones: {
        tincan: {
          forecast: fc("Tincan"),
          cachedAt: "2026-02-14T00:00:00Z",
        } as ZoneSnapshot,
      },
    };
    __store.set("avy-favorites-snapshot", JSON.stringify(flat));
    const loaded = await loadSnapshot();
    // Should now be nested by date. The exact key is the LOCAL day of the
    // cachedAt instant (deliberately local, not UTC), so assert on the
    // single present date key generically rather than hard-coding it.
    const byDate = loaded?.zones.tincan as Record<string, ZoneSnapshot>;
    const keys = Object.keys(byDate);
    expect(keys).toHaveLength(1);
    expect(/^\d{4}-\d{2}-\d{2}$/.test(keys[0])).toBe(true);
    expect(byDate[keys[0]].forecast).toBeDefined();
  });
});

describe("mutateSnapshot serializes concurrent writes (lost-update fix)", () => {
  it("does not drop either writer's zone when two run concurrently", async () => {
    // Two independent wake sources each add a different zone at the same
    // time. Before serialization, both read the empty base and the second
    // save clobbered the first. They must now both survive.
    const now = "2026-02-14T12:00:00Z";
    const [a, b] = await Promise.all([
      mutateSnapshot((cur) =>
        mergeZoneBundle(cur, "zoneA", "2026-02-14", { forecast: fc("A") }, now),
      ),
      mutateSnapshot((cur) =>
        mergeZoneBundle(cur, "zoneB", "2026-02-14", { forecast: fc("B") }, now),
      ),
    ]);
    // The later resolver sees both; re-load from storage to be sure the
    // persisted result (not just the in-memory return) has both.
    const persisted = await loadSnapshot();
    expect(persisted?.zones.zoneA).toBeDefined();
    expect(persisted?.zones.zoneB).toBeDefined();
    // Sanity: the second-resolved return value already contains both.
    void a;
    expect(b.zones.zoneA).toBeDefined();
    expect(b.zones.zoneB).toBeDefined();
  });

  it("skips the write when the mutator returns the same reference", async () => {
    await saveSnapshot(snap({ tincan: { "2026-02-14": { forecast: fc("t"), cachedAt: "orig" } } }));
    const result = await mutateSnapshot((cur) => cur); // no-op
    expect(result.zones.tincan["2026-02-14"].cachedAt).toBe("orig");
  });
});
