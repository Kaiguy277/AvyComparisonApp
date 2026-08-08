import { describe, it, expect } from "vitest";

import {
  avgOverHours,
  hourlyIncrements,
  hourlySeries,
  maxOverHours,
  valueHoursAgo,
  windowStartIdx,
} from "./synoptic-api";

// The safety-grade fix: 24/72hr lookbacks must be selected by TIMESTAMP,
// not array index. Synoptic reports at each station's native cadence, so
// "N samples ago" is not "N hours ago". These tests build a station that
// reports every 10 MINUTES — the failure mode where the old index math
// turned a 24-hour window into a ~4-hour one.

// Build `count` samples ending at `endIso`, spaced `stepMin` apart, with a
// value function of the sample's age in hours.
function series(
  endIso: string,
  count: number,
  stepMin: number,
  valAt: (hoursAgo: number) => number | null,
): { timestamps: string[]; vals: (number | null)[] } {
  const end = Date.parse(endIso);
  const timestamps: string[] = [];
  const vals: (number | null)[] = [];
  // Oldest first (ascending), matching Synoptic's date_time order.
  for (let i = count - 1; i >= 0; i--) {
    const t = end - i * stepMin * 60_000;
    timestamps.push(new Date(t).toISOString());
    vals.push(valAt((end - t) / 3_600_000));
  }
  return { timestamps, vals };
}

const END = "2026-02-14T12:00:00.000Z";

describe("valueHoursAgo selects by elapsed time, not sample count", () => {
  // 10-min cadence → 6 samples/hour. 24 samples = 4 hours. A depth that
  // rises 1"/hour: value == -(hoursAgo) below the latest.
  const { timestamps, vals } = series(END, 6 * 30, 10, (h) => 100 - h);

  it("value ~24h ago is ~24h back, NOT 24 samples (4h) back", () => {
    const v = valueHoursAgo(vals, timestamps, 24);
    // 24h ago the depth was ~100-24 = 76, give or take one 10-min step.
    expect(v).not.toBeNull();
    expect(v!).toBeGreaterThanOrEqual(75);
    expect(v!).toBeLessThanOrEqual(77);
    // The old bug (index -24) would have returned ~96 (4 hours ago).
    expect(v!).toBeLessThan(90);
  });

  it("returns null when no reading is that old", () => {
    // Only 2 hours of data, ask for 24h ago.
    const short = series(END, 12, 10, (h) => 100 - h);
    expect(valueHoursAgo(short.vals, short.timestamps, 24)).toBeNull();
  });
});

describe("window aggregates cover the real time window", () => {
  const { timestamps, vals } = series(END, 6 * 30, 10, (h) => 100 - h);

  it("maxOverHours(24) sees the whole last 24h, not the last 24 samples", () => {
    // Values decrease with age, so max over 24h ≈ the latest (~100).
    expect(maxOverHours(vals, timestamps, 24)).toBe(100);
  });

  it("avgOverHours(24) averages ~24h of data (mean ≈ 100 - 12)", () => {
    const avg = avgOverHours(vals, timestamps, 24);
    expect(avg).not.toBeNull();
    expect(avg!).toBeGreaterThanOrEqual(87);
    expect(avg!).toBeLessThanOrEqual(89);
  });
});

describe("hourlySeries downsamples to ~1 point per clock hour", () => {
  it("a 10-min station yields ~24 points for 24h, not 144", () => {
    const { timestamps, vals } = series(END, 6 * 30, 10, (h) => 100 - h);
    const pts = hourlySeries(vals, timestamps, 24);
    // One bucket per clock hour across ~24h → ~24-25 points.
    expect(pts.length).toBeGreaterThanOrEqual(23);
    expect(pts.length).toBeLessThanOrEqual(26);
    // Timestamps ascending.
    for (let i = 1; i < pts.length; i++) {
      expect(Date.parse(pts[i].timestamp)).toBeGreaterThan(
        Date.parse(pts[i - 1].timestamp),
      );
    }
  });

  it("72h window buckets to ~2h (≈36 points) regardless of cadence", () => {
    const { timestamps, vals } = series(END, 6 * 80, 10, (h) => 100 - h);
    const pts = hourlySeries(vals, timestamps, 72);
    expect(pts.length).toBeGreaterThanOrEqual(34);
    expect(pts.length).toBeLessThanOrEqual(38);
  });
});

describe("hourlyIncrements sums cumulative deltas per bucket", () => {
  it("a cumulative precip gauge yields the per-hour new precip", () => {
    // Cumulative precip that rises 0.1\"/hour. Over 6 samples/hr that's
    // 0.1 per clock hour of accumulation — summed within the bucket.
    const end = Date.parse(END);
    const timestamps: string[] = [];
    const vals: (number | null)[] = [];
    const count = 6 * 6; // 6 hours of 10-min samples
    for (let i = count - 1; i >= 0; i--) {
      const t = end - i * 10 * 60_000;
      timestamps.push(new Date(t).toISOString());
      const hoursElapsed = (t - (end - count * 10 * 60_000)) / 3_600_000;
      vals.push(Number((hoursElapsed * 0.1).toFixed(4))); // cumulative
    }
    const pts = hourlyIncrements(vals, timestamps, 6, 2);
    // Each clock-hour bucket should total ≈ 0.1", never negative.
    for (const p of pts) {
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(0.13);
    }
    // Total ≈ 0.6" over the window (not ~3.6" from 6× double counting).
    const total = pts.reduce((s, p) => s + p.value, 0);
    expect(total).toBeGreaterThanOrEqual(0.4);
    expect(total).toBeLessThanOrEqual(0.75);
  });
});

describe("windowStartIdx binary search", () => {
  it("finds the first sample within N hours of the latest", () => {
    const { timestamps } = series(END, 6 * 30, 10, () => 0);
    const start = windowStartIdx(timestamps, 24);
    // Everything from `start` on is within 24h; the one before is older.
    const anchor = Date.parse(timestamps[timestamps.length - 1]);
    expect(anchor - Date.parse(timestamps[start])).toBeLessThanOrEqual(
      24 * 3_600_000,
    );
    if (start > 0) {
      expect(anchor - Date.parse(timestamps[start - 1])).toBeGreaterThan(
        24 * 3_600_000,
      );
    }
  });
});
