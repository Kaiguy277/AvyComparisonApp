// The forecast data pipeline as a single async function, so it can be a
// TanStack Query queryFn. It encapsulates the four-way decision tree that
// used to live inline in app/index.tsx as a race-prone tangle of
// useState + useEffect + .then():
//
//   offline            → read the on-device snapshot
//   online, cached hit → the cron-refreshed server cache (fast path)
//   online, archive    → fall back to the snapshot (NAC only serves today)
//   online, today miss → live scrape, batched per center, + snotel + weather
//
// Returning ONE complete bundle (weather + stations folded in) means the
// caller never has to stitch together follow-up fetches, and letting hard
// failures throw means the query surfaces a real error state instead of an
// empty screen that's indistinguishable from "no data".

import { avalancheApi } from "@/lib/api/avalanche";
import type {
  AvalancheSummary,
  AvalancheZone,
  AvgDiscussion,
  AvgLocation,
  NacWeatherProduct,
  NwsForecast,
  ScrapedZoneInfo,
  StationsOnlyZone,
} from "@/lib/api/avalanche";
import { loadSnapshot } from "@/lib/offlineCache";
import { AVAILABLE_ZONES, ZONE_TO_CENTER } from "@/lib/zones";

export interface WeatherForecastBundle {
  centerWeather: Record<string, NacWeatherProduct>;
  zoneNwsForecasts: Record<string, NwsForecast>;
  centerAvgDiscussions: Record<string, AvgDiscussion>;
  zoneAvgLocations: Record<string, AvgLocation[]>;
}

export type LoadSource = "cached" | "live" | "offline";

export interface ForecastBundle {
  summary: AvalancheSummary | null;
  stationsOnlyZones: StationsOnlyZone[];
  weather: WeatherForecastBundle | null;
  scrapedAt: string | null;
  zonesScraped: ScrapedZoneInfo[];
  // "offline" here means "served from the local snapshot" — used by the
  // persist effect to avoid re-stamping freshness on data it just read
  // back. null summary + this source is the empty/archive-miss state.
  loadSource: LoadSource;
  // The date the bundle actually represents (newest available for an
  // offline/today read). Informational only — callers must NOT feed it
  // back into the query's date input (doing so was the old viewedDate
  // hijack that let a slow response rewrite what day you were viewing).
  resolvedDate: string | null;
}

export interface LoadForecastArgs {
  zoneIds: string[];
  date: string;
  isToday: boolean;
  isOnline: boolean | null;
}

const emptyBundle = (loadSource: LoadSource): ForecastBundle => ({
  summary: null,
  stationsOnlyZones: [],
  weather: null,
  scrapedAt: null,
  zonesScraped: [],
  loadSource,
  resolvedDate: null,
});

export async function loadForecastBundle(
  args: LoadForecastArgs,
): Promise<ForecastBundle> {
  const { zoneIds, date, isToday, isOnline } = args;
  if (zoneIds.length === 0) return emptyBundle("cached");

  // Offline: the snapshot is the only source. Newest-per-zone for today,
  // exact date for an archive day (mirrors useZoneBundle's safety rule).
  if (isOnline === false) {
    return readSnapshotBundle(isToday ? undefined : date);
  }

  // 1) Server-side cache — refreshed by cron every 1–2h. ~200ms vs ~40s.
  const cached = await avalancheApi.getCachedForecasts(
    zoneIds,
    isToday ? undefined : date,
  );
  const cachedHasAnyZones =
    (cached.zones && cached.zones.length > 0) ||
    (cached.stationsOnlyZones && cached.stationsOnlyZones.length > 0);
  if (
    cached.success &&
    cachedHasAnyZones &&
    (!cached.missingZoneIds || cached.missingZoneIds.length === 0)
  ) {
    return {
      summary: {
        quickTake: "",
        zones: cached.zones || [],
        weatherHighlights: "",
        bottomLine: "",
      },
      stationsOnlyZones: cached.stationsOnlyZones || [],
      weather: {
        centerWeather: cached.centerWeather || {},
        zoneNwsForecasts: cached.zoneNwsForecasts || {},
        centerAvgDiscussions: cached.centerAvgDiscussions || {},
        zoneAvgLocations: cached.zoneAvgLocations || {},
      },
      scrapedAt:
        cached.forecastFetchedAt ||
        cached.stationsFetchedAt ||
        new Date().toISOString(),
      zonesScraped: [],
      loadSource: "cached",
      resolvedDate: cached.forecastDate ?? null,
    };
  }

  // 2) Archive day with an incomplete cache: NAC's live API only serves
  // the current forecast, so there's no historical data to scrape — fall
  // back to the snapshot for that exact date (empty state if we don't
  // have it).
  if (!isToday) {
    return readSnapshotBundle(date);
  }

  // 3) Today, cache incomplete: live scrape, batched per center, then
  // fold in snotel + weather so the returned bundle is complete.
  const centerGroups = new Map<string, string[]>();
  for (const zoneId of zoneIds) {
    const centerId =
      AVAILABLE_ZONES.find((z) => z.id === zoneId)?.center || "UNKNOWN";
    if (!centerGroups.has(centerId)) centerGroups.set(centerId, []);
    centerGroups.get(centerId)!.push(zoneId);
  }

  const BATCH_SIZE = 4;
  const entries = Array.from(centerGroups.entries());
  const allZones: AvalancheZone[] = [];
  const allZonesScraped: ScrapedZoneInfo[] = [];
  let hasAnySuccess = false;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(([, batchZoneIds]) => avalancheApi.getSummary(batchZoneIds)),
    );
    for (const response of results) {
      if (response.success && response.summary) {
        allZones.push(...response.summary.zones);
        if (response.zonesScraped) allZonesScraped.push(...response.zonesScraped);
        hasAnySuccess = true;
      }
    }
  }

  if (!hasAnySuccess) {
    // Distinct from "no data": a real failure the query should report.
    throw new Error("Failed to fetch avalanche conditions.");
  }

  // Secondary data — folded in so the bundle is self-contained. Both are
  // best-effort: a station/weather hiccup shouldn't fail the forecast.
  const [snotel, weather] = await Promise.all([
    avalancheApi.getSnotelObservations(zoneIds).catch(() => null),
    avalancheApi.getWeatherForecast(zoneIds).catch(() => null),
  ]);

  const zonesWithStations =
    snotel?.success && snotel.observations
      ? allZones.map((zone) => ({
          ...zone,
          weatherObservations:
            snotel.observations?.[zone.id] || zone.weatherObservations,
        }))
      : allZones;

  return {
    summary: {
      quickTake: "",
      zones: zonesWithStations,
      weatherHighlights: "",
      bottomLine: "",
    },
    // Live scrape returns only zones with active forecasts; stations-only
    // entries come from the cached path.
    stationsOnlyZones: [],
    weather:
      weather?.success
        ? {
            centerWeather: weather.centerWeather || {},
            zoneNwsForecasts: weather.zoneNwsForecasts || {},
            centerAvgDiscussions: weather.centerAvgDiscussions || {},
            zoneAvgLocations: weather.zoneAvgLocations || {},
          }
        : null,
    scrapedAt: new Date().toISOString(),
    zonesScraped: allZonesScraped,
    loadSource: "live",
    resolvedDate: null,
  };
}

// Hydrate a bundle from the on-device snapshot. targetDate undefined →
// newest cached date per zone; a date → that exact date only (no silent
// swap to an older snapshot). Returns an empty bundle if nothing matches.
async function readSnapshotBundle(
  targetDate?: string,
): Promise<ForecastBundle> {
  const snap = await loadSnapshot();
  if (!snap || Object.keys(snap.zones).length === 0) {
    return emptyBundle("offline");
  }

  const zones: AvalancheZone[] = [];
  const stationsOnly: StationsOnlyZone[] = [];
  const weather: WeatherForecastBundle = {
    centerWeather: {},
    zoneNwsForecasts: {},
    centerAvgDiscussions: {},
    zoneAvgLocations: {},
  };
  let resolvedDate: string | null = null;

  for (const [zoneId, byDate] of Object.entries(snap.zones)) {
    const dates = Object.keys(byDate).sort().reverse();
    const pick = targetDate
      ? byDate[targetDate]
        ? targetDate
        : null
      : dates[0];
    if (!pick) continue;
    const s = byDate[pick];
    const cid = ZONE_TO_CENTER[zoneId];
    if (s.forecast) {
      zones.push(s.forecast);
    } else if (s.stations && s.stations.length > 0) {
      stationsOnly.push({
        id: zoneId,
        centerId: cid ?? "",
        weatherObservations: s.stations,
      });
    } else {
      continue;
    }
    if (!resolvedDate || pick > resolvedDate) resolvedDate = pick;
    const w = s.weather;
    if (!w) continue;
    if (cid && w.nacWeather) weather.centerWeather[cid] = w.nacWeather;
    if (w.nwsForecast) weather.zoneNwsForecasts[zoneId] = w.nwsForecast;
    if (cid && w.avgDiscussion) weather.centerAvgDiscussions[cid] = w.avgDiscussion;
    if (w.avgLocations) weather.zoneAvgLocations[zoneId] = w.avgLocations;
  }

  if (zones.length === 0 && stationsOnly.length === 0) {
    return emptyBundle("offline");
  }

  return {
    summary: { quickTake: "", zones, weatherHighlights: "", bottomLine: "" },
    stationsOnlyZones: stationsOnly,
    weather,
    scrapedAt: snap.fetchedAt,
    zonesScraped: [],
    loadSource: "offline",
    resolvedDate,
  };
}
