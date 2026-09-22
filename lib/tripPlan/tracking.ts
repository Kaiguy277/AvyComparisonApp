import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { callTripPlans } from "./api";
import {
  mergeTrackingRuntime,
  recordTrackingStart,
  type TrackingStartResult,
} from "./trackingDiag";
import { loadActivePlan, loadPlanSecret } from "./store";
import {
  onLocationFix,
  startLocationRefreshIfPermitted,
  stopLocationRefresh,
} from "../locationRefresh";

// Live trip tracking.
//
// This is a REAL background-location feature, unlike the wake trick that got
// build 32 rejected under Guideline 2.5.4: the coordinates are the product.
// While a trip is active and the user opted in, the party's position is
// posted so the contacts holding a share link can see where they are and
// which way they were heading — the thing a SAR crew actually needs.
//
// Consequences of that, which must stay true:
//   * tracking runs ONLY while a trip is active and opted in,
//   * it is torn down on check-in / cancel / close,
//   * nothing is recorded before departure or after the trip ends.
// Running this outside an active trip would put us right back where the
// rejection found us.

export const TRIP_TRACKING_TASK = "avy.trip-tracking";

// Points that haven't been accepted by the server yet. The whole point of
// this feature is travel through country with no signal, so uploads failing
// is the NORMAL case, not an error path — points queue here and flush when
// coverage returns.
const BUFFER_KEY = "avy-trip-track-buffer-v1";
// Bound the queue so a long trip with no signal can't grow it without limit.
// At the cadence below this is several days of travel.
const MAX_BUFFERED = 2000;
// Server accepts at most 200 per post (LIMITS.maxPointsPerPost).
const UPLOAD_CHUNK = 200;

const isExpoGo = Constants.appOwnership === "expo";
const isSupported = !isExpoGo && Platform.OS === "ios";

export interface TrackPoint {
  at: string;
  lat: number;
  lng: number;
  accuracy_m?: number;
}

// The queue is scoped to the plan it was recorded for. It used to be a bare
// array, which meant a buffer left over from one trip would upload into
// whatever the NEXT active plan happened to be — one party's positions
// attributed to another's trip. Points now travel with the plan id that
// produced them and are only ever posted to that plan.
interface TrackBuffer {
  planId: string;
  points: TrackPoint[];
}

async function readBuffer(): Promise<TrackBuffer | null> {
  try {
    const raw = await AsyncStorage.getItem(BUFFER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Old shape: a bare array with no plan id. There is no safe way to guess
    // which trip it belonged to, so drop it rather than risk misattributing
    // positions.
    if (Array.isArray(parsed)) return null;
    if (
      parsed &&
      typeof parsed.planId === "string" &&
      Array.isArray(parsed.points)
    ) {
      return parsed as TrackBuffer;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeBuffer(planId: string, points: TrackPoint[]): Promise<void> {
  try {
    // Keep the NEWEST when overflowing: a searcher needs where they are now
    // far more than where they were three days ago.
    const capped = points.slice(-MAX_BUFFERED);
    await AsyncStorage.setItem(
      BUFFER_KEY,
      JSON.stringify({ planId, points: capped } satisfies TrackBuffer),
    );
  } catch {}
}

export async function clearTrackingBuffer(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BUFFER_KEY);
  } catch {}
}

// Push whatever is queued. Removes only what the server actually accepted,
// so a mid-flush failure retries rather than dropping positions.
export async function flushTrackingBuffer(): Promise<boolean> {
  // Driven by the buffer, not by the active plan. A trip that has just been
  // checked in still has positions worth delivering — they were recorded
  // while it was open, and the server accepts anything timestamped before it
  // closed. Requiring an open active plan here is what silently stranded
  // them.
  const buf = await readBuffer();
  if (!buf || buf.points.length === 0) return true;

  const secret = await loadPlanSecret(buf.planId);
  if (!secret) return false;

  let pending = buf.points;

  while (pending.length > 0) {
    const chunk = pending.slice(0, UPLOAD_CHUNK);
    const r = await callTripPlans({
      action: "location",
      plan_id: buf.planId,
      plan_secret: secret,
      points: chunk,
    });

    if (!r.ok) {
      await mergeTrackingRuntime({
        lastUpload: `http:${r.status}`,
        lastUploadAt: new Date().toISOString(),
        buffered: pending.length,
      });
      // 409 means the server has already ended tracking for this plan
      // (checked in, cancelled, or tracking turned off). The queue is then
      // meaningless — drop it and stop, rather than retrying forever.
      if (r.status === 409) {
        await clearTrackingBuffer();
        await stopTripTracking();
        return false;
      }
      // 404 means the server has never heard of this plan — the create is
      // still sitting in the outbox. iOS delivers a location almost the
      // instant tracking starts, so the FIRST fix of every trip loses this
      // race, and it is the position from the trailhead. Push the outbox now
      // instead of waiting for another 500 m of travel to trigger a retry.
      if (r.status === 404) {
        try {
          // Imported lazily: send.ts imports this module, so a static import
          // back would be a cycle.
          const { flushTripPlanOutbox } = await import("./send");
          await flushTripPlanOutbox();
        } catch {}
      }
      // Anything else (offline, 5xx, timeout): keep everything and retry.
      await writeBuffer(buf.planId, pending);
      return false;
    }

    pending = pending.slice(chunk.length);
    await writeBuffer(buf.planId, pending);
    await mergeTrackingRuntime({
      lastUpload: "ok",
      lastUploadAt: new Date().toISOString(),
      buffered: pending.length,
    });
  }
  return true;
}

async function recordLocations(locations: Location.LocationObject[]): Promise<void> {
  await mergeTrackingRuntime({
    lastDispatchAt: new Date().toISOString(),
    lastDispatchPoints: locations.length,
  });
  const plan = await loadActivePlan();
  // Defensive: iOS can deliver one more batch after we ask it to stop.
  if (!plan || plan.status === "closed" || !plan.trackingEnabled) {
    // This tears tracking down, so record WHY — silently stopping on the
    // first batch would look identical to never being dispatched at all.
    await mergeTrackingRuntime({
      lastUpload: `skipped:${
        !plan ? "no-plan" : plan.status === "closed" ? "plan-closed" : "not-tracking"
      }`,
      lastUploadAt: new Date().toISOString(),
    });
    await stopTripTracking();
    return;
  }

  const points: TrackPoint[] = locations.map((l) => ({
    at: new Date(l.timestamp).toISOString(),
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    accuracy_m:
      typeof l.coords.accuracy === "number" && Number.isFinite(l.coords.accuracy)
        ? l.coords.accuracy
        : undefined,
  }));
  if (points.length === 0) return;

  const existing = await readBuffer();
  const carried =
    existing && existing.planId === plan.planId ? existing.points : [];
  await writeBuffer(plan.planId, [...carried, ...points]);
  await flushTrackingBuffer();

  // Same handling as the always-on refresh monitor: remember which centers
  // the user is near and refresh the forecast, throttled. Sharing that
  // function keeps one throttle across both location sessions, so swapping
  // between them can't cause a burst of refetches.
  const last = locations[locations.length - 1];
  if (last) await onLocationFix(last.coords);
}

// Defined at module load so iOS can dispatch into it when the OS delivers a
// background location batch — including after the app was terminated.
if (!isExpoGo) {
  TaskManager.defineTask(TRIP_TRACKING_TASK, async ({ data, error }) => {
    if (error) {
      console.warn("[trip-tracking] dispatched with error", error);
      return;
    }
    try {
      const locations = (data as { locations?: Location.LocationObject[] })
        ?.locations;
      if (locations?.length) await recordLocations(locations);
    } catch (err) {
      console.warn("[trip-tracking] threw", err);
    }
  });
}

export async function isTrackingRunning(): Promise<boolean> {
  if (!isSupported) return false;
  try {
    return await Location.hasStartedLocationUpdatesAsync(TRIP_TRACKING_TASK);
  } catch {
    return false;
  }
}

// Start-outcome recording lives in ./trackingDiag so screens can read it
// without importing this module (which defines background tasks on load).
export type { TrackingStartResult, TrackingStartRecord } from "./trackingDiag";

export async function startTripTracking(): Promise<TrackingStartResult> {
  const { result, detail } = await attemptTripTrackingStart();
  await recordTrackingStart(result, detail);
  return result;
}

async function attemptTripTrackingStart(): Promise<{
  result: TrackingStartResult;
  detail?: string;
}> {
  if (!isSupported) {
    return {
      result: "unsupported",
      detail: `expoGo=${isExpoGo} os=${Platform.OS}`,
    };
  }
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) return { result: "foreground-denied" };
    // iOS requires foreground before background can even be requested.
    const bg = await Location.requestBackgroundPermissionsAsync();
    // `granted` is not enough on iOS. It comes back true for "While Using",
    // which cannot deliver background updates — the session starts, the task
    // registers, `hasStartedLocationUpdatesAsync` says yes, and iOS silently
    // delivers nothing. That is precisely how this failed unnoticed: the app
    // reported tracking as running while the contact was told there was no
    // cell coverage.
    //
    // Only the foreground response carries the iOS scope, and it is optional:
    // `getForegroundPermissionsAsync()` was observed returning no `ios` block
    // at all on a device where Always WAS granted. So absence means "not
    // reported", NOT "denied" — an earlier version of this check read it the
    // other way and refused to track for a user who had granted everything.
    //
    // Reject only what we can positively identify as insufficient.
    const scope =
      (await Location.getForegroundPermissionsAsync()).ios?.scope ??
      fg.ios?.scope;
    const insufficient = scope === "whenInUse" || scope === "none";
    if (!bg.granted || (Platform.OS === "ios" && insufficient)) {
      return {
        result: "background-denied",
        detail: `status=${bg.status} scope=${scope ?? "unreported"}`,
      };
    }

    if (await isTrackingRunning())
      return { result: "started", detail: "already-running" };

    // Only one location session at a time. The always-on refresh monitor is
    // deliberately low accuracy; tracking needs better, and running both
    // concurrently is untested territory in expo-location.
    await stopLocationRefresh();

    await Location.startLocationUpdatesAsync(TRIP_TRACKING_TASK, {
      // Enough to place a party in a drainage without running the GPS hot.
      accuracy: Location.LocationAccuracy.Balanced,
      distanceInterval: 500,
      timeInterval: 10 * 60 * 1000,
      pausesUpdatesAutomatically: false,
      activityType: Location.LocationActivityType.Fitness,
      // Apple requires the blue bar for continuous background location, and
      // it is the honest signal here: the user turned this on and should be
      // able to see that it's running.
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Trip tracking on",
        notificationBody:
          "Sharing your location with your trip contacts until you check in.",
      },
    });

    // Verify rather than assume. startLocationUpdatesAsync resolving does not
    // guarantee iOS accepted the session, and this is the one place where a
    // false "started" would be actively harmful.
    const running = await isTrackingRunning();
    return {
      result: "started",
      detail: running ? "verified" : "NOT-RUNNING-AFTER-START",
    };
  } catch (err) {
    console.warn("[trip-tracking] start failed", err);
    return {
      result: "error",
      detail: err instanceof Error ? err.message.slice(0, 120) : String(err),
    };
  }
}

// Tears down the background updates. Safe to call when nothing is running —
// check-in, cancel and close all funnel through here.
export async function stopTripTracking(): Promise<void> {
  if (!isSupported) return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TRIP_TRACKING_TASK)) {
      await Location.stopLocationUpdatesAsync(TRIP_TRACKING_TASK);
    }
  } catch {}
  // Hand back to the low-power monitor so a forgetful user keeps getting
  // fresh forecasts after the trip ends.
  await startLocationRefreshIfPermitted();
}
