import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import type { WeatherObservation } from "@/lib/api/avalanche";
import { AVAILABLE_ZONES } from "@/lib/zones";

interface Props {
  zoneId: string;
  centerId?: string;
  stations: WeatherObservation[];
  // YYYY-MM-DD of the day the home grid is currently showing — threaded
  // into the detail route the same way ZoneTile does.
  viewedDate: string;
}

// Highest-elevation station — the one a backcountry user wants at-a-glance.
function highestStation(
  obs: WeatherObservation[],
): WeatherObservation | undefined {
  if (obs.length === 0) return undefined;
  return obs
    .slice()
    .sort((a, b) => (b.elevation ?? -Infinity) - (a.elevation ?? -Infinity))[0];
}

function formatSnowDelta(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v === 0) return "0″";
  if (v > 0) return `+${v}″`;
  return `${v}″`;
}

function formatStationTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(/\s?(AM|PM)/i, (_m, ap) => ap.toLowerCase());
}

// Muted variant of ZoneTile for zones with no current avalanche forecast.
// Shows the zone name + highest-station snapshot + a "STATIONS ONLY"
// eyebrow so the user understands why the danger pyramid is missing.
// Tappable to the same zone detail route as ZoneTile.
export function StationsOnlyTile({ zoneId, stations, viewedDate }: Props) {
  const router = useRouter();
  const station = highestStation(stations);
  const zoneName =
    AVAILABLE_ZONES.find((z) => z.id === zoneId)?.name ?? zoneId;

  const onPress = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push({
      pathname: "/zone/[zoneId]" as never,
      params: { zoneId, date: viewedDate },
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
        opacity: 0.92,
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <View style={{ padding: 12 }}>
          <Text
            variant="display"
            className="text-ink-50"
            style={{ fontSize: 15, lineHeight: 18 }}
            numberOfLines={2}
          >
            {zoneName}
          </Text>

          <Text
            variant="mono"
            weight="bold"
            style={{
              fontSize: 10,
              letterSpacing: 1.2,
              color: palette.ink[400],
              marginTop: 8,
            }}
          >
            STATIONS ONLY
          </Text>
          <Text
            variant="mono"
            style={{
              fontSize: 9,
              letterSpacing: 0.6,
              color: palette.ink[500],
              marginTop: 2,
            }}
          >
            No current forecast
          </Text>

          {station ? (
            <View style={{ marginTop: 12 }}>
              <Text
                variant="mono"
                weight="bold"
                style={{
                  fontSize: 9,
                  letterSpacing: 1,
                  color: palette.ink[300],
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
                  }}
                >
                  {station.elevation.toLocaleString()}′
                </Text>
              ) : null}
              {station.timestamp ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 3,
                    marginTop: 2,
                    marginBottom: 6,
                  }}
                >
                  <Ionicons
                    name="time-outline"
                    size={10}
                    color={palette.ink[400]}
                  />
                  <Text
                    variant="mono"
                    style={{
                      fontSize: 9,
                      letterSpacing: 0.4,
                      color: palette.ink[400],
                    }}
                  >
                    {formatStationTime(station.timestamp)}
                  </Text>
                </View>
              ) : (
                <View style={{ height: 6 }} />
              )}
              <View style={{ gap: 3 }}>
                <Stat
                  icon="thermometer-outline"
                  value={
                    station.temperature.current !== null
                      ? `${station.temperature.current}°`
                      : "—"
                  }
                />
                <Stat
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
                <Stat
                  icon="snow-outline"
                  value={formatSnowDelta(station.snow.depth24hrChange)}
                  suffix="24H"
                />
              </View>
            </View>
          ) : (
            <Text
              variant="mono"
              style={{
                fontSize: 10,
                letterSpacing: 0.8,
                color: palette.ink[400],
                marginTop: 14,
              }}
            >
              No station data yet
            </Text>
          )}
        </View>
      </Pressable>
    </View>
  );
}

type StatProps =
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

function Stat(props: StatProps) {
  const { value, suffix } = props;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      {props.iconSet === "material" ? (
        <MaterialCommunityIcons
          name={props.icon}
          size={13}
          color={palette.ink[400]}
        />
      ) : (
        <Ionicons name={props.icon} size={12} color={palette.ink[400]} />
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
