import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  AvalancheZone,
  WeatherObservation,
  ZoneWeatherForecast,
} from "./api/avalanche";
import { addDaysKey, formatDayKey, toKey, todayKey } from "./dates";

// Storage keys
const FAVORITES_KEY = "avy-favorites";
const SNAPSHOT_KEY = "avy-favorites-snapshot";

// Snapshot age past which we mark the data as "stale" in the UI. Doesn't
// delete anything — last-known-good is always more useful than nothing
// when you're out of service.
export const STALE_AFTER_HOURS = 72;

// How many archive days to keep on the phone for each favorite zone.
// Three days covers "drove out yesterday morning" use cases without
// blowing up AsyncStorage.
export const OFFLINE_HISTORY_DAYS = 3;

export interface ZoneSnapshot {
  // Optional: a zone with no current avalanche forecast (off-season, etc.)
  // can still have stations + weather cached so the user can monitor
  // weather conditions year-round.
  forecast?: AvalancheZone;
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

// Returns null on a true first run (key has never been written) so callers
// can seed defaults; returns [] only when the user has explicitly emptied
// their favorites list (which we should respect, not overwrite).
export async function loadFavorites(): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    if (raw === null) return null;
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

// Local day key for a Date or ISO string (see lib/dates.ts on why local).
function isoDate(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  if (isNaN(x.getTime())) return todayKey();
  return toKey(x);
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

// Serializes every read-modify-write cycle on the snapshot behind a
// single promise chain. The app has four independent wake sources that
// can write concurrently — bg-task, silent push, location wake, and the
// foreground refresh — and each previously did its own load → build →
// save, so two overlapping writers would each start from the same base
// and the later save would silently drop the earlier one's zones. All
// snapshot mutations must go through here.
//
// The mutator receives the freshly-loaded current snapshot and returns
// the next one (it may return the same reference to signal "no change",
// in which case nothing is written). Prune inside the mutator if needed.
let snapshotWriteChain: Promise<unknown> = Promise.resolve();

export function mutateSnapshot(
  mutator: (current: FavoritesSnapshot) => FavoritesSnapshot,
): Promise<FavoritesSnapshot> {
  const run = async (): Promise<FavoritesSnapshot> => {
    const current = (await loadSnapshot()) || { fetchedAt: "", zones: {} };
    const next = mutator(current);
    if (next !== current) await saveSnapshot(next);
    return next;
  };
  // Chain regardless of whether the prior write resolved or rejected, so
  // one failure doesn't wedge the queue.
  const result = snapshotWriteChain.then(run, run);
  snapshotWriteChain = result.catch(() => {});
  return result;
}

// Merge one zone+date bundle into a snapshot immutably, preserving any
// fields the patch doesn't supply. Shared by every writer so the nested
// spread + preserve-existing logic lives in exactly one place.
export function mergeZoneBundle(
  snap: FavoritesSnapshot,
  zoneId: string,
  date: string,
  patch: Partial<ZoneSnapshot>,
  nowIso: string,
): FavoritesSnapshot {
  const existing = snap.zones[zoneId]?.[date];
  return {
    fetchedAt: nowIso,
    zones: {
      ...snap.zones,
      [zoneId]: {
        ...(snap.zones[zoneId] || {}),
        [date]: {
          forecast: patch.forecast ?? existing?.forecast,
          stations: patch.stations ?? existing?.stations,
          weather: patch.weather ?? existing?.weather,
          cachedAt: nowIso,
        },
      },
    },
  };
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

// Drop archive days older than OFFLINE_HISTORY_DAYS for every zone, and
// drop entire zones that aren't in the favorites set. Call after every
// snapshot mutation so AsyncStorage doesn't grow without bound.
export function pruneSnapshot(
  snap: FavoritesSnapshot,
  favoriteZoneIds: string[],
  historyDays = OFFLINE_HISTORY_DAYS,
): FavoritesSnapshot {
  const favSet = new Set(favoriteZoneIds);
  // Local cutoff — keep today plus (historyDays − 1) prior local days.
  const cutoffStr = addDaysKey(todayKey(), -(historyDays - 1));

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

// Date helpers now live in lib/dates.ts (single local convention). These
// re-exports keep the historical names working for existing callers.
export const formatDateLabel = formatDayKey;
export const todayIsoDate = todayKey;
export const addDaysIso = addDaysKey;
