import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import { ageHours, formatAge } from "@/lib/offlineCache";
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
  // ISO timestamp of when the underlying bundle was last fetched (server
  // cache when online, snapshot fetchedAt when offline). Drives the small
  // "FETCHED Xh ago" badge in the card header so age is visible at a glance
  // on every card, not just buried in the offline banner.
  dataFetchedAt?: string;
}

// Map fetch age to a tint so old data is visually obvious.
//   < 3h   →  muted (normal)
//   3–12h  →  aspen (warning — older than the cron cadence by a wide margin)
//   > 12h  →  red   (alarm — likely from before today)
function ageColor(iso: string | undefined): string {
  const h = ageHours(iso);
  if (h === null) return palette.ink[400];
  if (h > 12) return "#FCA5A5";
  if (h > 3) return palette.aspen[400];
  return palette.ink[300];
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
  // Prefer the ISO date the forecast says it's for; fall back to today +
  // offset. Some upstream sources (UAC) send literal "Today"/"Tomorrow"
  // labels rather than real dates, so an unparseable iso must also use
  // the offset, not just an absent one.
  let d: Date;
  const parsed = iso ? new Date(iso) : null;
  if (parsed && !isNaN(parsed.getTime())) {
    d = parsed;
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
  dataFetchedAt,
}: Props) {
  const fresh = freshness[zone.freshness.status];
  const today = zone.forecast?.[0];
  const tomorrow = zone.forecast?.[1];
  const headlineColor = today
    ? dangerColors[highest(today.danger)].fill
    : palette.ink[500];

  // Each zone card collapses by default — the header (name, freshness,
  // today/tomorrow danger panel) gives the at-a-glance read; tap to expand
  // for bottom line, problems, forecaster discussion, weather + stations.
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = () => {
    Haptics.selectionAsync().catch(() => {});
    setExpanded((v) => !v);
  };

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

      {/* Two layouts: a dense scannable summary when collapsed (name +
          today's elevation ratings + problem chips) so 3–4 zones fit on a
          screen; the full header with dates, freshness badge, and
          Today+Tomorrow panel when expanded. Tapping the row toggles. */}
      {!expanded ? (
        <Pressable onPress={toggleExpanded}>
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: fresh.fill,
                }}
              />
              <Text
                variant="display"
                className="text-ink-50"
                style={{ fontSize: 18, lineHeight: 22, flex: 1 }}
                numberOfLines={1}
              >
                {zone.name}
              </Text>
              <Ionicons
                name="chevron-down"
                size={16}
                color={palette.ink[300]}
              />
            </View>

            {today ? (
              <View
                style={{
                  flexDirection: "row",
                  gap: 6,
                  marginTop: 10,
                }}
              >
                <ElevationChip code="ALP" rating={today.danger.alpine} />
                <ElevationChip code="TL" rating={today.danger.treeline} />
                <ElevationChip code="BTL" rating={today.danger.belowTreeline} />
              </View>
            ) : null}

            {zone.problems && zone.problems.length > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  gap: 6,
                  marginTop: 8,
                  flexWrap: "wrap",
                }}
              >
                {zone.problems.map((p, i) => (
                  <ProblemChip key={i} name={p.name} />
                ))}
              </View>
            ) : null}

            {/* Compact issued / expires / fetched footnote — quick read of
                how fresh the forecast is without expanding. */}
            {zone.freshness.issueDate || zone.freshness.expiresDate || dataFetchedAt ? (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 12,
                  marginTop: 8,
                }}
              >
                {zone.freshness.issueDate ? (
                  <Text
                    variant="mono"
                    className="text-ink-400"
                    style={{ fontSize: 9, letterSpacing: 1.2 }}
                  >
                    ISSUED{" "}
                    <Text className="text-ink-200" style={{ fontSize: 9 }}>
                      {zone.freshness.issueDate}
                    </Text>
                  </Text>
                ) : null}
                {zone.freshness.expiresDate ? (
                  <Text
                    variant="mono"
                    className="text-ink-400"
                    style={{ fontSize: 9, letterSpacing: 1.2 }}
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
                {dataFetchedAt ? (
                  <Text
                    variant="mono"
                    className="text-ink-400"
                    style={{ fontSize: 9, letterSpacing: 1.2 }}
                  >
                    FETCHED{" "}
                    <Text style={{ fontSize: 9, color: ageColor(dataFetchedAt) }}>
                      {formatAge(dataFetchedAt).toUpperCase()}
                    </Text>
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </Pressable>
      ) : (
        <Pressable onPress={toggleExpanded}>
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
                  {dataFetchedAt ? (
                    <View>
                      <Text
                        variant="mono"
                        className="text-ink-400"
                        style={{ fontSize: 9, letterSpacing: 1.2 }}
                      >
                        FETCHED
                      </Text>
                      <Text
                        variant="mono"
                        style={{ fontSize: 11, color: ageColor(dataFetchedAt) }}
                      >
                        {formatAge(dataFetchedAt).toUpperCase()}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Badge fill={fresh.fill} ink={fresh.ink}>
                  {fresh.label}
                </Badge>
                <Ionicons
                  name="chevron-up"
                  size={18}
                  color={palette.ink[300]}
                />
              </View>
            </View>
          </View>

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
        </Pressable>
      )}

      {/* Everything below is gated by the expanded state. The forecast
          link, announcement, bottom line, problems, forecaster discussion,
          weather outlook, and stations all hide when collapsed. */}
      {!expanded ? null : (
        <>
          <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
            <View className="flex-row items-center gap-3 flex-wrap">
              {zone.forecastUrl ? (
                <Pressable
                  onPress={() => Linking.openURL(zone.forecastUrl)}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: 7,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: palette.frost[400],
                    backgroundColor: pressed
                      ? palette.frost[400] + "33"
                      : palette.frost[400] + "1A",
                  })}
                >
                  <Ionicons
                    name="open-outline"
                    size={13}
                    color={palette.frost[400]}
                  />
                  <Text
                    variant="mono"
                    weight="medium"
                    style={{
                      fontSize: 11,
                      letterSpacing: 1.2,
                      color: palette.frost[400],
                      textDecorationLine: "underline",
                    }}
                  >
                    VIEW OFFICIAL FORECAST & RECENT OBS
                  </Text>
                </Pressable>
              ) : null}
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

          <CardContent style={{ paddingTop: 4 }} className="gap-3">
        {/* Bottom line — the full forecaster narrative, quoted as the
            headline read. Wrapped in a Collapsible (default open) so users
            who've already read it can tuck it away to get to the problems
            faster, but it's the primary read so it expands by default. */}
        {zone.travelAdvice && zone.travelAdvice.trim() ? (
          <Collapsible
            leadingAccent={palette.frost[500]}
            title={
              <Text
                variant="mono"
                weight="medium"
                className="text-frost-400"
                style={{ fontSize: 11, letterSpacing: 1.6 }}
              >
                BOTTOM LINE
              </Text>
            }
          >
            <Text
              className="text-ink-50"
              style={{ fontSize: 16, lineHeight: 23 }}
            >
              {zone.travelAdvice.trim()}
            </Text>
          </Collapsible>
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
        </>
      )}
    </Card>
  );
}

// Compact danger chip used in the collapsed-card summary. Shows the
// elevation code (ALP/TL/BTL) tinted by danger color so the rating reads
// at a glance without needing an explicit label.
const RATING_ABBREV: Record<DangerRating, string> = {
  LOW: "LOW",
  MODERATE: "MOD",
  CONSIDERABLE: "CONS",
  HIGH: "HIGH",
  EXTREME: "EXTR",
  NO_RATING: "—",
};

function ElevationChip({
  code,
  rating,
}: {
  code: string;
  rating: DangerRating;
}) {
  const c = dangerColors[rating];
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: c.fill,
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 6,
      }}
    >
      <Text
        variant="mono"
        weight="bold"
        style={{
          fontSize: 10,
          letterSpacing: 1.2,
          color: c.ink,
          opacity: 0.7,
        }}
      >
        {code}
      </Text>
      <Text
        variant="mono"
        weight="bold"
        style={{
          fontSize: 11,
          letterSpacing: 0.6,
          color: c.ink,
        }}
      >
        {RATING_ABBREV[rating]}
      </Text>
    </View>
  );
}

// Tiny pill with the avalanche problem name. Aspen-tinted to match the
// PROBLEMS section in the expanded card — visual continuity makes it
// obvious what the chips represent.
function ProblemChip({ name }: { name: string }) {
  return (
    <View
      style={{
        paddingVertical: 3,
        paddingHorizontal: 7,
        borderRadius: 5,
        borderWidth: 0.5,
        borderColor: palette.aspen[500] + "99",
        backgroundColor: palette.aspen[500] + "1A",
      }}
    >
      <Text
        variant="mono"
        weight="medium"
        style={{
          fontSize: 9,
          letterSpacing: 1.2,
          color: palette.aspen[400],
        }}
      >
        {name.toUpperCase()}
      </Text>
    </View>
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
