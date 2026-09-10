import { describe, expect, it } from "vitest";
import {
  TRIP_LIMITS,
  contactSchema,
  defaultTimes,
  emptyDraft,
  normalizePhone,
  tripPlanDraftSchema,
  type TripPlanDraftInput,
} from "./schema";

const H = 3_600_000;

function validDraft(overrides: Partial<TripPlanDraftInput> = {}): TripPlanDraftInput {
  const depart = new Date("2026-12-06T17:00:00Z");
  return emptyDraft({
    areaName: "Turnagain Pass",
    trailheadName: "Tincan lot",
    route: "Tincan common up-track to the trees, ski the low-angle glades.",
    travelMode: "ski",
    timezone: "America/Anchorage",
    departAt: depart.toISOString(),
    returnBy: new Date(depart.getTime() + 8 * H).toISOString(),
    worryBy: new Date(depart.getTime() + 11 * H).toISOString(),
    subject: { fullName: "Kai Myers", phone: "(907) 555-0100" },
    vehicle: { id: "v1", label: "Tacoma", type: "truck", color: "silver", plate: "ABC123" },
    contacts: [{ id: "c1", displayName: "Alex", email: "Alex@Example.com ", phone: "907-555-0101" }],
    ...overrides,
  });
}

describe("phone normalization", () => {
  it("normalizes a US number to E.164", () => {
    expect(normalizePhone("(907) 555-0100")).toBe("+19075550100");
    expect(normalizePhone("907.555.0100")).toBe("+19075550100");
  });
  it("accepts an explicit country code", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
  });
  it("rejects garbage and 7-digit numbers", () => {
    expect(normalizePhone("555-0100")).toBeNull();
    expect(normalizePhone("call me")).toBeNull();
  });
});

describe("contact schema", () => {
  it("trims + lowercases email and normalizes phone", () => {
    const c = contactSchema.parse({
      id: "c1",
      displayName: "  Alex  Q ",
      email: " Alex@Example.com ",
      phone: "907 555 0101",
    });
    expect(c.email).toBe("alex@example.com");
    expect(c.phone).toBe("+19075550101");
    expect(c.displayName).toBe("Alex Q");
  });
  it("rejects a bad email", () => {
    expect(contactSchema.safeParse({ id: "c", displayName: "A", email: "a@b" }).success).toBe(false);
  });
});

describe("trip plan draft", () => {
  it("accepts a minimal valid draft and normalizes nested values", () => {
    const r = tripPlanDraftSchema.safeParse(validDraft());
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.subject.phone).toBe("+19075550100");
    expect(r.data.contacts[0].email).toBe("alex@example.com");
    expect(r.data.gear.beacon).toBe(true);
  });

  it("rejects return before departure", () => {
    const d = validDraft();
    const r = tripPlanDraftSchema.safeParse({ ...d, returnBy: d.departAt });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues.some((i) => i.path.join(".") === "returnBy")).toBe(true);
  });

  it("rejects worry-by before return", () => {
    const d = validDraft();
    const r = tripPlanDraftSchema.safeParse({
      ...d,
      worryBy: new Date(Date.parse(d.returnBy) - H).toISOString(),
    });
    expect(r.success).toBe(false);
  });

  it("rejects worry-by more than 48h after return", () => {
    const d = validDraft();
    const r = tripPlanDraftSchema.safeParse({
      ...d,
      worryBy: new Date(Date.parse(d.returnBy) + (TRIP_LIMITS.maxWorryOffsetHours + 1) * H).toISOString(),
    });
    expect(r.success).toBe(false);
  });

  it("requires the subject's name and phone to send", () => {
    const r = tripPlanDraftSchema.safeParse(validDraft({ subject: {} }));
    expect(r.success).toBe(false);
    if (r.success) return;
    const paths = r.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("subject.fullName");
    expect(paths).toContain("subject.phone");
  });

  it("requires at least one and at most five contacts, no duplicates", () => {
    expect(tripPlanDraftSchema.safeParse(validDraft({ contacts: [] })).success).toBe(false);
    const six = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`,
      displayName: `P${i}`,
      email: `p${i}@example.com`,
    }));
    expect(tripPlanDraftSchema.safeParse(validDraft({ contacts: six })).success).toBe(false);
    const dup = tripPlanDraftSchema.safeParse(
      validDraft({
        contacts: [
          { id: "a", displayName: "A", email: "same@example.com" },
          { id: "b", displayName: "B", email: "SAME@example.com" },
        ],
      }),
    );
    expect(dup.success).toBe(false);
  });

  it("requires a vehicle description unless on foot or dropped off", () => {
    const bad = tripPlanDraftSchema.safeParse(
      validDraft({ vehicle: { id: "v", label: "x", type: "car" } }),
    );
    expect(bad.success).toBe(false);
    const foot = tripPlanDraftSchema.safeParse(validDraft({ travelMode: "foot", vehicle: null }));
    expect(foot.success).toBe(true);
    const dropped = tripPlanDraftSchema.safeParse(
      validDraft({ vehicle: { id: "v", label: "x", type: "dropped_off" } }),
    );
    expect(dropped.success).toBe(true);
  });

  it("rejects a Null-Island trailhead", () => {
    const r = tripPlanDraftSchema.safeParse(validDraft({ trailhead: { lat: 0, lng: 0 } }));
    expect(r.success).toBe(false);
  });
});

describe("defaultTimes", () => {
  it("rounds departure up to 15 minutes and offsets return/worry", () => {
    const now = new Date("2026-12-06T17:07:00Z");
    const t = defaultTimes(now);
    expect(t.departAt).toBe("2026-12-06T17:15:00.000Z");
    expect(Date.parse(t.returnBy) - Date.parse(t.departAt)).toBe(TRIP_LIMITS.defaultTripHours * H);
    expect(Date.parse(t.worryBy) - Date.parse(t.returnBy)).toBe(TRIP_LIMITS.defaultWorryOffsetHours * H);
  });
  it("is stable across the November DST change (UTC math, no local drift)", () => {
    const now = new Date("2026-11-01T09:50:00Z"); // DST ends 2026-11-01 in Anchorage
    const t = defaultTimes(now, 8);
    expect(Date.parse(t.returnBy) - Date.parse(t.departAt)).toBe(8 * H);
  });
});
