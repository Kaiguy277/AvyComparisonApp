import type {
  AvalancheZone,
  ObservationSummary,
  WeatherObservation,
  ZoneWeatherForecast,
} from "./api/avalanche";

// Session-level in-memory cache for zone bundles. The offline snapshot
// in lib/offlineCache.ts only persists FAVORITE zones — ad-hoc picks
// from the picker would otherwise be visible on the home grid (since
// they're in the in-memory `summary` state) but unreachable from the
// zone detail / sub-screens, which read from the snapshot.
//
// This map fills that gap: every zone we have data for in the current
// session is written here, and the detail screens read from it as a
// fallback when the offline snapshot doesn't have the zone.
//
// Lives only as long as the JS runtime — clears on app reload, which
// is fine: the home screen will re-populate it the next time it
// fetches a summary.

export interface ZoneSessionEntry {
  // Optional so stations-only zones (no current avalanche forecast) can
  // still be cached for the wx station screen.
  forecast?: AvalancheZone;
  weather?: ZoneWeatherForecast;
  stations?: WeatherObservation[];
  observations?: ObservationSummary[];
  cachedAt: string;
  // Local day key (YYYY-MM-DD) the forecast/stations/weather represent.
  // Consumers MUST match this against the date being viewed before using
  // this entry as a fallback — the map holds only the most recently
  // fetched day, so using it for an archive date would show today's
  // ratings under an archive label (a safety bug). Absent for entries
  // that carry only date-agnostic data (e.g. recent observations).
  dateKey?: string;
}

const cache = new Map<string, ZoneSessionEntry>();

// Merge into any existing entry — a stations-only update should not
// erase a previously cached forecast (and vice-versa).
export function setZoneSession(
  id: string,
  entry: Partial<ZoneSessionEntry> & { cachedAt: string },
): void {
  const prev = cache.get(id);
  cache.set(id, {
    forecast: entry.forecast ?? prev?.forecast,
    weather: entry.weather ?? prev?.weather,
    stations: entry.stations ?? prev?.stations,
    observations: entry.observations ?? prev?.observations,
    cachedAt: entry.cachedAt,
    dateKey: entry.dateKey ?? prev?.dateKey,
  });
}

export function getZoneSession(id: string): ZoneSessionEntry | undefined {
  return cache.get(id);
}

export function clearZoneSession(): void {
  cache.clear();
}
