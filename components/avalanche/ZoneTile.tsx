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
  // ISO timestamp the bundle for this zone was last refreshed. Surfaced
  // as a small "FETCHED HH:MM" footer so a bg-wake or push-driven
  // update is immediately visible per zone — without this, users can't
  // tell whether a wake actually rewrote the cache.
  cachedAt?: string;
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

function formatStationTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(/\s?(AM|PM)/i, (_m, ap) => ap.toLowerCase());
}

// Compact likelihood for the cramped tile space. NAC ladder is
// Unlikely → Possible → Likely → Very Likely → Almost Certain. We
// shorten the long ones; the short ones already fit.
function formatLikelihood(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("almost") || s.includes("certain")) return "CERTAIN";
  if (s.includes("very")) return "V.LIKELY";
  if (s.includes("unlikely")) return "UNLIKELY";
  if (s.includes("possible")) return "POSSIBLE";
  if (s.includes("likely")) return "LIKELY";
  return raw.toUpperCase();
}

// Likelihood color ramp — ink for low end, aspen for the alarming end.
// Keeps the eye drawn to the cells that matter.
function likelihoodColor(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("almost") || s.includes("certain")) return "#DC2626";
  if (s.includes("very")) return palette.aspen[400];
  if (s.includes("likely") && !s.includes("unlikely")) return palette.aspen[400];
  if (s.includes("possible")) return palette.frost[400];
  return palette.ink[400];
}

function formatFetchedClock(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(/\s?(AM|PM)/i, (_m, ap) => ap.toLowerCase());
}

export function ZoneTile({ zone, viewedDate, cachedAt }: Props) {
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

          {/* Problem names listed with likelihood. Name on the left
              (truncates), short likelihood tag on the right. */}
          {zone.problems && zone.problems.length > 0 ? (
            <View style={{ marginTop: 6 }}>
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
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      lineHeight: 15,
                      color: palette.ink[200],
                      flex: 1,
                      minWidth: 0,
                    }}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                  {p.likelihood ? (
                    <Text
                      variant="mono"
                      weight="bold"
                      style={{
                        fontSize: 8,
                        letterSpacing: 0.8,
                        color: likelihoodColor(p.likelihood),
                      }}
                      numberOfLines={1}
                    >
                      {formatLikelihood(p.likelihood)}
                    </Text>
                  ) : null}
                </View>
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

          {/* Per-zone wake/refresh time. Different from the forecast
              issue/expiry above — this is when the snapshot for this
              specific zone was last rewritten, so a bg-wake or push
              shows up here immediately. */}
          {formatFetchedClock(cachedAt) ? (
            <Text
              variant="mono"
              weight="medium"
              style={{
                marginTop: 4,
                fontSize: 8,
                letterSpacing: 1,
                color: palette.ink[500],
                textAlign: "center",
              }}
              numberOfLines={1}
            >
              FETCHED {formatFetchedClock(cachedAt)}
            </Text>
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
