import { describe, it, expect } from "vitest";

import { elevationBand, elevationRingIndex } from "./elevationBand";

describe("elevationBand", () => {
  it("maps NAC's three canonical strings", () => {
    expect(elevationBand("Alpine")).toBe("alpine");
    expect(elevationBand("Treeline")).toBe("treeline");
    expect(elevationBand("Below Treeline")).toBe("belowTreeline");
  });

  it("does NOT read 'Below Treeline' as 'Treeline' (the safety bug)", () => {
    // The whole point: substring matching would have classified this as
    // treeline, showing a below-treeline-only problem at the wrong band.
    expect(elevationBand("Below Treeline")).not.toBe("treeline");
  });

  it("treats 'Above Treeline' as alpine", () => {
    expect(elevationBand("Above Treeline")).toBe("alpine");
  });

  it("is case-insensitive", () => {
    expect(elevationBand("BELOW TREELINE")).toBe("belowTreeline");
    expect(elevationBand("alpine")).toBe("alpine");
  });
});

describe("elevationRingIndex", () => {
  it("orders inner→outer: alpine 0, treeline 1, below treeline 2", () => {
    expect(elevationRingIndex("Alpine")).toBe(0);
    expect(elevationRingIndex("Treeline")).toBe(1);
    expect(elevationRingIndex("Below Treeline")).toBe(2);
  });

  it("agrees with elevationBand so the rose and the text list can't diverge", () => {
    for (const s of ["Alpine", "Above Treeline", "Treeline", "Below Treeline"]) {
      const band = elevationBand(s);
      const ring = elevationRingIndex(s);
      const expected = band === "alpine" ? 0 : band === "belowTreeline" ? 2 : 1;
      expect(ring).toBe(expected);
    }
  });
});
