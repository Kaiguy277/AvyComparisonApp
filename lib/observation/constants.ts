// Value/label sets for the observation submission form. Wire format
// (the right-hand side of each pair) matches what the NAC observation
// API expects — sourced from the open-source Avy app's schemas.ts:
// https://github.com/NWACus/avy/blob/main/types/nationalAvalancheCenter/schemas.ts
//
// We expose `{value, label}[]` so the UI can iterate cleanly without
// having to know the wire codes. Order in each list is the order we
// want the user to see (most-common first, then alphabetical/encyclopedic).

export interface Option<V extends string = string> {
  value: V;
  label: string;
}

// What was the observer doing when they made the observation?
export const ACTIVITY_OPTIONS = [
  { value: "skiing_snowboarding", label: "Skiing / Snowboarding" },
  { value: "snowmobiling_snowbiking", label: "Snowmobiling / Snowbiking" },
  { value: "climbing", label: "Climbing" },
  { value: "xcskiing_snowshoeing", label: "XC Skiing / Snowshoeing" },
  { value: "walking", label: "Walking / Hiking" },
  { value: "flying", label: "Flying / Heli" },
  { value: "driving", label: "Driving" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option[];

export type ActivityValue = (typeof ACTIVITY_OPTIONS)[number]["value"];

// 8 cardinal/ordinal aspects.
export const ASPECT_OPTIONS = [
  { value: "N", label: "N" },
  { value: "NE", label: "NE" },
  { value: "E", label: "E" },
  { value: "SE", label: "SE" },
  { value: "S", label: "S" },
  { value: "SW", label: "SW" },
  { value: "W", label: "W" },
  { value: "NW", label: "NW" },
] as const satisfies readonly Option[];

export type AspectValue = (typeof ASPECT_OPTIONS)[number]["value"];

// Avalanche type (slab / loose / wet / cornice / etc).
export const AVALANCHE_TYPE_OPTIONS = [
  { value: "SS", label: "SS — Soft Slab" },
  { value: "HS", label: "HS — Hard Slab" },
  { value: "L", label: "L — Dry Loose" },
  { value: "WL", label: "WL — Wet Loose" },
  { value: "WS", label: "WS — Wet Slab" },
  { value: "C", label: "C — Cornice" },
  { value: "R", label: "R — Roof" },
  { value: "SF", label: "SF — Slush Flow" },
  { value: "I", label: "I — Ice Fall" },
  { value: "U", label: "U — Unknown" },
] as const satisfies readonly Option[];

export type AvalancheTypeValue = (typeof AVALANCHE_TYPE_OPTIONS)[number]["value"];

// What set the avalanche off. We split this into a "common" subset
// (shown by default) and a "more triggers" expansion to keep the form
// quick for typical public observations.
export const AVALANCHE_TRIGGER_COMMON = [
  { value: "N", label: "N — Natural" },
  { value: "AS", label: "AS — Skier" },
  { value: "AR", label: "AR — Snowboarder" },
  { value: "AM", label: "AM — Snowmobile" },
  { value: "AI", label: "AI — Snowshoer" },
  { value: "AF", label: "AF — Foot penetration" },
  { value: "U", label: "U — Unknown" },
] as const satisfies readonly Option[];

export const AVALANCHE_TRIGGER_ADVANCED = [
  { value: "AW", label: "AW — Wildlife" },
  { value: "AV", label: "AV — Vehicle" },
  { value: "AK", label: "AK — Snowcat" },
  { value: "NC", label: "NC — Cornice fall" },
  { value: "NL", label: "NL — Triggered by loose-snow avalanche" },
  { value: "NS", label: "NS — Triggered by slab avalanche" },
  { value: "NI", label: "NI — Ice fall" },
  { value: "NR", label: "NR — Rock fall" },
  { value: "NE", label: "NE — Earthquake" },
  { value: "NO", label: "NO — Other natural" },
  { value: "AE", label: "AE — Explosive triggered" },
  { value: "AA", label: "AA — Artillery" },
  { value: "AL", label: "AL — Avalauncher" },
  { value: "AB", label: "AB — Air blast" },
  { value: "AC", label: "AC — Human-caused cornice fall" },
  { value: "AX", label: "AX — Gas exploder" },
  { value: "AH", label: "AH — Explosives from helicopter" },
  { value: "AP", label: "AP — Pre-placed remote explosive" },
  { value: "AU", label: "AU — Unknown artificial trigger" },
  { value: "AO", label: "AO — Other artificial" },
] as const satisfies readonly Option[];

export const AVALANCHE_TRIGGER_OPTIONS = [
  ...AVALANCHE_TRIGGER_COMMON,
  ...AVALANCHE_TRIGGER_ADVANCED,
] as const satisfies readonly Option[];

export type AvalancheTriggerValue = (typeof AVALANCHE_TRIGGER_OPTIONS)[number]["value"];

// Bed surface — what layer the avalanche slid on.
export const BED_SURFACE_OPTIONS = [
  { value: "S", label: "S — New Snow" },
  { value: "I", label: "I — New/Old Interface" },
  { value: "O", label: "O — Old Snow" },
  { value: "G", label: "G — Ground" },
  { value: "U", label: "U — Unknown" },
] as const satisfies readonly Option[];

export type BedSurfaceValue = (typeof BED_SURFACE_OPTIONS)[number]["value"];

// Instability distribution — used for both cracking and collapsing follow-ups.
export const INSTABILITY_DISTRIBUTION_OPTIONS = [
  { value: "isolated", label: "Isolated — one or two spots" },
  { value: "specific", label: "Specific — certain aspects/elevations" },
  { value: "widespread", label: "Widespread — most of the terrain" },
] as const satisfies readonly Option[];

export type InstabilityDistributionValue =
  (typeof INSTABILITY_DISTRIBUTION_OPTIONS)[number]["value"];

// Whether the center can re-use the photos and how to credit them.
export const PHOTO_USAGE_OPTIONS = [
  { value: "credit", label: "Use with photo credit" },
  { value: "anonymous", label: "Use anonymously" },
  { value: "private", label: "Don't use" },
] as const satisfies readonly Option[];

export type PhotoUsageValue = (typeof PHOTO_USAGE_OPTIONS)[number]["value"];

// Destructive size — D scale, allows half-sizes (D2.5).
export const D_SIZE_OPTIONS = [
  { value: "1", label: "D1 — Relatively harmless" },
  { value: "1.5", label: "D1.5" },
  { value: "2", label: "D2 — Could bury, injure, or kill a person" },
  { value: "2.5", label: "D2.5" },
  { value: "3", label: "D3 — Could bury & destroy a car" },
  { value: "3.5", label: "D3.5" },
  { value: "4", label: "D4 — Could destroy a railway car" },
  { value: "4.5", label: "D4.5" },
  { value: "5", label: "D5 — Largest known avalanches" },
] as const satisfies readonly Option[];

export type DSizeValue = (typeof D_SIZE_OPTIONS)[number]["value"];

// What we tag submissions with. Until NAC assigns us a value, we send
// "public" (the existing observer-type value) so the row is still valid.
// When the partner agreement is signed, swap this to whatever NAC gives us.
export const OBS_SOURCE = "public" as const;

// Observer type — the form is public-only; we hard-code this.
export const OBSERVER_TYPE_PUBLIC = "public" as const;

// Help copy that explains the technical terms we ask about. Lifted in
// spirit from Avy / avalanche.org definitions.
export const HELP_COPY = {
  cracking:
    "Did you see shooting cracks in the snow surface as you traveled? " +
    "Shooting cracks indicate a slab sitting on a weak layer that's " +
    "ready to fail.",
  collapsing:
    "Did you feel or hear the snowpack settle with a 'whumpf'? " +
    "Collapsing means a buried weak layer just failed under your weight.",
  d_size:
    "Destructive size: D1 is relatively harmless to people. D2 can " +
    "bury, injure, or kill. D3 can destroy a car. D4 can destroy a " +
    "railway car. D5 is the largest avalanches known.",
  trigger:
    "What set the avalanche off. 'Natural' means it released without " +
    "any human action. 'Skier/Snowboarder/Snowmobile' triggers describe " +
    "who was on the slope when it released.",
} as const;
