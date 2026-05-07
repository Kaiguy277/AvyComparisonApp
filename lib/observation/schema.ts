// Schemas for the observation submission flow.
//
// Three layers:
//   1. observerProfileSchema — what we persist locally (name + contact +
//      defaults). AsyncStorage-backed.
//   2. observationFormSchema — form-side state. Uses form-friendly types
//      (Date objects, integer-strings for elevation/number/d_size) so the
//      UI can bind directly. Validation runs at submit time.
//   3. submitPayloadSchema — wire format. Dates are YYYY-MM-DD strings,
//      numbers are real numbers, media is the array of MediaItem returned
//      from POST /v2/public/media.
//
// A `toSubmitPayload()` helper converts (1) → wire format with the right
// coercions. We intentionally don't reuse one schema for both — the form
// needs to allow in-progress drafts, and the wire format has stricter
// types that user-facing validation messages would obscure.

import { z } from "zod";
import {
  ACTIVITY_OPTIONS,
  ASPECT_OPTIONS,
  AVALANCHE_TRIGGER_OPTIONS,
  AVALANCHE_TYPE_OPTIONS,
  BED_SURFACE_OPTIONS,
  D_SIZE_OPTIONS,
  INSTABILITY_DISTRIBUTION_OPTIONS,
  OBSERVER_TYPE_PUBLIC,
  OBS_SOURCE,
  PHOTO_USAGE_OPTIONS,
} from "./constants";

const required = "Required.";

// ───────────────────────────── enum-like value sets ─────────────────────────

const valuesOf = <T extends readonly { value: string }[]>(opts: T) =>
  opts.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];

const activityValueSchema = z.enum(valuesOf(ACTIVITY_OPTIONS));
const aspectValueSchema = z.enum(valuesOf(ASPECT_OPTIONS));
const avalancheTypeValueSchema = z.enum(valuesOf(AVALANCHE_TYPE_OPTIONS));
const triggerValueSchema = z.enum(valuesOf(AVALANCHE_TRIGGER_OPTIONS));
const bedSurfaceValueSchema = z.enum(valuesOf(BED_SURFACE_OPTIONS));
const dSizeValueSchema = z.enum(valuesOf(D_SIZE_OPTIONS));
const distributionValueSchema = z.enum(valuesOf(INSTABILITY_DISTRIBUTION_OPTIONS));
const photoUsageValueSchema = z.enum(valuesOf(PHOTO_USAGE_OPTIONS));

// ───────────────────────────── observer profile ─────────────────────────────

// Persisted across submissions. Email is required (centers contact the
// observer for follow-up); phone is optional and never shared with the
// public per NAC convention.
export const observerProfileSchema = z.object({
  name: z.string().min(1, required),
  email: z.string().email("That doesn't look like an email address."),
  phone: z.string().optional(),
  showName: z.boolean().default(false),
  photoUsage: photoUsageValueSchema.default("credit"),
  // Bookkeeping — when we last saw a successful submission. Used for
  // "welcome back" copy on the form.
  lastSubmittedAt: z.string().nullable().default(null),
});
export type ObserverProfile = z.infer<typeof observerProfileSchema>;

// ───────────────────────────── form: lat/lng + photos ───────────────────────

export const locationPointSchema = z.object({
  lat: z.number({ error: required }).min(-90).max(90),
  lng: z.number({ error: required }).min(-180).max(180),
});
export type LocationPoint = z.infer<typeof locationPointSchema>;

// Local image asset shape — what expo-image-picker returns plus a caption.
// We hold these in form state until submit time, then upload each one to
// /v2/public/media and replace with the returned MediaItem.
export const localImageAssetSchema = z.object({
  uri: z.string(),
  width: z.number(),
  height: z.number(),
  // expo-image-picker EXIF is loosely typed; we only use DateTimeOriginal
  // and Orientation, both optional.
  exif: z
    .object({
      DateTimeOriginal: z.string().optional(),
      Orientation: z.union([z.string(), z.number()]).optional(),
    })
    .partial()
    .nullable()
    .optional(),
});
export type LocalImageAsset = z.infer<typeof localImageAssetSchema>;

export const localImageWithCaptionSchema = z.object({
  image: localImageAssetSchema,
  caption: z.string().optional(),
});
export type LocalImageWithCaption = z.infer<typeof localImageWithCaptionSchema>;

// MediaItem returned by /v2/public/media — we only care about the id and
// the URLs needed to render thumbnails on success.
export const mediaItemSchema = z.object({
  id: z.union([z.string(), z.number()]),
  type: z.string().optional(),
  url: z
    .object({
      original: z.string().optional(),
      large: z.string().optional(),
      medium: z.string().optional(),
      thumbnail: z.string().optional(),
    })
    .optional(),
  caption: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
});
export type MediaItem = z.infer<typeof mediaItemSchema>;

// ───────────────────────────── form: avalanche entries ──────────────────────

// One avalanche record. Numeric fields are stored as strings in form
// state so the user can type freely; we coerce at submit time.
export const avalancheEntryFormSchema = z.object({
  date: z.date({ error: required }),
  location: z.string().min(1, required),
  trigger: triggerValueSchema,
  avalanche_type: avalancheTypeValueSchema.optional(),
  bed_sfc: bedSurfaceValueSchema.optional(),
  aspect: aspectValueSchema,
  d_size: dSizeValueSchema,
  elevation: z
    .string()
    .regex(/^\d+$/, "Elevation must be a whole number (feet)."),
  number: z
    .string()
    .regex(/^\d+$/, "Number of avalanches must be a whole number.")
    .default("1"),
  comments: z.string().optional(),
  images: z.array(localImageWithCaptionSchema).default([]),
});
export type AvalancheEntryForm = z.infer<typeof avalancheEntryFormSchema>;

// ───────────────────────────── form: top-level ──────────────────────────────

const instabilityFormSchema = z
  .object({
    avalanches_observed: z.boolean().default(false),
    avalanches_triggered: z.boolean().default(false),
    avalanches_caught: z.boolean().default(false),
    cracking: z.boolean().default(false),
    cracking_description: distributionValueSchema.optional(),
    collapsing: z.boolean().default(false),
    collapsing_description: distributionValueSchema.optional(),
  })
  .superRefine((arg, ctx) => {
    if (arg.cracking && !arg.cracking_description) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tell us how widespread the cracking was.",
        path: ["cracking_description"],
      });
    }
    if (arg.collapsing && !arg.collapsing_description) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tell us how widespread the collapsing was.",
        path: ["collapsing_description"],
      });
    }
  });
export type InstabilityForm = z.infer<typeof instabilityFormSchema>;

export const observationFormSchema = z
  .object({
    // Center attribution — resolved from the zoneId or the user's pick.
    center_id: z.string().min(2, required),

    // Observer details (mirrors profile, but editable per submission).
    name: z.string().min(1, required),
    email: z.string().email("That doesn't look like an email address."),
    phone: z.string().optional(),
    show_name: z.boolean().default(false),

    // What/when/where.
    start_date: z.date({ error: required }),
    activity: z.array(activityValueSchema).min(1, "Pick at least one activity."),
    location_name: z.string().min(1, required),
    location_point: locationPointSchema,

    // The free-text observation summary.
    observation_summary: z
      .string()
      .min(1, required)
      .max(10_000, "Observation summary is too long."),

    // Privacy / photo handling.
    private: z.boolean().default(false),
    photoUsage: photoUsageValueSchema.default("credit"),

    // Instability — defaults to "no" everywhere; user toggles up.
    instability: instabilityFormSchema,

    // Avalanches array — only required when avalanches_observed is true.
    avalanches: z.array(avalancheEntryFormSchema).default([]),
    avalanches_summary: z.string().optional(),

    // Photos.
    images: z.array(localImageWithCaptionSchema).default([]),
  })
  .superRefine((arg, ctx) => {
    if (arg.instability.avalanches_observed && arg.avalanches.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "You said you saw avalanches — add at least one to the Avalanches section.",
        path: ["avalanches"],
      });
    }
  });
export type ObservationForm = z.infer<typeof observationFormSchema>;

// ───────────────────────────── wire format ──────────────────────────────────

const formatYmd = (d: Date): string => {
  // Local-date YYYY-MM-DD. We deliberately don't go through UTC because
  // backcountry users on the West Coast filing at 11pm shouldn't have
  // their date roll over.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const avalancheWirePayloadSchema = z.object({
  date: z.string(),
  location: z.string(),
  trigger: z.string(),
  avalanche_type: z.string().optional(),
  bed_sfc: z.string().optional(),
  aspect: z.string(),
  d_size: z.string(),
  elevation: z.number(),
  number: z.number(),
  comments: z.string().optional(),
  media: z.array(mediaItemSchema).default([]),
});
export type AvalancheWirePayload = z.infer<typeof avalancheWirePayloadSchema>;

export const submitPayloadSchema = z.object({
  center_id: z.string(),
  observer_type: z.literal(OBSERVER_TYPE_PUBLIC),
  obs_source: z.string(),
  status: z.enum(["draft", "published"]),
  private: z.boolean(),
  name: z.string(),
  show_name: z.boolean(),
  email: z.string().email(),
  phone: z.string().optional(),
  start_date: z.string(),
  activity: z.array(z.string()),
  location_name: z.string(),
  location_point: locationPointSchema,
  observation_summary: z.string(),
  instability: z.object({
    avalanches_observed: z.boolean(),
    avalanches_triggered: z.boolean(),
    avalanches_caught: z.boolean(),
    cracking: z.boolean(),
    cracking_description: z.string().optional(),
    collapsing: z.boolean(),
    collapsing_description: z.string().optional(),
  }),
  avalanches: z.array(avalancheWirePayloadSchema),
  avalanches_summary: z.string().optional(),
  media: z.array(mediaItemSchema),
});
export type SubmitPayload = z.infer<typeof submitPayloadSchema>;

// Convert form state + uploaded MediaItems into the wire payload.
// Caller is responsible for having uploaded all images first and
// supplying the resulting MediaItem arrays in order.
export function toSubmitPayload(args: {
  form: ObservationForm;
  obsMedia: MediaItem[];
  // One MediaItem[] per avalanche entry, in the same order as form.avalanches.
  avalancheMedia: MediaItem[][];
  status: "draft" | "published";
}): SubmitPayload {
  const { form, obsMedia, avalancheMedia, status } = args;
  return {
    center_id: form.center_id,
    observer_type: OBSERVER_TYPE_PUBLIC,
    obs_source: OBS_SOURCE,
    status,
    private: form.private,
    name: form.name,
    show_name: form.show_name,
    email: form.email,
    phone: form.phone || undefined,
    start_date: formatYmd(form.start_date),
    activity: form.activity,
    location_name: form.location_name,
    location_point: form.location_point,
    observation_summary: form.observation_summary,
    instability: {
      avalanches_observed: form.instability.avalanches_observed,
      avalanches_triggered: form.instability.avalanches_triggered,
      avalanches_caught: form.instability.avalanches_caught,
      cracking: form.instability.cracking,
      cracking_description: form.instability.cracking_description,
      collapsing: form.instability.collapsing,
      collapsing_description: form.instability.collapsing_description,
    },
    avalanches: form.avalanches.map((a, i) => ({
      date: formatYmd(a.date),
      location: a.location,
      trigger: a.trigger,
      avalanche_type: a.avalanche_type,
      bed_sfc: a.bed_sfc,
      aspect: a.aspect,
      d_size: a.d_size,
      elevation: Number(a.elevation),
      number: Number(a.number),
      comments: a.comments || undefined,
      media: avalancheMedia[i] ?? [],
    })),
    avalanches_summary: form.avalanches_summary || undefined,
    media: obsMedia,
  };
}

// Helper to build an empty form state with sane defaults. The submit
// screen pre-fills name/email/phone from the observer profile, and
// center_id + zone hint from the entry context.
export function emptyObservationForm(initial: {
  center_id: string;
  name?: string;
  email?: string;
  phone?: string;
  show_name?: boolean;
  photoUsage?: z.infer<typeof photoUsageValueSchema>;
  location_point?: LocationPoint;
}): ObservationForm {
  return {
    center_id: initial.center_id,
    name: initial.name ?? "",
    email: initial.email ?? "",
    phone: initial.phone,
    show_name: initial.show_name ?? false,
    start_date: new Date(),
    activity: [],
    location_name: "",
    location_point: initial.location_point ?? { lat: 0, lng: 0 },
    observation_summary: "",
    private: false,
    photoUsage: initial.photoUsage ?? "credit",
    instability: {
      avalanches_observed: false,
      avalanches_triggered: false,
      avalanches_caught: false,
      cracking: false,
      collapsing: false,
    },
    avalanches: [],
    images: [],
  };
}
