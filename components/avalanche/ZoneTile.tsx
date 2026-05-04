import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/Text";
import { MountainDanger } from "./MountainDanger";
import { freshness, palette } from "@/constants/design";
import type {
  AvalancheZone,
  WeatherObservation,
} from "@/lib/api/avalanche";

interface Props {
  zone: AvalancheZone;
  // YYYY-MM-DD of the day the home grid is currently showing. Threaded
  // into the detail route so the detail / sub screens look up the
  // matching bundle in the snapshot, not the newest.
  viewedDate: string;
}

// Color the freshness word by status. Green for current is intentionally
// muted (the calm state); aspen + red carry the alert weight.
function freshnessColor(status: keyof typeof freshness): string {
  if (status === "expired") return "#FCA5A5";
  if (status === "expiring") return palette.aspen[400];
  if (status === "recent") return palette.frost[400];
  if (status === "unknown") return palette.ink[400];
  return "#52BA4A"; // current
}

// Highest-elevation station in the zone — that's the one a backcountry
// user wants to read at-a-glance ("what's the alpine doing right now?").
function highestStation(
  zone: AvalancheZone,
): WeatherObservation | undefined {
  const obs = zone.weatherObservations ?? [];
  if (obs.length === 0) return undefined;
  return obs
    .slice()
    .sort((a, b) => (b.elevation ?? -Infinity) - (a.elevation ?? -Infinity))[0];
}

// Format a number with sign for delta-style readouts (24h depth change).
// "+0" for zero so the eye reads "no new snow" rather than ambiguous "0".
function formatSnowDelta(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v === 0) return "0″";
  if (v > 0) return `+${v}″`;
  return `${v}″`;
}

export function ZoneTile({ zone, viewedDate }: Props) {
  const router = useRouter();
  const today = zone.forecast?.[0];
  const fresh = freshness[zone.freshness.status];
  const station = highestStation(zone);

  const onPress = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push({
      pathname: "/zone/[zoneId]" as never,
      params: { zoneId: zone.id, date: viewedDate },
    });
  };

  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: palette.ink[800],
        borderWidth: 2,
        borderColor: palette.ink[700],
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View style={{ padding: 12 }}>
          {/* Name + freshness word */}
          <Text
            variant="display"
            className="text-ink-50"
            style={{ fontSize: 15, lineHeight: 18 }}
            numberOfLines={2}
          >
            {zone.name}
          </Text>
          <Text
            variant="mono"
            weight="bold"
            style={{
              fontSize: 10,
              letterSpacing: 1.2,
              color: freshnessColor(zone.freshness.status),
              marginTop: 4,
            }}
          >
            {fresh.label.toUpperCase()}
          </Text>

          {/* Station name + elevation — full-width above the mountain
              row so long names ("Eagle River Valley", etc.) are never
              truncated. */}
          {station ? (
            <Text
              variant="mono"
              weight="bold"
              style={{
                fontSize: 9,
                letterSpacing: 1,
                color: palette.ink[400],
                marginTop: 14,
              }}
              numberOfLines={2}
            >
              {station.stationName.toUpperCase()}
              {typeof station.elevation === "number"
                ? ` · ${station.elevation.toLocaleString()}′`
                : ""}
            </Text>
          ) : null}

          {/* Row: mountain glyph (with danger numerals 1..5 inside its
              bands) on the left, current station readouts on the right.
              Stacked icon+value rows: temp, wind, 24h new-snow delta. */}
          {today ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 12,
                marginTop: station ? 6 : 14,
              }}
            >
              <MountainDanger
                danger={today.danger}
                size={74}
                labelMode="numbers"
              />
              {station ? (
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <StationStat
                    icon="thermometer-outline"
                    value={
                      station.temperature.current !== null
                        ? `${station.temperature.current}°`
                        : "—"
                    }
                  />
                  <StationStat
                    icon="speedometer-outline"
                    value={
                      station.wind?.speedCurrent !== null &&
                      station.wind?.speedCurrent !== undefined
                        ? `${Math.round(station.wind.speedCurrent)}${
                            station.wind.direction
                              ? ` ${station.wind.direction}`
                              : ""
                          }`
                        : "—"
                    }
                  />
                  <StationStat
                    icon="snow-outline"
                    value={formatSnowDelta(station.snow.depth24hrChange)}
                    suffix="24H"
                  />
                </View>
              ) : null}
            </View>
          ) : (
            <View
              style={{
                marginTop: 14,
                paddingVertical: 16,
                alignItems: "center",
              }}
            >
              <Text
                variant="mono"
                className="text-ink-400"
                style={{ fontSize: 11, letterSpacing: 1 }}
              >
                NO RATING
              </Text>
            </View>
          )}

          {/* Problem names listed. */}
          {zone.problems && zone.problems.length > 0 ? (
            <View style={{ marginTop: 12 }}>
              <Text
                variant="mono"
                weight="bold"
                style={{
                  fontSize: 9,
                  letterSpacing: 1.2,
                  color: palette.ink[400],
                  marginBottom: 4,
                }}
              >
                PROBLEMS
              </Text>
              {zone.problems.map((p, i) => (
                <Text
                  key={i}
                  style={{
                    fontSize: 11,
                    lineHeight: 15,
                    color: palette.ink[200],
                  }}
                  numberOfLines={1}
                >
                  {p.name}
                </Text>
              ))}
            </View>
          ) : null}

          {/* Issued + expires meta. */}
          {zone.freshness.issueDate || zone.freshness.expiresDate ? (
            <View style={{ marginTop: 12, gap: 2 }}>
              {zone.freshness.issueDate ? (
                <Text
                  variant="mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: 0.6,
                    color: palette.ink[400],
                  }}
                  numberOfLines={1}
                >
                  ISSUED{" "}
                  <Text style={{ fontSize: 9, color: palette.ink[200] }}>
                    {zone.freshness.issueDate}
                  </Text>
                </Text>
              ) : null}
              {zone.freshness.expiresDate ? (
                <Text
                  variant="mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: 0.6,
                    color: palette.ink[400],
                  }}
                  numberOfLines={1}
                >
                  EXPIRES{" "}
                  <Text
                    style={{
                      fontSize: 9,
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
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

function StationStat({
  icon,
  value,
  suffix,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  // Tiny muted-mono trailing label, e.g. "24H" on the snow-delta stat
  // to disambiguate it from a current reading.
  suffix?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
      }}
    >
      <Ionicons
        name={icon}
        size={12}
        color={palette.ink[400]}
      />
      <Text
        variant="mono"
        weight="medium"
        style={{
          fontSize: 11,
          letterSpacing: 0,
          color: palette.ink[100],
        }}
      >
        {value}
      </Text>
      {suffix ? (
        <Text
          variant="mono"
          style={{
            fontSize: 8,
            letterSpacing: 0.8,
            color: palette.ink[400],
            marginLeft: 1,
          }}
        >
          {suffix}
        </Text>
      ) : null}
    </View>
  );
}
