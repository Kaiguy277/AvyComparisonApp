import { describe, expect, it } from "vitest";

import { formatTempF, formatWindMph } from "./units";

describe("formatTempF", () => {
  // The bug this was written for: a station reporting 52.34 rendered raw,
  // next to neighbours showing 36.9 and 39.
  it("trims excess precision to one decimal", () => {
    expect(formatTempF(52.34)).toBe("52.3°");
    expect(formatTempF(52.36)).toBe("52.4°");
  });

  it("leaves a meaningful tenth in place", () => {
    expect(formatTempF(36.9)).toBe("36.9°");
  });

  it("drops a trailing .0 so whole degrees stay clean", () => {
    expect(formatTempF(39)).toBe("39°");
    expect(formatTempF(49.0)).toBe("49°");
    expect(formatTempF(38.04)).toBe("38°");
  });

  // Near freezing is the range that matters most for this app.
  it("keeps resolution either side of freezing", () => {
    expect(formatTempF(31.6)).toBe("31.6°");
    expect(formatTempF(32.4)).toBe("32.4°");
    expect(formatTempF(32)).toBe("32°");
  });

  it("handles sub-zero readings without producing -0", () => {
    expect(formatTempF(-0.04)).toBe("0°");
    expect(formatTempF(-12.35)).toBe("-12.3°");
    expect(formatTempF(-40)).toBe("-40°");
  });

  it("renders an em dash for missing or unusable values", () => {
    expect(formatTempF(null)).toBe("—");
    expect(formatTempF(undefined)).toBe("—");
    expect(formatTempF(NaN)).toBe("—");
    expect(formatTempF(Infinity)).toBe("—");
  });
});

describe("formatWindMph", () => {
  // The bug this was written for: the station card headline rendered the raw
  // sensor value, so "6.95 MPH" sat above "24H AVG 9 mph" and "24H MAX 27.8 mph"
  // — three precisions for one quantity in a single view.
  it("rounds to whole mph", () => {
    expect(formatWindMph(6.95)).toBe("7");
    expect(formatWindMph(27.8)).toBe("28");
    expect(formatWindMph(9)).toBe("9");
    expect(formatWindMph(0.4)).toBe("0");
  });

  it("never renders a negative zero", () => {
    // Math.round(-0.4) is -0, which would print as "-0 mph".
    expect(formatWindMph(-0.4)).toBe("0");
    expect(Object.is(Number(formatWindMph(-0.4)), 0)).toBe(true);
  });

  it("falls back to an em dash for missing or non-finite values", () => {
    expect(formatWindMph(null)).toBe("—");
    expect(formatWindMph(undefined)).toBe("—");
    expect(formatWindMph(NaN)).toBe("—");
    expect(formatWindMph(Infinity)).toBe("—");
  });
});
