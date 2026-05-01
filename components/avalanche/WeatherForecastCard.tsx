import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import type {
  AvgDiscussion,
  NacWeatherProduct,
  NwsForecast,
} from "@/lib/api/avalanche";

interface Props {
  nacWeather?: NacWeatherProduct;
  nwsForecast?: NwsForecast;
  avgDiscussion?: AvgDiscussion;
  isLoading?: boolean;
}

export function WeatherForecastCard({
  nacWeather,
  nwsForecast,
  avgDiscussion,
  isLoading,
}: Props) {
  if (isLoading) {
    return (
      <View className="flex-row items-center gap-2">
        <ActivityIndicator size="small" color={palette.ink[300]} />
        <Text
          variant="mono"
          className="text-ink-300"
          style={{ fontSize: 11, letterSpacing: 1.2 }}
        >
          FETCHING FORECAST…
        </Text>
      </View>
    );
  }

  const hasAvg = !!avgDiscussion?.discussion;
  const hasNac = !!nacWeather?.discussion;
  const hasNws = !!nwsForecast?.periods?.length;

  const discussion = hasAvg
    ? avgDiscussion!.discussion
    : hasNac
      ? nacWeather!.discussion
      : hasNws
        ? nwsForecast!.periods
            .slice(0, 2)
            .map((p) => `${p.name}: ${p.detailedForecast}`)
            .join("\n\n")
        : null;

  if (!discussion) return null;

  let sourceLabel: string;
  let sourceTime: string | null = null;
  let sourceUrl: string | null = null;

  if (hasAvg) {
    sourceLabel = `NWS AVG · ${avgDiscussion!.wfo}`;
    sourceTime = avgDiscussion!.issuedTime;
    sourceUrl = `https://forecast.weather.gov/product.php?site=${avgDiscussion!.wfo}&issuedby=${avgDiscussion!.wfo}&product=AVG&format=CI&version=1`;
  } else if (hasNac) {
    sourceLabel = "Avalanche center weather";
    sourceTime = nacWeather!.publishedTime ?? null;
  } else {
    sourceLabel = `NWS · ${nwsForecast!.gridpoint}`;
    sourceUrl = nwsForecast!.forecastPageUrl;
  }

  return (
    <View>
      <Text
        className="text-ink-100"
        style={{ fontSize: 14, lineHeight: 21 }}
      >
        {discussion}
      </Text>
      <View
        className="flex-row items-center justify-between mt-3 pt-3"
        style={{ borderTopWidth: 0.5, borderColor: palette.ink[700], gap: 12 }}
      >
        <View className="flex-1">
          <Text
            variant="mono"
            weight="medium"
            className="text-ink-300"
            style={{ fontSize: 10, letterSpacing: 1.2 }}
          >
            {sourceLabel}
          </Text>
          {sourceTime ? (
            <Text
              variant="mono"
              className="text-ink-400"
              style={{ fontSize: 9, letterSpacing: 0.8, marginTop: 2 }}
            >
              {new Date(sourceTime).toLocaleString()}
            </Text>
          ) : null}
        </View>
        {sourceUrl ? (
          <Pressable
            onPress={() => Linking.openURL(sourceUrl!)}
            className="flex-row items-center gap-1"
            hitSlop={8}
          >
            <Text
              variant="mono"
              weight="medium"
              className="text-frost-400"
              style={{ fontSize: 10, letterSpacing: 1.2 }}
            >
              FULL FORECAST
            </Text>
            <Ionicons
              name="arrow-forward"
              size={11}
              color={palette.frost[400]}
              style={{ transform: [{ rotate: "-45deg" }] }}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
