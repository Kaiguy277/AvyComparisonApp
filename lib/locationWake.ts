import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { Linking, Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { refreshFavoritesSnapshot } from "./backgroundRefresh";

// Why this exists:
// Silent push, BGAppRefreshTask, and BGProcessingTask all stop firing
// once the user force-quits the app. iOS deliberately treats force-quit
// as "the user does not want this app running." The only background
// wake mechanism that survives force-quit is the location family —
// specifically `startMonitoringSignificantLocationChanges`, which iOS
// fires when the device hands off to a different cell tower.
//
// We don't actually use the location data. Registering the monitor is
// just a way to get iOS to relaunch us periodically — same trick every
// continuously-fresh weather app on iOS uses (AccuWeather, Carrot, etc).
// When the wake fires, we run our normal refresh body and exit.
//
// expo-location's startLocationUpdatesAsync calls BOTH
// startUpdatingLocation AND startMonitoringSignificantLocationChanges
// under the hood (see EXLocationTaskConsumer.m). The sig-change call
// is the one that survives force-quit.

export const LOCATION_TASK_NAME = "avy.location-wake";

const LOCATION_DIAG_KEY = "avy-location-diagnostic-v1";
// Set once we've shown the contextual "enable Always location" explainer
// (on the user's first favorite). Prevents re-popping the modal.
const LOCATION_PROMPT_KEY = "avy-location-prompt-shown-v1";

export async function hasShownLocationPrompt(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(LOCATION_PROMPT_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function markLocationPromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCATION_PROMPT_KEY, "1");
  } catch {}
}

// True when the background-location authorization is already granted, so
// the contextual explainer can be skipped entirely.
export async function isLocationWakeGranted(): Promise<boolean> {
  if (!isSupported) return false;
  try {
    return (await Location.getBackgroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

// Enable action for the reminder banner: if iOS can still show a prompt,
// request it; if the user previously denied and iOS won't prompt again,
// deep-link to Settings (the only path left). Returns true if wake is
// active afterward.
export async function promptOrOpenLocationSettings(): Promise<boolean> {
  if (!isSupported) return false;
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    const blocked =
      (!fg.granted && !fg.canAskAgain) || (!bg.granted && !bg.canAskAgain);
    if (blocked) {
      Linking.openSettings().catch(() => {});
      return false;
    }
  } catch {
    // fall through to the request path
  }
  return requestAndRegisterLocationWake();
}

// Snooze for the "location off" reminder banner. Dismissing hides it for
// a few days so it's a gentle periodic nudge, not a permanent fixture.
const LOCATION_BANNER_SNOOZE_KEY = "avy-location-banner-snoozed-at-v1";
const BANNER_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export async function snoozeLocationBanner(): Promise<void> {
  try {
    await AsyncStorage.setItem(
      LOCATION_BANNER_SNOOZE_KEY,
      String(Date.now()),
    );
  } catch {}
}

export async function isLocationBannerSnoozed(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_BANNER_SNOOZE_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < BANNER_SNOOZE_MS;
  } catch {
    return false;
  }
}

const isExpoGo = Constants.appOwnership === "expo";

export type LocationDiagStep =
  | "skipped-unsupported"
  | "skipped-expo-go"
  | "foreground-denied"
  | "background-denied"
  | "register-error"
  | "ok";

export interface LocationDiagnostic {
  at: string;
  step: LocationDiagStep;
  message?: string;
}

async function writeDiagnostic(d: LocationDiagnostic): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCATION_DIAG_KEY, JSON.stringify(d));
  } catch {}
}

export async function readLocationDiagnostic(): Promise<LocationDiagnostic | null> {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_DIAG_KEY);
    return raw ? (JSON.parse(raw) as LocationDiagnostic) : null;
  } catch {
    return null;
  }
}

// Define the task at module load so iOS can dispatch into it when the
// OS relaunches the app via a significant-location-change wake.
// Importing this file from app/_layout.tsx ensures the definition runs
// before the React tree mounts.
if (!isExpoGo) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ error }) => {
    if (error) {
      console.warn("[location-wake] dispatched with error", error);
      return;
    }
    try {
      // We intentionally do not read the location payload — we just
      // use the wake as a heartbeat to refresh the snapshot.
      await refreshFavoritesSnapshot("location");
    } catch (err) {
      console.warn("[location-wake] threw", err);
    }
  });
}

// iOS only. The whole mechanism relies on
// startMonitoringSignificantLocationChanges surviving force-quit, which
// is an iOS behavior. On Android, startLocationUpdatesAsync additionally
// requires a foregroundService config we don't set — it would throw at
// start and leave the diagnostic banner nagging. So Android cleanly
// no-ops ("skipped-unsupported") rather than erroring.
const isSupported = !isExpoGo && Platform.OS === "ios";

// Try to start location-driven background wake if the user has already
// granted Always permission. Never prompts. Safe to call on every launch.
export async function registerLocationWakeIfPermitted(): Promise<boolean> {
  const at = new Date().toISOString();

  if (!isSupported) {
    await writeDiagnostic({
      at,
      step: isExpoGo ? "skipped-expo-go" : "skipped-unsupported",
    });
    return false;
  }

  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (!fg.granted) {
      await writeDiagnostic({
        at,
        step: "foreground-denied",
        message: `granted=false canAsk=${fg.canAskAgain}`,
      });
      return false;
    }
    const bg = await Location.getBackgroundPermissionsAsync();
    if (!bg.granted) {
      await writeDiagnostic({
        at,
        step: "background-denied",
        message: `granted=false canAsk=${bg.canAskAgain}`,
      });
      return false;
    }
    return await startLocationTask();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeDiagnostic({ at, step: "register-error", message });
    console.warn("[location-wake] register check failed", err);
    return false;
  }
}

// Onboarding: requests foreground then background permission, then
// starts the task. Returns true on full success.
export async function requestAndRegisterLocationWake(): Promise<boolean> {
  const at = new Date().toISOString();

  if (!isSupported) {
    await writeDiagnostic({
      at,
      step: isExpoGo ? "skipped-expo-go" : "skipped-unsupported",
    });
    return false;
  }

  try {
    // iOS requires foreground permission before background can be asked.
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) {
      await writeDiagnostic({
        at,
        step: "foreground-denied",
        message: `granted=${fg.granted} canAsk=${fg.canAskAgain}`,
      });
      return false;
    }
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) {
      await writeDiagnostic({
        at,
        step: "background-denied",
        message: `granted=${bg.granted} canAsk=${bg.canAskAgain}`,
      });
      return false;
    }
    return await startLocationTask();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeDiagnostic({ at, step: "register-error", message });
    console.warn("[location-wake] request failed", err);
    return false;
  }
}

async function startLocationTask(): Promise<boolean> {
  try {
    const already = await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME,
    );
    if (already) {
      await writeDiagnostic({ at: new Date().toISOString(), step: "ok" });
      return true;
    }
    // Lowest accuracy + a generous distance filter keeps power use
    // negligible. We don't use the location anyway — these settings
    // only control how often iOS calls us back, not what we read.
    // pausesUpdatesAutomatically lets iOS stop the active updater
    // when motion is unlikely to produce new data; the
    // significant-location-change monitor (set up in parallel by the
    // expo-location native code) keeps firing regardless and is the
    // one that survives force-quit.
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.LocationAccuracy.Lowest,
      distanceInterval: 5000,
      pausesUpdatesAutomatically: true,
      showsBackgroundLocationIndicator: false,
      // Help iOS pause more aggressively when stationary.
      activityType: Location.LocationActivityType.OtherNavigation,
    });
    await writeDiagnostic({ at: new Date().toISOString(), step: "ok" });
    console.log("[location-wake] registered");
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeDiagnostic({
      at: new Date().toISOString(),
      step: "register-error",
      message,
    });
    console.warn("[location-wake] start failed", err);
    return false;
  }
}

export async function unregisterLocationWake(): Promise<void> {
  if (!isSupported) return;
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME,
    );
    if (started) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch {}
}
