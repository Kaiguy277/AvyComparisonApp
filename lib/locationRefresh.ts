import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { Linking, Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { refreshFavoritesSnapshot } from "./backgroundRefresh";
import { nearestCenters } from "./zones";

// Movement-triggered refresh, and "which center am I nearest".
//
// THE PROBLEM THIS SOLVES: someone drives from town into the mountains,
// never opens the app, and loses service at the trailhead with a stale
// forecast on their phone. Background App Refresh and silent push are both
// dropped by iOS once the app is force-quit, which is exactly the forgetful
// user we most need to reach. Significant-location-change monitoring is the
// one mechanism iOS restores after a swipe-away.
//
// HOW THIS DIFFERS FROM THE VERSION REJECTED UNDER 2.5.4 (build 32):
//   * The app now HAS a feature requiring persistent location — live trip
//     tracking (lib/tripPlan/tracking.ts). That is what the background mode
//     is for, and the 2.5.4 objection ("unable to locate any features that
//     require persistent location") no longer holds.
//   * We now READ the coordinate instead of discarding it. It resolves the
//     nearest avalanche center, which the home screen shows and uses to keep
//     the right zones current. Location is used, not merely awaited.
//   * Apple's own rejection suggested this mechanism: "You may wish to use
//     the significant-change location service ... if persistent real-time
//     location updates are not required."
// Both uses are disclosed in the Info.plist purpose strings, the privacy
// policy and the App Review notes. Keep it that way.

export const LOCATION_REFRESH_TASK = "avy.location-refresh";

const NEAREST_KEY = "avy-nearest-center-v1";
const LAST_REFRESH_AT_KEY = "avy-loc-refresh-at-v1";
const PROMPT_SHOWN_KEY = "avy-loc-prompt-shown-v2";
const BANNER_SNOOZE_KEY = "avy-loc-banner-snoozed-v2";

// Forecasts move once or twice a day, stations hourly. A cell-tower handoff
// can fire far more often than that, so throttle hard — this exists to have
// fresh data by the time service drops, not to poll.
const REFRESH_MIN_INTERVAL_MS = 20 * 60 * 1000;
const BANNER_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

const isExpoGo = Constants.appOwnership === "expo";
const isSupported = !isExpoGo && Platform.OS === "ios";

export interface NearbyCenters {
  // Closest first. Several, not one: centers cluster, and someone deciding
  // where to go on a given day is choosing between neighbours — from
  // Anchorage that is Turnagain, Hatcher and Valdez, not just the closest.
  centers: { centerId: string; km: number }[];
  at: string;
}

export async function readNearbyCenters(): Promise<NearbyCenters | null> {
  try {
    const raw = await AsyncStorage.getItem(NEAREST_KEY);
    return raw ? (JSON.parse(raw) as NearbyCenters) : null;
  } catch {
    return null;
  }
}

// Resolve and remember which avalanche centers the user is near. This is the
// user-visible use of the coordinate — the home screen surfaces it, and it
// is how the app knows which forecasts matter where the user actually is.
// (Build 32 discarded the coordinate, which is precisely what Apple objected
// to under 2.5.4.)
export async function recordPosition(
  lat: number,
  lon: number,
): Promise<string[]> {
  const centers = nearestCenters(lat, lon, 3);
  if (centers.length === 0) return [];
  try {
    await AsyncStorage.setItem(
      NEAREST_KEY,
      JSON.stringify({ centers, at: new Date().toISOString() } as NearbyCenters),
    );
  } catch {}
  return centers.map((c) => c.centerId);
}

// Shared by the background task and the trip-tracking task, so a tracked
// trip gets the same refresh behaviour without running two location
// sessions at once.
export async function onLocationFix(
  coords: { latitude: number; longitude: number },
): Promise<void> {
  await recordPosition(coords.latitude, coords.longitude);
  try {
    const raw = await AsyncStorage.getItem(LAST_REFRESH_AT_KEY);
    const last = raw ? Number(raw) : 0;
    if (Number.isFinite(last) && Date.now() - last < REFRESH_MIN_INTERVAL_MS) {
      return;
    }
    await AsyncStorage.setItem(LAST_REFRESH_AT_KEY, String(Date.now()));
    await refreshFavoritesSnapshot("location");
  } catch (err) {
    console.warn("[location-refresh] refresh failed", err);
  }
}

if (!isExpoGo) {
  TaskManager.defineTask(LOCATION_REFRESH_TASK, async ({ data, error }) => {
    if (error) {
      console.warn("[location-refresh] dispatched with error", error);
      return;
    }
    try {
      const locations = (data as { locations?: Location.LocationObject[] })
        ?.locations;
      const last = locations?.[locations.length - 1];
      if (last) await onLocationFix(last.coords);
    } catch (err) {
      console.warn("[location-refresh] threw", err);
    }
  });
}

export async function isLocationRefreshRunning(): Promise<boolean> {
  if (!isSupported) return false;
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_REFRESH_TASK);
  } catch {
    return false;
  }
}

export async function isAlwaysGranted(): Promise<boolean> {
  if (!isSupported) return false;
  try {
    return (await Location.getBackgroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

// Start the low-power monitor. Never prompts — safe on every launch.
export async function startLocationRefreshIfPermitted(): Promise<boolean> {
  if (!isSupported) return false;
  try {
    if (!(await Location.getForegroundPermissionsAsync()).granted) return false;
    if (!(await Location.getBackgroundPermissionsAsync()).granted) return false;
    return startTask();
  } catch (err) {
    console.warn("[location-refresh] start check failed", err);
    return false;
  }
}

export async function requestAndStartLocationRefresh(): Promise<boolean> {
  if (!isSupported) return false;
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) return false;
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) return false;
    return startTask();
  } catch (err) {
    console.warn("[location-refresh] request failed", err);
    return false;
  }
}

// If iOS will still prompt, prompt; otherwise send them to Settings, which
// is the only remaining path once they've declined.
export async function promptOrOpenLocationSettings(): Promise<boolean> {
  if (!isSupported) return false;
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    if ((!fg.granted && !fg.canAskAgain) || (!bg.granted && !bg.canAskAgain)) {
      Linking.openSettings().catch(() => {});
      return false;
    }
  } catch {}
  return requestAndStartLocationRefresh();
}

async function startTask(): Promise<boolean> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_REFRESH_TASK)) {
      return true;
    }
    await Location.startLocationUpdatesAsync(LOCATION_REFRESH_TASK, {
      // Lowest accuracy is deliberate: we need "which drainage are you in",
      // not metres, and it keeps this close to free on battery.
      accuracy: Location.LocationAccuracy.Lowest,
      distanceInterval: 5000,
      pausesUpdatesAutomatically: true,
      activityType: Location.LocationActivityType.OtherNavigation,
      // No blue bar for this one: it is low-power monitoring, not the
      // continuous tracking session, which does show the indicator.
      showsBackgroundLocationIndicator: false,
    });
    console.log("[location-refresh] started");
    return true;
  } catch (err) {
    console.warn("[location-refresh] start failed", err);
    return false;
  }
}

export async function stopLocationRefresh(): Promise<void> {
  if (!isSupported) return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_REFRESH_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_REFRESH_TASK);
    }
  } catch {}
}

// ── contextual prompt bookkeeping ──────────────────────────────────────────

export async function hasShownLocationPrompt(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PROMPT_SHOWN_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function markLocationPromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(PROMPT_SHOWN_KEY, "1");
  } catch {}
}

export async function snoozeLocationBanner(): Promise<void> {
  try {
    await AsyncStorage.setItem(BANNER_SNOOZE_KEY, String(Date.now()));
  } catch {}
}

export async function isLocationBannerSnoozed(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(BANNER_SNOOZE_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < BANNER_SNOOZE_MS;
  } catch {
    return false;
  }
}
