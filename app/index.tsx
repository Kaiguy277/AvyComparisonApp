import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

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
const QUICK_TAKE_KEY = "avalanche-quick-take-enabled";

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
  const [quickTakeEnabled, setQuickTakeEnabled] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [pickerMode, setPickerMode] = useState<"list" | "map">("list");

  const [isLoading, setIsLoading] = useState(false);
  const [isSnotelLoading, setIsSnotelLoading] = useState(false);
  const [isQuickTakeLoading, setIsQuickTakeLoading] = useState(false);
  const [isWeatherForecastLoading, setIsWeatherForecastLoading] = useState(false);

  const [summary, setSummary] = useState<AvalancheSummary | null>(null);
  const [scrapedAt, setScrapedAt] = useState<string | null>(null);
  const [zonesScraped, setZonesScraped] = useState<ScrapedZoneInfo[]>([]);
  const [loadSource, setLoadSource] = useState<"cached" | "live" | null>(null);
  const [weatherForecastData, setWeatherForecastData] =
    useState<WeatherForecastBundle | null>(null);

  const quickTakeEnabledRef = useRef(quickTakeEnabled);
  quickTakeEnabledRef.current = quickTakeEnabled;

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

  // Load saved prefs
  useEffect(() => {
    (async () => {
      try {
        const [savedZones, savedQuickTake] = await Promise.all([
          AsyncStorage.getItem(ZONE_PREFS_KEY),
          AsyncStorage.getItem(QUICK_TAKE_KEY),
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
        if (savedQuickTake !== null) {
          setQuickTakeEnabled(savedQuickTake === "true");
        }
      } catch (err) {
        console.warn("Failed to load preferences", err);
      } finally {
        setPrefsLoaded(true);
      }
    })();
  }, []);

  const updateSelectedZones = useCallback((zoneIds: string[]) => {
    setSelectedZoneIds(zoneIds);
    AsyncStorage.setItem(ZONE_PREFS_KEY, JSON.stringify(zoneIds)).catch(() => {});
  }, []);

  const toggleQuickTake = useCallback((enabled: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    setQuickTakeEnabled(enabled);
    AsyncStorage.setItem(QUICK_TAKE_KEY, String(enabled)).catch(() => {});
  }, []);

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

  const generateQuickTake = useCallback(async (zones: AvalancheZone[]) => {
    if (!quickTakeEnabledRef.current || zones.length === 0) return;
    setIsQuickTakeLoading(true);
    try {
      const enriched = zones.map((z) => ({
        ...z,
        centerId: ZONE_TO_CENTER[z.id] || "unknown",
      }));
      const r = await avalancheApi.generateQuickTake(enriched);
      if (r.success && r.quickTake) {
        setSummary((prev) =>
          prev
            ? {
                ...prev,
                quickTake: r.quickTake || prev.quickTake,
                weatherHighlights: r.weatherHighlights || prev.weatherHighlights,
              }
            : prev,
        );
      }
    } catch (err) {
      console.error("Quick Take error", err);
    } finally {
      setIsQuickTakeLoading(false);
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
      const cached = await avalancheApi.getCachedForecasts(selectedZoneIds);
      const hasMissingZones = !!cached.missingZoneIds?.length;
      const hasMissingSummaries = !!cached.missingSummaryCenterIds?.length;

      if (
        cached.success &&
        cached.zones &&
        cached.zones.length > 0 &&
        !hasMissingZones &&
        !hasMissingSummaries
      ) {
        setSummary({
          quickTake: "",
          zones: cached.zones,
          weatherHighlights: "",
          bottomLine: "",
        });
        setScrapedAt(new Date().toISOString());
        setLoadSource("cached");
        setIsLoading(false);
        fetchSnotel(selectedZoneIds);
        fetchWeatherForecast(selectedZoneIds);
        generateQuickTake(cached.zones);
        return;
      }

      const missingZoneIds =
        cached.missingZoneIds && cached.missingZoneIds.length > 0
          ? cached.missingZoneIds
          : selectedZoneIds;

      const centerGroups = new Map<string, string[]>();
      for (const zoneId of missingZoneIds) {
        const info = AVAILABLE_ZONES.find((z) => z.id === zoneId);
        const centerId = info?.center || "UNKNOWN";
        if (!centerGroups.has(centerId)) centerGroups.set(centerId, []);
        centerGroups.get(centerId)!.push(zoneId);
      }

      const BATCH_SIZE = 4;
      const entries = Array.from(centerGroups.entries());
      const allZones: AvalancheZone[] = cached.zones || [];
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
        generateQuickTake(allZones);
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
  }, [
    selectedZoneIds,
    fetchSnotel,
    fetchWeatherForecast,
    generateQuickTake,
  ]);

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
              <SegmentedToggle
                value={pickerMode}
                onChange={setPickerMode}
                options={[
                  { value: "list", label: "LIST" },
                  { value: "map", label: "MAP" },
                ]}
              />
              <View style={{ marginTop: 14 }}>
                {pickerMode === "list" ? (
                  <HierarchicalZoneSelector
                    selectedZoneIds={selectedZoneIds}
                    onSelectionChange={updateSelectedZones}
                  />
                ) : (
                  <ZoneMapPicker
                    selectedZoneIds={selectedZoneIds}
                    onSelectionChange={updateSelectedZones}
                  />
                )}
              </View>
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
          <Pressable
            onPress={() => toggleQuickTake(!quickTakeEnabled)}
            className="flex-row items-center gap-2.5"
            hitSlop={6}
          >
            <Checkbox
              checked={quickTakeEnabled}
              onChange={() => toggleQuickTake(!quickTakeEnabled)}
              size="sm"
            />
            <Text
              variant="mono"
              weight="medium"
              className="text-ink-300"
              style={{ fontSize: 11, letterSpacing: 1.4 }}
            >
              INCLUDE AI QUICK TAKE
            </Text>
          </Pressable>
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
            {/* QUICK TAKE — full-bleed editorial moment */}
            {quickTakeEnabled && (isQuickTakeLoading || summary.quickTake) ? (
              <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
                <View
                  style={{
                    borderRadius: 18,
                    backgroundColor: palette.ink[900],
                    paddingHorizontal: 22,
                    paddingTop: 22,
                    paddingBottom: 22,
                    borderWidth: 0.5,
                    borderColor: palette.frost[600],
                    overflow: "hidden",
                  }}
                >
                  <View className="flex-row items-baseline justify-between">
                    <View className="flex-row items-baseline gap-2">
                      <Text
                        variant="mono"
                        weight="medium"
                        className="text-frost-400"
                        style={{ fontSize: 10, letterSpacing: 2.4 }}
                      >
                        QUICK TAKE
                      </Text>
                      <Text
                        variant="mono"
                        className="text-ink-400"
                        style={{ fontSize: 9, letterSpacing: 1.4 }}
                      >
                        AI
                      </Text>
                    </View>
                    <Text
                      variant="mono"
                      className="text-ink-400"
                      style={{ fontSize: 9, letterSpacing: 1.4 }}
                    >
                      {summary.zones.length} ZONE{summary.zones.length !== 1 ? "S" : ""}
                    </Text>
                  </View>
                  {isQuickTakeLoading ? (
                    <View className="flex-row items-center gap-2 mt-3">
                      <ActivityIndicator size="small" color={palette.ink[300]} />
                      <Text
                        variant="mono"
                        className="text-ink-300"
                        style={{ fontSize: 11, letterSpacing: 1.2 }}
                      >
                        SYNTHESIZING…
                      </Text>
                    </View>
                  ) : (
                    <Text
                      variant="display"
                      className="text-ink-50 mt-3"
                      style={{ fontSize: 26, lineHeight: 34 }}
                    >
                      {summary.quickTake}
                    </Text>
                  )}
                </View>
              </View>
            ) : null}

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
              {quickTakeEnabled && summary.quickTake ? (
                <Text
                  className="text-ink-400 mt-2"
                  style={{ fontSize: 11, lineHeight: 17 }}
                >
                  Quick Take is generated by AI from the forecasts above.
                </Text>
              ) : null}
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

function SegmentedToggle<V extends string>({
  value,
  onChange,
  options,
}: {
  value: V;
  onChange: (v: V) => void;
  options: { value: V; label: string }[];
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        padding: 3,
        borderRadius: 999,
        backgroundColor: palette.ink[800],
        borderWidth: 0.5,
        borderColor: palette.ink[700],
      }}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(opt.value);
            }}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 999,
              backgroundColor: active ? palette.ink[50] : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              variant="mono"
              weight="medium"
              style={{
                fontSize: 11,
                letterSpacing: 1.6,
                color: active ? palette.ink[950] : palette.ink[300],
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
