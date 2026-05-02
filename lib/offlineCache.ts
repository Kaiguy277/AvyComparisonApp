import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  AvalancheZone,
  WeatherObservation,
  ZoneWeatherForecast,
} from "./api/avalanche";

// Storage keys
const FAVORITES_KEY = "avy-favorites";
const SNAPSHOT_KEY = "avy-favorites-snapshot";
const AUTO_REFRESH_KEY = "avy-auto-refresh-favorites";

// Snapshot age past which we mark the data as "stale" in the UI. Doesn't
// delete anything — last-known-good is always more useful than nothing
// when you're out of service.
export const STALE_AFTER_HOURS = 72;

export interface ZoneSnapshot {
  forecast: AvalancheZone;
  stations?: WeatherObservation[];
  weather?: ZoneWeatherForecast;
  cachedAt: string; // ISO 8601
}

export interface FavoritesSnapshot {
  fetchedAt: string;
  zones: Record<string, ZoneSnapshot>;
}

// ────────── Favorites (the list of zone IDs the user wants kept fresh) ──────────

export async function loadFavorites(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export async function saveFavorites(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...new Set(ids)]));
  } catch (err) {
    console.warn("saveFavorites failed", err);
  }
}

// ────────── Snapshot (forecast + stations + weather, indexed by zoneId) ──────────

export async function loadSnapshot(): Promise<FavoritesSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FavoritesSnapshot;
    if (!parsed?.zones) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSnapshot(snapshot: FavoritesSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn("saveSnapshot failed", err);
  }
}

// Merge new zone data into the snapshot. Pass anything you have — partial
// updates are fine (e.g. SNOTEL arrives later than the forecast).
export async function upsertSnapshotZone(
  zoneId: string,
  patch: Partial<ZoneSnapshot> & { forecast?: AvalancheZone },
): Promise<void> {
  const current = (await loadSnapshot()) || { fetchedAt: "", zones: {} };
  const existing = current.zones[zoneId];
  current.zones[zoneId] = {
    forecast: patch.forecast ?? existing?.forecast ?? ({} as AvalancheZone),
    stations: patch.stations ?? existing?.stations,
    weather: patch.weather ?? existing?.weather,
    cachedAt: new Date().toISOString(),
  };
  current.fetchedAt = new Date().toISOString();
  await saveSnapshot(current);
}

// ────────── Auto-refresh preference ──────────

export async function loadAutoRefresh(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(AUTO_REFRESH_KEY);
    if (raw === null) return true; // default on
    return raw === "true";
  } catch {
    return true;
  }
}

export async function saveAutoRefresh(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTO_REFRESH_KEY, String(on));
  } catch {}
}

// ────────── Helpers ──────────

export function ageHours(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60);
}

export function isStale(iso: string | undefined): boolean {
  const h = ageHours(iso);
  return h === null || h > STALE_AFTER_HOURS;
}

export function formatAge(iso: string | undefined): string {
  const h = ageHours(iso);
  if (h === null) return "never";
  if (h < 1) return `${Math.round(h * 60)}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
