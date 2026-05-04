import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/Text";
import { MountainDanger } from "@/components/avalanche/MountainDanger";
import { dangerColors, freshness, palette } from "@/constants/design";
import {
  ageHours,
  formatAge,
  getZoneSnapshotForDate,
  loadSnapshot,
  type FavoritesSnapshot,
  type ZoneSnapshot,
} from "@/lib/offlineCache";
import type {
  AvalancheZone,
  DangerRating,
  ElevationDanger,
} from "@/lib/api/avalanche";

const RATING_ORDER: DangerRating[] = [
  "NO_RATING",
  "LOW",
  "MODERATE",
  "CONSIDERABLE",
  "HIGH",
  "EXTREME",
];

function highest(d: ElevationDanger): DangerRating {
  return [d.alpine, d.treeline, d.belowTreeline].reduce((b, c) =>
    RATING_ORDER.indexOf(c) > RATING_ORDER.indexOf(b) ? c : b,
  );
}

function startCase(s: string): string {
  if (!s) return s;
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function freshnessColor(status: keyof typeof freshness): string {
  if (status === "expired") return "#FCA5A5";
  if (status === "expiring") return palette.aspen[400];
  if (status === "recent") return palette.frost[400];
  if (status === "unknown") return palette.ink[400];
  return "#52BA4A";
}

function ageColor(iso: string | undefined): string {
  const h = ageHours(iso);
  if (h === null) return palette.ink[400];
  if (h > 12) return "#FCA5A5";
  if (h > 3) return palette.aspen[400];
  return palette.ink[300];
}

export default function ZoneDetailScreen() {
  const insets = useSafeAreaInsets();
  const { zoneId } = useLocalSearchParams<{ zoneId: string }>();
  const router = useRouter();

  const [snap, setSnap] = useState<FavoritesSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    loadSnapshot().then((s) => {
      setSnap(s);
      setLoaded(true);
    });
  }, []);

  const bundle = snap ? getZoneSnapshotForDate(snap, zoneId) : undefined;
  const zone: AvalancheZone | undefined = bundle?.forecast;
  const today = zone?.forecast?.[0];
  const tomorrow = zone?.forecast?.[1];
  const fresh = zone ? freshness[zone.freshness.status] : null;
  const fetchedAt = bundle?.cachedAt ?? snap?.fetchedAt;

  const navigateTo = (suffix: string) => {
    Haptics.selectionAsync().catch(() => {});
    router.push({
      pathname: `/zone/[zoneId]/${suffix}` as never,
      params: { zoneId },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.ink[950] }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderBottomWidth: 0.5,
          borderColor: palette.ink[700],
        }}
      >
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.back();
          }}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={palette.ink[100]} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            variant="display"
            className="text-ink-50"
            style={{ fontSize: 20, lineHeight: 22 }}
            numberOfLines={2}
          >
            {zone?.name ?? "Zone"}
          </Text>
          {zone?.author ? (
            <Text
              variant="mono"
              className="text-ink-400"
              style={{ fontSize: 10, letterSpacing: 1.2, marginTop: 2 }}
            >
              BY {zone.author.toUpperCase()}
            </Text>
          ) : null}
        </View>
        {/* Freshness moved into the strip below the header so it sits
            next to issued/expires/fetched with shared context. */}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {!loaded ? (
          <View style={{ padding: 20 }}>
            <Text
              variant="mono"
              className="text-ink-400"
              style={{ fontSize: 11, letterSpacing: 1.4 }}
            >
              LOADING…
            </Text>
          </View>
        ) : !zone || !today ? (
          <View style={{ padding: 20 }}>
            <Text
              variant="display"
              className="text-ink-100"
              style={{ fontSize: 18, marginBottom: 8 }}
            >
              Forecast not cached yet
            </Text>
            <Text
              className="text-ink-300"
              style={{ fontSize: 14, lineHeight: 20 }}
            >
              Open this zone from the home grid while online to fetch and cache its forecast.
            </Text>
          </View>
        ) : (
          <>
            {/* FRESHNESS STRIP — sits right at the top, framing the
                pyramids with the issued / expires / fetched signal so
                the user always knows how trustworthy the read is. */}
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 4,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 14,
                alignItems: "baseline",
              }}
            >
              <Text
                variant="mono"
                weight="bold"
                style={{
                  fontSize: 11,
                  letterSpacing: 1.4,
                  color: freshnessColor(zone.freshness.status),
                }}
              >
                {fresh ? fresh.label.toUpperCase() : "—"}
              </Text>
              {zone.freshness.issueDate ? (
                <Text
                  variant="mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: 0.8,
                    color: palette.ink[400],
                  }}
                >
                  ISSUED{" "}
                  <Text style={{ fontSize: 11, color: palette.ink[200] }}>
                    {zone.freshness.issueDate}
                  </Text>
                </Text>
              ) : null}
              {zone.freshness.expiresDate ? (
                <Text
                  variant="mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: 0.8,
                    color: palette.ink[400],
                  }}
                >
                  EXPIRES{" "}
                  <Text
                    style={{
                      fontSize: 11,
                      color:
                        zone.freshness.status === "expired"
                          ? "#FCA5A5"
                          : zone.freshness.status === "expiring"
                            ? palette.aspen[400]
                            : palette.ink[200],
                    }}
                  >
                    {zone.freshness.expiresDate}
                  </Text>
                </Text>
              ) : null}
              {fetchedAt ? (
                <Text
                  variant="mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: 0.8,
                    color: palette.ink[400],
                  }}
                >
                  FETCHED{" "}
                  <Text style={{ fontSize: 11, color: ageColor(fetchedAt) }}>
                    {formatAge(fetchedAt).toUpperCase()}
                  </Text>
                </Text>
              ) : null}
            </View>

            {/* TODAY | TOMORROW — two day columns side by side. */}
            <View
              style={{
                flexDirection: "row",
                paddingHorizontal: 16,
                paddingTop: 14,
                gap: 12,
              }}
            >
              <DayColumn label="TODAY" danger={today.danger} />
              {tomorrow ? (
                <>
                  <View
                    style={{
                      width: 0.5,
                      backgroundColor: palette.ink[500],
                      marginVertical: 8,
                    }}
                  />
                  <DayColumn label="TOMORROW" danger={tomorrow.danger} muted />
                </>
              ) : null}
            </View>

            {/* BOTTOM LINE */}
            {zone.travelAdvice && zone.travelAdvice.trim() ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 28 }}>
                <Text
                  variant="mono"
                  weight="medium"
                  className="text-ink-400"
                  style={{
                    fontSize: 10,
                    letterSpacing: 1.6,
                    marginBottom: 8,
                  }}
                >
                  BOTTOM LINE
                </Text>
                <Text
                  className="text-ink-50"
                  style={{ fontSize: 16, lineHeight: 24 }}
                >
                  {zone.travelAdvice.trim()}
                </Text>
              </View>
            ) : null}

            {/* Announcement banner */}
            {zone.announcement ? (
              <View
                style={{
                  marginHorizontal: 16,
                  marginTop: 16,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  borderWidth: 0.5,
                  borderColor: palette.aspen[500],
                  backgroundColor: palette.aspen[500] + "1A",
                  flexDirection: "row",
                  gap: 10,
                }}
              >
                <Ionicons
                  name="warning"
                  size={14}
                  color={palette.aspen[400]}
                  style={{ marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    variant="mono"
                    weight="medium"
                    className="text-aspen-400"
                    style={{
                      fontSize: 10,
                      letterSpacing: 1.4,
                      marginBottom: 4,
                    }}
                  >
                    ANNOUNCEMENT
                  </Text>
                  <Text
                    className="text-ink-100"
                    style={{ fontSize: 13, lineHeight: 19 }}
                  >
                    {zone.announcement}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* SUB-TILES — each navigates to a focused detail screen */}
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 28,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <SubTile
                label="Problems"
                value={
                  zone.problems && zone.problems.length > 0
                    ? `${zone.problems.length} listed`
                    : "—"
                }
                icon="alert-circle-outline"
                accent={palette.aspen[400]}
                disabled={!zone.problems || zone.problems.length === 0}
                onPress={() => navigateTo("problems")}
              />
              <SubTile
                label="Full forecast"
                value={hasFullForecast(zone, bundle) ? "Read" : "—"}
                icon="newspaper-outline"
                accent={palette.frost[400]}
                disabled={!hasFullForecast(zone, bundle)}
                onPress={() => navigateTo("forecast")}
              />
              <SubTile
                label="NWS forecast"
                value={bundle?.weather?.nwsForecast ? "Read" : "—"}
                icon="cloud-outline"
                accent={palette.frost[500]}
                disabled={!bundle?.weather?.nwsForecast}
                onPress={() => navigateTo("nws")}
              />
              <SubTile
                label="WX stations"
                value={
                  bundle?.stations && bundle.stations.length > 0
                    ? `${bundle.stations.length} active`
                    : "—"
                }
                icon="thermometer-outline"
                accent="#3D8A37"
                disabled={!bundle?.stations?.length}
                onPress={() => navigateTo("stations")}
              />
            </View>

            {/* Issued / expires / fetched moved to the freshness strip
                near the top of the page. */}

            {zone.forecastUrl ? (
              <Pressable
                onPress={() => Linking.openURL(zone.forecastUrl)}
                style={({ pressed }) => ({
                  marginTop: 24,
                  marginHorizontal: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  borderWidth: 0.5,
                  borderColor: palette.ink[600],
                  backgroundColor: pressed ? palette.ink[800] : "transparent",
                })}
              >
                <Text
                  variant="mono"
                  weight="medium"
                  style={{
                    fontSize: 12,
                    letterSpacing: 1.4,
                    color: palette.ink[200],
                  }}
                >
                  OFFICIAL FORECAST · {hostname(zone.forecastUrl)}
                </Text>
                <Ionicons
                  name="open-outline"
                  size={14}
                  color={palette.ink[300]}
                />
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function DayColumn({
  label,
  danger,
  muted,
}: {
  label: string;
  danger: ElevationDanger;
  muted?: boolean;
}) {
  const top = highest(danger);
  const c = dangerColors[top];
  return (
    <View style={{ flex: 1, alignItems: "center", opacity: muted ? 0.95 : 1 }}>
      <Text
        variant="mono"
        weight="medium"
        className="text-ink-400"
        style={{ fontSize: 10, letterSpacing: 1.6, marginBottom: 8 }}
      >
        {label}
      </Text>
      <MountainDanger danger={danger} size={108} />
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          gap: 6,
          marginTop: 10,
        }}
      >
        <Text
          variant="mono"
          weight="bold"
          style={{
            fontSize: 32,
            color: c.fill,
            letterSpacing: -1,
            lineHeight: 34,
          }}
        >
          {c.level || "—"}
        </Text>
        <Text
          variant="display"
          style={{
            fontSize: 16,
            color: c.fill,
            letterSpacing: 0.3,
            lineHeight: 20,
          }}
        >
          {top === "NO_RATING" ? "no rating" : startCase(c.label)}
        </Text>
      </View>
      <View style={{ gap: 3, marginTop: 10, alignSelf: "stretch" }}>
        {(
          [
            { key: "alpine" as const, label: "ALP" },
            { key: "treeline" as const, label: "TL" },
            { key: "belowTreeline" as const, label: "BTL" },
          ]
        ).map(({ key, label }) => {
          const r = danger[key];
          const cc = dangerColors[r];
          return (
            <View
              key={key}
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                gap: 4,
              }}
            >
              <Text
                variant="mono"
                weight="medium"
                style={{
                  fontSize: 9,
                  letterSpacing: 1,
                  color: palette.ink[400],
                  width: 26,
                }}
              >
                {label}
              </Text>
              <Text
                variant="mono"
                weight="bold"
                style={{
                  fontSize: 11,
                  color: cc.fill,
                  width: 12,
                }}
              >
                {cc.level || "—"}
              </Text>
              <Text
                style={{ flex: 1, fontSize: 11, color: cc.fill }}
                numberOfLines={1}
              >
                {r === "NO_RATING" ? "—" : startCase(cc.label)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SubTile({
  label,
  value,
  icon,
  accent,
  disabled,
  onPress,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  // Larger, more square tile with a bold outline so each destination
  // reads as its own button on the cream page. Icon at 28px sits in
  // the upper-left, label below it, value + chevron pinned to the
  // bottom — gives the tile real presence instead of a cramped row.
  // Border lives on an outer View so Pressable rendering quirks on
  // iOS (border occasionally not painting on Pressable) don't lose it.
  return (
    <View
      style={{
        width: "48.5%",
        aspectRatio: 1,
        backgroundColor: palette.ink[800],
        borderWidth: 2,
        borderColor: disabled ? palette.ink[500] : palette.ink[700],
        borderRadius: 14,
        overflow: "hidden",
        opacity: disabled ? 0.45 : 1,
      }}
    >
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: 1,
        padding: 18,
        opacity: pressed ? 0.7 : 1,
        justifyContent: "space-between",
      })}
    >
      <View>
        <Ionicons
          name={icon}
          size={32}
          color={disabled ? palette.ink[400] : accent}
        />
        <Text
          variant="mono"
          weight="bold"
          style={{
            fontSize: 11,
            letterSpacing: 1.4,
            color: disabled ? palette.ink[400] : accent,
            marginTop: 14,
          }}
          numberOfLines={2}
        >
          {label.toUpperCase()}
        </Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <Text
          variant="display"
          style={{
            fontSize: 22,
            lineHeight: 26,
            color: disabled ? palette.ink[400] : palette.ink[100],
          }}
        >
          {value}
        </Text>
        {!disabled ? (
          <Ionicons
            name="chevron-forward"
            size={16}
            color={palette.ink[300]}
          />
        ) : null}
      </View>
    </Pressable>
    </View>
  );
}

function Meta({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View>
      <Text
        variant="mono"
        weight="medium"
        className="text-ink-400"
        style={{ fontSize: 9, letterSpacing: 1.2 }}
      >
        {label}
      </Text>
      <Text
        variant="mono"
        style={{
          fontSize: 12,
          color: valueColor ?? palette.ink[200],
          marginTop: 2,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

// True when there's any published narrative beyond avalanche problems —
// drives whether the "Full forecast" tile is enabled. Includes the
// bottom line, snowpack discussion, weather discussion, the avalanche
// center's mountain weather summary, and the AVG synthesized blurb.
function hasFullForecast(
  zone: AvalancheZone,
  bundle: ZoneSnapshot | undefined,
): boolean {
  const w = bundle?.weather;
  return !!(
    (zone.travelAdvice && zone.travelAdvice.trim()) ||
    (zone.hazardDiscussion && zone.hazardDiscussion.trim()) ||
    (zone.weatherDiscussion && zone.weatherDiscussion.trim()) ||
    zone.announcement ||
    w?.nacWeather ||
    w?.avgDiscussion
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toUpperCase();
  } catch {
    return "FORECAST";
  }
}
