// On-device persistence for the trip-plan feature (anonymous mode).
//
//   AsyncStorage  — profile (non-sensitive), saved trips, active-plan
//                   summary, composer draft, saved contacts.
//   SecureStore   — the sensitive subject fields (DOB, home address,
//                   medical) and each plan's secret.
//
// Account mode (post-v1) syncs the same blocks to Postgres; the shapes
// here are the contract.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import {
  contactSchema,
  gearProfileSchema,
  partyMemberSchema,
  subjectProfileSchema,
  tripTemplateSchema,
  vehicleProfileSchema,
  type Contact,
  type GearProfile,
  type PartyMember,
  type SubjectProfile,
  type TripPlanDraftInput,
  type TripTemplate,
  type VehicleProfile,
} from "./schema";
import { z } from "zod";

export const KEYS = {
  profile: "avy-tripplan-profile-v1",
  secureProfile: "avy-tripplan-profile-secure-v1",
  templates: "avy-tripplan-templates-v1",
  active: "avy-tripplan-active-v1",
  history: "avy-tripplan-history-v1",
  draft: "avy-tripplan-draft-v1",
  secretPrefix: "avy-tripplan-secret-",
  deviceId: "avy-tripplan-device-id-v1",
} as const;

// ───────────────────────────── profile vault ───────────────────────────────

const SENSITIVE_SUBJECT_KEYS = [
  "dateOfBirth",
  "homeAddress",
  "medicalConditions",
  "medications",
  "allergies",
] as const;
type SensitiveKey = (typeof SENSITIVE_SUBJECT_KEYS)[number];

const profileSchema = z.object({
  subject: subjectProfileSchema.prefault({}),
  vehicles: z.array(vehicleProfileSchema).default([]),
  defaultVehicleId: z.string().optional(),
  gear: gearProfileSchema.prefault({}),
  contacts: z.array(contactSchema).default([]),
  party: z.array(partyMemberSchema).default([]),
  updatedAt: z.string().optional(),
});
export type TripProfile = z.infer<typeof profileSchema>;

const secureSubjectSchema = subjectProfileSchema.pick({
  dateOfBirth: true,
  homeAddress: true,
  medicalConditions: true,
  medications: true,
  allergies: true,
});

export function emptyProfile(): TripProfile {
  return profileSchema.parse({});
}

function splitSensitive(subject: SubjectProfile): {
  plain: SubjectProfile;
  secure: Partial<Pick<SubjectProfile, SensitiveKey>>;
} {
  const plain: SubjectProfile = { ...subject };
  const secure: Partial<Pick<SubjectProfile, SensitiveKey>> = {};
  for (const k of SENSITIVE_SUBJECT_KEYS) {
    if (plain[k] !== undefined) {
      secure[k] = plain[k];
      delete plain[k];
    }
  }
  return { plain, secure };
}

export async function loadProfile(): Promise<TripProfile> {
  let base: TripProfile = emptyProfile();
  try {
    const raw = await AsyncStorage.getItem(KEYS.profile);
    if (raw) {
      const parsed = profileSchema.safeParse(JSON.parse(raw));
      if (parsed.success) base = parsed.data;
    }
  } catch {}
  try {
    const rawSecure = await SecureStore.getItemAsync(KEYS.secureProfile);
    if (rawSecure) {
      const parsed = secureSubjectSchema.safeParse(JSON.parse(rawSecure));
      if (parsed.success) base = { ...base, subject: { ...base.subject, ...parsed.data } };
    }
  } catch {}
  return base;
}

export async function saveProfile(profile: TripProfile): Promise<void> {
  const validated = profileSchema.parse({ ...profile, updatedAt: new Date().toISOString() });
  const { plain, secure } = splitSensitive(validated.subject);
  await AsyncStorage.setItem(KEYS.profile, JSON.stringify({ ...validated, subject: plain }));
  try {
    if (Object.keys(secure).length === 0) {
      await SecureStore.deleteItemAsync(KEYS.secureProfile);
    } else {
      await SecureStore.setItemAsync(KEYS.secureProfile, JSON.stringify(secure));
    }
  } catch {
    // SecureStore unavailable (simulator without keychain, etc.) — keep
    // the sensitive fields out of AsyncStorage rather than degrade.
  }
}

export async function updateProfile(
  patch: (p: TripProfile) => TripProfile,
): Promise<TripProfile> {
  const next = patch(await loadProfile());
  await saveProfile(next);
  return next;
}

export async function clearProfile(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.profile).catch(() => {});
  await SecureStore.deleteItemAsync(KEYS.secureProfile).catch(() => {});
}

// ───────────────────────────── saved trips ─────────────────────────────────

export async function loadTemplates(): Promise<TripTemplate[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.templates);
    if (!raw) return [];
    const parsed = z.array(tripTemplateSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export async function saveTemplates(list: TripTemplate[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.templates, JSON.stringify(list));
}

// Most-used first, ties broken by most recent.
export function rankTemplates(list: TripTemplate[]): TripTemplate[] {
  return [...list].sort((a, b) => {
    if (b.useCount !== a.useCount) return b.useCount - a.useCount;
    return (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "");
  });
}

export function mostRecentTemplate(list: TripTemplate[]): TripTemplate | null {
  const withUse = list.filter((t) => t.lastUsedAt);
  if (withUse.length === 0) return null;
  return withUse.sort((a, b) => (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? ""))[0];
}

// Called after a successful send: upsert a template for this area +
// trailhead and bump its counters, so the next trip is one tap.
export async function recordTripAsTemplate(
  draft: TripPlanDraftInput,
  opts: { id: () => string; now?: Date },
): Promise<TripTemplate> {
  const list = await loadTemplates();
  const now = (opts.now ?? new Date()).toISOString();
  const key = (t: { areaName: string; trailheadName: string }) =>
    `${t.areaName}|${t.trailheadName}`.toLowerCase();
  const idx = list.findIndex((t) => key(t) === key(draft));
  const hours = Math.max(
    1,
    Math.round((Date.parse(draft.returnBy) - Date.parse(draft.departAt)) / 3_600_000),
  );
  const base = {
    zoneId: draft.zoneId,
    areaName: draft.areaName,
    trailheadName: draft.trailheadName,
    trailhead: draft.trailhead,
    route: draft.route,
    alternates: draft.alternates,
    travelMode: draft.travelMode,
    vehicleId: draft.vehicle?.id,
    contactIds: (draft.contacts ?? []).map((c) => c.id),
    party: draft.party ?? [],
    usualTripHours: hours,
    lastUsedAt: now,
  };
  let next: TripTemplate;
  if (idx >= 0) {
    next = tripTemplateSchema.parse({ ...list[idx], ...base, useCount: list[idx].useCount + 1 });
    list[idx] = next;
  } else {
    next = tripTemplateSchema.parse({
      id: opts.id(),
      label: draft.areaName,
      ...base,
      useCount: 1,
    });
    list.push(next);
  }
  await saveTemplates(list);
  return next;
}

export async function deleteTemplate(id: string): Promise<void> {
  const list = await loadTemplates();
  await saveTemplates(list.filter((t) => t.id !== id));
}

// ───────────────────────────── active plan ─────────────────────────────────

export interface ActiveContact {
  id: string; // local contact id
  serverId?: string;
  displayName: string;
  email: string;
  shareUrl?: string;
  sharedAt?: string;
  lastOpenedAt?: string | null;
}

export interface ActivePlan {
  planId: string;
  // Local lifecycle of the server record.
  sync: "pending" | "created" | "failed";
  syncError?: string;
  status: "active" | "overdue" | "closed";
  closeReason: string | null;
  // Live location sharing with this trip's contacts. Opt-in per trip and
  // off by default; drives lib/tripPlan/tracking.ts. Optional because plans
  // created by 1.0 have no such field.
  trackingEnabled?: boolean;
  areaName: string;
  trailheadName: string;
  subjectName: string;
  timezone: string;
  departAt: string;
  returnBy: string;
  worryBy: string;
  contacts: ActiveContact[];
  createdAt: string;
  lastSyncAt?: string;
  checkInQueuedAt?: string;
  events?: { type: string; at: string; contactName: string | null; note: string | null }[];
}

// ── change notification ─────────────────────────────────────────────────
//
// Every screen that shows the trip holds its own copy via useTripPlan. Before
// this existed, those copies only refreshed on mount, app-foreground or
// reconnect — so the home screen, which stays mounted underneath the trip
// screens, kept showing "HEADING OUT" after a trip was created, and the
// composer then blocked with "you already have a live trip". Every write now
// notifies every mounted copy, so no screen can disagree with the store.
type ActivePlanListener = () => void;
const listeners = new Set<ActivePlanListener>();

export function subscribeActivePlan(fn: ActivePlanListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notifyActivePlan(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      // One broken subscriber must not stop the others hearing about it.
    }
  }
}

// ── trip history ────────────────────────────────────────────────────────
//
// Before this, the app stored exactly ONE trip and DISMISS deleted it, so past
// trips simply vanished — and the server purges a plan seven days after it
// closes, so this has to live on the phone. Kai: "there should be a way to
// navigate to my old trips."
//
// Local only. It holds where you went, when, and who you told, so it never
// leaves the device and any entry can be removed.

export const HISTORY_LIMIT = 25;

// Pure, for testing: upsert a closed trip by planId, newest departure first,
// capped. A trip already in history is REPLACED rather than duplicated — a
// closed plan keeps getting saved as late status polls land, and the latest
// copy carries the fullest activity timeline.
export function mergeHistory(
  existing: ActivePlan[],
  plan: ActivePlan,
  limit: number = HISTORY_LIMIT,
): ActivePlan[] {
  if (plan.status !== "closed") return existing;
  const rest = existing.filter((p) => p.planId !== plan.planId);
  return [plan, ...rest]
    .sort((a, b) => Date.parse(b.departAt) - Date.parse(a.departAt))
    .slice(0, Math.max(limit, 0));
}

export async function loadTripHistory(): Promise<ActivePlan[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.history);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ActivePlan[]) : [];
  } catch {
    return [];
  }
}

async function archiveTrip(plan: ActivePlan): Promise<void> {
  try {
    const next = mergeHistory(await loadTripHistory(), plan);
    await AsyncStorage.setItem(KEYS.history, JSON.stringify(next));
  } catch {
    // History is a convenience; never let it break saving the live plan.
  }
}

export async function removeFromHistory(planId: string): Promise<void> {
  try {
    const next = (await loadTripHistory()).filter((p) => p.planId !== planId);
    await AsyncStorage.setItem(KEYS.history, JSON.stringify(next));
  } catch {}
  notifyActivePlan();
}

export async function loadActivePlan(): Promise<ActivePlan | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.active);
    return raw ? (JSON.parse(raw) as ActivePlan) : null;
  } catch {
    return null;
  }
}

export async function saveActivePlan(plan: ActivePlan | null): Promise<void> {
  if (plan === null) {
    await AsyncStorage.removeItem(KEYS.active).catch(() => {});
  } else {
    await AsyncStorage.setItem(KEYS.active, JSON.stringify(plan));
    // Every close path — check-in, cancel, a contact closing it from the web,
    // expiry, a 404 — ends in a save of a closed plan. Archiving here means no
    // path can skip history.
    if (plan.status === "closed") await archiveTrip(plan);
  }
  notifyActivePlan();
}

export async function updateActivePlan(
  patch: (p: ActivePlan) => ActivePlan,
): Promise<ActivePlan | null> {
  const cur = await loadActivePlan();
  if (!cur) return null;
  const next = patch(cur);
  await saveActivePlan(next);
  return next;
}

// ───────────────────────────── secrets / ids ───────────────────────────────

export async function savePlanSecret(planId: string, secret: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.secretPrefix + planId, secret);
}

export async function loadPlanSecret(planId: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEYS.secretPrefix + planId);
  } catch {
    return null;
  }
}

export async function deletePlanSecret(planId: string): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.secretPrefix + planId).catch(() => {});
}

export async function getDeviceId(newId: () => string): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(KEYS.deviceId);
    if (existing) return existing;
    const id = newId();
    await SecureStore.setItemAsync(KEYS.deviceId, id);
    return id;
  } catch {
    // Fall back to AsyncStorage if the keychain is unavailable.
    const existing = await AsyncStorage.getItem(KEYS.deviceId);
    if (existing) return existing;
    const id = newId();
    await AsyncStorage.setItem(KEYS.deviceId, id);
    return id;
  }
}

// ───────────────────────────── composer draft ──────────────────────────────

export async function loadDraft(): Promise<TripPlanDraftInput | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.draft);
    return raw ? (JSON.parse(raw) as TripPlanDraftInput) : null;
  } catch {
    return null;
  }
}

export async function saveDraft(draft: TripPlanDraftInput | null): Promise<void> {
  if (draft === null) {
    await AsyncStorage.removeItem(KEYS.draft).catch(() => {});
    return;
  }
  await AsyncStorage.setItem(KEYS.draft, JSON.stringify(draft));
}

// Re-export the profile piece types for screens.
export type { Contact, GearProfile, PartyMember, SubjectProfile, VehicleProfile };
