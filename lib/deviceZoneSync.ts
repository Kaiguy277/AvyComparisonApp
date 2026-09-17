import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "./supabase";
import { loadFavorites } from "./offlineCache";

// Why this is its own module rather than living in pushNotifications or
// being called from saveFavorites directly: offlineCache is imported by
// backgroundRefresh, which is imported by pushNotifications. Hooking the
// sync into saveFavorites would close that loop into an import cycle.
// This module only reaches "downward" (AsyncStorage, supabase,
// offlineCache), so both pushNotifications and the screens can use it.

const PUSH_TOKEN_KEY = "avy-push-token-v1";
// Last zone list we successfully pushed, so a no-op favourite toggle
// (star then un-star) doesn't cost a round trip.
const SYNCED_ZONES_KEY = "avy-synced-zones-v1";

// Remember the Expo push token so zone syncs don't have to re-mint one.
// Called by pushNotifications after a successful registration.
export async function cachePushToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  } catch {}
}

export async function readCachedPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

// Push the device's favourite zone ids to device_tokens.zones so the daily
// forecast alert can name them and carry today's danger rating.
//
// Safe to call often: it no-ops when the token isn't registered yet, when
// the zone list hasn't changed, or when offline (the next call retries).
// Never throws — callers treat this as best-effort.
export async function syncDeviceZones(zones?: string[]): Promise<boolean> {
  try {
    const token = await readCachedPushToken();
    // No token yet — registration hasn't completed (or was never possible,
    // e.g. simulator). The post-registration call covers this case.
    if (!token) return false;

    const list = zones ?? (await loadFavorites()) ?? [];
    const normalized = [...new Set(list)].sort();
    const fingerprint = normalized.join(",");

    const lastSynced = await AsyncStorage.getItem(SYNCED_ZONES_KEY);
    if (lastSynced === fingerprint) return true;

    const { error } = await supabase.rpc("set_device_zones", {
      p_token: token,
      p_zones: normalized,
    });
    if (error) {
      // Offline or transient — leave the fingerprint unset so the next
      // call retries rather than assuming success.
      console.warn("[zone-sync] failed", error.message);
      return false;
    }

    await AsyncStorage.setItem(SYNCED_ZONES_KEY, fingerprint);
    return true;
  } catch (err) {
    console.warn("[zone-sync] threw", err);
    return false;
  }
}
