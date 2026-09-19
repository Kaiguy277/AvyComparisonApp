import { describe, expect, it } from "vitest";

import { tzOffsetMs, utcToWallTime, wallTimeToUtc } from "./zoned-time";

const AK = "America/Anchorage";
const H = 3_600_000;

describe("wallTimeToUtc", () => {
  // The bug: 9 PM picked in Alaska was read as 9 PM UTC.
  it("reads a summer (AKDT, UTC-8) wall time as Alaska time, not UTC", () => {
    const utc = wallTimeToUtc("2026-09-18T21:00", AK)!;
    expect(new Date(utc).toISOString()).toBe("2026-09-19T05:00:00.000Z");
  });

  it("reads a winter (AKST, UTC-9) wall time — avalanche season", () => {
    const utc = wallTimeToUtc("2026-01-15T21:00", AK)!;
    expect(new Date(utc).toISOString()).toBe("2026-01-16T06:00:00.000Z");
  });

  it("is 8 hours later than the old naive-UTC parse in September", () => {
    const naiveUtc = Date.parse("2026-09-18T21:00:00Z");
    expect(wallTimeToUtc("2026-09-18T21:00", AK)! - naiveUtc).toBe(8 * H);
  });

  it("lands correctly on the day after the spring-forward change", () => {
    // US DST starts 2026-03-08; the 9th is fully AKDT.
    const utc = wallTimeToUtc("2026-03-09T09:00", AK)!;
    expect(new Date(utc).toISOString()).toBe("2026-03-09T17:00:00.000Z");
  });

  it("lands correctly on the day after fall-back", () => {
    // US DST ends 2026-11-01; the 2nd is fully AKST.
    const utc = wallTimeToUtc("2026-11-02T09:00", AK)!;
    expect(new Date(utc).toISOString()).toBe("2026-11-02T18:00:00.000Z");
  });

  it("accepts seconds, and works for other zones", () => {
    expect(new Date(wallTimeToUtc("2026-09-18T12:00:30", "America/Denver")!).toISOString())
      .toBe("2026-09-18T18:00:30.000Z");
  });

  it("returns null for anything that isn't a datetime-local value", () => {
    expect(wallTimeToUtc("", AK)).toBeNull();
    expect(wallTimeToUtc("tomorrow", AK)).toBeNull();
    expect(wallTimeToUtc("2026-09-18", AK)).toBeNull();
    // An offset means it is NOT a wall time; refuse rather than double-shift.
    expect(wallTimeToUtc("2026-09-18T21:00Z", AK)).toBeNull();
  });
});

describe("utcToWallTime", () => {
  it("formats for a datetime-local input in the plan's zone", () => {
    expect(utcToWallTime(Date.parse("2026-09-19T05:00:00Z"), AK)).toBe("2026-09-18T21:00");
  });

  it("round-trips with wallTimeToUtc", () => {
    for (const w of ["2026-09-18T21:00", "2026-01-15T06:30", "2026-07-04T00:00"]) {
      expect(utcToWallTime(wallTimeToUtc(w, AK)!, AK)).toBe(w);
    }
  });
});

describe("tzOffsetMs", () => {
  it("is -8h in AKDT and -9h in AKST", () => {
    expect(tzOffsetMs(Date.parse("2026-09-18T12:00:00Z"), AK)).toBe(-8 * H);
    expect(tzOffsetMs(Date.parse("2026-01-15T12:00:00Z"), AK)).toBe(-9 * H);
  });
});
