import { describe, expect, it } from "vitest";

import {
  composeAlert,
  peakDanger,
  titleCase,
  zoneDangerFor,
} from "./forecast-alert-copy";

describe("peakDanger", () => {
  it("takes the highest band, not the first or the lowest", () => {
    expect(
      peakDanger({ alpine: "HIGH", treeline: "MODERATE", belowTreeline: "LOW" }),
    ).toBe("HIGH");
    expect(
      peakDanger({ alpine: "LOW", treeline: "LOW", belowTreeline: "CONSIDERABLE" }),
    ).toBe("CONSIDERABLE");
  });

  it("is case-insensitive", () => {
    expect(peakDanger({ alpine: "considerable" })).toBe("CONSIDERABLE");
  });

  // The important one: an unreadable band must never drag the rating DOWN.
  it("ignores NO_RATING and unknown values rather than treating them as LOW", () => {
    expect(peakDanger({ alpine: "NO_RATING", treeline: "HIGH" })).toBe("HIGH");
    expect(peakDanger({ alpine: "???", treeline: "MODERATE" })).toBe("MODERATE");
  });

  it("returns null when nothing is ratable, so the caller can skip", () => {
    expect(peakDanger({ alpine: "NO_RATING" })).toBeNull();
    expect(peakDanger({})).toBeNull();
    expect(peakDanger(undefined)).toBeNull();
    expect(peakDanger(null)).toBeNull();
  });

  it("handles a partially-populated band set", () => {
    expect(peakDanger({ treeline: "EXTREME" })).toBe("EXTREME");
  });
});

describe("zoneDangerFor", () => {
  const today = "2026-09-17";

  it("prefers the entry matching today's date", () => {
    const payload = {
      name: "Turnagain Pass",
      forecast: [
        { date: "2026-09-16", danger: { alpine: "EXTREME" } },
        { date: today, danger: { alpine: "MODERATE" } },
      ],
    };
    expect(zoneDangerFor(payload, today, "zone-id")).toEqual({
      name: "Turnagain Pass",
      danger: "MODERATE",
    });
  });

  it("falls back to the first entry when no date matches", () => {
    const payload = {
      name: "Hatcher Pass",
      forecast: [{ danger: { treeline: "HIGH" } }],
    };
    expect(zoneDangerFor(payload, today, "zone-id")?.danger).toBe("HIGH");
  });

  it("falls back to the zone id when the payload has no name", () => {
    const payload = { forecast: [{ date: today, danger: { alpine: "LOW" } }] };
    expect(zoneDangerFor(payload, today, "turnagain-girdwood")?.name).toBe(
      "turnagain-girdwood",
    );
  });

  // Skipping beats sending a stale number: a notification saying
  // "CONSIDERABLE" from yesterday is worse than no notification.
  it("returns null for an empty or unratable payload", () => {
    expect(zoneDangerFor({ name: "X", forecast: [] }, today, "x")).toBeNull();
    expect(zoneDangerFor(null, today, "x")).toBeNull();
    expect(
      zoneDangerFor(
        { name: "X", forecast: [{ date: today, danger: { alpine: "NO_RATING" } }] },
        today,
        "x",
      ),
    ).toBeNull();
  });
});

describe("composeAlert", () => {
  it("returns null when there is nothing to say", () => {
    expect(composeAlert([])).toBeNull();
  });

  it("uses the zone name as the title for a single zone", () => {
    expect(composeAlert([{ name: "Turnagain Pass", danger: "CONSIDERABLE" }]))
      .toEqual({
        title: "Turnagain Pass",
        body: "Considerable today. Tap for the full forecast.",
      });
  });

  it("combines multiple zones under one headline", () => {
    const r = composeAlert([
      { name: "Turnagain Pass", danger: "CONSIDERABLE" },
      { name: "Hatcher Pass", danger: "MODERATE" },
    ]);
    expect(r?.title).toBe("Today's avalanche danger");
    expect(r?.body).toBe("Turnagain Pass — Considerable · Hatcher Pass — Moderate");
  });

  it("caps the list and counts the overflow", () => {
    const parts = ["A", "B", "C", "D", "E", "F"].map((name) => ({
      name,
      danger: "LOW",
    }));
    const r = composeAlert(parts);
    expect(r?.body).toContain("+2 more");
    expect(r?.body.startsWith("A — Low · B — Low · C — Low · D — Low")).toBe(true);
  });

  it("does not add an overflow suffix at exactly the cap", () => {
    const parts = ["A", "B", "C", "D"].map((name) => ({ name, danger: "HIGH" }));
    expect(composeAlert(parts)?.body).not.toContain("more");
  });
});

describe("titleCase", () => {
  it("renders ratings as display copy", () => {
    expect(titleCase("CONSIDERABLE")).toBe("Considerable");
    expect(titleCase("HIGH")).toBe("High");
  });
});
