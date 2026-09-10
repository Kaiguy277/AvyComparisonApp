// Packet helpers: completeness scoring, the share-sheet message, and
// local-time formatting. Pure; no RN imports.

import {
  TRAVEL_MODE_OPTIONS,
  type PacketSnapshot,
  type TripPlanDraft,
  type TripPlanDraftInput,
} from "./schema";

// Weighted completeness — header + "where/when" ×3, party/vehicle ×2,
// everything else ×1. Nudges the user; never blocks sending.
interface Weighted {
  label: string;
  weight: number;
  filled: boolean;
}

function has(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "boolean") return true;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export function completenessItems(d: TripPlanDraftInput): Weighted[] {
  const s = d.subject ?? {};
  const g = d.gear ?? {};
  const c = d.clothingToday ?? {};
  const v = d.vehicle ?? null;
  return [
    { label: "Your name", weight: 3, filled: has(s.fullName) },
    { label: "Your cell number", weight: 3, filled: has(s.phone) },
    { label: "Area", weight: 3, filled: has(d.areaName) },
    { label: "Trailhead", weight: 3, filled: has(d.trailheadName) },
    { label: "Trailhead pin", weight: 2, filled: has(d.trailhead) },
    { label: "Route / objective", weight: 3, filled: has(d.route) },
    { label: "Return time", weight: 3, filled: has(d.returnBy) },
    { label: "Contacts", weight: 3, filled: has(d.contacts) },
    { label: "Party members", weight: 2, filled: has(d.party) },
    {
      label: "Vehicle",
      weight: 2,
      filled: d.travelMode === "foot" || (v !== null && (has(v.color) || has(v.make))),
    },
    { label: "Plate", weight: 2, filled: d.travelMode === "foot" || has(v?.plate) },
    { label: "Physical description", weight: 1, filled: has(s.height) || has(s.build) || has(s.hair) },
    { label: "Clothing colors", weight: 1, filled: has(c.shell) || has(c.pack) || has(g.clothingColors) },
    { label: "Medical / medications", weight: 1, filled: has(s.medicalConditions) || has(s.medications) },
    { label: "Experience", weight: 1, filled: has(s.experienceLevel) },
    { label: "Satellite device", weight: 1, filled: has(g.satShareUrl) || has(g.satMessageAddress) },
    { label: "Overnight gear", weight: 1, filled: has(g.overnightGear) || (g.inventory ?? []).includes("overnight") },
    { label: "Photo", weight: 1, filled: has(s.photoUri) },
  ];
}

export function completeness(d: TripPlanDraftInput): {
  score: number; // 0..1
  missing: string[];
} {
  const items = completenessItems(d);
  const total = items.reduce((a, i) => a + i.weight, 0);
  const filled = items.filter((i) => i.filled).reduce((a, i) => a + i.weight, 0);
  return {
    score: total === 0 ? 0 : filled / total,
    missing: items.filter((i) => !i.filled).map((i) => i.label),
  };
}

// ───────────────────────────── formatting ──────────────────────────────────

export function formatLocal(
  iso: string | number,
  timezone: string,
  opts: { withDate?: boolean } = {},
): string {
  const d = typeof iso === "number" ? new Date(iso) : new Date(iso);
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      ...(opts.withDate ? { weekday: "short", month: "short", day: "numeric" } : {}),
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

// Same calendar day in the given zone?
export function sameLocalDay(a: string, b: string, timezone: string): boolean {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return f.format(new Date(a)) === f.format(new Date(b));
}

export function travelModeLabel(mode: TripPlanDraft["travelMode"]): string {
  return TRAVEL_MODE_OPTIONS.find((o) => o.value === mode)?.label ?? mode;
}

export function firstName(full: string | undefined): string {
  return (full ?? "").trim().split(/\s+/)[0] || "Your friend";
}

// The text that goes out through the iOS share sheet. It has to stand
// on its own if the contact never taps the link, so it carries the
// worry-by instruction in prose.
export function shareMessage(args: {
  subjectName: string;
  areaName: string;
  returnBy: string;
  worryBy: string;
  timezone: string;
  url: string;
}): string {
  const name = firstName(args.subjectName);
  const back = formatLocal(args.returnBy, args.timezone, {
    withDate: !sameLocalDay(args.returnBy, new Date().toISOString(), args.timezone),
  });
  const worry = formatLocal(args.worryBy, args.timezone, {
    withDate: !sameLocalDay(args.worryBy, args.returnBy, args.timezone),
  });
  return (
    `${name} is heading to ${args.areaName}, back by ${back}. ` +
    `If you haven't heard from ${name} by ${worry}, open this and follow the steps: ${args.url}`
  );
}

export function buildPacket(
  draft: TripPlanDraft,
  forecast: PacketSnapshot["forecast"],
  now: Date = new Date(),
): PacketSnapshot {
  return { version: 1, createdAt: now.toISOString(), draft, forecast };
}

// Byte size guard for the packet JSON (mirrors TRIP_LIMITS.maxPacketBytes
// server-side).
export function packetBytes(p: PacketSnapshot): number {
  const json = JSON.stringify(p);
  // TextEncoder exists in RN (Hermes) and Node ≥ 11.
  return typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(json).length
    : json.length;
}
