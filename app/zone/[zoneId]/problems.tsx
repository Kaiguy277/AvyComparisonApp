import { ScrollView } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { Text } from "@/components/ui/Text";
import { AvalancheProblemCard } from "@/components/avalanche/AvalancheProblemCard";
import { useZoneBundle } from "@/hooks/useZoneBundle";
import { AVAILABLE_ZONES } from "@/lib/zones";
import { ZoneScreenHeader, ZoneScreenContainer } from "@/components/avalanche/ZoneScreenChrome";

export default function ZoneProblemsScreen() {
  const { zoneId, date } = useLocalSearchParams<{
    zoneId: string;
    date?: string;
  }>();
  const { forecast: zone, loaded, isToday } = useZoneBundle(zoneId, date);
  const problems = zone?.problems ?? [];

  return (
    <ZoneScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <ZoneScreenHeader
        eyebrow="PROBLEMS"
        title={
          zone?.name ??
          AVAILABLE_ZONES.find((z) => z.id === zoneId)?.name ??
          "Zone"
        }
        count={problems.length}
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
        ) : problems.length === 0 ? (
          <Text
            className="text-ink-300"
            style={{ fontSize: 14, lineHeight: 20 }}
          >
            {isToday
              ? "No avalanche problems are listed in today's forecast for this zone."
              : "No forecast is cached for this zone on the selected day."}
          </Text>
        ) : (
          problems.map((p, i) => <AvalancheProblemCard key={i} problem={p} />)
        )}
      </ScrollView>
    </ZoneScreenContainer>
  );
}
