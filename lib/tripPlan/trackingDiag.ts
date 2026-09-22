// Read/write for the last trip-tracking start outcome.
//
// Deliberately its own module with NO expo-location / expo-task-manager
// imports. `tracking.ts` calls `TaskManager.defineTask` at module load, so
// importing it from a screen would register that task at app startup — a
// real change in behaviour. The home-screen diagnostic needs to *observe*
// tracking, not alter when it initialises, so the storage key lives here
// where both sides can reach it for free.
import AsyncStorage from "@react-native-async-storage/async-storage";

const START_RESULT_KEY = "avy-trip-track-start-v1";

export type TrackingStartResult =
  | "started"
  | "unsupported"
  | "foreground-denied"
  | "background-denied"
  | "error";

export interface TrackingStartRecord {
  result: TrackingStartResult;
  // For "error", the thrown message. For "started", whether iOS actually
  // reports the task as running afterwards — asking instead of assuming.
  detail?: string;
  at: string;
}

export async function recordTrackingStart(
  result: TrackingStartResult,
  detail?: string,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      START_RESULT_KEY,
      JSON.stringify({ result, detail, at: new Date().toISOString() }),
    );
  } catch {}
}

export async function readLastTrackingStart(): Promise<TrackingStartRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(START_RESULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.result === "string"
      ? (parsed as TrackingStartRecord)
      : null;
  } catch {
    return null;
  }
}

// ── runtime: what happens AFTER tracking starts ─────────────────────────
//
// Starting is verified (see above) but positions were still never reaching
// the server, so the failure is downstream: either iOS never dispatches the
// task, or it does and the upload silently buffers. Uploads failing is a
// NORMAL case for this app — the whole point is travel without signal — so
// nothing in that path raises. That makes it invisible, which is why it
// needs recording rather than reasoning about.
const RUNTIME_KEY = "avy-trip-track-runtime-v1";

export interface TrackingRuntimeRecord {
  // Set every time iOS hands the task a batch of locations.
  lastDispatchAt?: string;
  lastDispatchPoints?: number;
  // Points waiting to upload. Growing = captured but not delivered.
  buffered?: number;
  // "ok" | "skipped:<why>" | "http:<status>" | "throw:<message>"
  lastUpload?: string;
  lastUploadAt?: string;
}

export async function mergeTrackingRuntime(
  patch: Partial<TrackingRuntimeRecord>,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(RUNTIME_KEY);
    const cur = raw ? JSON.parse(raw) : {};
    await AsyncStorage.setItem(
      RUNTIME_KEY,
      JSON.stringify({ ...cur, ...patch }),
    );
  } catch {}
}

export async function readTrackingRuntime(): Promise<TrackingRuntimeRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(RUNTIME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as TrackingRuntimeRecord)
      : null;
  } catch {
    return null;
  }
}
