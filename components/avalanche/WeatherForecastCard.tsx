import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
        <ActivityIndicator size="small" />
        <Text className="text-sm text-muted-foreground">Loading weather forecast...</Text>
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
    sourceLabel = `NWS Avalanche Weather Guidance (${avgDiscussion!.wfo})`;
    sourceTime = avgDiscussion!.issuedTime;
    sourceUrl = `https://forecast.weather.gov/product.php?site=${avgDiscussion!.wfo}&issuedby=${avgDiscussion!.wfo}&product=AVG&format=CI&version=1`;
  } else if (hasNac) {
    sourceLabel = "Avalanche Center Weather Discussion";
    sourceTime = nacWeather!.publishedTime ?? null;
  } else {
    sourceLabel = `NWS Mountain Forecast (${nwsForecast!.gridpoint})`;
    sourceUrl = nwsForecast!.forecastPageUrl;
  }

  return (
    <View className="gap-2">
      <Text className="text-sm text-muted-foreground leading-5">{discussion}</Text>
      <View className="flex-row items-center justify-between flex-wrap gap-2 pt-1">
        <Text className="text-[10px] text-muted-foreground/60 flex-1">
          {sourceLabel}
          {sourceTime ? ` — ${new Date(sourceTime).toLocaleString()}` : ""}
        </Text>
        {sourceUrl ? (
          <Pressable
            onPress={() => Linking.openURL(sourceUrl!)}
            className="flex-row items-center gap-1"
          >
            <Text className="text-xs text-primary">View full forecast</Text>
            <Ionicons name="open-outline" size={12} color="#0d9488" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
