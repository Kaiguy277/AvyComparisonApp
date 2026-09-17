import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Defuses the orphaned background-location task left behind by builds <= 32.
//
// Build 32 called Location.startLocationUpdatesAsync("avy.location-wake") once
// the user granted Always location. expo-task-manager PERSISTS that
// registration in the app container and restores it natively on the next
// launch. Build 33 deleted both the task handler (lib/locationWake.ts) and
// `location` from UIBackgroundModes — and iOS throws an exception when
// allowsBackgroundLocationUpdates is set without that background mode, so the
// app crashed on launch for anyone UPGRADING from 32. A fresh install was
// fine, because deleting the app wipes the container along with the task.
//
// 1.1 can clean this up where 33 could not: tracking puts `location` back in
// UIBackgroundModes, so the native restore no longer throws and our JS
// actually gets to run. We then unregister the dead task for good.
//
// Keep this until there is no plausible install still carrying a build <= 32.

const LEGACY_LOCATION_WAKE_TASK = "avy.location-wake";
const CLEANED_KEY = "avy-legacy-wake-cleaned-v1";

// AsyncStorage keys owned by the deleted lib/locationWake.ts. Harmless, but
// they'd linger forever otherwise.
const LEGACY_KEYS = [
  "avy-location-diagnostic-v1",
  "avy-location-prompt-shown-v1",
  "avy-location-banner-snoozed-at-v1",
];

export async function cleanUpLegacyLocationWake(): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(CLEANED_KEY)) === "1") return;

    // Stop the updates first: unregistering a task that iOS still considers
    // an active location session is the case that misbehaves.
    try {
      if (await Location.hasStartedLocationUpdatesAsync(LEGACY_LOCATION_WAKE_TASK)) {
        await Location.stopLocationUpdatesAsync(LEGACY_LOCATION_WAKE_TASK);
      }
    } catch {}

    try {
      if (await TaskManager.isTaskRegisteredAsync(LEGACY_LOCATION_WAKE_TASK)) {
        await TaskManager.unregisterTaskAsync(LEGACY_LOCATION_WAKE_TASK);
      }
    } catch {}

    try {
      await AsyncStorage.multiRemove(LEGACY_KEYS);
    } catch {}

    await AsyncStorage.setItem(CLEANED_KEY, "1");
    console.log("[legacy-cleanup] removed avy.location-wake");
  } catch {
    // Never block launch on cleanup — the next launch retries.
  }
}
