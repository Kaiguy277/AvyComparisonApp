import { describe, it, expect } from "vitest";

import {
  addDaysKey,
  formatDayKey,
  formatDayKeyLong,
  fromKey,
  toKey,
  todayKey,
} from "./dates";

// These helpers are the single date convention for the app: LOCAL day
// keys, never UTC. The bug they fix is a UTC rollover at 3–5 PM local that
// desynced the archive pager. The tests below run under the process TZ; a
// couple deliberately pick an instant that would land on a DIFFERENT day
// in UTC vs local to prove we don't go through UTC.

describe("toKey / fromKey round-trip (local)", () => {
  it("formats a local date as YYYY-MM-DD", () => {
    // Local midnight — no UTC involved.
    expect(toKey(new Date(2026, 1, 14))).toBe("2026-02-14");
  });

  it("fromKey parses to LOCAL midnight, not UTC midnight", () => {
    const d = fromKey("2026-02-14");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(1); // February
    expect(d.getDate()).toBe(14);
    expect(d.getHours()).toBe(0); // local midnight
  });

  it("round-trips any key", () => {
    for (const k of ["2026-01-01", "2026-07-04", "2026-12-31"]) {
      expect(toKey(fromKey(k))).toBe(k);
    }
  });

  it("does not shift the day for a late-evening local instant", () => {
    // 11 PM local on the 14th. `new Date().toISOString().slice(0,10)`
    // (the old UTC approach) would report the 15th in any UTC-negative
    // zone. toKey must still say the 14th.
    const lateLocal = new Date(2026, 1, 14, 23, 0, 0);
    expect(toKey(lateLocal)).toBe("2026-02-14");
  });
});

describe("addDaysKey", () => {
  it("steps forward and back", () => {
    expect(addDaysKey("2026-02-14", 1)).toBe("2026-02-15");
    expect(addDaysKey("2026-02-14", -1)).toBe("2026-02-13");
  });

  it("crosses month boundaries", () => {
    expect(addDaysKey("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDaysKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("crosses a year boundary", () => {
    expect(addDaysKey("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles a leap day", () => {
    expect(addDaysKey("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysKey("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("survives a DST transition without dropping/gaining a day", () => {
    // US DST springs forward 2026-03-08. Local-midnight arithmetic must
    // still produce consecutive calendar days regardless of the offset
    // flip (the old T12:00:00Z + setUTCDate approach was fragile here).
    expect(addDaysKey("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDaysKey("2026-03-08", 1)).toBe("2026-03-09");
  });
});

describe("formatDayKey", () => {
  it("renders a short label from a local parse", () => {
    expect(formatDayKey("2026-02-14")).toBe("FEB 14");
    expect(formatDayKey("2026-12-01")).toBe("DEC 1");
  });

  it("returns the raw key on garbage input", () => {
    expect(formatDayKey("not-a-date")).toBe("not-a-date");
  });
});

describe("formatDayKeyLong", () => {
  it("includes the weekday", () => {
    // 2026-02-14 is a Saturday.
    expect(formatDayKeyLong("2026-02-14")).toBe("SAT · FEB 14");
  });
});

describe("todayKey", () => {
  it("matches toKey(now) for an injected clock", () => {
    const fixed = new Date(2026, 5, 30, 15, 0, 0); // 3 PM local
    expect(todayKey(fixed)).toBe("2026-06-30");
    // The 3 PM guard: this is exactly the hour the old UTC key would have
    // already rolled to July 1 in Alaska. Local keeps it June 30.
    expect(todayKey(fixed)).toBe(toKey(fixed));
  });
});
