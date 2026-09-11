import { describe, it, expect } from "vitest";

import {
  avalancheEntryFormSchema,
  emptyObservationForm,
  locationPointSchema,
  toSubmitPayload,
} from "./schema";

describe("locationPointSchema", () => {
  it("rejects 0,0 (the fix-less default — bogus coordinates)", () => {
    expect(locationPointSchema.safeParse({ lat: 0, lng: 0 }).success).toBe(
      false,
    );
  });

  it("accepts a real coordinate", () => {
    expect(
      locationPointSchema.safeParse({ lat: 60.78, lng: -148.9 }).success,
    ).toBe(true);
  });

  it("rejects out-of-range coordinates", () => {
    expect(locationPointSchema.safeParse({ lat: 91, lng: 0 }).success).toBe(
      false,
    );
    expect(locationPointSchema.safeParse({ lat: 0, lng: 181 }).success).toBe(
      false,
    );
  });

  it("accepts a point on a zero meridian/equator that isn't 0,0", () => {
    // Guard against an over-broad refine: lat 0 OR lng 0 alone is valid.
    expect(locationPointSchema.safeParse({ lat: 0, lng: -122 }).success).toBe(
      true,
    );
    expect(locationPointSchema.safeParse({ lat: 45, lng: 0 }).success).toBe(
      true,
    );
  });
});

describe("avalanche elevation", () => {
  const base = {
    date: new Date("2026-02-14T12:00:00Z"),
    location: "Tincan proper",
    trigger: "AS",
    aspect: "N",
    d_size: "2",
  };

  it("accepts a blank elevation — 'I don't know' beats a guess", () => {
    const r = avalancheEntryFormSchema.safeParse({ ...base, elevation: "" });
    expect(r.success).toBe(true);
  });

  it("still accepts a whole number and still rejects junk", () => {
    expect(avalancheEntryFormSchema.safeParse({ ...base, elevation: "3500" }).success).toBe(true);
    expect(avalancheEntryFormSchema.safeParse({ ...base, elevation: "35oo" }).success).toBe(false);
    expect(avalancheEntryFormSchema.safeParse({ ...base, elevation: "3500.5" }).success).toBe(false);
  });

  it("sends null rather than NaN when the observer left it blank", () => {
    const form = emptyObservationForm({ center_id: "CNFAIC" });
    const entry = avalancheEntryFormSchema.parse({ ...base, elevation: "" });
    const withNumber = avalancheEntryFormSchema.parse({ ...base, elevation: "3500" });
    const payload = toSubmitPayload({
      form: { ...form, avalanches: [entry, withNumber] },
      obsMedia: [],
      avalancheMedia: [[], []],
      status: "published",
    });
    expect(payload.avalanches[0].elevation).toBeNull();
    expect(payload.avalanches[1].elevation).toBe(3500);
  });
});
