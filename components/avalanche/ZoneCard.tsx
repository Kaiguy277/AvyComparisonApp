import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Collapsible } from "@/components/ui/Collapsible";
import { Text } from "@/components/ui/Text";
import { DangerStack } from "./DangerStack";
import { HeadlineDanger } from "./HeadlineDanger";
import { AvalancheProblemCard } from "./AvalancheProblemCard";
import { WeatherStationCard } from "./WeatherStationCard";
import { WeatherForecastCard } from "./WeatherForecastCard";
import { dangerColors, freshness, palette } from "@/constants/design";
import type {
  AvalancheZone,
  DangerRating,
  ElevationDanger,
  ZoneWeatherForecast,
} from "@/lib/api/avalanche";

interface Props {
  zone: AvalancheZone;
  isSnotelLoading?: boolean;
  isWeatherForecastLoading?: boolean;
  weatherForecast?: ZoneWeatherForecast;
}

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

export function ZoneCard({
  zone,
  isSnotelLoading,
  isWeatherForecastLoading,
  weatherForecast,
}: Props) {
  const fresh = freshness[zone.freshness.status];
  const today = zone.forecast?.[0];
  const tomorrow = zone.forecast?.[1];
  const headlineColor = today
    ? dangerColors[highest(today.danger)].fill
    : palette.ink[500];

  return (
    <Card variant="raised">
      <View
        style={{
          height: 3,
          backgroundColor: headlineColor,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }}
      />

      <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text
              variant="mono"
              weight="medium"
              className="text-ink-400"
              style={{ fontSize: 10, letterSpacing: 1.6 }}
            >
              ZONE
            </Text>
            <Text
              variant="display"
              className="text-ink-50"
              style={{ fontSize: 28, lineHeight: 32, marginTop: 2 }}
            >
              {zone.name}
            </Text>
            <View className="flex-row gap-2 mt-2">
              {zone.freshness.issueDate ? (
                <View>
                  <Text
                    variant="mono"
                    className="text-ink-400"
                    style={{ fontSize: 9, letterSpacing: 1.2 }}
                  >
                    ISSUED
                  </Text>
                  <Text
                    variant="mono"
                    className="text-ink-200"
                    style={{ fontSize: 11 }}
                  >
                    {zone.freshness.issueDate}
                  </Text>
                </View>
              ) : null}
              {zone.freshness.expiresDate ? (
                <View>
                  <Text
                    variant="mono"
                    className="text-ink-400"
                    style={{ fontSize: 9, letterSpacing: 1.2 }}
                  >
                    EXPIRES
                  </Text>
                  <Text
                    variant="mono"
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
                </View>
              ) : null}
            </View>
          </View>
          <Badge fill={fresh.fill} ink={fresh.ink}>
            {fresh.label}
          </Badge>
        </View>

        {zone.forecastUrl ? (
          <Pressable
            onPress={() => Linking.openURL(zone.forecastUrl)}
            className="flex-row items-center gap-1.5 mt-3"
            hitSlop={8}
          >
            <Text
              variant="mono"
              weight="medium"
              className="text-frost-400"
              style={{ fontSize: 10, letterSpacing: 1.4 }}
            >
              OFFICIAL FORECAST
            </Text>
            <Ionicons
              name="arrow-forward-outline"
              size={11}
              color={palette.frost[400]}
              style={{ transform: [{ rotate: "-45deg" }] }}
            />
          </Pressable>
        ) : null}
      </View>

      {/* Headline danger panel */}
      {today ? (
        <View
          style={{
            marginTop: 18,
            marginHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 18,
            borderTopWidth: 0.5,
            borderColor: palette.ink[700],
          }}
        >
          <View className="flex-row gap-6">
            <View className="flex-1">
              <HeadlineDanger danger={today.danger} label="TODAY" />
            </View>
            {tomorrow ? (
              <View className="flex-1">
                <HeadlineDanger danger={tomorrow.danger} label="TOMORROW" />
              </View>
            ) : null}
          </View>

          <View style={{ marginTop: 16 }}>
            <Text
              variant="mono"
              weight="medium"
              className="text-ink-400"
              style={{ fontSize: 10, letterSpacing: 1.4, marginBottom: 8 }}
            >
              ELEVATION DETAIL · TODAY
            </Text>
            <DangerStack danger={today.danger} />
          </View>
        </View>
      ) : null}

      <CardContent style={{ paddingTop: 4 }} className="gap-3">
        {/* Key Message — quoted, large, the human voice */}
        <View
          style={{
            paddingLeft: 14,
            borderLeftWidth: 2,
            borderColor: palette.frost[500],
            marginVertical: 6,
          }}
        >
          <Text
            variant="display"
            className="text-ink-50"
            style={{ fontSize: 18, lineHeight: 26 }}
          >
            {zone.keyMessage}
          </Text>
        </View>

        {zone.problems && zone.problems.length > 0 ? (
          <Collapsible
            leadingAccent={palette.aspen[500]}
            title={
              <View className="flex-row items-baseline gap-3 flex-1">
                <Text
                  variant="mono"
                  weight="medium"
                  className="text-aspen-400"
                  style={{ fontSize: 11, letterSpacing: 1.6 }}
                >
                  PROBLEMS
                </Text>
                <Text
                  variant="mono"
                  className="text-ink-300"
                  style={{ fontSize: 11 }}
                >
                  {zone.problems.length}
                </Text>
              </View>
            }
          >
            <View className="gap-2">
              {zone.problems.map((p, i) => (
                <AvalancheProblemCard key={i} problem={p} />
              ))}
            </View>
          </Collapsible>
        ) : zone.hazardDiscussion ? (
          <Collapsible
            leadingAccent={palette.aspen[500]}
            title={
              <Text
                variant="mono"
                weight="medium"
                className="text-aspen-400"
                style={{ fontSize: 11, letterSpacing: 1.6 }}
              >
                HAZARD DISCUSSION
              </Text>
            }
          >
            <Text className="text-ink-200" style={{ fontSize: 14, lineHeight: 21 }}>
              {zone.hazardDiscussion}
            </Text>
          </Collapsible>
        ) : null}

        <Collapsible
          leadingAccent={palette.frost[500]}
          title={
            <Text
              variant="mono"
              weight="medium"
              className="text-frost-400"
              style={{ fontSize: 11, letterSpacing: 1.6 }}
            >
              TRAVEL ADVICE
            </Text>
          }
        >
          <Text className="text-ink-200" style={{ fontSize: 14, lineHeight: 21 }}>
            {zone.travelAdvice}
          </Text>
        </Collapsible>

        {weatherForecast?.nacWeather ||
        weatherForecast?.nwsForecast ||
        weatherForecast?.avgDiscussion ||
        (isWeatherForecastLoading && !weatherForecast) ? (
          <Collapsible
            leadingAccent={palette.frost[400]}
            title={
              <View className="flex-row items-baseline gap-3 flex-wrap flex-1">
                <Text
                  variant="mono"
                  weight="medium"
                  className="text-ink-100"
                  style={{ fontSize: 11, letterSpacing: 1.6 }}
                >
                  WEATHER OUTLOOK
                </Text>
                {weatherForecast?.avgDiscussion ? (
                  <Text
                    variant="mono"
                    className="text-ink-400"
                    style={{ fontSize: 9, letterSpacing: 1.2 }}
                  >
                    AVG
                  </Text>
                ) : null}
                {weatherForecast?.nacWeather ? (
                  <Text
                    variant="mono"
                    className="text-ink-400"
                    style={{ fontSize: 9, letterSpacing: 1.2 }}
                  >
                    NAC
                  </Text>
                ) : null}
                {weatherForecast?.nwsForecast ? (
                  <Text
                    variant="mono"
                    className="text-ink-400"
                    style={{ fontSize: 9, letterSpacing: 1.2 }}
                  >
                    NWS
                  </Text>
                ) : null}
              </View>
            }
          >
            <WeatherForecastCard
              nacWeather={weatherForecast?.nacWeather}
              nwsForecast={weatherForecast?.nwsForecast}
              avgDiscussion={weatherForecast?.avgDiscussion}
              isLoading={isWeatherForecastLoading && !weatherForecast}
            />
          </Collapsible>
        ) : null}

        {zone.weatherObservations && zone.weatherObservations.length > 0 ? (
          <Collapsible
            leadingAccent="#52BA4A"
            title={
              <View className="flex-row items-baseline gap-3 flex-1">
                <Text
                  variant="mono"
                  weight="medium"
                  className="text-ink-100"
                  style={{ fontSize: 11, letterSpacing: 1.6 }}
                >
                  STATIONS
                </Text>
                <Text
                  variant="mono"
                  className="text-ink-300"
                  style={{ fontSize: 11 }}
                >
                  {zone.weatherObservations.length}
                </Text>
              </View>
            }
          >
            <WeatherStationCard
              observations={zone.weatherObservations}
              note={
                zone.id === "douglas-island"
                  ? "These stations sit outside the forecast zone. Expect high spatial variability."
                  : undefined
              }
            />
          </Collapsible>
        ) : null}

        {!zone.weatherObservations && isSnotelLoading ? (
          <View className="flex-row items-center gap-2 px-3 py-3 rounded-xl bg-ink-800/60">
            <ActivityIndicator size="small" color={palette.ink[300]} />
            <Text
              variant="mono"
              className="text-ink-300"
              style={{ fontSize: 11, letterSpacing: 1.2 }}
            >
              FETCHING STATIONS…
            </Text>
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}
