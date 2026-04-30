import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Collapsible } from "@/components/ui/Collapsible";
import { HierarchicalZoneSelector } from "@/components/avalanche/HierarchicalZoneSelector";
import { ZoneCard } from "@/components/avalanche/ZoneCard";
import { ZoneComparisonMatrix } from "@/components/avalanche/ZoneComparisonMatrix";
import { freshnessConfig } from "@/components/avalanche/dangerColors";
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

export default function Index() {
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>(DEFAULT_ZONE_IDS);
  const [quickTakeEnabled, setQuickTakeEnabled] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSnotelLoading, setIsSnotelLoading] = useState(false);
  const [isQuickTakeLoading, setIsQuickTakeLoading] = useState(false);
  const [isWeatherForecastLoading, setIsWeatherForecastLoading] = useState(false);

  const [summary, setSummary] = useState<AvalancheSummary | null>(null);
  const [scrapedAt, setScrapedAt] = useState<string | null>(null);
  const [zonesScraped, setZonesScraped] = useState<ScrapedZoneInfo[]>([]);
  const [loadSource, setLoadSource] = useState<"cached" | "live" | null>(null);
  const [weatherForecastData, setWeatherForecastData] = useState<WeatherForecastBundle | null>(
    null,
  );

  const quickTakeEnabledRef = useRef(quickTakeEnabled);
  quickTakeEnabledRef.current = quickTakeEnabled;

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
      Alert.alert("No zones selected", "Please select at least one zone to view forecasts.");
      return;
    }

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
        Alert.alert("Error", "Failed to fetch avalanche conditions.");
      }
    } catch (err) {
      console.error("Fetch error", err);
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
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const isDefaultSelection =
    JSON.stringify([...selectedZoneIds].sort()) ===
    JSON.stringify([...DEFAULT_ZONE_IDS].sort());

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingBottom: 48 }}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={fetchSummary}
          tintColor="#0d9488"
        />
      }
    >
      {/* Hero */}
      <View className="px-4 pt-6 pb-4 bg-sky-50">
        <View className="self-center bg-primary/10 rounded-full px-3 py-1 mb-3 flex-row items-center gap-2">
          <Ionicons name="triangle-outline" size={14} color="#0d9488" />
          <Text className="text-sm font-medium text-primary">Backcountry</Text>
        </View>
        <Text className="text-3xl font-bold text-foreground text-center">
          Avalanche Conditions
        </Text>
        <Text className="text-base text-muted-foreground text-center mt-2">
          Forecasts, weather outlooks, and station data side by side.
        </Text>
      </View>

      {/* Zone selector */}
      <View className="px-4 mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Select Forecast Zones</CardTitle>
            <CardDescription>
              {selectedZoneIds.length} of {AVAILABLE_ZONES.length} zones selected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HierarchicalZoneSelector
              selectedZoneIds={selectedZoneIds}
              onSelectionChange={updateSelectedZones}
            />
            <View className="flex-row justify-end gap-2 mt-3">
              <Button
                variant="outline"
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

      {/* Action */}
      <View className="px-4 mt-4 items-center gap-3">
        <Button
          onPress={fetchSummary}
          disabled={isLoading}
          loading={isLoading}
          size="lg"
          leftIcon={<Ionicons name="snow" size={18} color="white" />}
        >
          {isLoading ? "Fetching..." : "Get Current Conditions"}
        </Button>
        <Pressable
          onPress={() => toggleQuickTake(!quickTakeEnabled)}
          className="flex-row items-center gap-2"
        >
          <Checkbox
            checked={quickTakeEnabled}
            onChange={() => toggleQuickTake(!quickTakeEnabled)}
          />
          <Text className="text-sm text-muted-foreground">Include AI Quick Take</Text>
        </Pressable>
      </View>

      {/* Status badges */}
      {scrapedAt ? (
        <View className="px-4 mt-3 flex-row flex-wrap items-center justify-center gap-2">
          <Text className="text-xs text-muted-foreground">
            Updated: {new Date(scrapedAt).toLocaleString()}
          </Text>
          {loadSource === "cached" ? <Badge variant="outline">Cached</Badge> : null}
          {isSnotelLoading ? (
            <Badge variant="secondary">Loading stations…</Badge>
          ) : null}
          {isWeatherForecastLoading ? (
            <Badge variant="secondary">Loading weather…</Badge>
          ) : null}
        </View>
      ) : null}

      {/* Quick take */}
      {summary && quickTakeEnabled && (isQuickTakeLoading || summary.quickTake) ? (
        <View className="px-4 mt-6">
          <Card className="border-primary/30">
            <CardHeader>
              <View className="flex-row items-center gap-2">
                <Ionicons name="information-circle-outline" size={20} color="#0d9488" />
                <CardTitle>Quick Take</CardTitle>
                <Badge variant="outline">AI</Badge>
              </View>
            </CardHeader>
            <CardContent>
              {isQuickTakeLoading ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" />
                  <Text className="text-sm text-muted-foreground">
                    Generating Quick Take for {summary.zones.length} zone
                    {summary.zones.length !== 1 ? "s" : ""}…
                  </Text>
                </View>
              ) : (
                <Text className="text-base text-foreground leading-6">
                  {summary.quickTake}
                </Text>
              )}
            </CardContent>
          </Card>
        </View>
      ) : null}

      {/* Comparison matrix */}
      {summary && summary.zones.length > 0 ? (
        <View className="px-4 mt-6">
          <ZoneComparisonMatrix zones={summary.zones} />
        </View>
      ) : null}

      {/* Zone details */}
      {summary && summary.zones.length > 0 ? (
        <View className="px-4 mt-6 gap-4">
          <Text className="text-xl font-bold text-foreground">Zone Details</Text>
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
      ) : null}

      {/* Sources */}
      {summary ? (
        <View className="px-4 mt-6">
          <Collapsible title="Data Sources & Freshness">
            <View className="gap-2">
              {zonesScraped.map((zone) => {
                const f = freshnessConfig[zone.freshness.status];
                return (
                  <View
                    key={zone.id}
                    className="flex-row items-center justify-between py-1"
                  >
                    <Text className="text-sm text-foreground flex-1" numberOfLines={2}>
                      {zone.name}{" "}
                      <Text className="text-muted-foreground">({zone.center})</Text>
                    </Text>
                    {zone.success ? (
                      <Badge variant="outline" textClassName={f.color}>
                        {f.label}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Failed</Badge>
                    )}
                  </View>
                );
              })}
              <View className="pt-3 mt-3 border-t border-border gap-2">
                <Text className="text-xs font-semibold text-foreground">Data Sources</Text>
                <SourceLink
                  label="National Avalanche Center API"
                  description="Avalanche forecasts & danger ratings"
                  url="https://avalanche.org/"
                />
                <SourceLink
                  label="NOAA National Weather Service"
                  description="Mountain weather forecasts"
                  url="https://www.weather.gov/"
                />
                <SourceLink
                  label="Synoptic Data (MesoWest)"
                  description="Weather station observations"
                  url="https://synopticdata.com/"
                />
                <SourceLink
                  label="Utah Avalanche Center"
                  description="UAC forecasts (direct API)"
                  url="https://utahavalanchecenter.org/"
                />
              </View>
            </View>
          </Collapsible>
        </View>
      ) : null}

      {summary ? (
        <View className="px-4 mt-6 p-4 rounded-lg border border-border bg-muted/40">
          <Text className="text-sm text-muted-foreground">
            Data sourced from the National Avalanche Center, NOAA/NWS, and the Synoptic
            weather station network. Always read the original forecasts from your local
            avalanche center before making travel decisions.
          </Text>
          {quickTakeEnabled && summary.quickTake ? (
            <Text className="text-xs text-muted-foreground mt-2">
              The "Quick Take" summary is generated by AI based on the forecast data above.
            </Text>
          ) : null}
        </View>
      ) : null}

      {!summary && !isLoading ? (
        <View className="items-center mt-12 px-4">
          <Ionicons name="triangle-outline" size={64} color="#cbd5e1" />
          <Text className="text-muted-foreground text-center mt-3">
            Select your zones and tap "Get Current Conditions" to fetch the latest forecasts.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function SourceLink({
  label,
  description,
  url,
}: {
  label: string;
  description: string;
  url: string;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Pressable
        onPress={() => Linking.openURL(url)}
        className="flex-row items-center gap-1 flex-1"
      >
        <Text className="text-sm text-primary" numberOfLines={1}>
          {label}
        </Text>
        <Ionicons name="open-outline" size={12} color="#0d9488" />
      </Pressable>
      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
        {description}
      </Text>
    </View>
  );
}
