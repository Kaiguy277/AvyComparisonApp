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
import { ZONE_TO_CENTER } from "@/lib/zones";
import type {
  AvalancheZone,
  DangerRating,
  ElevationDanger,
  ZoneWeatherForecast,
} from "@/lib/api/avalanche";

// Resolve a zone to its avalanche-center ID so we can deep-link to the
// official observations page (avalanche.org aggregates obs per center).
function centerIdFor(zone: AvalancheZone): string {
  return ZONE_TO_CENTER[zone.id] || "";
}

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

        <View className="flex-row items-center gap-3 mt-3 flex-wrap">
          {zone.forecastUrl ? (
            <Pressable
              onPress={() => Linking.openURL(zone.forecastUrl)}
              className="flex-row items-center gap-1.5"
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
          <Pressable
            onPress={() =>
              Linking.openURL(
                `https://avalanche.org/observations/?center_id=${centerIdFor(zone)}`,
              )
            }
            className="flex-row items-center gap-1.5"
            hitSlop={8}
          >
            <Text
              variant="mono"
              weight="medium"
              className="text-frost-400"
              style={{ fontSize: 10, letterSpacing: 1.4 }}
            >
              RECENT OBS
            </Text>
            <Ionicons
              name="arrow-forward-outline"
              size={11}
              color={palette.frost[400]}
              style={{ transform: [{ rotate: "-45deg" }] }}
            />
          </Pressable>
          {zone.author ? (
            <Text
              variant="mono"
              className="text-ink-400"
              style={{ fontSize: 10, letterSpacing: 1.2 }}
            >
              · BY {zone.author.toUpperCase()}
            </Text>
          ) : null}
        </View>

        {/* Announcement / advisory banner — when NAC ships an alert */}
        {zone.announcement ? (
          <View
            style={{
              marginTop: 14,
              padding: 12,
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
                style={{ fontSize: 10, letterSpacing: 1.4, marginBottom: 4 }}
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
        {/* Bottom line — the full forecaster narrative, quoted as the
            headline read. Used to be a synthesized first sentence labeled
            "KEY MESSAGE"; we now surface the whole thing because it's the
            primary thing a backcountry user wants to read. */}
        {zone.travelAdvice && zone.travelAdvice.trim() ? (
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
              BOTTOM LINE
            </Text>
            <Text
              className="text-ink-50"
              style={{ fontSize: 16, lineHeight: 23 }}
            >
              {zone.travelAdvice.trim()}
            </Text>
          </View>
        ) : null}

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
                <AvalancheProblemCard key={i} problem={p} />
              ))}
            </View>
          </Collapsible>
        ) : null}

        {/* Forecaster's higher-level narrative — bottom line + snowpack
            discussion. The per-problem narratives live with each problem
            up above, so this rollup stays focused on the bigger picture. */}
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

// Returns true if the zone has any forecaster-level narrative beyond the
// bottom-line callout above (the bottom line is shown as the card headline,
// so this rollup only covers snowpack + weather discussions).
function hasForecasterDiscussion(zone: AvalancheZone): boolean {
  if (zone.hazardDiscussion && zone.hazardDiscussion.trim().length > 0) return true;
  if (zone.weatherDiscussion && zone.weatherDiscussion.trim().length > 0) return true;
  return false;
}

// The forecaster's secondary narrative: snowpack discussion + weather
// discussion (when populated). The bottom line is the card headline above
// and per-problem prose is co-located with each problem card.
function ForecasterDiscussion({ zone }: { zone: AvalancheZone }) {
  const sections: { label: string; body: string }[] = [];
  if (zone.hazardDiscussion && zone.hazardDiscussion.trim()) {
    sections.push({ label: "SNOWPACK & CONDITIONS", body: zone.hazardDiscussion.trim() });
  }
  if (zone.weatherDiscussion && zone.weatherDiscussion.trim()) {
    sections.push({ label: "WEATHER DISCUSSION", body: zone.weatherDiscussion.trim() });
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
