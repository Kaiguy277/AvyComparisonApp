import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  loadFavorites,
  loadSnapshot,
  pruneSnapshot,
  saveSnapshot,
  todayIsoDate,
  type FavoritesSnapshot,
} from "./offlineCache";
import { avalancheApi } from "./api/avalanche";
import { ZONE_TO_CENTER } from "./zones";

// Track the last successful device-side refresh so the home screen can
// surface "background wake fired Xm ago via push" — a deterministic
// signal that the BG task / silent push pipeline actually executed.
// Without this, a successful wake is invisible: the displayed "CACHED
// · HH:MM" reads the server's forecast-cache time, which doesn't move
// just because the device pulled a refresh.
const LAST_REFRESH_KEY = "avy-last-bg-refresh-v1";

export interface LastRefreshRecord {
  at: string;
  source: "bg-task" | "push" | "foreground";
  zones: number;
}

export async function readLastRefresh(): Promise<LastRefreshRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_REFRESH_KEY);
    return raw ? (JSON.parse(raw) as LastRefreshRecord) : null;
  } catch {
    return null;
  }
}

async function writeLastRefresh(rec: LastRefreshRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_REFRESH_KEY, JSON.stringify(rec));
  } catch {}
}

// Task identifier persisted by iOS BGTaskScheduler. Must be a stable
// string — changing it after release leaves orphaned scheduled tasks.
export const BG_TASK_NAME = "avy.refresh-favorites";

// 15 minutes is the floor iOS will respect; the OS schedules less often
// based on usage patterns, battery, network, and the user's per-app
// Background App Refresh setting. There is no guarantee about cadence —
// this is a hint, not a contract.
const MIN_INTERVAL_MINUTES = 15;

// Expo Go doesn't include the native side of expo-background-task;
// calling defineTask / registerTaskAsync there throws. Detect and no-op
// so the visual preview on phone (via Expo Go) doesn't crash. In a
// production build (TestFlight / standalone), this is false and the
// task wires up normally.
const isExpoGo = Constants.appOwnership === "expo";

// Shared refresh body — reusable across the BGTaskScheduler wake-up, the
// silent-push notification handler, and the in-app foreground refresh.
// Returns the count of zones written, or null if nothing was attempted.
export async function refreshFavoritesSnapshot(
  source: "bg-task" | "push" | "foreground" = "bg-task",
): Promise<number | null> {
  const favs = await loadFavorites();
  if (!favs || favs.length === 0) return 0;
  const r = await avalancheApi.getCachedForecasts(favs);
  if (!r.success || !r.zones) {
    console.warn(`[${source}] getCachedForecasts unsuccessful`);
    return null;
  }
  const date = r.forecastDate || todayIsoDate();
  let next: FavoritesSnapshot =
    (await loadSnapshot()) || { fetchedAt: "", zones: {} };
  const favSet = new Set(favs);
  for (const z of r.zones) {
    if (!favSet.has(z.id)) continue;
    const cid = ZONE_TO_CENTER[z.id];
    const weather = {
      nacWeather: cid ? r.centerWeather?.[cid] : undefined,
      nwsForecast: r.zoneNwsForecasts?.[z.id],
      avgDiscussion: cid ? r.centerAvgDiscussions?.[cid] : undefined,
      avgLocations: r.zoneAvgLocations?.[z.id],
    };
    next = {
      fetchedAt: new Date().toISOString(),
      zones: {
        ...next.zones,
        [z.id]: {
          ...(next.zones[z.id] || {}),
          [date]: {
            forecast: z,
            stations: z.weatherObservations,
            weather,
            cachedAt: new Date().toISOString(),
          },
        },
      },
    };
  }
  next = pruneSnapshot(next, favs);
  await saveSnapshot(next);
  await writeLastRefresh({
    at: new Date().toISOString(),
    source,
    zones: r.zones.length,
  });
  console.log(`[${source}] cached ${r.zones.length} zones for ${date}`);
  return r.zones.length;
}

// defineTask must be evaluated at module load (before app entry resolves)
// so iOS can dispatch into it when the OS wakes the headless JS runtime.
// Importing this file from app/_layout.tsx achieves that ordering.
// Skipped on Expo Go (no native scheduler) and web.
if (!isExpoGo) {
  TaskManager.defineTask(BG_TASK_NAME, async () => {
    try {
      const n = await refreshFavoritesSnapshot("bg-task");
      return n === null
        ? BackgroundTask.BackgroundTaskResult.Failed
        : BackgroundTask.BackgroundTaskResult.Success;
    } catch (err) {
      console.warn("[bg-task] threw", err);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

// Web has no native background scheduler; Expo Go ships without
// expo-background-task. Calls become no-ops so the dev preview doesn't error.
const isSupported =
  !isExpoGo && (Platform.OS === "ios" || Platform.OS === "android");

export async function registerBackgroundRefresh(): Promise<void> {
  if (!isSupported) return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
      console.warn(
        "[bg-task] restricted — user has Background App Refresh disabled",
      );
      return;
    }
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_TASK_NAME);
    if (isRegistered) return;
    await BackgroundTask.registerTaskAsync(BG_TASK_NAME, {
      minimumInterval: MIN_INTERVAL_MINUTES,
    });
    console.log(`[bg-task] registered (>= ${MIN_INTERVAL_MINUTES}min)`);
  } catch (err) {
    console.warn("[bg-task] register failed", err);
  }
}

export async function unregisterBackgroundRefresh(): Promise<void> {
  if (!isSupported) return;
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_TASK_NAME);
    if (isRegistered) await BackgroundTask.unregisterTaskAsync(BG_TASK_NAME);
  } catch {}
}
