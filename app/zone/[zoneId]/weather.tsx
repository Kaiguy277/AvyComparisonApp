import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { Text } from "@/components/ui/Text";
import { WeatherForecastCard } from "@/components/avalanche/WeatherForecastCard";
import {
  getZoneSnapshotForDate,
  loadSnapshot,
  type FavoritesSnapshot,
} from "@/lib/offlineCache";
import { ZoneScreenHeader, ZoneScreenContainer } from "./_chrome";

export default function ZoneWeatherOutlookScreen() {
  const { zoneId } = useLocalSearchParams<{ zoneId: string }>();
  const [snap, setSnap] = useState<FavoritesSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    loadSnapshot().then((s) => {
      setSnap(s);
      setLoaded(true);
    });
  }, []);

  const bundle = snap ? getZoneSnapshotForDate(snap, zoneId) : undefined;
  const zone = bundle?.forecast;
  const weather = bundle?.weather;
  const hasContent =
    !!weather?.nacWeather || !!weather?.nwsForecast || !!weather?.avgDiscussion;

  return (
    <ZoneScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <ZoneScreenHeader eyebrow="WEATHER OUTLOOK" title={zone?.name ?? "Zone"} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {!loaded ? (
          <Text
            variant="mono"
            className="text-ink-400"
            style={{ fontSize: 11, letterSpacing: 1.4 }}
          >
            LOADING…
          </Text>
        ) : !hasContent ? (
          <Text
            className="text-ink-300"
            style={{ fontSize: 14, lineHeight: 20 }}
          >
            No mountain weather forecast bundled with this zone yet.
          </Text>
        ) : (
          <WeatherForecastCard
            nacWeather={weather?.nacWeather}
            nwsForecast={weather?.nwsForecast}
            avgDiscussion={weather?.avgDiscussion}
            isLoading={false}
          />
        )}
      </ScrollView>
    </ZoneScreenContainer>
  );
}
