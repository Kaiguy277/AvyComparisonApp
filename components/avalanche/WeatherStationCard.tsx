import { Alert, Linking, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { TempSparkline } from "./TempSparkline";
import { palette } from "@/constants/design";
import type { WeatherObservation } from "@/lib/api/avalanche";

interface Props {
  observations: WeatherObservation[];
  note?: string;
}

export function WeatherStationCard({ observations, note }: Props) {
  if (!observations || observations.length === 0) return null;

  return (
    <View>
      {note ? (
        <Text
          className="text-ink-400 italic mb-3"
          style={{ fontSize: 12, lineHeight: 17 }}
        >
          {note}
        </Text>
      ) : null}

      <View className="gap-4">
        {observations.map((obs, idx) => {
          const lastUpdated = obs.timestamp
            ? new Date(obs.timestamp).toLocaleString()
            : null;
          const hasWind = obs.wind !== null && obs.wind !== undefined;
          const stationUrl = `https://mesowest.utah.edu/cgi-bin/droman/meso_base_dyn.cgi?stn=${obs.stationTriplet}`;

          return (
            <View
              key={idx}
              style={{
                paddingTop: idx === 0 ? 0 : 14,
                borderTopWidth: idx === 0 ? 0 : 0.5,
                borderColor: palette.ink[700],
              }}
            >
              {/* Header */}
              <View className="flex-row items-baseline justify-between mb-3">
                <Pressable
                  onPress={() =>
                    Alert.alert(
                      obs.stationName,
                      [
                        `ID · ${obs.stationTriplet}`,
                        `Elevation · ${obs.elevation.toLocaleString()}'`,
                        `Quality · ${obs.dataQuality}`,
                        lastUpdated ? `Updated · ${lastUpdated}` : null,
                      ]
                        .filter(Boolean)
                        .join("\n"),
                      [
                        {
                          text: "View station",
                          onPress: () => Linking.openURL(stationUrl),
                        },
                        { text: "Close", style: "cancel" },
                      ],
                    )
                  }
                  className="flex-row items-baseline gap-2 flex-1"
                  hitSlop={6}
                >
                  <Text
                    variant="display"
                    className="text-ink-50"
                    style={{ fontSize: 16, lineHeight: 20 }}
                    numberOfLines={1}
                  >
                    {obs.stationName}
                  </Text>
                  <Ionicons
                    name="information-circle-outline"
                    size={12}
                    color={palette.ink[400]}
                  />
                </Pressable>
                <Text
                  variant="mono"
                  weight="medium"
                  className="text-ink-300"
                  style={{ fontSize: 11 }}
                >
                  {obs.elevation.toLocaleString()}′
                </Text>
              </View>

              {/* Current row */}
              <View className="flex-row items-center gap-4 mb-3">
                {obs.temperature.current !== null ? (
                  <Reading
                    icon="thermometer-outline"
                    color="#FCA5A5"
                    value={`${obs.temperature.current}°`}
                  />
                ) : null}
                {obs.snow.depth !== null ? (
                  <Reading
                    icon="snow-outline"
                    color={palette.frost[400]}
                    value={`${obs.snow.depth}″`}
                    suffix="depth"
                  />
                ) : null}
                {hasWind &&
                (obs.wind!.speedCurrent !== null || obs.wind!.direction !== null) ? (
                  <Reading
                    icon="navigate-outline"
                    color="#7DD3C0"
                    value={`${obs.wind!.direction || ""} ${obs.wind!.speedCurrent !== null ? obs.wind!.speedCurrent + " mph" : ""}`.trim()}
                  />
                ) : null}
              </View>

              <PeriodBlock
                label="LAST 24 H"
                snowChange={obs.snow.depth24hrChange}
                precip={obs.snow.precip24hr}
                tempHigh={obs.temperature.high24hr}
                tempLow={obs.temperature.low24hr}
                hourly={obs.temperature.hourly24hr}
                hours={24}
                wind={
                  hasWind
                    ? {
                        direction: obs.wind!.direction24hr,
                        avg: obs.wind!.speedAvg24hr,
                        max: obs.wind!.speedMax24hr,
                      }
                    : null
                }
              />

              <View style={{ height: 12 }} />

              <PeriodBlock
                label="LAST 72 H"
                snowChange={obs.snow.depth72hrChange}
                precip={obs.snow.precip72hr}
                tempHigh={obs.temperature.high72hr}
                tempLow={obs.temperature.low72hr}
                hourly={obs.temperature.hourly72hr}
                hours={72}
                wind={
                  hasWind
                    ? {
                        direction: obs.wind!.direction72hr,
                        avg: obs.wind!.speedAvg72hr,
                        max: obs.wind!.speedMax72hr,
                      }
                    : null
                }
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Reading({
  icon,
  color,
  value,
  suffix,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  value: string;
  suffix?: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Ionicons name={icon} size={12} color={color} />
      <Text
        variant="mono"
        weight="medium"
        className="text-ink-100"
        style={{ fontSize: 13 }}
      >
        {value}
      </Text>
      {suffix ? (
        <Text
          variant="mono"
          className="text-ink-400"
          style={{ fontSize: 10, letterSpacing: 0.6 }}
        >
          {suffix}
        </Text>
      ) : null}
    </View>
  );
}

interface PeriodBlockProps {
  label: string;
  snowChange: number | null;
  precip: number | null;
  tempHigh: number | null;
  tempLow: number | null;
  hourly?: { timestamp: string; value: number }[];
  hours: number;
  wind: { direction: string | null; avg: number | null; max: number | null } | null;
}

function PeriodBlock({
  label,
  snowChange,
  precip,
  tempHigh,
  tempLow,
  hourly,
  hours,
  wind,
}: PeriodBlockProps) {
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingBottom: 6,
          marginBottom: 8,
          borderBottomWidth: 0.5,
          borderColor: palette.ink[700],
        }}
      >
        <Text
          variant="mono"
          weight="medium"
          className="text-frost-400"
          style={{ fontSize: 9, letterSpacing: 1.6 }}
        >
          {label}
        </Text>
        <View style={{ flex: 1, height: 0.5, backgroundColor: palette.ink[700] }} />
      </View>

      <View className="flex-row" style={{ gap: 14 }}>
        {/* Snow */}
        <View className="flex-1">
          <Text
            variant="mono"
            className="text-ink-400 mb-1"
            style={{ fontSize: 9, letterSpacing: 1.2 }}
          >
            SNOW
          </Text>
          {snowChange !== null ? (
            <Text
              variant="mono"
              weight="bold"
              style={{
                fontSize: 16,
                color: snowChange > 0 ? palette.frost[400] : palette.ink[100],
              }}
            >
              {snowChange > 0 ? "+" : ""}
              {snowChange}″
            </Text>
          ) : (
            <Text
              variant="mono"
              className="text-ink-400"
              style={{ fontSize: 14 }}
            >
              —
            </Text>
          )}
          {precip !== null ? (
            <Text
              variant="mono"
              className="text-ink-300"
              style={{ fontSize: 11, marginTop: 1 }}
            >
              {precip.toFixed(1)}″ SWE
            </Text>
          ) : null}
        </View>

        {/* Temp */}
        <View className="flex-1">
          <Text
            variant="mono"
            className="text-ink-400 mb-1"
            style={{ fontSize: 9, letterSpacing: 1.2 }}
          >
            TEMP
          </Text>
          <View className="flex-row items-start gap-2">
            <View>
              {tempHigh !== null && tempLow !== null ? (
                <>
                  <Text
                    variant="mono"
                    weight="medium"
                    className="text-ink-100"
                    style={{ fontSize: 13 }}
                  >
                    H {tempHigh}°
                  </Text>
                  <Text
                    variant="mono"
                    weight="medium"
                    className="text-ink-300"
                    style={{ fontSize: 13 }}
                  >
                    L {tempLow}°
                  </Text>
                </>
              ) : (
                <Text
                  variant="mono"
                  className="text-ink-400"
                  style={{ fontSize: 14 }}
                >
                  —
                </Text>
              )}
            </View>
            {hourly && hourly.length >= 2 ? (
              <TempSparkline
                data={hourly}
                high={tempHigh}
                low={tempLow}
                hours={hours}
              />
            ) : null}
          </View>
        </View>

        {/* Wind */}
        {wind ? (
          <View className="flex-1">
            <Text
              variant="mono"
              className="text-ink-400 mb-1"
              style={{ fontSize: 9, letterSpacing: 1.2 }}
            >
              WIND
            </Text>
            {wind.direction ? (
              <Text
                variant="mono"
                weight="medium"
                className="text-ink-100"
                style={{ fontSize: 13 }}
              >
                {wind.direction}
              </Text>
            ) : null}
            {wind.avg !== null ? (
              <Text
                variant="mono"
                className="text-ink-300"
                style={{ fontSize: 11, marginTop: 1 }}
              >
                avg {wind.avg}
              </Text>
            ) : null}
            {wind.max !== null ? (
              <Text
                variant="mono"
                weight="medium"
                className="text-ink-100"
                style={{ fontSize: 11 }}
              >
                gust {wind.max}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
