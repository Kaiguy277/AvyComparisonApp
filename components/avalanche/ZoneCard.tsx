import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Collapsible } from "@/components/ui/Collapsible";
import { ElevationPyramid } from "./ElevationPyramid";
import { AvalancheProblemCard } from "./AvalancheProblemCard";
import { WeatherStationCard } from "./WeatherStationCard";
import { WeatherForecastCard } from "./WeatherForecastCard";
import { freshnessConfig } from "./dangerColors";
import type { AvalancheZone, ZoneWeatherForecast } from "@/lib/api/avalanche";

interface Props {
  zone: AvalancheZone;
  isSnotelLoading?: boolean;
  isWeatherForecastLoading?: boolean;
  weatherForecast?: ZoneWeatherForecast;
}

export function ZoneCard({
  zone,
  isSnotelLoading,
  isWeatherForecastLoading,
  weatherForecast,
}: Props) {
  const freshness = freshnessConfig[zone.freshness.status];
  const today = zone.forecast?.[0];
  const tomorrow = zone.forecast?.[1];

  return (
    <Card>
      <CardHeader>
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <CardTitle>{zone.name}</CardTitle>
            <CardDescription className="mt-1">
              {zone.freshness.issueDate ? `Issued: ${zone.freshness.issueDate}` : ""}
            </CardDescription>
            {zone.freshness.expiresDate ? (
              <Text
                className={`text-xs mt-0.5 ${
                  zone.freshness.status === "expired"
                    ? "text-red-600 font-medium"
                    : zone.freshness.status === "expiring"
                      ? "text-orange-600 font-medium"
                      : "text-muted-foreground"
                }`}
              >
                Expires: {zone.freshness.expiresDate}
              </Text>
            ) : null}
          </View>
          <Badge className={`${freshness.bg}`} textClassName={freshness.color}>
            {freshness.label}
          </Badge>
        </View>

        {zone.forecastUrl ? (
          <Pressable
            onPress={() => Linking.openURL(zone.forecastUrl)}
            className="flex-row items-center gap-1 mt-2"
          >
            <Text className="text-xs text-primary">View Official Forecast</Text>
            <Ionicons name="open-outline" size={12} color="#0d9488" />
          </Pressable>
        ) : null}
      </CardHeader>

      <CardContent className="gap-4">
        {today ? (
          <View className="flex-row gap-4">
            <View className="flex-1 items-center">
              <Text className="text-xs font-medium text-muted-foreground mb-2">Today</Text>
              <ElevationPyramid danger={today.danger} />
            </View>
            {tomorrow ? (
              <View className="flex-1 items-center">
                <Text className="text-xs font-medium text-muted-foreground mb-2">
                  Tomorrow
                </Text>
                <ElevationPyramid danger={tomorrow.danger} />
              </View>
            ) : null}
          </View>
        ) : null}

        <View>
          <Text className="text-sm font-medium text-foreground mb-1">Key Message</Text>
          <Text className="text-sm text-muted-foreground">{zone.keyMessage}</Text>
        </View>

        <View className="gap-1">
          {zone.problems && zone.problems.length > 0 ? (
            <Collapsible
              title={
                <View className="flex-row items-center gap-2 flex-1">
                  <Ionicons name="warning-outline" size={16} color="#f97316" />
                  <Text className="text-sm font-medium text-foreground">
                    Avalanche Problems ({zone.problems.length})
                  </Text>
                </View>
              }
            >
              <View className="gap-2">
                {zone.problems.map((problem, i) => (
                  <AvalancheProblemCard key={i} problem={problem} />
                ))}
              </View>
            </Collapsible>
          ) : zone.hazardDiscussion ? (
            <Collapsible
              title={
                <View className="flex-row items-center gap-2 flex-1">
                  <Ionicons name="warning-outline" size={16} color="#f97316" />
                  <Text className="text-sm font-medium text-foreground">
                    Hazard Discussion
                  </Text>
                </View>
              }
            >
              <Text className="text-sm text-muted-foreground">
                {zone.hazardDiscussion}
              </Text>
            </Collapsible>
          ) : null}

          <Collapsible
            title={
              <View className="flex-row items-center gap-2 flex-1">
                <Ionicons name="compass-outline" size={16} color="#3b82f6" />
                <Text className="text-sm font-medium text-foreground">Travel Advice</Text>
              </View>
            }
          >
            <Text className="text-sm text-muted-foreground">{zone.travelAdvice}</Text>
          </Collapsible>

          {weatherForecast?.nacWeather ||
          weatherForecast?.nwsForecast ||
          weatherForecast?.avgDiscussion ||
          (isWeatherForecastLoading && !weatherForecast) ? (
            <Collapsible
              className="border-sky-500/30"
              title={
                <View className="flex-row items-center gap-2 flex-1 flex-wrap">
                  <Ionicons name="cloud-outline" size={16} color="#0ea5e9" />
                  <Text className="text-sm font-medium text-foreground">
                    Weather Outlook
                  </Text>
                  {weatherForecast?.avgDiscussion ? (
                    <Badge variant="outline">AVG</Badge>
                  ) : null}
                  {weatherForecast?.nacWeather ? (
                    <Badge variant="outline">Avy Center</Badge>
                  ) : null}
                  {weatherForecast?.nwsForecast ? (
                    <Badge variant="outline">NWS Mountain</Badge>
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
              className="border-blue-500/30"
              title={
                <View className="flex-row items-center gap-2 flex-1">
                  <Ionicons name="snow-outline" size={16} color="#3b82f6" />
                  <Text className="text-sm font-medium text-foreground">
                    Weather Stations ({zone.weatherObservations.length})
                  </Text>
                </View>
              }
            >
              <WeatherStationCard
                observations={zone.weatherObservations}
                note={
                  zone.id === "douglas-island"
                    ? "Note: These stations are outside the forecast zone. Expect high spatial variability."
                    : undefined
                }
              />
            </Collapsible>
          ) : null}
        </View>

        {!zone.weatherObservations && isSnotelLoading ? (
          <View className="flex-row items-center gap-2 p-3 bg-muted/30 rounded-lg">
            <ActivityIndicator size="small" />
            <Text className="text-sm text-muted-foreground">
              Loading weather station data...
            </Text>
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}
