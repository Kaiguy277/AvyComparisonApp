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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import NetInfo from "@react-native-community/netinfo";
import {
  ageHours,
  formatAge,
  isStale,
  loadFavorites,
  loadSnapshot,
  saveFavorites,
  saveSnapshot,
  type FavoritesSnapshot,
} from "@/lib/offlineCache";

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
import { HierarchicalZoneSelector } from "@/components/avalanche/HierarchicalZoneSelector";
import { ZoneMapPicker } from "@/components/avalanche/ZoneMapPicker";
import { ZoneCard } from "@/components/avalanche/ZoneCard";
import { ZoneComparisonMatrix } from "@/components/avalanche/ZoneComparisonMatrix";
import { TopoBackground } from "@/components/visual/TopoBackground";
import { freshness, palette } from "@/constants/design";
import {
  avalancheApi,
  type AvalancheSummary,
  type AvalancheZone,
  type AvgDiscussion,
  type AvgLocation,
  type NacWeatherProduct,
  type NwsForecast,
  type ScrapedZoneInfo,
  type ZoneWeatherForecast,
} from "@/lib/api/avalanche";
import { AVAILABLE_ZONES, DEFAULT_ZONE_IDS, ZONE_TO_CENTER } from "@/lib/zones";

const ZONE_PREFS_KEY = "avalanche-zone-selection";

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

  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>(DEFAULT_ZONE_IDS);
  const [favoriteZoneIds, setFavoriteZoneIds] = useState<string[]>([]);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSnotelLoading, setIsSnotelLoading] = useState(false);
  const [isWeatherForecastLoading, setIsWeatherForecastLoading] = useState(false);

  const [summary, setSummary] = useState<AvalancheSummary | null>(null);
  const [scrapedAt, setScrapedAt] = useState<string | null>(null);
  const [zonesScraped, setZonesScraped] = useState<ScrapedZoneInfo[]>([]);
  const [loadSource, setLoadSource] = useState<"cached" | "live" | "offline" | null>(null);
  const [weatherForecastData, setWeatherForecastData] =
    useState<WeatherForecastBundle | null>(null);

  // Offline cache state — keeps the last-known-good bundle for favorite zones
  // available even when the phone has no service.
  const [snapshot, setSnapshot] = useState<FavoritesSnapshot | null>(null);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const lastBgFetchRef = useRef<number>(0);

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

  // Load saved prefs + offline snapshot
  useEffect(() => {
    (async () => {
      try {
        const [savedZones, favs, snap] = await Promise.all([
          AsyncStorage.getItem(ZONE_PREFS_KEY),
          loadFavorites(),
          loadSnapshot(),
        ]);
        if (savedZones) {
          const parsed = JSON.parse(savedZones);
          if (Array.isArray(parsed)) {
            const valid = parsed.filter((id: string) =>
              AVAILABLE_ZONES.some((z) => z.id === id),
            );
            setSelectedZoneIds(valid);
          }
        }
        setFavoriteZoneIds(favs);
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
    lastBgFetchRef.current = now;
    try {
      const groups = new Map<string, string[]>();
      for (const id of favoriteZoneIds) {
        const info = AVAILABLE_ZONES.find((z) => z.id === id);
        const c = info?.center || "UNKNOWN";
        if (!groups.has(c)) groups.set(c, []);
        groups.get(c)!.push(id);
      }
      const allZones: AvalancheZone[] = [];
      for (const [, zoneIds] of groups) {
        const r = await avalancheApi.getSummary(zoneIds);
        if (r.success && r.summary) allZones.push(...r.summary.zones);
      }
      const [snotelR, weatherR] = await Promise.all([
        avalancheApi.getSnotelObservations(favoriteZoneIds),
        avalancheApi.getWeatherForecast(favoriteZoneIds),
      ]);
      // Merge SNOTEL into the zone records before persisting.
      const stationMap = snotelR.observations || {};
      for (const z of allZones) {
        if (stationMap[z.id]) z.weatherObservations = stationMap[z.id];
      }
      const next: FavoritesSnapshot =
        (await loadSnapshot()) || { fetchedAt: "", zones: {} };
      const favSet = new Set(favoriteZoneIds);
      for (const z of allZones) {
        if (!favSet.has(z.id)) continue;
        const cid = ZONE_TO_CENTER[z.id];
        next.zones[z.id] = {
          forecast: z,
          stations: z.weatherObservations,
          weather: weatherR.success
            ? {
                nacWeather: cid ? weatherR.centerWeather?.[cid] : undefined,
                nwsForecast: weatherR.zoneNwsForecasts?.[z.id],
                avgDiscussion: cid ? weatherR.centerAvgDiscussions?.[cid] : undefined,
                avgLocations: weatherR.zoneAvgLocations?.[z.id],
              }
            : undefined,
          cachedAt: new Date().toISOString(),
        };
      }
      next.fetchedAt = new Date().toISOString();
      await saveSnapshot(next);
      setSnapshot(next);
      console.log(`[bg-refresh] cached ${allZones.length} favorite zones`);
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

  const updateSelectedZones = useCallback((zoneIds: string[]) => {
    setSelectedZoneIds(zoneIds);
    AsyncStorage.setItem(ZONE_PREFS_KEY, JSON.stringify(zoneIds)).catch(() => {});
  }, []);

  // Hydrate the screen state from the offline snapshot — used by the
  // OFFLINE banner's "Load" button so a backcountry user without service
  // can still see their last-known forecast + station data.
  const loadFromSnapshot = useCallback(async () => {
    const snap = await loadSnapshot();
    if (!snap || Object.keys(snap.zones).length === 0) {
      Alert.alert(
        "No cached forecast",
        "Add favorites and fetch a forecast while online to enable offline mode.",
      );
      return;
    }
    const zones = Object.values(snap.zones).map((s) => s.forecast);
    setSummary({
      quickTake: "",
      zones,
      weatherHighlights: "",
      bottomLine: "",
    });
    setScrapedAt(snap.fetchedAt);
    setLoadSource("offline");
    // Build the weather forecast bundle from the cached per-zone weather
    const bundle: WeatherForecastBundle = {
      centerWeather: {},
      zoneNwsForecasts: {},
      centerAvgDiscussions: {},
      zoneAvgLocations: {},
    };
    for (const [zoneId, snapZone] of Object.entries(snap.zones)) {
      const cid = ZONE_TO_CENTER[zoneId];
      const w = snapZone.weather;
      if (!w) continue;
      if (cid && w.nacWeather) bundle.centerWeather[cid] = w.nacWeather;
      if (w.nwsForecast) bundle.zoneNwsForecasts[zoneId] = w.nwsForecast;
      if (cid && w.avgDiscussion) bundle.centerAvgDiscussions[cid] = w.avgDiscussion;
      if (w.avgLocations) bundle.zoneAvgLocations[zoneId] = w.avgLocations;
    }
    setWeatherForecastData(bundle);
  }, []);

  const toggleFavorite = useCallback(
    (zoneId: string) => {
      setFavoriteZoneIds((prev) => {
        const next = prev.includes(zoneId)
          ? prev.filter((id) => id !== zoneId)
          : [...prev, zoneId];
        saveFavorites(next).catch(() => {});
        return next;
      });
    },
    [],
  );

  // Persist any favorite-zone data into the offline snapshot whenever the
  // in-memory summary or weather bundle changes. Only favorites are written
  // — random one-off selections shouldn't bloat AsyncStorage.
  useEffect(() => {
    if (!summary || favoriteZoneIds.length === 0) return;
    const favSet = new Set(favoriteZoneIds);
    (async () => {
      const next: FavoritesSnapshot =
        (await loadSnapshot()) || { fetchedAt: "", zones: {} };
      let touched = false;
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
        next.zones[z.id] = {
          forecast: z,
          stations: z.weatherObservations || next.zones[z.id]?.stations,
          weather: wf || next.zones[z.id]?.weather,
          cachedAt: new Date().toISOString(),
        };
        touched = true;
      }
      if (touched) {
        next.fetchedAt = new Date().toISOString();
        await saveSnapshot(next);
        setSnapshot(next);
      }
    })();
  }, [summary, weatherForecastData, favoriteZoneIds]);

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

  const fetchSummary = useCallback(async () => {
    if (selectedZoneIds.length === 0) {
      Alert.alert(
        "No zones selected",
        "Please select at least one zone to view forecasts.",
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    setIsLoading(true);
    setLoadSource(null);

    try {
      // Group selected zones by center, then batch the per-center scrapes so
      // we don't blast a single edge function call with all zones.
      const centerGroups = new Map<string, string[]>();
      for (const zoneId of selectedZoneIds) {
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
        setScrapedAt(new Date().toISOString());
        setZonesScraped(allZonesScraped);
        setLoadSource("live");
        fetchSnotel(selectedZoneIds);
        fetchWeatherForecast(selectedZoneIds);
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
  }, [selectedZoneIds, fetchSnotel, fetchWeatherForecast]);

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
    JSON.stringify([...selectedZoneIds].sort()) ===
    JSON.stringify([...DEFAULT_ZONE_IDS].sort());

  return (
    <View style={{ flex: 1, backgroundColor: palette.ink[950] }}>
      <TopoBackground height={580} intensity="low" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 64,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchSummary}
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
                ? "#FCA5A5"
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
                      ? "#FCA5A5"
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
                          ? "#FCA5A5"
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

        {/* HERO */}
        <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 }}>
          <View className="flex-row items-center gap-2.5 mb-4">
            <Image
              source={require("@/assets/images/wordmark.png")}
              style={{ width: 22, height: 31 }}
              resizeMode="contain"
            />
            <Text
              variant="mono"
              weight="medium"
              className="text-frost-400"
              style={{ fontSize: 11, letterSpacing: 2.4 }}
            >
              AVY · COMPARISON
            </Text>
            <View style={{ flex: 1 }} />
            <Text
              variant="mono"
              className="text-ink-400"
              style={{ fontSize: 11, letterSpacing: 1.6 }}
            >
              {today.weekday}
            </Text>
          </View>

          <View className="flex-row items-baseline gap-3 mb-2">
            <Text
              variant="mono"
              weight="bold"
              className="text-ink-50"
              style={{ fontSize: 56, lineHeight: 60, letterSpacing: -1 }}
            >
              {today.day}
            </Text>
            <View>
              <Text
                variant="mono"
                weight="medium"
                className="text-ink-200"
                style={{ fontSize: 11, letterSpacing: 2.4 }}
              >
                {today.month}
              </Text>
              <Text
                variant="mono"
                className="text-ink-400"
                style={{ fontSize: 11, letterSpacing: 2.4 }}
              >
                {today.year}
              </Text>
            </View>
          </View>

          <Text
            variant="display"
            className="text-ink-50"
            style={{
              fontSize: 56,
              lineHeight: 60,
              letterSpacing: -1.5,
              marginTop: 14,
            }}
          >
            Conditions
          </Text>

          <View
            style={{
              height: 0.5,
              backgroundColor: palette.ink[700],
              marginTop: 18,
            }}
          />
        </View>

        {/* ZONE PICKER */}
        <View style={{ paddingHorizontal: 16 }}>
          <Card>
            <CardHeader>
              <View className="flex-row items-baseline justify-between">
                <CardEyebrow>ZONES</CardEyebrow>
                <Text
                  variant="mono"
                  weight="medium"
                  className="text-ink-100"
                  style={{ fontSize: 12, letterSpacing: 1.4 }}
                >
                  {selectedZoneIds.length} / {AVAILABLE_ZONES.length}
                </Text>
              </View>
            </CardHeader>
            <CardContent>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setMapModalOpen(true);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 14,
                  borderWidth: 0.5,
                  borderColor: palette.frost[600],
                  backgroundColor: palette.frost[400] + "12",
                  marginBottom: 14,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Ionicons name="map-outline" size={18} color={palette.frost[400]} />
                  <View>
                    <Text
                      variant="mono"
                      weight="medium"
                      className="text-frost-400"
                      style={{ fontSize: 11, letterSpacing: 1.6 }}
                    >
                      OPEN MAP
                    </Text>
                    <Text
                      className="text-ink-300"
                      style={{ fontSize: 12, marginTop: 2 }}
                    >
                      Tap zones colored by today's danger.
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={palette.frost[400]}
                  style={{ transform: [{ rotate: "-45deg" }] }}
                />
              </Pressable>

              <HierarchicalZoneSelector
                selectedZoneIds={selectedZoneIds}
                onSelectionChange={updateSelectedZones}
                favoriteZoneIds={favoriteZoneIds}
                onFavoriteToggle={toggleFavorite}
              />
              <View
                className="flex-row gap-2 mt-4"
                style={{ justifyContent: "flex-end" }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => updateSelectedZones([])}
                  disabled={selectedZoneIds.length === 0}
                >
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => updateSelectedZones(DEFAULT_ZONE_IDS)}
                  disabled={isDefaultSelection}
                >
                  Reset
                </Button>
              </View>
            </CardContent>
          </Card>
        </View>

        {/* ACTION */}
        <View
          style={{
            paddingHorizontal: 16,
            marginTop: 18,
            alignItems: "center",
            gap: 14,
          }}
        >
          <Button
            onPress={fetchSummary}
            disabled={isLoading}
            loading={isLoading}
            size="lg"
            className="w-full"
            leftIcon={
              <Ionicons
                name="snow"
                size={16}
                color={palette.ink[950]}
              />
            }
          >
            {isLoading ? "Loading…" : "Get current conditions"}
          </Button>
        </View>

        {/* STATUS BAR */}
        {scrapedAt ? (
          <View
            style={{
              marginTop: 24,
              marginHorizontal: 16,
              paddingVertical: 14,
              paddingHorizontal: 18,
              borderRadius: 14,
              backgroundColor: palette.ink[900],
              borderWidth: 0.5,
              borderColor: palette.ink[700],
            }}
            className="flex-row items-center justify-between flex-wrap gap-2"
          >
            <View className="flex-row items-center gap-2.5">
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: palette.frost[400],
                }}
              />
              <Text
                variant="mono"
                weight="medium"
                className="text-ink-100"
                style={{ fontSize: 13, letterSpacing: 1.2 }}
              >
                {new Date(scrapedAt)
                  .toLocaleString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    month: "short",
                    day: "numeric",
                  })
                  .toUpperCase()}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              {loadSource === "cached" ? (
                <Badge variant="frost">Cached</Badge>
              ) : (
                <Badge variant="aspen">Live</Badge>
              )}
              {isSnotelLoading ? <Badge variant="subtle">stations…</Badge> : null}
              {isWeatherForecastLoading ? <Badge variant="subtle">weather…</Badge> : null}
            </View>
          </View>
        ) : null}

        {/* RESULTS */}
        {summary ? (
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* MATRIX */}
            {summary.zones.length > 0 ? (
              <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
                <ZoneComparisonMatrix zones={summary.zones} />
              </View>
            ) : null}

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
                <View style={{ paddingHorizontal: 16, gap: 14 }}>
                  {summary.zones.map((zone) => (
                    <ZoneCard
                      key={zone.id}
                      zone={zone}
                      isSnotelLoading={isSnotelLoading}
                      isWeatherForecastLoading={isWeatherForecastLoading}
                      weatherForecast={getZoneWeatherForecast(zone.id)}
                    />
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
                Always read the original forecasts from your local avalanche center
                before making travel decisions. This app summarizes — it does not
                replace.
              </Text>
            </View>
          </Animated.View>
        ) : null}

        {/* EMPTY STATE */}
        {!summary && !isLoading ? (
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
        ) : null}
      </ScrollView>

      <Modal
        visible={mapModalOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setMapModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: palette.ink[950] }}>
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: insets.top + 12,
              paddingBottom: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottomWidth: 0.5,
              borderColor: palette.ink[700],
            }}
          >
            <View>
              <Text
                variant="mono"
                weight="medium"
                className="text-frost-400"
                style={{ fontSize: 10, letterSpacing: 2 }}
              >
                MAP · ZONES
              </Text>
              <Text
                variant="display"
                className="text-ink-50"
                style={{ fontSize: 26, lineHeight: 30, marginTop: 2 }}
              >
                Pick on map
              </Text>
            </View>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setMapModalOpen(false);
              }}
              hitSlop={10}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: 999,
                backgroundColor: palette.ink[50],
              }}
            >
              <Text
                variant="mono"
                weight="medium"
                style={{
                  fontSize: 11,
                  letterSpacing: 1.6,
                  color: palette.ink[950],
                }}
              >
                DONE
              </Text>
            </Pressable>
          </View>

          <ZoneMapPicker
            selectedZoneIds={selectedZoneIds}
            onSelectionChange={updateSelectedZones}
          />
        </View>
      </Modal>
    </View>
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

