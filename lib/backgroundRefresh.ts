import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
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

// expo-background-fetch wraps iOS's legacy
// `application:performFetchWithCompletionHandler:` API, which routes to
// BGAppRefreshTask under iOS 13+. This is the right primitive for "keep
// cached content fresh" per Apple's Background Tasks doc — short
// runtime (~30s), fires opportunistically every tens of minutes when
// iOS thinks the user is about to open the app.
//
// (We previously used expo-background-task, which uses
// BGProcessingTaskRequest — meant for long-running idle work like DB
// maintenance, fires far less often, and was the wrong tool for a
// 200ms cache pull.)
const MIN_INTERVAL_SECONDS = 15 * 60;

// Expo Go ships without the native background-fetch module; calling
// defineTask / registerTaskAsync there throws. Detect and no-op so the
// visual preview via Expo Go doesn't crash. In a production build
// (TestFlight / standalone), this is false and the task wires up
// normally.
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
  // Stations-only zones are dated by the stations snapshot, which may not
  // align with the forecast date — fall back to today.
  const stationsDate = r.stationsDate || todayIsoDate();
  let next: FavoritesSnapshot =
    (await loadSnapshot()) || { fetchedAt: "", zones: {} };
  const favSet = new Set(favs);
  const nowIso = new Date().toISOString();

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
      fetchedAt: nowIso,
      zones: {
        ...next.zones,
        [z.id]: {
          ...(next.zones[z.id] || {}),
          [date]: {
            forecast: z,
            stations: z.weatherObservations,
            weather,
            cachedAt: nowIso,
          },
        },
      },
    };
  }

  // Stations-only zones — no forecast, but the cron is still updating
  // their station and weather data. Write into the snapshot so the
  // detail screen can render fresh wx info even off-season.
  for (const soz of r.stationsOnlyZones || []) {
    if (!favSet.has(soz.id)) continue;
    const cid = soz.centerId || ZONE_TO_CENTER[soz.id];
    const weather = {
      nacWeather: cid ? r.centerWeather?.[cid] : undefined,
      nwsForecast: r.zoneNwsForecasts?.[soz.id],
      avgDiscussion: cid ? r.centerAvgDiscussions?.[cid] : undefined,
      avgLocations: r.zoneAvgLocations?.[soz.id],
    };
    const existing = next.zones[soz.id]?.[stationsDate];
    next = {
      fetchedAt: nowIso,
      zones: {
        ...next.zones,
        [soz.id]: {
          ...(next.zones[soz.id] || {}),
          [stationsDate]: {
            // Preserve any pre-existing forecast (rare but possible: a
            // stations-only response after we previously had a forecast
            // on the same date should not erase it).
            forecast: existing?.forecast,
            stations: soz.weatherObservations,
            weather,
            cachedAt: nowIso,
          },
        },
      },
    };
  }

  next = pruneSnapshot(next, favs);
  await saveSnapshot(next);
  const totalCached =
    r.zones.length + (r.stationsOnlyZones?.length || 0);
  await writeLastRefresh({
    at: nowIso,
    source,
    zones: totalCached,
  });
  console.log(
    `[${source}] cached ${r.zones.length} forecast + ${r.stationsOnlyZones?.length || 0} stations-only for ${date}`,
  );
  return totalCached;
}

// defineTask must be evaluated at module load (before app entry resolves)
// so iOS can dispatch into it when the OS wakes the headless JS runtime.
// Importing this file from app/_layout.tsx achieves that ordering.
// Skipped on Expo Go (no native scheduler) and web.
if (!isExpoGo) {
  TaskManager.defineTask(BG_TASK_NAME, async () => {
    try {
      const n = await refreshFavoritesSnapshot("bg-task");
      // NewData / NoData / Failed are signals to iOS about whether
      // the fetch produced anything useful — informs the OS's
      // scheduling heuristic for the next fire.
      if (n === null) return BackgroundFetch.BackgroundFetchResult.Failed;
      return n > 0
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (err) {
      console.warn("[bg-task] threw", err);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

// Web has no native background scheduler; Expo Go ships without the
// native module. Calls become no-ops so the dev preview doesn't error.
const isSupported =
  !isExpoGo && (Platform.OS === "ios" || Platform.OS === "android");

export async function registerBackgroundRefresh(): Promise<void> {
  if (!isSupported) return;
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
      console.warn(
        "[bg-task] restricted — user has Background App Refresh disabled",
      );
      return;
    }
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_TASK_NAME);
    if (isRegistered) return;
    await BackgroundFetch.registerTaskAsync(BG_TASK_NAME, {
      minimumInterval: MIN_INTERVAL_SECONDS,
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log(`[bg-task] registered (>= ${MIN_INTERVAL_SECONDS / 60}min)`);
  } catch (err) {
    console.warn("[bg-task] register failed", err);
  }
}

export async function unregisterBackgroundRefresh(): Promise<void> {
  if (!isSupported) return;
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_TASK_NAME);
    if (isRegistered) await BackgroundFetch.unregisterTaskAsync(BG_TASK_NAME);
  } catch {}
}
