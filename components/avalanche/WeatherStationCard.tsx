import { View, Text, Pressable, Linking, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { WeatherObservation } from "@/lib/api/avalanche";
import { TempSparkline } from "./TempSparkline";

interface Props {
  observations: WeatherObservation[];
  note?: string;
}

export function WeatherStationCard({ observations, note }: Props) {
  if (!observations || observations.length === 0) return null;

  return (
    <View className="rounded-lg border border-blue-500/30 p-3 bg-card">
      <View className="flex-row items-center gap-2 mb-2">
        <Ionicons name="pulse-outline" size={16} color="#3b82f6" />
        <Text className="text-base font-semibold text-foreground">
          Weather Station Observations
        </Text>
      </View>
      {note ? (
        <Text className="text-xs italic text-muted-foreground mb-3">{note}</Text>
      ) : null}

      {observations.map((obs, idx) => {
        const lastUpdated = obs.timestamp
          ? new Date(obs.timestamp).toLocaleString()
          : null;
        const hasWind = obs.wind !== null && obs.wind !== undefined;
        const stationUrl = `https://mesowest.utah.edu/cgi-bin/droman/meso_base_dyn.cgi?stn=${obs.stationTriplet}`;

        return (
          <View key={idx} className={idx > 0 ? "mt-4 pt-4 border-t border-border/50" : ""}>
            <View className="flex-row items-center justify-between">
              <Pressable
                onPress={() => {
                  Alert.alert(obs.stationName, [
                    `Station ID: ${obs.stationTriplet}`,
                    `Elevation: ${obs.elevation.toLocaleString()}'`,
                    `Data Quality: ${obs.dataQuality}`,
                    lastUpdated ? `Last Updated: ${lastUpdated}` : null,
                  ]
                    .filter(Boolean)
                    .join("\n"), [
                    { text: "View Station Data", onPress: () => Linking.openURL(stationUrl) },
                    { text: "Close", style: "cancel" },
                  ]);
                }}
                className="flex-row items-center gap-1.5 flex-1"
              >
                <Text className="text-xs font-medium text-foreground">
                  {obs.stationName}
                </Text>
                <Ionicons name="information-circle-outline" size={14} color="#6b7280" />
              </Pressable>
              <Text className="text-xs font-semibold text-muted-foreground">
                {obs.elevation.toLocaleString()}' Elev
              </Text>
            </View>

            {/* Current */}
            <View className="flex-row items-center gap-4 mt-2">
              {obs.temperature.current !== null ? (
                <View className="flex-row items-center gap-1">
                  <Ionicons name="thermometer-outline" size={12} color="#f87171" />
                  <Text className="text-sm font-semibold text-foreground">
                    {obs.temperature.current}°F
                  </Text>
                </View>
              ) : null}
              {obs.snow.depth !== null ? (
                <View className="flex-row items-center gap-1">
                  <Ionicons name="snow-outline" size={12} color="#3b82f6" />
                  <Text className="text-sm font-semibold text-foreground">
                    {obs.snow.depth}" depth
                  </Text>
                </View>
              ) : null}
              {hasWind &&
              (obs.wind!.speedCurrent !== null || obs.wind!.direction !== null) ? (
                <View className="flex-row items-center gap-1">
                  <Ionicons name="navigate-outline" size={12} color="#14b8a6" />
                  <Text className="text-sm font-semibold text-foreground">
                    {obs.wind!.direction ? `${obs.wind!.direction} ` : ""}
                    {obs.wind!.speedCurrent !== null
                      ? `${obs.wind!.speedCurrent} mph`
                      : ""}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* 24h block */}
            <PeriodBlock
              label="Last 24 Hours"
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

            {/* 72h block */}
            <PeriodBlock
              label="Last 72 Hours"
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
    <View className="mt-3">
      <Text className="text-xs font-semibold text-foreground border-b border-border pb-1 mb-2">
        {label}
      </Text>
      <View className="flex-row gap-3">
        {/* Snow */}
        <View className="flex-1">
          <View className="flex-row items-center gap-1 mb-1">
            <Ionicons name="snow-outline" size={12} color="#3b82f6" />
            <Text className="text-xs font-medium text-muted-foreground">Snow</Text>
          </View>
          {snowChange !== null ? (
            <Text
              className={`text-sm font-semibold ${
                snowChange > 0 ? "text-blue-600" : "text-foreground"
              }`}
            >
              {snowChange > 0 ? "+" : ""}
              {snowChange}"
            </Text>
          ) : null}
          {precip !== null ? (
            <Text className="text-sm font-semibold text-foreground">
              {precip.toFixed(1)}" SWE
            </Text>
          ) : null}
        </View>

        {/* Temp */}
        <View className="flex-1">
          <View className="flex-row items-center gap-1 mb-1">
            <Ionicons name="thermometer-outline" size={12} color="#f87171" />
            <Text className="text-xs font-medium text-muted-foreground">Temp</Text>
          </View>
          <View className="flex-row items-start gap-2">
            <View>
              {tempHigh !== null && tempLow !== null ? (
                <>
                  <Text className="text-sm font-semibold text-foreground">
                    H: {tempHigh}°
                  </Text>
                  <Text className="text-sm font-semibold text-foreground">
                    L: {tempLow}°
                  </Text>
                </>
              ) : (
                <Text className="text-sm text-muted-foreground">N/A</Text>
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
            <View className="flex-row items-center gap-1 mb-1">
              <Ionicons name="navigate-outline" size={12} color="#14b8a6" />
              <Text className="text-xs font-medium text-muted-foreground">Wind</Text>
            </View>
            {wind.direction ? (
              <Text className="text-sm font-semibold text-foreground">
                {wind.direction}
              </Text>
            ) : null}
            {wind.avg !== null ? (
              <Text className="text-sm text-foreground">avg {wind.avg} mph</Text>
            ) : null}
            {wind.max !== null ? (
              <Text className="text-sm text-foreground">
                gusts <Text className="font-semibold">{wind.max} mph</Text>
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
