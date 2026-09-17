import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { callTripPlans } from "./api";
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

async function readBuffer(): Promise<TrackPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(BUFFER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TrackPoint[]) : [];
  } catch {
    return [];
  }
}

async function writeBuffer(points: TrackPoint[]): Promise<void> {
  try {
    // Keep the NEWEST when overflowing: a searcher needs where they are now
    // far more than where they were three days ago.
    const capped = points.slice(-MAX_BUFFERED);
    await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(capped));
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
  const plan = await loadActivePlan();
  if (!plan || plan.status === "closed" || !plan.trackingEnabled) return false;
  const secret = await loadPlanSecret(plan.planId);
  if (!secret) return false;

  let pending = await readBuffer();
  if (pending.length === 0) return true;

  while (pending.length > 0) {
    const chunk = pending.slice(0, UPLOAD_CHUNK);
    const r = await callTripPlans({
      action: "location",
      plan_id: plan.planId,
      plan_secret: secret,
      points: chunk,
    });

    if (!r.ok) {
      // 409 means the server has already ended tracking for this plan
      // (checked in, cancelled, or tracking turned off). The queue is then
      // meaningless — drop it and stop, rather than retrying forever.
      if (r.status === 409) {
        await clearTrackingBuffer();
        await stopTripTracking();
        return false;
      }
      // Anything else (offline, 5xx, timeout): keep everything and retry
      // on the next fix.
      await writeBuffer(pending);
      return false;
    }

    pending = pending.slice(chunk.length);
    await writeBuffer(pending);
  }
  return true;
}

async function recordLocations(locations: Location.LocationObject[]): Promise<void> {
  const plan = await loadActivePlan();
  // Defensive: iOS can deliver one more batch after we ask it to stop.
  if (!plan || plan.status === "closed" || !plan.trackingEnabled) {
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

  await writeBuffer([...(await readBuffer()), ...points]);
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

export type TrackingStartResult =
  | "started"
  | "unsupported"
  | "foreground-denied"
  | "background-denied"
  | "error";

// Asks for permission and starts the background updates. Called only when
// the user turns tracking on for a trip — never at launch, never
// speculatively.
export async function startTripTracking(): Promise<TrackingStartResult> {
  if (!isSupported) return "unsupported";
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) return "foreground-denied";
    // iOS requires foreground before background can even be requested.
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) return "background-denied";

    if (await isTrackingRunning()) return "started";

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
    return "started";
  } catch (err) {
    console.warn("[trip-tracking] start failed", err);
    return "error";
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
