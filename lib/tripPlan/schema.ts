// Trip Plan ("tell a loved one") — domain schema.
//
// One zod schema tree shared by the composer, the local store, and (as a
// copied module, see the drift test) the edge function. Everything the
// user types lives in a TripPlanDraft; at send time the draft is frozen
// into a PacketSnapshot that the server stores and renders for contacts.
//
// Times: the form works in local wall-clock for the plan's `timezone`;
// the draft stores UTC ISO strings. Invariant: depart < returnBy <= worryBy,
// and worryBy - returnBy <= TRIP_LIMITS.maxWorryOffsetHours.
//
// Field set is the union of the Alaska State Troopers Wilderness Trip Plan,
// the AK DPS "information to provide" list, and the trip-relevant sections
// of the standard Lost Person Questionnaire — see
// docs/specs/2026-09-09-spec-trip-plan.md §5.

import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export const TRIP_LIMITS = {
  maxContacts: 5,
  minContacts: 1,
  maxWorryOffsetHours: 48,
  defaultWorryOffsetHours: 3,
  defaultTripHours: 8,
  maxTextChars: 2000,
  maxPacketBytes: 393_216,
  // Profile photo, base64 data URI. A 400px JPEG is typically 25–50 KB of
  // base64, so this leaves room for one photo plus a full packet.
  maxPhotoChars: 120_000,
  maxPartyMembers: 12,
} as const;

// ───────────────────────────── option lists ────────────────────────────────

export interface Option<V extends string = string> {
  value: V;
  label: string;
}

export const TRAVEL_MODE_OPTIONS = [
  { value: "ski", label: "Ski" },
  { value: "splitboard", label: "Splitboard" },
  { value: "snowmachine", label: "Snowmachine" },
  { value: "snowshoe", label: "Snowshoe" },
  { value: "foot", label: "On foot" },
  { value: "mixed", label: "Mixed" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option[];
export type TravelMode = (typeof TRAVEL_MODE_OPTIONS)[number]["value"];

export const EXPERIENCE_OPTIONS = [
  { value: "novice", label: "Novice" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "professional", label: "Professional" },
] as const satisfies readonly Option[];
export type ExperienceLevel = (typeof EXPERIENCE_OPTIONS)[number]["value"];

export const VEHICLE_TYPE_OPTIONS = [
  { value: "car", label: "Car / SUV" },
  { value: "truck", label: "Truck" },
  { value: "snowmachine", label: "Snowmachine" },
  { value: "trailer", label: "Truck + trailer" },
  { value: "airplane", label: "Airplane" },
  { value: "boat", label: "Boat" },
  { value: "dropped_off", label: "Dropped off / no vehicle" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option[];
export type VehicleType = (typeof VEHICLE_TYPE_OPTIONS)[number]["value"];

const valuesOf = <T extends readonly Option[]>(opts: T) =>
  opts.map((o) => o.value) as unknown as [
    T[number]["value"],
    ...T[number]["value"][],
  ];

// ───────────────────────────── primitives ──────────────────────────────────

const required = "Required";

// Free text: trimmed, whitespace collapsed, bounded.
const text = (max: number = TRIP_LIMITS.maxTextChars) =>
  z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max, `Keep it under ${max} characters.`));

// Optional variant: empty → undefined, and the key stays optional in the
// output type (the ZodOptional wrapper is outermost), so UI code can pass
// partial objects around without fighting `string | undefined` keys.
const optionalText = (max?: number) =>
  text(max)
    .transform((s) => (s ? s : undefined))
    .optional();

// Phone → E.164. Default region US; anything that fails to parse is
// rejected rather than stored raw, so the server never has to guess.
export function normalizePhone(raw: string): string | null {
  const parsed = parsePhoneNumberFromString(raw, "US");
  return parsed && parsed.isValid() ? parsed.number : null;
}

export const phoneSchema = z
  .string()
  .trim()
  .min(1, required)
  .transform((raw, ctx) => {
    const e164 = normalizePhone(raw);
    if (!e164) {
      ctx.addIssue({
        code: "custom",
        message: "That doesn't look like a phone number.",
      });
      return z.NEVER;
    }
    return e164;
  });

export const optionalPhoneSchema = z
  .string()
  .trim()
  .transform((raw, ctx) => {
    if (!raw) return undefined;
    const e164 = normalizePhone(raw);
    if (!e164) {
      ctx.addIssue({
        code: "custom",
        message: "That doesn't look like a phone number.",
      });
      return z.NEVER;
    }
    return e164;
  })
  .optional();

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("That doesn't look like an email address.");

// ISO-8601 instant. We validate parseability, not shape, so both
// `2026-12-06T17:00:00Z` and `…+00:00` pass.
export const instantSchema = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date/time.");

export const latLngSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .refine((p) => !(p.lat === 0 && p.lng === 0), {
    message: "Pick a real location.",
    path: ["lat"],
  });
export type LatLng = z.infer<typeof latLngSchema>;

// ───────────────────────────── profile blocks ──────────────────────────────

// Who the subject is, as SAR needs to know them. All optional here so a
// partially-filled profile still saves; the packet schema enforces what
// is required to *send*.
export const subjectProfileSchema = z.object({
  fullName: optionalText(120),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
    .optional(),
  sex: optionalText(40),
  phone: optionalPhoneSchema,
  cellCarrier: optionalText(60),
  homeAddress: optionalText(300),
  height: optionalText(20),
  weight: optionalText(20),
  build: optionalText(40),
  hair: optionalText(60),
  eyes: optionalText(40),
  distinguishingMarks: optionalText(300),
  photoUri: z.string().optional(),
  // Small JPEG data URI shown on the packet page so rescuers have a face.
  photoDataUri: z.string().optional(),
  medicalConditions: optionalText(1000),
  medications: optionalText(1000),
  allergies: optionalText(500),
  eyesightNote: optionalText(200),
  experienceLevel: z.enum(valuesOf(EXPERIENCE_OPTIONS)).optional(),
  avalancheTraining: optionalText(200),
  overnightCapable: z.boolean().optional(),
  goesOutAlone: z.boolean().optional(),
});
export type SubjectProfile = z.infer<typeof subjectProfileSchema>;

export const vehicleProfileSchema = z.object({
  id: z.string().min(1),
  label: text(40),
  type: z.enum(valuesOf(VEHICLE_TYPE_OPTIONS)),
  make: optionalText(40),
  model: optionalText(40),
  year: optionalText(8),
  color: optionalText(40),
  plate: optionalText(16),
  plateState: optionalText(8),
  registration: optionalText(40),
  notes: optionalText(300),
});
export type VehicleProfile = z.infer<typeof vehicleProfileSchema>;

// Colors, as seen from the air. Used twice: `gear.usualColors` is what
// you normally wear (profile), `draft.clothingToday` is what you have on
// today (prefilled from the profile, editable per trip).
export const clothingTodaySchema = z.object({
  shell: optionalText(60),
  pants: optionalText(60),
  pack: optionalText(60),
  helmet: optionalText(60),
});
export type ClothingToday = z.infer<typeof clothingTodaySchema>;

export const gearProfileSchema = z.object({
  // Tap-to-own inventory (keys from lib/tripPlan/gear.ts GEAR_ITEMS). The
  // four booleans below are kept in sync for older packets/pages.
  inventory: z.array(z.string()).default([]),
  beacon: z.boolean().default(true),
  shovel: z.boolean().default(true),
  probe: z.boolean().default(true),
  airbag: z.boolean().default(false),
  satDeviceType: optionalText(60),
  satShareUrl: optionalText(300),
  satMessageAddress: optionalText(120),
  radio: optionalText(120),
  overnightGear: optionalText(300),
  foodDays: optionalText(20),
  fireAndStove: optionalText(120),
  navigation: optionalText(200),
  // Legacy free-text colors (pre-2026-09-10). Kept so old profiles still
  // render; `usualColors` is the structured replacement.
  clothingColors: optionalText(200),
  usualColors: clothingTodaySchema.prefault({}),
  tentColor: optionalText(40),
  skiOrSledDescription: optionalText(300),
  skiOrSledColor: optionalText(60),
  firearm: optionalText(120),
  other: optionalText(500),
});
export type GearProfile = z.input<typeof gearProfileSchema>;

export const partyMemberSchema = z.object({
  name: text(120).pipe(z.string().min(1, required)),
  phone: optionalPhoneSchema,
  emergencyContact: optionalText(200),
  vehicleNote: optionalText(200),
});
export type PartyMember = z.infer<typeof partyMemberSchema>;

// A trusted person. Email is required in v1 because it is the server's
// nudge channel; phone becomes required once SMS ships.
export const contactSchema = z.object({
  id: z.string().min(1),
  displayName: text(80).pipe(z.string().min(1, required)),
  phone: optionalPhoneSchema,
  email: emailSchema,
});
export type Contact = z.infer<typeof contactSchema>;

// ───────────────────────────── the draft ───────────────────────────────────

export const tripPlanDraftSchema = z
  .object({
    // Where
    zoneId: z.string().optional(),
    areaName: text(120).pipe(z.string().min(1, "Where are you going?")),
    trailheadName: text(120).pipe(z.string().min(1, "Which trailhead?")),
    trailhead: latLngSchema.optional(),
    route: text(1000).pipe(
      z.string().min(1, "Describe the route or objective."),
    ),
    alternates: optionalText(1000),
    travelMode: z.enum(valuesOf(TRAVEL_MODE_OPTIONS)),
    doneBefore: z.boolean().default(false),
    familiarWithArea: z.boolean().default(false),

    // When
    timezone: z.string().min(1).default("America/Anchorage"),
    departAt: instantSchema,
    returnBy: instantSchema,
    worryBy: instantSchema,

    // Party
    party: z.array(partyMemberSchema).max(TRIP_LIMITS.maxPartyMembers).default([]),
    leader: optionalText(120),
    ifSeparated: optionalText(500),

    // Vehicle
    vehicle: vehicleProfileSchema.nullable().default(null),
    parkedAt: optionalText(200),

    // Today-specific readiness (asked per trip, not on the profile).
    overnightCapable: z.boolean().optional(),

    // Subject + gear
    subject: subjectProfileSchema.prefault({}),
    gear: gearProfileSchema.prefault({}),
    clothingToday: clothingTodaySchema.prefault({}),

    // People
    contacts: z
      .array(contactSchema)
      .min(TRIP_LIMITS.minContacts, "Add at least one contact.")
      .max(TRIP_LIMITS.maxContacts, `Up to ${TRIP_LIMITS.maxContacts} contacts.`),
    othersWhoKnow: optionalText(300),
    localAgencyPhone: optionalPhoneSchema,
    notes: optionalText(1000),
  })
  .superRefine((d, ctx) => {
    const depart = Date.parse(d.departAt);
    const ret = Date.parse(d.returnBy);
    const worry = Date.parse(d.worryBy);
    if (!(depart < ret)) {
      ctx.addIssue({
        code: "custom",
        path: ["returnBy"],
        message: "Return time must be after departure.",
      });
    }
    if (!(ret <= worry)) {
      ctx.addIssue({
        code: "custom",
        path: ["worryBy"],
        message: "Worry-by time can't be before your return time.",
      });
    }
    if (worry - ret > TRIP_LIMITS.maxWorryOffsetHours * 3_600_000) {
      ctx.addIssue({
        code: "custom",
        path: ["worryBy"],
        message: `Worry-by must be within ${TRIP_LIMITS.maxWorryOffsetHours} hours of your return.`,
      });
    }
    // Required-to-send subject fields.
    if (!d.subject.fullName) {
      ctx.addIssue({ code: "custom", path: ["subject", "fullName"], message: "Your name." });
    }
    if (!d.subject.phone) {
      ctx.addIssue({ code: "custom", path: ["subject", "phone"], message: "Your cell number." });
    }
    if (d.travelMode !== "foot" && d.vehicle && d.vehicle.type !== "dropped_off") {
      if (!d.vehicle.color && !d.vehicle.make && !d.vehicle.model) {
        ctx.addIssue({
          code: "custom",
          path: ["vehicle"],
          message: "Describe the vehicle (make, model, color).",
        });
      }
    }
    const emails = new Set<string>();
    d.contacts.forEach((c, i) => {
      if (emails.has(c.email)) {
        ctx.addIssue({
          code: "custom",
          path: ["contacts", i, "email"],
          message: "Duplicate contact.",
        });
      }
      emails.add(c.email);
    });
  });

export type TripPlanDraft = z.infer<typeof tripPlanDraftSchema>;
export type TripPlanDraftInput = z.input<typeof tripPlanDraftSchema>;

// ───────────────────────────── the packet ──────────────────────────────────

// What the zone's forecast looked like on the trip day, frozen.
export const forecastSnapshotSchema = z.object({
  centerName: z.string(),
  zoneName: z.string(),
  issuedAt: z.string().nullable(),
  dangerByBand: z
    .object({
      upper: z.string().nullable(),
      middle: z.string().nullable(),
      lower: z.string().nullable(),
    })
    .nullable(),
  problems: z.array(z.string()),
});
export type ForecastSnapshot = z.infer<typeof forecastSnapshotSchema>;

// PacketSnapshot = validated draft (minus contact ids) + provenance.
export const packetSnapshotSchema = z.object({
  version: z.literal(1),
  createdAt: instantSchema,
  draft: tripPlanDraftSchema,
  forecast: forecastSnapshotSchema.nullable(),
});
export type PacketSnapshot = z.infer<typeof packetSnapshotSchema>;

// ───────────────────────────── templates ───────────────────────────────────

// A saved trip: the "quick send" path. Everything the composer can
// prefill from a previous plan except the times.
export const tripTemplateSchema = z.object({
  id: z.string().min(1),
  label: text(60).pipe(z.string().min(1)),
  zoneId: z.string().optional(),
  areaName: text(120),
  trailheadName: text(120),
  trailhead: latLngSchema.optional(),
  route: text(1000),
  alternates: optionalText(1000),
  travelMode: z.enum(valuesOf(TRAVEL_MODE_OPTIONS)),
  vehicleId: z.string().optional(),
  contactIds: z.array(z.string()).default([]),
  party: z.array(partyMemberSchema).default([]),
  usualTripHours: z.number().min(1).max(72).default(TRIP_LIMITS.defaultTripHours),
  lastUsedAt: instantSchema.optional(),
  useCount: z.number().int().min(0).default(0),
});
export type TripTemplate = z.infer<typeof tripTemplateSchema>;

// ───────────────────────────── helpers ─────────────────────────────────────

export function defaultTimes(now: Date = new Date(), tripHours = TRIP_LIMITS.defaultTripHours) {
  const depart = new Date(now);
  // Round up to the next 15 minutes.
  depart.setSeconds(0, 0);
  depart.setMinutes(Math.ceil(depart.getMinutes() / 15) * 15);
  const returnBy = new Date(depart.getTime() + tripHours * 3_600_000);
  const worryBy = new Date(
    returnBy.getTime() + TRIP_LIMITS.defaultWorryOffsetHours * 3_600_000,
  );
  return {
    departAt: depart.toISOString(),
    returnBy: returnBy.toISOString(),
    worryBy: worryBy.toISOString(),
  };
}

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Anchorage";
  } catch {
    return "America/Anchorage";
  }
}

export function emptyDraft(overrides: Partial<TripPlanDraftInput> = {}): TripPlanDraftInput {
  return {
    areaName: "",
    trailheadName: "",
    route: "",
    travelMode: "ski",
    doneBefore: false,
    familiarWithArea: false,
    timezone: deviceTimezone(),
    ...defaultTimes(),
    party: [],
    vehicle: null,
    subject: {},
    gear: {},
    clothingToday: {},
    contacts: [],
    ...overrides,
  };
}
