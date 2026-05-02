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

const WEEKDAY = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

function formatRelativeDate(iso: string | undefined, offsetDays: number): string {
  // Prefer the date the forecast says it's for; fall back to today + offset.
  let d: Date;
  if (iso) {
    const parsed = new Date(iso);
    d = isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    d = new Date();
    d.setDate(d.getDate() + offsetDays);
  }
  return `${WEEKDAY[d.getDay()]} · ${MONTH[d.getMonth()]} ${d.getDate()}`;
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
              className="text-ink-300"
              style={{ fontSize: 12, letterSpacing: 1.8 }}
            >
              ZONE
            </Text>
            <Text
              variant="display"
              className="text-ink-50"
              style={{ fontSize: 36, lineHeight: 40, marginTop: 4 }}
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

      {/* Headline danger panel — today + tomorrow, side by side */}
      {today ? (
        <View
          style={{
            marginTop: 18,
            marginHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 20,
            borderTopWidth: 0.5,
            borderColor: palette.ink[700],
            flexDirection: "row",
            gap: 12,
          }}
        >
          <DayColumn
            danger={today.danger}
            label="TODAY"
            date={formatRelativeDate(today.date, 0)}
          />
          {tomorrow ? (
            <>
              <View
                style={{
                  width: 0.5,
                  backgroundColor: palette.ink[700],
                  marginVertical: 4,
                }}
              />
              <DayColumn
                danger={tomorrow.danger}
                label="TOMORROW"
                date={formatRelativeDate(tomorrow.date, 1)}
              />
            </>
          ) : null}
        </View>
      ) : null}

      <CardContent style={{ paddingTop: 4 }} className="gap-3">
        {/* Key Message — quoted, large, the human voice. Sized to read at arm's length */}
        <View
          style={{
            paddingLeft: 16,
            borderLeftWidth: 2,
            borderColor: palette.frost[500],
            marginVertical: 8,
          }}
        >
          <Text
            variant="mono"
            weight="medium"
            className="text-frost-400"
            style={{ fontSize: 11, letterSpacing: 1.6, marginBottom: 6 }}
          >
            KEY MESSAGE
          </Text>
          <Text
            variant="display"
            className="text-ink-50"
            style={{ fontSize: 22, lineHeight: 30 }}
          >
            {zone.keyMessage}
          </Text>
        </View>

        {/* Problems — structured data only (name, likelihood, size, aspect) */}
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
                <AvalancheProblemCard key={i} problem={p} hideDiscussion />
              ))}
            </View>
          </Collapsible>
        ) : null}

        {/* Forecaster's full narrative — bottom line + per-problem prose +
            snowpack discussion all in one place. The "dig deeper" section. */}
        {hasForecasterDiscussion(zone) ? (
          <Collapsible
            leadingAccent={palette.frost[500]}
            title={
              <Text
                variant="mono"
                weight="medium"
                className="text-frost-400"
                style={{ fontSize: 11, letterSpacing: 1.6 }}
              >
                FORECASTER DISCUSSION
              </Text>
            }
          >
            <ForecasterDiscussion zone={zone} />
          </Collapsible>
        ) : null}

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

function DayColumn({
  danger,
  label,
  date,
}: {
  danger: ElevationDanger;
  label: string;
  date: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text
        variant="mono"
        className="text-ink-400"
        style={{ fontSize: 10, letterSpacing: 1.4, marginBottom: 2 }}
      >
        {date}
      </Text>
      <HeadlineDanger danger={danger} label={label} />
      <View style={{ marginTop: 12 }}>
        <DangerStack danger={danger} size="compact" />
      </View>
    </View>
  );
}

// Returns true if there's any text-heavy field worth surfacing in the
// "Forecaster Discussion" rollup. Keeps the section hidden for sparse zones.
function hasForecasterDiscussion(zone: AvalancheZone): boolean {
  if (zone.travelAdvice && zone.travelAdvice.trim().length > 0) return true;
  if (zone.hazardDiscussion && zone.hazardDiscussion.trim().length > 0) return true;
  return (zone.problems || []).some(
    (p) => p.discussion && p.discussion.trim().length > 0,
  );
}

// Concatenates everything text-heavy in the order a forecaster would
// typically write it — bottom line → snowpack → per-problem narratives.
function ForecasterDiscussion({ zone }: { zone: AvalancheZone }) {
  const sections: { label: string; body: string }[] = [];
  if (zone.travelAdvice && zone.travelAdvice.trim()) {
    sections.push({ label: "BOTTOM LINE", body: zone.travelAdvice.trim() });
  }
  if (zone.hazardDiscussion && zone.hazardDiscussion.trim()) {
    sections.push({ label: "SNOWPACK & CONDITIONS", body: zone.hazardDiscussion.trim() });
  }
  for (const p of zone.problems || []) {
    if (p.discussion && p.discussion.trim()) {
      sections.push({
        label: p.name.toUpperCase(),
        body: p.discussion.trim(),
      });
    }
  }
  return (
    <View style={{ gap: 16 }}>
      {sections.map((s, i) => (
        <View key={i}>
          <Text
            variant="mono"
            weight="medium"
            className="text-frost-400"
            style={{ fontSize: 10, letterSpacing: 1.6, marginBottom: 6 }}
          >
            {s.label}
          </Text>
          <Text
            className="text-ink-100"
            style={{ fontSize: 14, lineHeight: 22 }}
          >
            {s.body}
          </Text>
        </View>
      ))}
    </View>
  );
}
