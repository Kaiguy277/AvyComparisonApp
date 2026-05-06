import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import NetInfo from "@react-native-community/netinfo";
import {
  addDaysIso,
  formatAge,
  formatDateLabel,
  isStale,
  loadFavorites,
  loadSnapshot,
  OFFLINE_HISTORY_DAYS,
  pruneSnapshot,
  saveFavorites,
  saveSnapshot,
  todayIsoDate,
  type FavoritesSnapshot,
} from "@/lib/offlineCache";

// How far back the user can scroll while online. Server retains 14 days
// in forecast_cache; we expose 10 to give the cleanup a buffer.
const ONLINE_HISTORY_DAYS = 10;

const WEEKDAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// "MON · MAY 1" — used in the hero pager when viewing an archive day.
function viewedDateLabel(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (isNaN(d.getTime())) return date;
  return `${WEEKDAY_SHORT[d.getUTCDay()]} · ${formatDateLabel(date)}`;
}

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardEyebrow,
  CardHeader,
} from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Collapsible } from "@/components/ui/Collapsible";
import { Text } from "@/components/ui/Text";
import { FavoritesReorder } from "@/components/avalanche/FavoritesReorder";
import { HierarchicalZoneSelector } from "@/components/avalanche/HierarchicalZoneSelector";
import { ZoneMapPicker } from "@/components/avalanche/ZoneMapPicker";
import { ZoneTile } from "@/components/avalanche/ZoneTile";
import { StationsOnlyTile } from "@/components/avalanche/StationsOnlyTile";
import { PermissionsIntro } from "@/components/onboarding/PermissionsIntro";
import { TopoBackground } from "@/components/visual/TopoBackground";
import { freshness, palette } from "@/constants/design";
import {
  hasCompletedOnboarding,
  markOnboardingComplete,
} from "@/lib/onboarding";
// Push registration moved to app/_layout.tsx (every-launch no-prompt
// retry); the PermissionsIntro modal calls requestAndRegister directly.
import {
  readPushDiagnostic,
  requestAndRegister,
  type PushDiagnostic,
} from "@/lib/pushNotifications";
import {
  readLocationDiagnostic,
  requestAndRegisterLocationWake,
  type LocationDiagnostic,
} from "@/lib/locationWake";
import { readLastRefresh, type LastRefreshRecord } from "@/lib/backgroundRefresh";
import {
  avalancheApi,
  type AvalancheSummary,
  type AvalancheZone,
  type AvgDiscussion,
  type AvgLocation,
  type NacWeatherProduct,
  type NwsForecast,
  type ScrapedZoneInfo,
  type StationsOnlyZone,
  type ZoneWeatherForecast,
} from "@/lib/api/avalanche";
import { AVAILABLE_ZONES, DEFAULT_ZONE_IDS, ZONE_TO_CENTER } from "@/lib/zones";
import { setZoneSession } from "@/lib/zoneSession";

interface WeatherForecastBundle {
  centerWeather: Record<string, NacWeatherProduct>;
  zoneNwsForecasts: Record<string, NwsForecast>;
  centerAvgDiscussions: Record<string, AvgDiscussion>;
  zoneAvgLocations: Record<string, AvgLocation[]>;
}

const months = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

export default function Index() {
  const insets = useSafeAreaInsets();

  // Top-level collapse state. Picker is collapsed by default — favorites
  // already auto-load and the zone grid carries the daily-driver read,
  // so the picker is admin and shouldn't take vertical space up front.
  const [pickerOpen, setPickerOpen] = useState(false);

  // The unified visible zone list. Anything in here renders in the tray and
  // gets fetched. A subset of these are favorites (persisted across launches);
  // the rest are session-only ad-hoc picks the user made via the list/map
  // pickers and didn't star.
  const [displayedZoneIds, setDisplayedZoneIds] =
    useState<string[]>(DEFAULT_ZONE_IDS);
  // Which day's forecast the user is currently viewing. Defaults to today;
  // the ← / → arrows in the hero step it back/forward through the archive
  // window.
  const [viewedDate, setViewedDate] = useState<string>(todayIsoDate());
  const todayStr = useMemo(() => todayIsoDate(), []);
  const isViewingToday = viewedDate === todayStr;
  // Persisted starred zones — survive relaunch and feed offline cache.
  const [favoriteZoneIds, setFavoriteZoneIds] = useState<string[]>([]);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const autoLoadedRef = useRef(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  // Snapshot of displayedZoneIds at the moment the map opened, so we can
  // detect whether the View Zones button needs to refetch on close.
  const mapBaselineIdsRef = useRef<string[]>([]);
  // The Compare list is collapsed by default — most users tap Favorites
  // and never need the manual selector. Open it on demand.
  const [compareOpen, setCompareOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSnotelLoading, setIsSnotelLoading] = useState(false);
  const [isWeatherForecastLoading, setIsWeatherForecastLoading] = useState(false);

  const [summary, setSummary] = useState<AvalancheSummary | null>(null);
  const [scrapedAt, setScrapedAt] = useState<string | null>(null);
  const [zonesScraped, setZonesScraped] = useState<ScrapedZoneInfo[]>([]);
  const [loadSource, setLoadSource] = useState<"cached" | "live" | "offline" | null>(null);
  const [weatherForecastData, setWeatherForecastData] =
    useState<WeatherForecastBundle | null>(null);
  // Zones with no current avalanche forecast but live wx station data.
  // Rendered as muted tiles below the main grid so the user can still
  // see hourly station updates year-round.
  const [stationsOnlyZones, setStationsOnlyZones] = useState<StationsOnlyZone[]>(
    [],
  );

  // Offline cache state — keeps the last-known-good bundle for favorite zones
  // available even when the phone has no service.
  const [snapshot, setSnapshot] = useState<FavoritesSnapshot | null>(null);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const lastBgFetchRef = useRef<number>(0);

  // First-launch onboarding modal — explains why we need push + Background
  // App Refresh, then triggers the iOS push permission prompt on tap.
  // null = haven't checked yet (don't render anything during the gap so
  // the modal doesn't flash). false = already onboarded. true = show.
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  useEffect(() => {
    (async () => {
      const done = await hasCompletedOnboarding();
      setShowOnboarding(!done);
      // Push registration is now driven from app/_layout.tsx — runs
      // every launch in no-prompt mode regardless of onboarding state.
    })();
  }, []);
  const dismissOnboarding = useCallback(() => {
    markOnboardingComplete().catch(() => {});
    setShowOnboarding(false);
  }, []);

  // Subtle reveal anim when results arrive
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (summary) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [summary, fadeAnim]);

  const today = useMemo(() => {
    const d = new Date();
    return {
      day: String(d.getDate()).padStart(2, "0"),
      month: months[d.getMonth()],
      year: d.getFullYear(),
      weekday: d
        .toLocaleDateString("en-US", { weekday: "long" })
        .toUpperCase(),
    };
  }, []);

  // Load saved favorites + offline snapshot. The displayed list seeds from
  // favorites (or DEFAULT_ZONE_IDS for first-run) — ad-hoc picks are
  // session-only and intentionally don't survive relaunch.
  useEffect(() => {
    (async () => {
      try {
        const [favs, snap] = await Promise.all([loadFavorites(), loadSnapshot()]);
        // First run (favs === null): seed favorites with the default zones
        // so they're starred AND selected, not just selected. After the user
        // edits and saves, favs becomes [] or a list and we respect that.
        if (favs === null) {
          setFavoriteZoneIds(DEFAULT_ZONE_IDS);
          setDisplayedZoneIds(DEFAULT_ZONE_IDS);
          await saveFavorites(DEFAULT_ZONE_IDS);
        } else {
          setFavoriteZoneIds(favs);
          setDisplayedZoneIds(favs.length > 0 ? favs : DEFAULT_ZONE_IDS);
        }
        setSnapshot(snap);
      } catch (err) {
        console.warn("Failed to load preferences", err);
      } finally {
        setPrefsLoaded(true);
      }
    })();
  }, []);

  // Network state — drives the OFFLINE banner and disables the live fetch.
  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return () => sub();
  }, []);

  // Auto-refresh favorites when the app comes back to the foreground. Skips
  // if we're offline, if there are no favorites, or if we already fetched
  // within the last 30 minutes. Refresh runs even if the user hasn't tapped
  // anything — the goal is "the cache is fresh when you drive out of service".
  const refreshFavoritesInBackground = useCallback(async () => {
    if (!isOnline || favoriteZoneIds.length === 0) return;
    const now = Date.now();
    if (now - lastBgFetchRef.current < 30 * 60 * 1000) return;
    try {
      // The server-side cache (refreshed by cron every 1–2h) is fast enough
      // and complete enough that we don't need separate live calls here.
      // Bg refresh always pulls today's bundle — historical days, if the
      // user wants them, are fetched on demand when they tap the arrow.
      const r = await avalancheApi.getCachedForecasts(favoriteZoneIds);
      if (!r.success || !r.zones) return;
      const date = r.forecastDate || todayIsoDate();
      const stationsDate = r.stationsDate || todayIsoDate();
      let next: FavoritesSnapshot =
        (await loadSnapshot()) || { fetchedAt: "", zones: {} };
      const favSet = new Set(favoriteZoneIds);
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
      // Stations-only favorites — no forecast, just fresh wx.
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
                forecast: existing?.forecast,
                stations: soz.weatherObservations,
                weather,
                cachedAt: nowIso,
              },
            },
          },
        };
      }
      next = pruneSnapshot(next, favoriteZoneIds);
      await saveSnapshot(next);
      setSnapshot(next);
      // Tick throttle only after a successful save — a failed fetch
      // shouldn't eat the next 30-minute retry window.
      lastBgFetchRef.current = now;
      console.log(
        `[bg-refresh] cached ${r.zones.length} forecast + ${r.stationsOnlyZones?.length || 0} stations-only`,
      );
    } catch (err) {
      console.warn("[bg-refresh] failed", err);
    }
  }, [isOnline, favoriteZoneIds]);

  // Trigger background refresh on mount + every time the app becomes active.
  useEffect(() => {
    refreshFavoritesInBackground();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshFavoritesInBackground();
    });
    return () => sub.remove();
  }, [refreshFavoritesInBackground]);

  // Pickers (list + map) update the unified display list directly. Removing
  // a zone via uncheck also unstars it so favorites stay ⊆ displayed.
  const updateDisplayedZones = useCallback(
    (zoneIds: string[]) => {
      setDisplayedZoneIds(zoneIds);
      const set = new Set(zoneIds);
      setFavoriteZoneIds((prev) => {
        if (prev.every((id) => set.has(id))) return prev;
        const next = prev.filter((id) => set.has(id));
        saveFavorites(next).catch(() => {});
        return next;
      });
    },
    [],
  );

  // Hydrate the screen state from the offline snapshot. Picks the bundle
  // for `targetDate` if provided; otherwise picks each zone's most recent
  // cached date. Returns true if anything was loaded — callers use the
  // boolean to decide whether to surface an empty state. The "no cache"
  // alert only fires when invoked by the user (no targetDate), since the
  // archive-back path has its own inline empty state.
  const loadFromSnapshot = useCallback(
    async (targetDate?: string): Promise<boolean> => {
      const snap = await loadSnapshot();
      if (!snap || Object.keys(snap.zones).length === 0) {
        if (!targetDate) {
          Alert.alert(
            "No cached forecast",
            "Add favorites and fetch a forecast while online to enable offline mode.",
          );
        }
        return false;
      }
      const zones: AvalancheZone[] = [];
      const stationsOnly: StationsOnlyZone[] = [];
      const bundle: WeatherForecastBundle = {
        centerWeather: {},
        zoneNwsForecasts: {},
        centerAvgDiscussions: {},
        zoneAvgLocations: {},
      };
      let resolvedDate: string | null = null;
      for (const [zoneId, byDate] of Object.entries(snap.zones)) {
        // For an archive day, only return data if we have an exact match —
        // we don't want to silently swap in an older snapshot.
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
          // No forecast cached for this zone but we have stations + maybe
          // weather — surface as a stations-only entry so the home grid
          // can render the muted tile and route the user into the detail
          // / stations sub-screens.
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
        if (cid && w.nacWeather) bundle.centerWeather[cid] = w.nacWeather;
        if (w.nwsForecast) bundle.zoneNwsForecasts[zoneId] = w.nwsForecast;
        if (cid && w.avgDiscussion) bundle.centerAvgDiscussions[cid] = w.avgDiscussion;
        if (w.avgLocations) bundle.zoneAvgLocations[zoneId] = w.avgLocations;
      }
      if (zones.length === 0 && stationsOnly.length === 0) return false;
      setSummary({ quickTake: "", zones, weatherHighlights: "", bottomLine: "" });
      setStationsOnlyZones(stationsOnly);
      setScrapedAt(snap.fetchedAt);
      setLoadSource("offline");
      setWeatherForecastData(bundle);
      if (resolvedDate && !targetDate) setViewedDate(resolvedDate);
      return true;
    },
    [],
  );

  // Toggle a zone's favorite status. Starring auto-adds to displayedZoneIds
  // (so the row appears in the tray); unstaring leaves the row in place as
  // an ad-hoc selection. Favorite ordering is kept in sync with display
  // ordering so the persisted list reads top-to-bottom the way the user
  // arranged it.
  const toggleFavorite = useCallback(
    (zoneId: string) => {
      setDisplayedZoneIds((prev) =>
        prev.includes(zoneId) ? prev : [...prev, zoneId],
      );
      setFavoriteZoneIds((prev) => {
        if (prev.includes(zoneId)) {
          const next = prev.filter((id) => id !== zoneId);
          saveFavorites(next).catch(() => {});
          return next;
        }
        // Insert and re-sort by current display order so favorites read in
        // the same order the user sees on screen.
        const display = displayedZoneIds.includes(zoneId)
          ? displayedZoneIds
          : [...displayedZoneIds, zoneId];
        const next = [...prev, zoneId].sort((a, b) => {
          const ai = display.indexOf(a);
          const bi = display.indexOf(b);
          return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
        });
        saveFavorites(next).catch(() => {});
        return next;
      });
    },
    [displayedZoneIds],
  );

  // Drag-reorder updates the visible order. Favorites preserve their
  // membership but their persisted order is rewritten to match.
  const reorderDisplayed = useCallback((nextOrder: string[]) => {
    setDisplayedZoneIds(nextOrder);
    setFavoriteZoneIds((prev) => {
      const favSet = new Set(prev);
      const next = nextOrder.filter((id) => favSet.has(id));
      saveFavorites(next).catch(() => {});
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  // × on a tray row: drop the zone from display AND favorites if it was
  // starred. The user can re-add it via the list/map pickers.
  const removeFromDisplayed = useCallback((zoneId: string) => {
    setDisplayedZoneIds((prev) => prev.filter((id) => id !== zoneId));
    setFavoriteZoneIds((prev) => {
      if (!prev.includes(zoneId)) return prev;
      const next = prev.filter((id) => id !== zoneId);
      saveFavorites(next).catch(() => {});
      return next;
    });
  }, []);

  // Persist any favorite-zone data into the offline snapshot whenever the
  // in-memory summary or weather bundle changes. Only favorites are written
  // — random one-off selections shouldn't bloat AsyncStorage. Each write
  // tags the bundle with `viewedDate` so back-scrolling can read it later.
  // Skip when the summary was just loaded FROM the snapshot — re-stamping
  // `fetchedAt` and `cachedAt` would falsify the freshness signal (banner
  // reads "0m ago" even though the underlying data is hours/days old).
  useEffect(() => {
    if (!summary || favoriteZoneIds.length === 0) return;
    if (loadSource === "offline") return;
    const favSet = new Set(favoriteZoneIds);
    (async () => {
      let next: FavoritesSnapshot =
        (await loadSnapshot()) || { fetchedAt: "", zones: {} };
      let touched = false;
      const nowIso = new Date().toISOString();
      for (const z of summary.zones) {
        if (!favSet.has(z.id)) continue;
        const centerId = ZONE_TO_CENTER[z.id];
        const wf = weatherForecastData
          ? {
              nacWeather: centerId
                ? weatherForecastData.centerWeather[centerId]
                : undefined,
              nwsForecast: weatherForecastData.zoneNwsForecasts[z.id],
              avgDiscussion: centerId
                ? weatherForecastData.centerAvgDiscussions[centerId]
                : undefined,
              avgLocations: weatherForecastData.zoneAvgLocations[z.id],
            }
          : undefined;
        const existing = next.zones[z.id]?.[viewedDate];
        next = {
          fetchedAt: nowIso,
          zones: {
            ...next.zones,
            [z.id]: {
              ...(next.zones[z.id] || {}),
              [viewedDate]: {
                forecast: z,
                stations: z.weatherObservations || existing?.stations,
                weather: wf || existing?.weather,
                cachedAt: nowIso,
              },
            },
          },
        };
        touched = true;
      }
      // Persist stations-only entries too — same date keying as the forecast
      // entries above so all of today's bundles share a row.
      for (const soz of stationsOnlyZones) {
        if (!favSet.has(soz.id)) continue;
        const centerId = soz.centerId || ZONE_TO_CENTER[soz.id];
        const wf = weatherForecastData
          ? {
              nacWeather: centerId
                ? weatherForecastData.centerWeather[centerId]
                : undefined,
              nwsForecast: weatherForecastData.zoneNwsForecasts[soz.id],
              avgDiscussion: centerId
                ? weatherForecastData.centerAvgDiscussions[centerId]
                : undefined,
              avgLocations: weatherForecastData.zoneAvgLocations[soz.id],
            }
          : undefined;
        const existing = next.zones[soz.id]?.[viewedDate];
        next = {
          fetchedAt: nowIso,
          zones: {
            ...next.zones,
            [soz.id]: {
              ...(next.zones[soz.id] || {}),
              [viewedDate]: {
                forecast: existing?.forecast,
                stations: soz.weatherObservations || existing?.stations,
                weather: wf || existing?.weather,
                cachedAt: nowIso,
              },
            },
          },
        };
        touched = true;
      }
      if (touched) {
        const pruned = pruneSnapshot(next, favoriteZoneIds);
        await saveSnapshot(pruned);
        setSnapshot(pruned);
      }
    })();
  }, [summary, stationsOnlyZones, weatherForecastData, favoriteZoneIds, viewedDate, loadSource]);

  // Fan every zone we have data for into the session-level in-memory
  // cache so the detail / sub-screens can find them — including ad-hoc
  // zones that aren't favorites and therefore aren't written to the
  // persistent offline snapshot.
  useEffect(() => {
    if (!summary && stationsOnlyZones.length === 0) return;
    const nowIso = new Date().toISOString();
    if (summary) {
      for (const z of summary.zones) {
        const cid = ZONE_TO_CENTER[z.id];
        const wf = weatherForecastData
          ? {
              nacWeather: cid
                ? weatherForecastData.centerWeather[cid]
                : undefined,
              nwsForecast: weatherForecastData.zoneNwsForecasts[z.id],
              avgDiscussion: cid
                ? weatherForecastData.centerAvgDiscussions[cid]
                : undefined,
              avgLocations: weatherForecastData.zoneAvgLocations[z.id],
            }
          : undefined;
        setZoneSession(z.id, {
          forecast: z,
          stations: z.weatherObservations,
          weather: wf,
          cachedAt: nowIso,
        });
      }
    }
    for (const soz of stationsOnlyZones) {
      const cid = soz.centerId || ZONE_TO_CENTER[soz.id];
      const wf = weatherForecastData
        ? {
            nacWeather: cid
              ? weatherForecastData.centerWeather[cid]
              : undefined,
            nwsForecast: weatherForecastData.zoneNwsForecasts[soz.id],
            avgDiscussion: cid
              ? weatherForecastData.centerAvgDiscussions[cid]
              : undefined,
            avgLocations: weatherForecastData.zoneAvgLocations[soz.id],
          }
        : undefined;
      setZoneSession(soz.id, {
        // Preserve any session forecast we may already have for this id;
        // stations-only response shouldn't erase a known forecast.
        stations: soz.weatherObservations,
        weather: wf,
        cachedAt: nowIso,
      });
    }
  }, [summary, stationsOnlyZones, weatherForecastData]);

  const fetchSnotel = useCallback(async (zoneIds: string[]) => {
    setIsSnotelLoading(true);
    try {
      const r = await avalancheApi.getSnotelObservations(zoneIds);
      if (r.success && r.observations) {
        setSummary((prev) =>
          prev
            ? {
                ...prev,
                zones: prev.zones.map((zone) => ({
                  ...zone,
                  weatherObservations:
                    r.observations?.[zone.id] || zone.weatherObservations,
                })),
              }
            : prev,
        );
      }
    } catch (err) {
      console.error("SNOTEL fetch error", err);
    } finally {
      setIsSnotelLoading(false);
    }
  }, []);

  const fetchWeatherForecast = useCallback(async (zoneIds: string[]) => {
    setIsWeatherForecastLoading(true);
    try {
      const r = await avalancheApi.getWeatherForecast(zoneIds);
      if (r.success) {
        setWeatherForecastData({
          centerWeather: r.centerWeather || {},
          zoneNwsForecasts: r.zoneNwsForecasts || {},
          centerAvgDiscussions: r.centerAvgDiscussions || {},
          zoneAvgLocations: r.zoneAvgLocations || {},
        });
      }
    } catch (err) {
      console.error("Weather forecast fetch error", err);
    } finally {
      setIsWeatherForecastLoading(false);
    }
  }, []);

  const getZoneWeatherForecast = useCallback(
    (zoneId: string): ZoneWeatherForecast | undefined => {
      if (!weatherForecastData) return undefined;
      const centerId = ZONE_TO_CENTER[zoneId];
      const nacWeather = centerId
        ? weatherForecastData.centerWeather[centerId]
        : undefined;
      const nwsForecast = weatherForecastData.zoneNwsForecasts[zoneId];
      const avgDiscussion = centerId
        ? weatherForecastData.centerAvgDiscussions[centerId]
        : undefined;
      const avgLocations = weatherForecastData.zoneAvgLocations[zoneId];
      if (!nacWeather && !nwsForecast && !avgDiscussion && !avgLocations) return undefined;
      return { nacWeather, nwsForecast, avgDiscussion, avgLocations };
    },
    [weatherForecastData],
  );

  const fetchSummary = useCallback(
    async (zoneIdsOverride?: string[], dateOverride?: string) => {
      const zoneIds = zoneIdsOverride ?? displayedZoneIds;
      const targetDate = dateOverride ?? viewedDate;
      const isToday = targetDate === todayIsoDate();
      if (zoneIds.length === 0) {
        Alert.alert(
          "No zones selected",
          "Please select at least one zone to view forecasts.",
        );
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    setIsLoading(true);
    setLoadSource(null);

    // Offline short-circuit: skip every network call and try the on-device
    // snapshot. The OFFLINE banner already explains the state to the user;
    // we don't want to surface a "Failed to fetch" alert on top of it.
    if (isOnline === false) {
      try {
        await loadFromSnapshot(targetDate);
      } catch (err) {
        console.warn("offline snapshot load failed", err);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      // 1) Try the server-side cache first — refreshed by cron every 1–2h.
      // This is the fast path: ~200ms instead of ~40s for live scraping.
      // Pin to a specific date when the user is browsing the archive.
      const cached = await avalancheApi.getCachedForecasts(
        zoneIds,
        isToday ? undefined : targetDate,
      );
      // The cache is "complete enough" if every requested zone is
      // accounted for either by a forecast row OR a stations-only row.
      // Stations-only zones still satisfy the request — the user wants
      // wx station data even when no avalanche forecast exists.
      const cachedHasAnyZones =
        (cached.zones && cached.zones.length > 0) ||
        (cached.stationsOnlyZones && cached.stationsOnlyZones.length > 0);
      if (
        cached.success &&
        cachedHasAnyZones &&
        (!cached.missingZoneIds || cached.missingZoneIds.length === 0)
      ) {
        // Hydrate the same shape we get from live scrape so the UI is identical.
        setSummary({
          quickTake: "",
          zones: cached.zones || [],
          weatherHighlights: "",
          bottomLine: "",
        });
        setStationsOnlyZones(cached.stationsOnlyZones || []);
        setScrapedAt(cached.forecastFetchedAt || cached.stationsFetchedAt || new Date().toISOString());
        setLoadSource("cached");
        if (cached.forecastDate) setViewedDate(cached.forecastDate);
        // Cache also includes the weather bundle — feed it straight in so the
        // outlook section renders without a second round-trip.
        setWeatherForecastData({
          centerWeather: cached.centerWeather || {},
          zoneNwsForecasts: cached.zoneNwsForecasts || {},
          centerAvgDiscussions: cached.centerAvgDiscussions || {},
          zoneAvgLocations: cached.zoneAvgLocations || {},
        });
        setIsLoading(false);
        return;
      }

      // For archive dates, fall through to offline cache rather than
      // attempting a live scrape — NAC's live API only ever returns the
      // current forecast, so there's no historical data to reach for.
      if (!isToday) {
        const ok = await loadFromSnapshot(targetDate);
        if (!ok) {
          // Clear the previous day's cards so the user sees the inline
          // "no forecast cached for this date yet" notice instead of stale
          // data from whatever they were just viewing.
          setSummary(null);
          setStationsOnlyZones([]);
          setWeatherForecastData(null);
          setScrapedAt(null);
          setLoadSource(null);
        }
        setIsLoading(false);
        return;
      }

      // 2) Fallback: live scrape, batched per center.
      const centerGroups = new Map<string, string[]>();
      for (const zoneId of zoneIds) {
        const info = AVAILABLE_ZONES.find((z) => z.id === zoneId);
        const centerId = info?.center || "UNKNOWN";
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
          batch.map(([centerId, zoneIds]) =>
            avalancheApi.getSummary(zoneIds).then((response) => ({ centerId, response })),
          ),
        );
        for (const { response } of results) {
          if (response.success && response.summary) {
            allZones.push(...response.summary.zones);
            if (response.zonesScraped) allZonesScraped.push(...response.zonesScraped);
            hasAnySuccess = true;
          }
        }
      }

      if (hasAnySuccess) {
        setSummary({
          quickTake: "",
          zones: allZones,
          weatherHighlights: "",
          bottomLine: "",
        });
        // Live scrape returns only zones with active forecasts; stations-only
        // entries come from the cached path.
        setStationsOnlyZones([]);
        setScrapedAt(new Date().toISOString());
        setZonesScraped(allZonesScraped);
        setLoadSource("live");
        fetchSnotel(zoneIds);
        fetchWeatherForecast(zoneIds);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        Alert.alert("Error", "Failed to fetch avalanche conditions.");
      }
    } catch (err) {
      console.error("Fetch error", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert("Error", "Failed to fetch avalanche conditions. Please try again.");
    } finally {
      setIsLoading(false);
    }
    },
    [displayedZoneIds, viewedDate, isOnline, fetchSnotel, fetchWeatherForecast, loadFromSnapshot],
  );

  // Auto-load favorites on first launch when prefs are ready and the user
  // has any starred zones. The cache read takes ~200ms so this is invisible.
  // Only fires once per session — pull-to-refresh / explicit fetches still work.
  // Waits for `isOnline` to be a known boolean so we route correctly: when
  // airplane-mode is detected we go straight to the offline snapshot
  // instead of firing a network call that's certain to fail.
  useEffect(() => {
    if (!prefsLoaded || autoLoadedRef.current) return;
    if (favoriteZoneIds.length === 0) return;
    if (isOnline === null) return;
    autoLoadedRef.current = true;
    // Offline at launch: skip fetchSummary (which pins to viewedDate =
    // today UTC) and call loadFromSnapshot() directly so we pick the
    // newest cached bundle per zone. fetchSummary's offline branch does
    // an exact-match lookup on today's UTC date — when the device's UTC
    // has rolled over since the last bg-wake, the snapshot is keyed
    // under yesterday UTC and the lookup silently returns nothing.
    // Skip if no snapshot was hydrated — loadFromSnapshot() with no
    // target date would otherwise pop a "No cached forecast" alert on
    // a fresh install opened offline.
    if (isOnline === false) {
      if (snapshot && Object.keys(snapshot.zones).length > 0) {
        loadFromSnapshot().catch(() => {});
      }
      return;
    }
    fetchSummary(favoriteZoneIds);
  }, [prefsLoaded, favoriteZoneIds, isOnline, fetchSummary, loadFromSnapshot, snapshot]);

  // Step viewedDate forward/back. The arrow handler does the fetch — keep
  // the boundary checks here so the press is a no-op rather than burying
  // logic inside the JSX.
  const stepDate = useCallback(
    (delta: number) => {
      const next = addDaysIso(viewedDate, delta);
      const today = todayIsoDate();
      if (next > today) return; // No future days
      // Maximum reach: 10 days back online, OFFLINE_HISTORY_DAYS back offline.
      const limitDays = isOnline === false ? OFFLINE_HISTORY_DAYS - 1 : ONLINE_HISTORY_DAYS - 1;
      const earliest = addDaysIso(today, -limitDays);
      if (next < earliest) return;
      Haptics.selectionAsync().catch(() => {});
      setViewedDate(next);
      fetchSummary(undefined, next);
    },
    [viewedDate, isOnline, fetchSummary],
  );

  const canStepBack = useMemo(() => {
    const today = todayIsoDate();
    const limitDays = isOnline === false ? OFFLINE_HISTORY_DAYS - 1 : ONLINE_HISTORY_DAYS - 1;
    return viewedDate > addDaysIso(today, -limitDays);
  }, [viewedDate, isOnline]);

  const canStepForward = viewedDate < todayStr;

  // Render only the currently-displayed zones (favorites + ad-hoc), in
  // display order. summary.zones may include zones from a previous fetch
  // that the user has since removed from the tray — filtering here drops
  // them without forcing a refetch.
  // Per-zone fetched-at lookup used by the home tiles. Tries the
  // currently-viewed date first; falls back to the newest snapshot
  // entry for that zone so a UTC-vs-local date mismatch doesn't hide
  // the freshness signal (the snapshot can be keyed under yesterday
  // UTC while viewedDate is today UTC).
  const cachedAtFor = useCallback(
    (zoneId: string): string | undefined => {
      const byDate = snapshot?.zones?.[zoneId];
      if (!byDate) return undefined;
      const exact = byDate[viewedDate]?.cachedAt;
      if (exact) return exact;
      const dates = Object.keys(byDate).sort();
      const latest = dates[dates.length - 1];
      return latest ? byDate[latest]?.cachedAt : undefined;
    },
    [snapshot, viewedDate],
  );

  const orderedZones = useMemo(() => {
    if (!summary?.zones) return [];
    const idx = new Map(displayedZoneIds.map((id, i) => [id, i]));
    return summary.zones
      .filter((z) => idx.has(z.id))
      .sort((a, b) => (idx.get(a.id) ?? Infinity) - (idx.get(b.id) ?? Infinity));
  }, [summary, displayedZoneIds]);

  // Stations-only rows — same filter / order rules as orderedZones.
  // Renders below the main grid so the user can monitor wx station info
  // year-round, even when no avalanche forecast is active.
  const orderedStationsOnly = useMemo(() => {
    if (stationsOnlyZones.length === 0) return [];
    const idx = new Map(displayedZoneIds.map((id, i) => [id, i]));
    return stationsOnlyZones
      .filter((z) => idx.has(z.id))
      .sort((a, b) => (idx.get(a.id) ?? Infinity) - (idx.get(b.id) ?? Infinity));
  }, [stationsOnlyZones, displayedZoneIds]);

  const favoriteSet = useMemo(
    () => new Set(favoriteZoneIds),
    [favoriteZoneIds],
  );

  if (!prefsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: palette.ink[950],
        }}
      >
        <ActivityIndicator size="large" color={palette.frost[400]} />
      </View>
    );
  }

  const isDefaultSelection =
    JSON.stringify([...displayedZoneIds].sort()) ===
    JSON.stringify([...DEFAULT_ZONE_IDS].sort());

  return (
    <View style={{ flex: 1, backgroundColor: palette.ink[950] }}>
      <PermissionsIntro
        visible={showOnboarding === true}
        onComplete={dismissOnboarding}
      />
      <TopoBackground height={320} intensity="low" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 64,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              // Re-fetch whichever zones are currently on screen, falling
              // back to the working selection if nothing's loaded yet.
              const ids = summary?.zones?.map((z) => z.id) ?? displayedZoneIds;
              fetchSummary(ids);
            }}
            tintColor={palette.frost[400]}
            colors={[palette.frost[400]]}
            progressBackgroundColor={palette.ink[800]}
          />
        }
      >
        {/* OFFLINE BANNER — appears the moment the network drops. If we have
            a cached snapshot for favorites, offer a one-tap load. */}
        {isOnline === false ? (
          <View
            style={{
              marginTop: 8,
              marginHorizontal: 16,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 12,
              borderWidth: 0.5,
              borderColor: snapshot && isStale(snapshot.fetchedAt)
                ? "#DC2626"
                : palette.aspen[500],
              backgroundColor: snapshot && isStale(snapshot.fetchedAt)
                ? "rgba(252, 165, 165, 0.10)"
                : palette.aspen[500] + "1A",
            }}
          >
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-row items-center gap-2 flex-1">
                <Ionicons
                  name="cloud-offline-outline"
                  size={16}
                  color={
                    snapshot && isStale(snapshot.fetchedAt)
                      ? "#DC2626"
                      : palette.aspen[400]
                  }
                />
                <View style={{ flex: 1 }}>
                  <Text
                    variant="mono"
                    weight="medium"
                    style={{
                      fontSize: 11,
                      letterSpacing: 1.4,
                      color:
                        snapshot && isStale(snapshot.fetchedAt)
                          ? "#DC2626"
                          : palette.aspen[400],
                    }}
                  >
                    {snapshot && isStale(snapshot.fetchedAt) ? "STALE" : "OFFLINE"}
                  </Text>
                  <Text
                    className="text-ink-200"
                    style={{ fontSize: 12, marginTop: 2 }}
                  >
                    {snapshot
                      ? `Cached ${formatAge(snapshot.fetchedAt)} · ${
                          Object.keys(snapshot.zones).length
                        } favorite${
                          Object.keys(snapshot.zones).length === 1 ? "" : "s"
                        }`
                      : "No cache available. Favorite zones to enable offline mode."}
                  </Text>
                </View>
              </View>
              {snapshot && Object.keys(snapshot.zones).length > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => loadFromSnapshot()}
                >
                  Load
                </Button>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Location-wake nudge — shows whenever the always-location
            background wake isn't running. Lets users who skipped the
            modal (or declined initially) enable it later without
            digging through Settings. Hides itself once registration
            completes. */}
        <LocationWakeBanner />

        {/* HEADER — wordmark + date pager on the top row, status meta
            (cached/live/offline + fetched time) on a small line below.
            Carries every bit of session-context the page needs in one
            block, so the area above the zone tiles is just header →
            MANAGE ZONES → tiles. */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 10,
            borderBottomWidth: 0.5,
            borderColor: palette.ink[500] + "AA",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Image
              source={require("@/assets/images/wordmark.png")}
              style={{ width: 18, height: 25 }}
              resizeMode="contain"
            />
            <Text
              variant="mono"
              weight="medium"
              className="text-frost-400"
              style={{ fontSize: 10, letterSpacing: 2 }}
            >
              AVY · COMPARISON
            </Text>
            <View style={{ flex: 1 }} />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Pressable
                onPress={() => stepDate(-1)}
                hitSlop={10}
                disabled={!canStepBack}
                style={{
                  paddingHorizontal: 4,
                  paddingVertical: 2,
                  opacity: canStepBack ? 1 : 0.25,
                }}
              >
                <Ionicons
                  name="chevron-back"
                  size={14}
                  color={palette.ink[200]}
                />
              </Pressable>
              <Text
                variant="mono"
                weight="medium"
                className="text-ink-200"
                style={{ fontSize: 11, letterSpacing: 1.4, minWidth: 110, textAlign: "center" }}
              >
                {isViewingToday
                  ? `${today.weekday.slice(0, 3)} · ${today.month.slice(0, 3)} ${today.day}`
                  : viewedDateLabel(viewedDate)}
              </Text>
              <Pressable
                onPress={() => stepDate(1)}
                hitSlop={10}
                disabled={!canStepForward}
                style={{
                  paddingHorizontal: 4,
                  paddingVertical: 2,
                  opacity: canStepForward ? 1 : 0.25,
                }}
              >
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={palette.ink[200]}
                />
              </Pressable>
            </View>
          </View>

          {/* Status meta — colored dot + source + fetched time,
              left-aligned under the wordmark. Plain text so it
              doesn't compete with anything tappable. */}
          {scrapedAt ? (
            <View
              style={{
                marginTop: 6,
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: !isViewingToday
                    ? palette.aspen[400]
                    : loadSource === "offline"
                      ? palette.aspen[400]
                      : "#52BA4A",
                }}
              />
              <Text
                variant="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: 1.2,
                  color: palette.ink[400],
                }}
              >
                {!isViewingToday
                  ? `ARCHIVE · ${formatDateLabel(viewedDate).toUpperCase()}`
                  : loadSource === "cached"
                    ? "CACHED"
                    : loadSource === "offline"
                      ? "OFFLINE"
                      : "LIVE"}
                {" · "}
                {new Date(scrapedAt)
                  .toLocaleString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                  .toUpperCase()}
              </Text>
              {isSnotelLoading || isWeatherForecastLoading ? (
                <Text
                  variant="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: 1.2,
                    color: palette.aspen[400],
                  }}
                >
                  · {isSnotelLoading ? "STATIONS…" : "WEATHER…"}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* Push diagnostic — shown only when registration didn't
              succeed. Tap to retry. Helps debug TestFlight builds
              where there's no console access. */}
          <PushDiagnosticLine />
        </View>

        {/* MANAGE ZONES — tile-style pane matching the zone tiles +
            sub-tiles. Bold 2px outline on a raised surface, with a
            press-to-toggle header that says exactly what it does
            ("Manage zones" + "tap to expand/collapse"). */}
        <View style={{ paddingHorizontal: 16 }}>
          <View
            style={{
              backgroundColor: palette.ink[800],
              borderWidth: 2,
              borderColor: palette.ink[700],
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setPickerOpen((v) => !v);
              }}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  gap: 10,
                }}
              >
                <Ionicons
                  name="list"
                  size={20}
                  color={palette.aspen[400]}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    variant="mono"
                    weight="bold"
                    style={{
                      fontSize: 11,
                      letterSpacing: 1.4,
                      color: palette.aspen[400],
                    }}
                  >
                    MANAGE ZONES
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      lineHeight: 16,
                      color: palette.ink[300],
                      marginTop: 2,
                    }}
                  >
                    {favoriteZoneIds.length} favorite
                    {favoriteZoneIds.length === 1 ? "" : "s"}
                    {displayedZoneIds.length !== favoriteZoneIds.length
                      ? ` · ${displayedZoneIds.length} on screen`
                      : ""}
                    {" · tap to "}
                    {pickerOpen ? "collapse" : "add or reorder"}
                  </Text>
                </View>
                <Ionicons
                  name={pickerOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={palette.ink[300]}
                />
              </View>
            </Pressable>
            {!pickerOpen ? null : (
            <View
              style={{
                paddingHorizontal: 16,
                paddingBottom: 16,
                borderTopWidth: 0.5,
                borderColor: palette.ink[500] + "AA",
              }}
            >
              {/* Unified zone tray — favorites + ad-hoc rows in one drag-
                  reorderable list. Filled star = persists across launches,
                  outline star = session-only. × removes the row entirely. */}
              {displayedZoneIds.length > 0 ? (
                <View style={{ marginBottom: 12 }}>
                  <FavoritesReorder
                    displayedZoneIds={displayedZoneIds}
                    favoriteIds={favoriteSet}
                    onReorder={reorderDisplayed}
                    onToggleFavorite={toggleFavorite}
                    onRemove={removeFromDisplayed}
                  />
                  <Text
                    variant="mono"
                    className="text-ink-400"
                    style={{
                      fontSize: 9,
                      letterSpacing: 1.4,
                      marginTop: 6,
                      paddingHorizontal: 4,
                    }}
                  >
                    LONG-PRESS A ROW TO REORDER
                  </Text>

                  {/* Sync notice — explains the favorites benefit. Shown
                      whenever the tray has rows so users at every stage
                      (just starred their first zone, or already curated a
                      list) see the value of the star. */}
                  <View
                    style={{
                      marginTop: 10,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      borderWidth: 0.5,
                      borderColor: palette.aspen[500] + "66",
                      backgroundColor: palette.aspen[500] + "12",
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <Ionicons
                      name="star"
                      size={14}
                      color={palette.aspen[400]}
                      style={{ marginTop: 1 }}
                    />
                    <Text
                      className="text-ink-200 flex-1"
                      style={{ fontSize: 11, lineHeight: 16 }}
                    >
                      Star a zone to favorite it. Favorites auto-load on
                      launch and stay current in the background while you
                      have service{" "}
                      <Text
                        variant="mono"
                        className="text-ink-400"
                        style={{ fontSize: 10, letterSpacing: 0.6 }}
                      >
                        (best-effort, OS-scheduled)
                      </Text>
                      . Always force-refreshes when you open the app online.
                    </Text>
                  </View>
                </View>
              ) : (
                <View
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    borderWidth: 0.5,
                    borderColor: palette.aspen[500] + "66",
                    backgroundColor: palette.aspen[500] + "12",
                    marginBottom: 12,
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <Ionicons
                    name="star-outline"
                    size={16}
                    color={palette.aspen[400]}
                    style={{ marginTop: 1 }}
                  />
                  <Text
                    className="text-ink-200 flex-1"
                    style={{ fontSize: 13, lineHeight: 19 }}
                  >
                    Star a zone to favorite it. Favorites auto-load on
                    launch, and avy + wx info stays current in the background
                    even with the app closed{" "}
                    <Text
                      variant="mono"
                      className="text-ink-400"
                      style={{ fontSize: 11, letterSpacing: 0.6 }}
                    >
                      (syncs every 1–2 hrs)
                    </Text>
                    .
                  </Text>
                </View>
              )}

              {/* Browse zones — picks land in the tray above as session rows.
                  Tap the star on any tray row to make it persist. */}
              <Text
                variant="mono"
                weight="medium"
                className="text-ink-400"
                style={{ fontSize: 10, letterSpacing: 1.6, marginBottom: 8 }}
              >
                BROWSE & ADD ZONES
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setCompareOpen((v) => !v);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    borderWidth: 0.5,
                    borderColor: compareOpen ? palette.frost[400] : palette.ink[600],
                    backgroundColor: compareOpen
                      ? palette.frost[400] + "1A"
                      : "transparent",
                  }}
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons
                      name="list-outline"
                      size={14}
                      color={compareOpen ? palette.frost[400] : palette.ink[200]}
                    />
                    <Text
                      variant="mono"
                      weight="medium"
                      style={{
                        fontSize: 11,
                        letterSpacing: 1.4,
                        color: compareOpen ? palette.frost[400] : palette.ink[200],
                      }}
                    >
                      PICK FROM LIST
                    </Text>
                  </View>
                  <Text
                    className="text-ink-400"
                    style={{ fontSize: 11, marginTop: 3 }}
                  >
                    Compare zones from any center
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    mapBaselineIdsRef.current = displayedZoneIds;
                    setMapModalOpen(true);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    borderWidth: 0.5,
                    borderColor: palette.ink[600],
                  }}
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons
                      name="map-outline"
                      size={14}
                      color={palette.ink[200]}
                    />
                    <Text
                      variant="mono"
                      weight="medium"
                      className="text-ink-200"
                      style={{ fontSize: 11, letterSpacing: 1.4 }}
                    >
                      PICK ON MAP
                    </Text>
                  </View>
                  <Text
                    className="text-ink-400"
                    style={{ fontSize: 11, marginTop: 3 }}
                  >
                    Find by location
                  </Text>
                </Pressable>
              </View>

              {/* COMPARE — collapsed by default. The hierarchical selector +
                  the explicit Get-conditions button live in here so the
                  zone-picker chrome only appears when the user wants it. */}
              {compareOpen ? (
                <View style={{ marginTop: 18 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <Text
                      variant="mono"
                      weight="medium"
                      className="text-frost-400"
                      style={{ fontSize: 11, letterSpacing: 1.6 }}
                    >
                      PICK MULTIPLE
                    </Text>
                    <Text
                      variant="mono"
                      className="text-ink-300"
                      style={{ fontSize: 11, letterSpacing: 1.2 }}
                    >
                      {displayedZoneIds.length} SEL.
                    </Text>
                  </View>
                  <HierarchicalZoneSelector
                    selectedZoneIds={displayedZoneIds}
                    onSelectionChange={updateDisplayedZones}
                    favoriteZoneIds={favoriteZoneIds}
                    onFavoriteToggle={toggleFavorite}
                  />
                  <View
                    className="flex-row gap-2 mt-3"
                    style={{ justifyContent: "flex-end" }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => updateDisplayedZones([])}
                      disabled={displayedZoneIds.length === 0}
                    >
                      Clear
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => updateDisplayedZones(DEFAULT_ZONE_IDS)}
                      disabled={isDefaultSelection}
                    >
                      Reset
                    </Button>
                  </View>
                  <Button
                    onPress={() => {
                      fetchSummary();
                      setCompareOpen(false);
                    }}
                    disabled={isLoading || displayedZoneIds.length === 0}
                    loading={isLoading}
                    size="lg"
                    className="w-full mt-3"
                    leftIcon={
                      <Ionicons name="snow" size={16} color={palette.ink[950]} />
                    }
                  >
                    {isLoading
                      ? "Loading…"
                      : `View ${displayedZoneIds.length} zone${displayedZoneIds.length === 1 ? "" : "s"}`}
                  </Button>
                </View>
              ) : null}
            </View>
            )}
          </View>
        </View>

        {/* Status meta now lives in the header. */}

        {/* RESULTS */}
        {summary ? (
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* DETAILS */}
            {summary.zones.length > 0 ? (
              <View style={{ marginTop: 28 }}>
                <View
                  style={{
                    paddingHorizontal: 24,
                    flexDirection: "row",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    marginBottom: 14,
                  }}
                >
                  <Text
                    variant="display"
                    className="text-ink-50"
                    style={{ fontSize: 38, lineHeight: 42 }}
                  >
                    Zones
                  </Text>
                  <Text
                    variant="mono"
                    weight="medium"
                    className="text-ink-300"
                    style={{ fontSize: 13, letterSpacing: 1.4 }}
                  >
                    {summary.zones.length}
                  </Text>
                </View>
                {/* 2-column grid of zone tiles. Tap → /zone/[zoneId]
                    detail. Pairs render side by side; an odd number of
                    favorites still aligns left because the spacer fills
                    the right column at the tail. */}
                <View
                  style={{
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  {orderedZones.map((zone) => (
                    <View
                      key={zone.id}
                      style={{
                        width: "48.5%",
                        flexShrink: 0,
                      }}
                    >
                      <ZoneTile
                        zone={zone}
                        viewedDate={viewedDate}
                        cachedAt={cachedAtFor(zone.id)}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* STATIONS-ONLY ROWS — favorited zones with no current avalanche
                forecast but live wx station data still flowing through the
                cron. Muted treatment, same layout grid. */}
            {orderedStationsOnly.length > 0 ? (
              <View style={{ marginTop: 24 }}>
                <View
                  style={{
                    paddingHorizontal: 24,
                    flexDirection: "row",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    marginBottom: 14,
                  }}
                >
                  <Text
                    variant="mono"
                    weight="medium"
                    className="text-ink-300"
                    style={{ fontSize: 11, letterSpacing: 1.6 }}
                  >
                    STATIONS ONLY · NO CURRENT FORECAST
                  </Text>
                  <Text
                    variant="mono"
                    weight="medium"
                    className="text-ink-400"
                    style={{ fontSize: 13, letterSpacing: 1.4 }}
                  >
                    {orderedStationsOnly.length}
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  {orderedStationsOnly.map((soz) => (
                    <View
                      key={soz.id}
                      style={{ width: "48.5%", flexShrink: 0 }}
                    >
                      <StationsOnlyTile
                        zoneId={soz.id}
                        centerId={soz.centerId}
                        stations={soz.weatherObservations}
                        viewedDate={viewedDate}
                        cachedAt={cachedAtFor(soz.id)}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* SOURCES */}
            <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
              <Collapsible
                title={
                  <Text
                    variant="mono"
                    weight="medium"
                    className="text-ink-200"
                    style={{ fontSize: 11, letterSpacing: 1.6 }}
                  >
                    SOURCES · FRESHNESS
                  </Text>
                }
              >
                <View className="gap-2.5">
                  {zonesScraped.map((zone) => {
                    const f = freshness[zone.freshness.status];
                    return (
                      <View
                        key={zone.id}
                        className="flex-row items-center justify-between"
                        style={{
                          paddingVertical: 6,
                          gap: 10,
                        }}
                      >
                        <View className="flex-1">
                          <Text
                            className="text-ink-100"
                            style={{ fontSize: 13 }}
                            numberOfLines={1}
                          >
                            {zone.name}
                          </Text>
                          <Text
                            variant="mono"
                            className="text-ink-400"
                            style={{ fontSize: 9, letterSpacing: 1.2 }}
                          >
                            {zone.center}
                          </Text>
                        </View>
                        {zone.success ? (
                          <Badge fill={f.fill} ink={f.ink}>
                            {f.label}
                          </Badge>
                        ) : (
                          <Badge variant="danger">FAILED</Badge>
                        )}
                      </View>
                    );
                  })}
                </View>

                <View
                  style={{
                    marginTop: 14,
                    paddingTop: 14,
                    borderTopWidth: 0.5,
                    borderColor: palette.ink[700],
                    gap: 8,
                  }}
                >
                  <Text
                    variant="mono"
                    weight="medium"
                    className="text-ink-400 mb-1"
                    style={{ fontSize: 9, letterSpacing: 1.6 }}
                  >
                    UPSTREAM
                  </Text>
                  <SourceLink
                    label="National Avalanche Center"
                    note="Forecasts · ratings"
                    url="https://avalanche.org/"
                  />
                  <SourceLink
                    label="NOAA / NWS"
                    note="Mountain weather"
                    url="https://www.weather.gov/"
                  />
                  <SourceLink
                    label="Synoptic · MesoWest"
                    note="Station observations"
                    url="https://synopticdata.com/"
                  />
                  <SourceLink
                    label="Utah Avalanche Center"
                    note="UAC direct API"
                    url="https://utahavalanchecenter.org/"
                  />
                </View>
              </Collapsible>
            </View>

            {/* DISCLAIMER */}
            <View
              style={{
                marginTop: 22,
                marginHorizontal: 16,
                padding: 18,
                borderRadius: 16,
                borderWidth: 0.5,
                borderColor: palette.ink[700],
                backgroundColor: palette.ink[900],
              }}
            >
              <Text
                variant="mono"
                weight="medium"
                className="text-aspen-400"
                style={{ fontSize: 10, letterSpacing: 1.8, marginBottom: 6 }}
              >
                READ THIS
              </Text>
              <Text
                className="text-ink-200"
                style={{ fontSize: 13, lineHeight: 20 }}
              >
                Always read the original forecasts from your local avalanche
                center before making travel decisions. This app repackages
                publicly-available avalanche and weather data — it does not
                replace the source forecast.
              </Text>
            </View>
          </Animated.View>
        ) : null}

        {/* EMPTY STATE — two flavors. Archive day with no cached data
            shows a contextual notice with a "back to today" shortcut.
            Otherwise shows the original "ready when you are" placeholder. */}
        {!summary && !isLoading ? (
          !isViewingToday ? (
            <View
              style={{
                marginTop: 32,
                marginHorizontal: 16,
                padding: 24,
                borderRadius: 18,
                borderWidth: 0.5,
                borderColor: palette.aspen[500],
                backgroundColor: palette.aspen[500] + "10",
                alignItems: "center",
              }}
            >
              <Ionicons
                name="archive-outline"
                size={28}
                color={palette.aspen[400]}
                style={{ marginBottom: 10 }}
              />
              <Text
                variant="display"
                className="text-ink-50 text-center"
                style={{ fontSize: 20, lineHeight: 26 }}
              >
                No forecast for {viewedDateLabel(viewedDate)}.
              </Text>
              <Text
                className="text-ink-300 text-center mt-2"
                style={{ fontSize: 13, lineHeight: 19, maxWidth: 300 }}
              >
                The archive only fills going forward — nothing was cached
                before the cron started running for these zones.
              </Text>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setViewedDate(todayStr);
                  fetchSummary(undefined, todayStr);
                }}
                hitSlop={10}
                style={({ pressed }) => ({
                  marginTop: 18,
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 999,
                  backgroundColor: pressed
                    ? palette.frost[500]
                    : palette.frost[400],
                })}
              >
                <Text
                  variant="mono"
                  weight="medium"
                  style={{
                    fontSize: 11,
                    letterSpacing: 1.4,
                    color: palette.ink[950],
                  }}
                >
                  BACK TO TODAY
                </Text>
              </Pressable>
            </View>
          ) : (
            <View
              style={{
                marginTop: 32,
                marginHorizontal: 16,
                padding: 28,
                borderRadius: 18,
                borderWidth: 0.5,
                borderColor: palette.ink[700],
                backgroundColor: palette.ink[900],
                alignItems: "center",
              }}
            >
              <Image
                source={require("@/assets/images/wordmark.png")}
                style={{ width: 64, height: 91, marginBottom: 14, opacity: 0.9 }}
                resizeMode="contain"
              />
              <Text
                variant="display"
                className="text-ink-50 text-center"
                style={{ fontSize: 22, lineHeight: 28 }}
              >
                Ready when you are.
              </Text>
              <Text
                className="text-ink-300 text-center mt-2"
                style={{ fontSize: 14, lineHeight: 21, maxWidth: 280 }}
              >
                Confirm your zones above, then tap{" "}
                <Text variant="mono" weight="medium" className="text-ink-100">
                  Get current conditions
                </Text>
                .
              </Text>
            </View>
          )
        ) : null}

        {/* CREDITS / ABOUT FOOTER — mirrors the web app's footer. Always
            rendered (regardless of whether forecasts are loaded) so the
            attribution and contact info is reachable. */}
        <View
          style={{
            marginTop: 28,
            marginHorizontal: 16,
            paddingTop: 22,
            paddingBottom: 4,
            borderTopWidth: 0.5,
            borderColor: palette.ink[700],
          }}
        >
          {/* Synoptic shoutout */}
          <View style={{ alignItems: "center" }}>
            <Text
              variant="mono"
              weight="medium"
              className="text-ink-400"
              style={{ fontSize: 10, letterSpacing: 1.8, marginBottom: 8 }}
            >
              MADE POSSIBLE IN PART BY
            </Text>
            <Text
              variant="display"
              className="text-ink-100"
              style={{ fontSize: 22, lineHeight: 26, marginBottom: 12 }}
            >
              Synoptic
            </Text>
            <Text
              className="text-ink-300 text-center"
              style={{ fontSize: 12, lineHeight: 17, paddingHorizontal: 8 }}
            >
              If your organization finds this tool useful and would like to
              help cover weather station data costs,{" "}
              <Text
                onPress={() =>
                  Linking.openURL(
                    "mailto:kaimyers@alaskapacific.edu?subject=Avy%20Comparison%20-%20Sponsorship",
                  )
                }
                style={{
                  color: palette.frost[400],
                  textDecorationLine: "underline",
                }}
              >
                please reach out
              </Text>
              .
            </Text>
          </View>

          {/* About */}
          <View
            style={{
              marginTop: 24,
              paddingTop: 22,
              borderTopWidth: 0.5,
              borderColor: palette.ink[700],
              alignItems: "center",
            }}
          >
            <Text
              variant="display"
              className="text-ink-50"
              style={{ fontSize: 22, lineHeight: 26, marginBottom: 12 }}
            >
              About
            </Text>
            <Text
              className="text-ink-300 text-center"
              style={{
                fontSize: 12,
                lineHeight: 18,
                paddingHorizontal: 4,
                marginBottom: 14,
              }}
            >
              Built by Kai Myers, a former ski patroller and current graduate
              student with a deep appreciation for snowpack and the people who
              venture into the mountains. This tool was created to make it
              easier to compare avalanche forecasts and weather data across
              multiple regions at a glance — even if you don&apos;t remember
              to check before you leave service. If you have questions,
              feedback, or ideas, feel free to reach out at{" "}
              <Text
                onPress={() =>
                  Linking.openURL("mailto:kaimyers@alaskapacific.edu")
                }
                style={{
                  color: palette.frost[400],
                  textDecorationLine: "underline",
                }}
              >
                kaimyers@alaskapacific.edu
              </Text>
              .
            </Text>

            {/* K.AI Consulting card — two distinct tap targets (white card
                with the logo, and the link row beneath) so the logo's tap
                doesn't get lost in the shadow + nested-View layout the way
                a single outer Pressable sometimes does on iOS. Both fire
                the same kaiconsulting.ai open. */}
            <Pressable
              onPress={() => Linking.openURL("https://kaiconsulting.ai")}
              hitSlop={8}
              style={({ pressed }) => ({
                marginTop: 6,
                alignItems: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Image
                source={require("@/assets/images/kai-consulting-logo.png")}
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: 16,
                }}
                resizeMode="contain"
              />
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL("https://kaiconsulting.ai")}
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                marginTop: 10,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                className="text-frost-400"
                style={{
                  fontSize: 12,
                  lineHeight: 17,
                  textDecorationLine: "underline",
                }}
              >
                kaiconsulting.ai
              </Text>
              <Ionicons
                name="arrow-forward"
                size={11}
                color={palette.frost[400]}
                style={{ transform: [{ rotate: "-45deg" }] }}
              />
            </Pressable>

            <Text
              variant="mono"
              className="text-ink-500 text-center"
              style={{
                fontSize: 9,
                letterSpacing: 1.2,
                lineHeight: 14,
                marginTop: 22,
              }}
            >
              © 2026 AVY COMPARISON{"\n"}
              DATA FROM NATIONAL AVALANCHE CENTER, NOAA/NWS, SYNOPTIC
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={mapModalOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          // System back gesture / hardware back: revert any unsaved picks
          // so the user doesn't accidentally commit by dismissing.
          updateDisplayedZones(mapBaselineIdsRef.current);
          setMapModalOpen(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: palette.ink[950] }}>
          {/* Two-row header: a compact eyebrow up top, then a row with
              CANCEL on the left and the View Zones primary button on the
              right. Two rows guarantee the button never gets pushed off
              by the title or by long zone counts. */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: insets.top + 10,
              paddingBottom: 12,
              borderBottomWidth: 0.5,
              borderColor: palette.ink[700],
              gap: 8,
            }}
          >
            <Text
              variant="mono"
              weight="medium"
              className="text-frost-400"
              style={{
                fontSize: 10,
                letterSpacing: 2,
                textAlign: "center",
              }}
            >
              MAP · ZONES
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  updateDisplayedZones(mapBaselineIdsRef.current);
                  setMapModalOpen(false);
                }}
                hitSlop={10}
                style={{
                  paddingVertical: 8,
                  paddingRight: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Ionicons
                  name="chevron-back"
                  size={16}
                  color={palette.ink[200]}
                />
                <Text
                  variant="mono"
                  weight="medium"
                  className="text-ink-200"
                  style={{ fontSize: 12, letterSpacing: 1.4 }}
                >
                  CANCEL
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (displayedZoneIds.length === 0) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                    () => {},
                  );
                  setMapModalOpen(false);
                  fetchSummary(displayedZoneIds);
                }}
                hitSlop={10}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor:
                    displayedZoneIds.length === 0
                      ? palette.ink[700]
                      : palette.frost[400],
                  opacity: displayedZoneIds.length === 0 ? 0.7 : 1,
                }}
              >
                <Text
                  variant="mono"
                  weight="medium"
                  style={{
                    fontSize: 12,
                    letterSpacing: 1.4,
                    color:
                      displayedZoneIds.length === 0
                        ? palette.ink[200]
                        : palette.ink[950],
                  }}
                >
                  {displayedZoneIds.length === 0
                    ? "PICK A ZONE"
                    : `VIEW ${displayedZoneIds.length} ZONE${displayedZoneIds.length === 1 ? "" : "S"}`}
                </Text>
              </Pressable>
            </View>
          </View>

          <ZoneMapPicker
            selectedZoneIds={displayedZoneIds}
            onSelectionChange={updateDisplayedZones}
          />
        </View>
      </Modal>
    </View>
  );
}

// Two-line diagnostic stack:
//   1. Push registration outcome (when not ok) — tap to retry
//   2. Last device-side BG refresh time + source — always shown when
//      the device has ever woken in the background, gives hard proof
//      the silent-push / BGTaskScheduler path is firing.
// The displayed "CACHED · HH:MM" in the header above is the SERVER's
// forecast cache time; this line is the DEVICE's wake time. Different
// signals — both useful.
function PushDiagnosticLine() {
  const [diag, setDiag] = useState<PushDiagnostic | null>(null);
  const [lastRefresh, setLastRefresh] = useState<LastRefreshRecord | null>(null);
  const reload = useCallback(() => {
    readPushDiagnostic().then(setDiag);
    readLastRefresh().then(setLastRefresh);
  }, []);
  useEffect(() => {
    reload();
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [reload]);

  // Hide the line for "ok" (registered successfully) and for the
  // soft "skipped-offline" state (network was unreachable, retries
  // automatically next launch). Only surface real errors that need
  // user action.
  const showPush =
    diag && diag.step !== "ok" && diag.step !== "skipped-offline";
  if (!showPush && !lastRefresh) return null;

  const onTap = async () => {
    Haptics.selectionAsync().catch(() => {});
    await requestAndRegister();
    reload();
  };

  return (
    <View style={{ marginTop: 6, gap: 4 }}>
      {showPush ? (
        <Pressable
          onPress={onTap}
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor:
                diag!.step === "permission-denied"
                  ? palette.aspen[400]
                  : "#DC2626",
            }}
          />
          <Text
            variant="mono"
            style={{
              fontSize: 10,
              letterSpacing: 1.2,
              color:
                diag!.step === "permission-denied"
                  ? palette.aspen[400]
                  : "#DC2626",
            }}
          >
            PUSH · {diag!.step.toUpperCase()}
            {diag!.message ? ` · ${diag!.message.slice(0, 60)}` : ""}
          </Text>
          <Text
            variant="mono"
            style={{
              fontSize: 10,
              letterSpacing: 1.2,
              color: palette.ink[400],
            }}
          >
            · TAP TO RETRY
          </Text>
        </Pressable>
      ) : null}
      {lastRefresh ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: palette.frost[500],
            }}
          />
          <Text
            variant="mono"
            style={{
              fontSize: 10,
              letterSpacing: 1.2,
              color: palette.ink[400],
            }}
          >
            BG WAKE ·{" "}
            {new Date(lastRefresh.at)
              .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
              .toUpperCase()}{" "}
            VIA {lastRefresh.source.toUpperCase()}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// Inline nudge to enable Always Location after onboarding has been
// completed. The onboarding modal only fires once per install (gated
// by an AsyncStorage flag), so users who declined location during
// onboarding — or upgraded from a build that didn't ask — would have
// no path to enable it short of digging through Settings. This banner
// auto-hides once the diagnostic reports "ok".
function LocationWakeBanner() {
  const [diag, setDiag] = useState<LocationDiagnostic | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    readLocationDiagnostic().then(setDiag);
  }, []);

  useEffect(() => {
    reload();
    // Re-check periodically so the banner disappears the moment
    // registration completes (e.g., right after the user grants
    // permission via the Settings → app → Location escalation).
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [reload]);

  if (!diag || diag.step === "ok") return null;

  const onTap = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await requestAndRegisterLocationWake();
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={onTap}
      disabled={busy}
      style={({ pressed }) => ({
        marginTop: 8,
        marginHorizontal: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 0.5,
        borderColor: palette.frost[500],
        backgroundColor: pressed
          ? palette.frost[500] + "26"
          : palette.frost[500] + "1A",
        opacity: busy ? 0.6 : 1,
      })}
    >
      <View className="flex-row items-center gap-2">
        <Ionicons
          name="location-outline"
          size={16}
          color={palette.frost[400]}
        />
        <View style={{ flex: 1 }}>
          <Text
            variant="mono"
            weight="bold"
            style={{
              fontSize: 11,
              letterSpacing: 1.4,
              color: palette.frost[400],
            }}
          >
            BACKGROUND REFRESH LIMITED
          </Text>
          <Text
            className="text-ink-200"
            style={{ fontSize: 12, lineHeight: 16, marginTop: 2 }}
          >
            Tap to enable Always Location — the only iOS hook that keeps
            data fresh after you force-quit the app.
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={palette.frost[400]}
        />
      </View>
    </Pressable>
  );
}

function SourceLink({
  label,
  note,
  url,
}: {
  label: string;
  note: string;
  url: string;
}) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      className="flex-row items-center justify-between"
      hitSlop={6}
    >
      <Text className="text-ink-200" style={{ fontSize: 13 }}>
        {label}
      </Text>
      <View className="flex-row items-center gap-2">
        <Text
          variant="mono"
          className="text-ink-400"
          style={{ fontSize: 10, letterSpacing: 1 }}
        >
          {note}
        </Text>
        <Ionicons
          name="arrow-forward"
          size={11}
          color={palette.ink[400]}
          style={{ transform: [{ rotate: "-45deg" }] }}
        />
      </View>
    </Pressable>
  );
}

