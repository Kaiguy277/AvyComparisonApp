import { useEffect, useState } from "react";

import {
  getZoneSnapshotForDate,
  loadSnapshot,
  type FavoritesSnapshot,
} from "@/lib/offlineCache";
import { getZoneSession } from "@/lib/zoneSession";
import { todayKey } from "@/lib/dates";
import type {
  AvalancheZone,
  WeatherObservation,
  ZoneWeatherForecast,
} from "@/lib/api/avalanche";

export interface ResolvedZoneBundle {
  // True once the persisted snapshot load has settled (so screens can
  // distinguish "still loading" from "genuinely no data for this date").
  loaded: boolean;
  snap: FavoritesSnapshot | null;
  forecast?: AvalancheZone;
  stations?: WeatherObservation[];
  weather?: ZoneWeatherForecast;
  cachedAt?: string;
  // Whether the viewed date is today (vs an archive day).
  isToday: boolean;
}

// The one place the zone detail + sub-screens resolve "the bundle for
// this zone on this date". Replaces five hand-copied copies of the
// loadSnapshot + getZoneSnapshotForDate + session-fallback dance.
//
// The date rule is a safety property, not a convenience:
//   • Today  → show the newest stored bundle for the zone (a zone whose
//     forecast hasn't been reissued today is still current), and allow
//     the in-memory session as a fallback for ad-hoc (non-favorite)
//     zones that were never persisted.
//   • Archive day → show ONLY the bundle actually stored for that exact
//     date. The session cache holds the most-recently-fetched day, so
//     falling back to it for a past date would render today's danger
//     ratings under an archive label. In an avalanche app that's a
//     safety defect, so archive views never touch the session (the
//     dateKey gate below fails for any non-today date).
export function useZoneBundle(
  zoneId: string,
  date?: string,
): ResolvedZoneBundle {
  const [snap, setSnap] = useState<FavoritesSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    loadSnapshot().then((s) => {
      if (cancelled) return;
      setSnap(s);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [zoneId, date]);

  const effectiveDate = date ?? todayKey();
  const isToday = effectiveDate === todayKey();

  // Today → newest stored bundle (undefined date); archive → exact date.
  const bundle = snap
    ? getZoneSnapshotForDate(snap, zoneId, isToday ? undefined : effectiveDate)
    : undefined;

  // Session fallback only when it holds data for the viewed date. Since
  // the session always carries the most recently fetched day, this is
  // true only for today — archive views get no session data.
  const session = getZoneSession(zoneId);
  const sessionForDate =
    session && session.dateKey === effectiveDate ? session : undefined;

  return {
    loaded,
    snap,
    forecast: bundle?.forecast ?? sessionForDate?.forecast,
    stations: bundle?.stations ?? sessionForDate?.stations,
    weather: bundle?.weather ?? sessionForDate?.weather,
    cachedAt: bundle?.cachedAt ?? sessionForDate?.cachedAt ?? snap?.fetchedAt,
    isToday,
  };
}
