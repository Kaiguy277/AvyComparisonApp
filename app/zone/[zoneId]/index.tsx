import { useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  View,
} from "react-native";
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
  const headlineRating = today ? highest(today.danger) : "NO_RATING";
  const c = dangerColors[headlineRating];
  const fresh = zone ? freshness[zone.freshness.status] : null;
  const fetchedAt = bundle?.cachedAt ?? snap?.fetchedAt;

  return (
    <View style={{ flex: 1, backgroundColor: palette.ink[950] }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom header — back button, zone name, freshness pill */}
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
          <Ionicons
            name="chevron-back"
            size={24}
            color={palette.ink[100]}
          />
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
              style={{
                fontSize: 10,
                letterSpacing: 1.2,
                marginTop: 2,
              }}
            >
              BY {zone.author.toUpperCase()}
            </Text>
          ) : null}
        </View>
        {fresh ? (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: fresh.fill,
            }}
          >
            <Text
              variant="mono"
              weight="bold"
              style={{
                fontSize: 9,
                letterSpacing: 1.2,
                color: fresh.ink,
              }}
            >
              {fresh.label.toUpperCase()}
            </Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: insets.bottom + 32,
        }}
      >
        {/* Loading / not-found states */}
        {!loaded ? (
          <Text
            variant="mono"
            className="text-ink-400"
            style={{ fontSize: 11, letterSpacing: 1.4 }}
          >
            LOADING…
          </Text>
        ) : !zone || !today ? (
          <View>
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
            {/* HERO — big mountain + numeral/word verdict */}
            <View style={{ alignItems: "center", marginBottom: 8 }}>
              <MountainDanger danger={today.danger} size={180} />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                justifyContent: "center",
                gap: 10,
                marginTop: 4,
              }}
            >
              <Text
                variant="mono"
                weight="bold"
                style={{
                  fontSize: 56,
                  lineHeight: 60,
                  color: c.fill,
                  letterSpacing: -2,
                }}
              >
                {c.level || "—"}
              </Text>
              <Text
                variant="display"
                style={{
                  fontSize: 28,
                  lineHeight: 32,
                  color: c.fill,
                  letterSpacing: 0.4,
                }}
              >
                {headlineRating === "NO_RATING"
                  ? "no rating"
                  : c.label.charAt(0) + c.label.slice(1).toLowerCase()}
              </Text>
            </View>

            {/* Per-elevation breakdown */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                gap: 18,
                marginTop: 14,
              }}
            >
              <ElevRow
                label="ALP"
                rating={today.danger.alpine}
              />
              <ElevRow
                label="TL"
                rating={today.danger.treeline}
              />
              <ElevRow
                label="BTL"
                rating={today.danger.belowTreeline}
              />
            </View>

            {/* Bottom line — forecaster's prose */}
            {zone.travelAdvice && zone.travelAdvice.trim() ? (
              <View style={{ marginTop: 28 }}>
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
                  variant="display"
                  className="text-ink-50"
                  style={{ fontSize: 17, lineHeight: 25 }}
                >
                  {zone.travelAdvice.trim()}
                </Text>
              </View>
            ) : null}

            {/* Problem chips — show problem names. Detail-level views of
                each problem (rose, likelihood, size, discussion) live in
                the specifics deep-dive screen. */}
            {zone.problems && zone.problems.length > 0 ? (
              <View style={{ marginTop: 24 }}>
                <Text
                  variant="mono"
                  weight="medium"
                  className="text-ink-400"
                  style={{
                    fontSize: 10,
                    letterSpacing: 1.6,
                    marginBottom: 10,
                  }}
                >
                  PROBLEMS · {zone.problems.length}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  {zone.problems.map((p, i) => (
                    <View
                      key={i}
                      style={{
                        paddingVertical: 5,
                        paddingHorizontal: 10,
                        borderRadius: 6,
                        borderWidth: 0.5,
                        borderColor: palette.aspen[500] + "AA",
                        backgroundColor: palette.aspen[500] + "1A",
                      }}
                    >
                      <Text
                        variant="mono"
                        weight="medium"
                        style={{
                          fontSize: 11,
                          letterSpacing: 1,
                          color: palette.aspen[400],
                        }}
                      >
                        {p.name.toUpperCase()}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Announcement banner */}
            {zone.announcement ? (
              <View
                style={{
                  marginTop: 24,
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

            {/* Issued / expires / fetched footnote */}
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 16,
                marginTop: 28,
              }}
            >
              {zone.freshness.issueDate ? (
                <Meta label="ISSUED" value={zone.freshness.issueDate} />
              ) : null}
              {zone.freshness.expiresDate ? (
                <Meta
                  label="EXPIRES"
                  value={zone.freshness.expiresDate}
                  valueColor={
                    zone.freshness.status === "expired"
                      ? "#FCA5A5"
                      : zone.freshness.status === "expiring"
                        ? palette.aspen[400]
                        : palette.ink[200]
                  }
                />
              ) : null}
              {fetchedAt ? (
                <Meta
                  label="FETCHED"
                  value={formatAge(fetchedAt).toUpperCase()}
                  valueColor={ageColor(fetchedAt)}
                />
              ) : null}
            </View>

            {/* Action buttons — open specifics deep-dive + official forecast */}
            <View style={{ gap: 10, marginTop: 28 }}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  router.push({
                    pathname: "/zone/[zoneId]/specifics",
                    params: { zoneId },
                  });
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  borderWidth: 0.5,
                  borderColor: palette.frost[400],
                  backgroundColor: pressed
                    ? palette.frost[400] + "33"
                    : palette.frost[400] + "12",
                })}
              >
                <Text
                  variant="mono"
                  weight="medium"
                  style={{
                    fontSize: 12,
                    letterSpacing: 1.4,
                    color: palette.frost[400],
                  }}
                >
                  OPEN FULL SPECIFICS
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={palette.frost[400]}
                />
              </Pressable>

              {zone.forecastUrl ? (
                <Pressable
                  onPress={() => Linking.openURL(zone.forecastUrl)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                    borderWidth: 0.5,
                    borderColor: palette.ink[600],
                    backgroundColor: pressed
                      ? palette.ink[800]
                      : "transparent",
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
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ElevRow({
  label,
  rating,
}: {
  label: string;
  rating: DangerRating;
}) {
  const c = dangerColors[rating];
  return (
    <View style={{ alignItems: "center" }}>
      <Text
        variant="mono"
        weight="medium"
        className="text-ink-400"
        style={{ fontSize: 10, letterSpacing: 1.4 }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          gap: 4,
          marginTop: 4,
        }}
      >
        <Text
          variant="mono"
          weight="bold"
          style={{
            fontSize: 18,
            color: c.fill,
            letterSpacing: -0.5,
          }}
        >
          {c.level || "—"}
        </Text>
        <Text
          variant="mono"
          style={{
            fontSize: 10,
            color: c.fill,
            letterSpacing: 0.6,
            opacity: 0.85,
          }}
        >
          {rating === "NO_RATING"
            ? ""
            : c.label.slice(0, 4)}
        </Text>
      </View>
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

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toUpperCase();
  } catch {
    return "FORECAST";
  }
}
