import { ScrollView } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { Text } from "@/components/ui/Text";
import { WeatherStationCard } from "@/components/avalanche/WeatherStationCard";
import { useZoneBundle } from "@/hooks/useZoneBundle";
import { AVAILABLE_ZONES } from "@/lib/zones";
import { ZoneScreenHeader, ZoneScreenContainer } from "@/components/avalanche/ZoneScreenChrome";

export default function ZoneStationsScreen() {
  const { zoneId, date } = useLocalSearchParams<{
    zoneId: string;
    date?: string;
  }>();
  const { forecast: zone, stations: bundleStations, loaded } = useZoneBundle(
    zoneId,
    date,
  );
  const stations = bundleStations ?? [];
  const displayName =
    zone?.name ??
    AVAILABLE_ZONES.find((z) => z.id === zoneId)?.name ??
    "Zone";

  return (
    <ZoneScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <ZoneScreenHeader
        eyebrow="STATIONS"
        title={displayName}
        count={stations.length}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {!loaded ? (
          <Text
            variant="mono"
            className="text-ink-400"
            style={{ fontSize: 11, letterSpacing: 1.4 }}
          >
            LOADING…
          </Text>
        ) : stations.length === 0 ? (
          <Text
            className="text-ink-300"
            style={{ fontSize: 14, lineHeight: 20 }}
          >
            No weather stations are linked to this zone in the offline snapshot.
          </Text>
        ) : (
          <WeatherStationCard
            observations={stations}
            note={
              zoneId === "douglas-island"
                ? "These stations sit outside the forecast zone. Expect high spatial variability."
                : undefined
            }
          />
        )}
      </ScrollView>
    </ZoneScreenContainer>
  );
}
