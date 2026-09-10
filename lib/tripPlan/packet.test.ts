import { describe, expect, it } from "vitest";
import { completeness, formatLocal, sameLocalDay, shareMessage } from "./packet";
import { emptyDraft } from "./schema";

describe("completeness", () => {
  it("is 0 for an empty draft and lists what is missing", () => {
    const c = completeness(emptyDraft({ departAt: "", returnBy: "", worryBy: "" }));
    expect(c.score).toBe(0);
    expect(c.missing).toContain("Your name");
    expect(c.missing).toContain("Contacts");
  });
  it("credits on-foot trips for the vehicle items", () => {
    const c = completeness(emptyDraft({ travelMode: "foot" }));
    expect(c.missing).not.toContain("Vehicle");
    expect(c.missing).not.toContain("Plate");
  });
  it("is 1 when everything is filled", () => {
    const c = completeness(
      emptyDraft({
        areaName: "A",
        trailheadName: "T",
        trailhead: { lat: 60.8, lng: -149 },
        route: "R",
        subject: {
          fullName: "K",
          phone: "9075550100",
          height: "6'",
          medicalConditions: "none",
          experienceLevel: "advanced",
          photoUri: "file://x",
        },
        gear: { satShareUrl: "https://share.garmin.com/x", overnightGear: "bivy" },
        clothingToday: { shell: "red" },
        party: [{ name: "P" }],
        vehicle: { id: "v", label: "x", type: "truck", color: "silver", plate: "ABC" },
        contacts: [{ id: "c", displayName: "A", email: "a@example.com" }],
      }),
    );
    expect(c.score).toBe(1);
    expect(c.missing).toEqual([]);
  });
});

describe("formatting", () => {
  it("formats in the plan's timezone", () => {
    expect(formatLocal("2026-12-07T03:00:00Z", "America/Anchorage")).toBe("6:00 PM");
    expect(formatLocal("2026-12-07T03:00:00Z", "America/Denver")).toBe("8:00 PM");
  });
  it("sameLocalDay respects the zone", () => {
    // 03:00Z Dec 7 is Dec 6 in Anchorage but Dec 7 in London.
    expect(sameLocalDay("2026-12-07T03:00:00Z", "2026-12-06T20:00:00Z", "America/Anchorage")).toBe(true);
    expect(sameLocalDay("2026-12-07T03:00:00Z", "2026-12-06T20:00:00Z", "Europe/London")).toBe(false);
  });
  it("share message carries the worry-by instruction and the link", () => {
    const m = shareMessage({
      subjectName: "Kai Myers",
      areaName: "Turnagain Pass",
      returnBy: "2026-12-07T03:00:00Z",
      worryBy: "2026-12-07T06:00:00Z",
      timezone: "America/Anchorage",
      url: "https://x.test/p?t=abc",
    });
    expect(m).toContain("Kai's trip plan: Turnagain Pass");
    expect(m).toContain("by 9:00 PM");
    expect(m).toContain("https://x.test/p?t=abc");
  });
});
