// Submission orchestrator. Owns the choreography of:
//   1. Upload N main observation photos (one POST per photo)
//   2. Upload M photos per avalanche entry (in order)
//   3. POST the observation JSON with all the resulting MediaItem refs
//   4. On success: persist observer profile so name/email pre-fill next time
//   5. On network failure: save the form to a local "drafts" queue with
//      a friendly error message
//
// Progress is surfaced via a callback so the screen can render a modal.
// Each step is its own progress event — the UI shows "Uploading photo
// 2 of 5" then "Sending observation" then resolves.
//
// Cancellation: an AbortController stops the in-flight fetch but does
// not undo prior uploads (those photos are still on NAC's servers,
// orphaned). A real "delete" would need an admin endpoint we don't
// have, so we accept the leak.

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

import {
  ObservationApiError,
  submitObservation as apiSubmitObservation,
  uploadMedia,
} from "@/lib/api/observationSubmit";
import {
  observationFormSchema,
  toSubmitPayload,
  type MediaItem,
  type ObservationForm,
} from "@/lib/observation/schema";
import {
  loadObserverProfile,
  markObserverProfileSubmitted,
  saveObserverProfile,
} from "@/lib/observerProfile";

// Stored as JSON-friendly snapshots — Date objects round-tripped via ISO.
const DRAFT_QUEUE_KEY = "avy-observation-drafts-v1";

export type SubmitStep =
  | { kind: "validating" }
  | { kind: "uploading-photo"; current: number; total: number; scope: "obs" | "avalanche"; avalancheIndex?: number }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string; offline: boolean };

export interface SubmitOptions {
  form: ObservationForm;
  onProgress: (step: SubmitStep) => void;
  signal?: AbortSignal;
}

export interface SubmitResult {
  ok: boolean;
  // Server response — we don't validate its shape (the public POST
  // returns inconsistent payloads per Avy's TODO). Just pass it through.
  response?: unknown;
  // True when we saved a draft because the device was offline.
  saved?: boolean;
}

// Run the submission. Throws on programming errors; returns SubmitResult
// for user-recoverable outcomes (validation failure, network error, etc).
export async function submitObservationFlow(
  opts: SubmitOptions,
): Promise<SubmitResult> {
  const { form, onProgress, signal } = opts;

  onProgress({ kind: "validating" });

  // Defensive — the screen already validates, but a second pass here
  // protects the API client from junk if a caller skips validation.
  const valid = observationFormSchema.safeParse(form);
  if (!valid.success) {
    const message =
      valid.error.issues[0]?.message ?? "Form is missing required fields.";
    onProgress({ kind: "error", message, offline: false });
    return { ok: false };
  }

  // If we know we're offline up front, save and bail.
  const net = await NetInfo.fetch();
  if (net.isConnected === false || net.isInternetReachable === false) {
    await saveDraft(form);
    onProgress({
      kind: "error",
      message:
        "You're offline. We saved your observation locally — try sending again when you're back online.",
      offline: true,
    });
    return { ok: false, saved: true };
  }

  try {
    // 1. Upload main observation photos.
    const obsTotal = form.images.length;
    const obsMedia: MediaItem[] = [];
    for (let i = 0; i < obsTotal; i++) {
      throwIfAborted(signal);
      onProgress({
        kind: "uploading-photo",
        current: i + 1,
        total: obsTotal,
        scope: "obs",
      });
      const item = await uploadMedia({
        image: form.images[i].image,
        centerId: form.center_id,
        observerName: form.name,
        caption: form.images[i].caption,
        photoUsage: form.photoUsage,
        title: form.location_name,
      });
      obsMedia.push(item);
    }

    // 2. Upload per-avalanche photos.
    const avalancheMedia: MediaItem[][] = [];
    for (let aIdx = 0; aIdx < form.avalanches.length; aIdx++) {
      const av = form.avalanches[aIdx];
      const list: MediaItem[] = [];
      for (let i = 0; i < av.images.length; i++) {
        throwIfAborted(signal);
        onProgress({
          kind: "uploading-photo",
          current: i + 1,
          total: av.images.length,
          scope: "avalanche",
          avalancheIndex: aIdx,
        });
        const item = await uploadMedia({
          image: av.images[i].image,
          centerId: form.center_id,
          observerName: form.name,
          caption: av.images[i].caption,
          photoUsage: form.photoUsage,
          title: av.location || form.location_name,
        });
        list.push(item);
      }
      avalancheMedia.push(list);
    }

    // 3. Submit the observation.
    throwIfAborted(signal);
    onProgress({ kind: "submitting" });
    const payload = toSubmitPayload({
      form: cleanFormForSubmit(form),
      obsMedia,
      avalancheMedia,
      // The center may flip this to "draft" via require_approval — for
      // now we send "published" (Avy default for centers that don't
      // require review). Slice 8 / partner conversation refines this.
      status: "published",
    });
    const response = await apiSubmitObservation(payload);

    // 4. Persist observer profile so name/email pre-fill next time.
    await persistObserverProfileFromForm(form);
    await markObserverProfileSubmitted();

    onProgress({ kind: "success" });
    return { ok: true, response };
  } catch (err) {
    if (isAbort(err)) {
      onProgress({
        kind: "error",
        message: "Submission cancelled.",
        offline: false,
      });
      return { ok: false };
    }
    if (err instanceof ObservationApiError) {
      // 4xx: caller's fault (likely auth — Origin not allowlisted).
      // 5xx / network: NAC's side or transit. Save a draft for retry.
      const offline = err.status >= 500 || err.status === 0;
      if (offline) await saveDraft(form);
      onProgress({
        kind: "error",
        message: friendlyApiError(err),
        offline,
      });
      return { ok: false, saved: offline };
    }
    // Generic network failure (no Response). Treat as offline.
    await saveDraft(form);
    onProgress({
      kind: "error",
      message:
        "Couldn't reach the avalanche center. Saved locally — try again in a bit.",
      offline: true,
    });
    return { ok: false, saved: true };
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");
}

function isAbort(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "AbortError" || err.message === "aborted")
  );
}

function friendlyApiError(err: ObservationApiError): string {
  if (err.status === 401 || err.status === 403) {
    return "The avalanche center didn't accept this submission. (The app's submitter credentials may not be set up yet.)";
  }
  if (err.status === 422) {
    return "The avalanche center rejected this submission. Double-check your fields and try again.";
  }
  if (err.status >= 500) {
    return "The avalanche center is having trouble. We saved your observation locally — try again later.";
  }
  return `Submission failed (${err.status}). Try again.`;
}

// Drop avalanches if avalanches_observed is false. Mirrors Avy's
// behavior — keeping orphaned entries would confuse the server.
function cleanFormForSubmit(form: ObservationForm): ObservationForm {
  if (!form.instability.avalanches_observed && form.avalanches.length > 0) {
    return { ...form, avalanches: [] };
  }
  return form;
}

async function persistObserverProfileFromForm(
  form: ObservationForm,
): Promise<void> {
  const existing = await loadObserverProfile();
  await saveObserverProfile({
    name: form.name,
    email: form.email,
    phone: form.phone || undefined,
    showName: form.show_name,
    photoUsage: form.photoUsage,
    lastSubmittedAt: existing?.lastSubmittedAt ?? null,
  });
}

// ───────────────────────────── draft queue ──────────────────────────────

interface DraftRecord {
  id: string;
  createdAt: string;
  // Form snapshot with Date fields stringified. Local image URIs are
  // kept verbatim — they may not survive a long app death (cache
  // eviction), but for short reconnection windows they should.
  snapshot: {
    form: SerializableForm;
  };
}

type SerializableForm = Omit<ObservationForm, "start_date" | "avalanches"> & {
  start_date: string;
  avalanches: (Omit<ObservationForm["avalanches"][number], "date"> & {
    date: string;
  })[];
};

async function saveDraft(form: ObservationForm): Promise<void> {
  try {
    const drafts = await listDrafts();
    drafts.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      snapshot: { form: serializeForm(form) },
    });
    await AsyncStorage.setItem(DRAFT_QUEUE_KEY, JSON.stringify(drafts));
  } catch {
    // Best-effort — if AsyncStorage is full or unavailable, oh well.
  }
}

export async function listDrafts(): Promise<DraftRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function clearDraft(id: string): Promise<void> {
  const drafts = await listDrafts();
  const next = drafts.filter((d) => d.id !== id);
  await AsyncStorage.setItem(DRAFT_QUEUE_KEY, JSON.stringify(next));
}

function serializeForm(form: ObservationForm): SerializableForm {
  return {
    ...form,
    start_date: form.start_date.toISOString(),
    avalanches: form.avalanches.map((a) => ({
      ...a,
      date: a.date.toISOString(),
    })),
  };
}
