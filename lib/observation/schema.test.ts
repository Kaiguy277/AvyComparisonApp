import { describe, it, expect } from "vitest";

import { locationPointSchema } from "./schema";

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
