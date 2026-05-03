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

// How many archive days to keep on the phone for each favorite zone.
// Three days covers "drove out yesterday morning" use cases without
// blowing up AsyncStorage.
export const OFFLINE_HISTORY_DAYS = 3;

export interface ZoneSnapshot {
  forecast: AvalancheZone;
  stations?: WeatherObservation[];
  weather?: ZoneWeatherForecast;
  cachedAt: string; // ISO 8601
}

// Snapshot stores per-day archives of each zone's bundle. Outer key is
// zoneId; inner key is the YYYY-MM-DD forecast date the bundle is for.
// Today's bundle replaces itself across cron ticks; older days hang
// around up to OFFLINE_HISTORY_DAYS.
export interface FavoritesSnapshot {
  fetchedAt: string;
  // Per-zone, per-date bundles. Old shape (just `Record<zoneId, ZoneSnapshot>`)
  // is migrated on read so existing installs don't lose their cache.
  zones: Record<string, Record<string, ZoneSnapshot>>;
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

// ────────── Snapshot (bundles indexed by zoneId × date) ──────────

function isoDate(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  if (isNaN(x.getTime())) return new Date().toISOString().slice(0, 10);
  return x.toISOString().slice(0, 10);
}

// Read & migrate-from-flat-shape if needed. The old shape was
// `zones: Record<zoneId, ZoneSnapshot>`; we promote each entry to today's
// date so existing installs don't see an empty cache after the upgrade.
export async function loadSnapshot(): Promise<FavoritesSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FavoritesSnapshot | null;
    if (!parsed?.zones) return null;
    // Detect old flat shape: values look like { forecast, stations?, ... }
    // (not nested by date). Migrate in place to nested shape.
    const sample = Object.values(parsed.zones)[0] as any;
    if (sample && "forecast" in sample && !looksLikeDateMap(sample)) {
      const migrated: FavoritesSnapshot = { fetchedAt: parsed.fetchedAt, zones: {} };
      for (const [zoneId, snap] of Object.entries(parsed.zones)) {
        const s = snap as unknown as ZoneSnapshot;
        const date = isoDate(s.cachedAt || parsed.fetchedAt || new Date());
        migrated.zones[zoneId] = { [date]: s };
      }
      return migrated;
    }
    return parsed;
  } catch {
    return null;
  }
}

function looksLikeDateMap(v: any): boolean {
  if (!v || typeof v !== "object") return false;
  // Date-keyed map → keys match YYYY-MM-DD
  return Object.keys(v).every((k) => /^\d{4}-\d{2}-\d{2}$/.test(k));
}

export async function saveSnapshot(snapshot: FavoritesSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn("saveSnapshot failed", err);
  }
}

// Find the bundle for a given zone+date. Pass undefined for date to get
// the most recent bundle the phone knows about for that zone.
export function getZoneSnapshotForDate(
  snap: FavoritesSnapshot | null,
  zoneId: string,
  date?: string,
): ZoneSnapshot | undefined {
  if (!snap) return undefined;
  const byDate = snap.zones[zoneId];
  if (!byDate) return undefined;
  if (date) return byDate[date];
  // No date → newest available
  const dates = Object.keys(byDate).sort();
  if (dates.length === 0) return undefined;
  return byDate[dates[dates.length - 1]];
}

// List the dates the phone has cached for a given zone, newest first.
export function listSnapshotDates(
  snap: FavoritesSnapshot | null,
  zoneId: string,
): string[] {
  if (!snap?.zones?.[zoneId]) return [];
  return Object.keys(snap.zones[zoneId]).sort().reverse();
}

// Insert / update a single (zoneId, date) bundle into the snapshot.
export function upsertSnapshotZoneDate(
  snap: FavoritesSnapshot | null,
  zoneId: string,
  date: string,
  patch: Partial<ZoneSnapshot> & { forecast?: AvalancheZone },
): FavoritesSnapshot {
  const next: FavoritesSnapshot = snap
    ? { ...snap, zones: { ...snap.zones } }
    : { fetchedAt: "", zones: {} };
  const existing = next.zones[zoneId]?.[date];
  next.zones[zoneId] = {
    ...(next.zones[zoneId] || {}),
    [date]: {
      forecast: patch.forecast ?? existing?.forecast ?? ({} as AvalancheZone),
      stations: patch.stations ?? existing?.stations,
      weather: patch.weather ?? existing?.weather,
      cachedAt: new Date().toISOString(),
    },
  };
  next.fetchedAt = new Date().toISOString();
  return next;
}

// Drop archive days older than OFFLINE_HISTORY_DAYS for every zone, and
// drop entire zones that aren't in the favorites set. Call after every
// snapshot mutation so AsyncStorage doesn't grow without bound.
export function pruneSnapshot(
  snap: FavoritesSnapshot,
  favoriteZoneIds: string[],
  historyDays = OFFLINE_HISTORY_DAYS,
): FavoritesSnapshot {
  const favSet = new Set(favoriteZoneIds);
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - historyDays + 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const nextZones: typeof snap.zones = {};
  for (const [zoneId, byDate] of Object.entries(snap.zones)) {
    if (!favSet.has(zoneId)) continue;
    const kept: Record<string, ZoneSnapshot> = {};
    for (const [date, s] of Object.entries(byDate)) {
      if (date >= cutoffStr) kept[date] = s;
    }
    if (Object.keys(kept).length > 0) nextZones[zoneId] = kept;
  }
  return { ...snap, zones: nextZones };
}

// Convenience: merge + prune + save in one shot.
export async function persistSnapshotZoneDate(
  zoneId: string,
  date: string,
  patch: Partial<ZoneSnapshot> & { forecast?: AvalancheZone },
  favoriteZoneIds: string[],
): Promise<FavoritesSnapshot> {
  const current = await loadSnapshot();
  const merged = upsertSnapshotZoneDate(current, zoneId, date, patch);
  const pruned = pruneSnapshot(merged, favoriteZoneIds);
  await saveSnapshot(pruned);
  return pruned;
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

// Format YYYY-MM-DD for display ("MAY 1", "TUE · APR 30") in the hero.
export function formatDateLabel(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (isNaN(d.getTime())) return date;
  const month = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][d.getUTCMonth()];
  return `${month} ${d.getUTCDate()}`;
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(date: string, delta: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
