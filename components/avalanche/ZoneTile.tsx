import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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
  if (status === "expired") return "#DC2626";
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
          {/* Zone name */}
          <Text
            variant="display"
            className="text-ink-50"
            style={{ fontSize: 15, lineHeight: 18 }}
            numberOfLines={2}
          >
            {zone.name}
          </Text>

          {/* Two-column body — left side is the avy forecast (mountain
              glyph + freshness word + issued/expires), right side is
              the highest-station weather snapshot. Problems below
              spans full width since names can be long. */}
          {today ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 12,
                marginTop: 14,
              }}
            >
              {/* LEFT — avalanche column. CURRENT/EXPIRED label above
                  the mountain glyph; date range moves to its own
                  full-width row below the problems. */}
              <View style={{ width: 74 }}>
                <Text
                  variant="mono"
                  weight="bold"
                  style={{
                    fontSize: 10,
                    letterSpacing: 1.2,
                    color: freshnessColor(zone.freshness.status),
                    marginBottom: 6,
                  }}
                >
                  {fresh.label.toUpperCase()}
                </Text>
                <MountainDanger
                  danger={today.danger}
                  size={74}
                  labelMode="numbers"
                />
              </View>

              {/* RIGHT — weather column */}
              {station ? (
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    variant="mono"
                    weight="bold"
                    style={{
                      fontSize: 9,
                      letterSpacing: 1,
                      color: palette.ink[400],
                    }}
                    numberOfLines={2}
                  >
                    {station.stationName.toUpperCase()}
                  </Text>
                  {typeof station.elevation === "number" ? (
                    <Text
                      variant="mono"
                      style={{
                        fontSize: 9,
                        letterSpacing: 0.6,
                        color: palette.ink[400],
                        marginTop: 1,
                        marginBottom: 6,
                      }}
                    >
                      {station.elevation.toLocaleString()}′
                    </Text>
                  ) : (
                    <View style={{ height: 6 }} />
                  )}
                  <View style={{ gap: 3 }}>
                    <StationStat
                      icon="thermometer-outline"
                      value={
                        station.temperature.current !== null
                          ? `${station.temperature.current}°`
                          : "—"
                      }
                    />
                    <StationStat
                      iconSet="material"
                      icon="weather-windy"
                      value={
                        station.wind?.speedCurrent !== null &&
                        station.wind?.speedCurrent !== undefined
                          ? `${Math.round(station.wind.speedCurrent)} mph${
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

          {/* Forecast date range — quiet single-line footer. Small
              enough to fit one line on a square tile; no rule above
              since the freshness word already labels the data. */}
          {zone.freshness.issueDate || zone.freshness.expiresDate ? (
            <View
              style={{
                marginTop: 8,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <Text
                variant="mono"
                style={{
                  fontSize: 8,
                  letterSpacing: 0.4,
                  color: palette.ink[400],
                }}
                numberOfLines={1}
              >
                {zone.freshness.issueDate ?? "—"}
              </Text>
              <Text
                variant="mono"
                style={{ fontSize: 8, color: palette.ink[500] }}
              >
                →
              </Text>
              <Text
                variant="mono"
                style={{
                  fontSize: 8,
                  letterSpacing: 0.4,
                  color:
                    zone.freshness.status === "expired"
                      ? "#DC2626"
                      : zone.freshness.status === "expiring"
                        ? palette.aspen[400]
                        : palette.ink[400],
                }}
                numberOfLines={1}
              >
                {zone.freshness.expiresDate ?? "—"}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

type StationStatProps =
  | {
      iconSet?: "ion";
      icon: keyof typeof Ionicons.glyphMap;
      value: string;
      suffix?: string;
    }
  | {
      iconSet: "material";
      icon: keyof typeof MaterialCommunityIcons.glyphMap;
      value: string;
      suffix?: string;
    };

function StationStat(props: StationStatProps) {
  const { value, suffix } = props;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
      }}
    >
      {props.iconSet === "material" ? (
        <MaterialCommunityIcons
          name={props.icon}
          size={13}
          color={palette.ink[400]}
        />
      ) : (
        <Ionicons
          name={props.icon}
          size={12}
          color={palette.ink[400]}
        />
      )}
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
