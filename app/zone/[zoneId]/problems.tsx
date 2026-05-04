import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { Text } from "@/components/ui/Text";
import { AvalancheProblemCard } from "@/components/avalanche/AvalancheProblemCard";
import { palette } from "@/constants/design";
import {
  getZoneSnapshotForDate,
  loadSnapshot,
  type FavoritesSnapshot,
} from "@/lib/offlineCache";
import { getZoneSession } from "@/lib/zoneSession";
import { ZoneScreenHeader, ZoneScreenContainer } from "@/components/avalanche/ZoneScreenChrome";

export default function ZoneProblemsScreen() {
  const { zoneId, date } = useLocalSearchParams<{
    zoneId: string;
    date?: string;
  }>();
  const [snap, setSnap] = useState<FavoritesSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    loadSnapshot().then((s) => {
      setSnap(s);
      setLoaded(true);
    });
  }, []);

  const bundle = snap ? getZoneSnapshotForDate(snap, zoneId, date) : undefined;
  const session = getZoneSession(zoneId);
  const zone = bundle?.forecast ?? session?.forecast;
  const problems = zone?.problems ?? [];

  return (
    <ZoneScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <ZoneScreenHeader
        eyebrow="PROBLEMS"
        title={zone?.name ?? "Zone"}
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
            No avalanche problems are listed in today's forecast for this zone.
          </Text>
        ) : (
          problems.map((p, i) => <AvalancheProblemCard key={i} problem={p} />)
        )}
      </ScrollView>
    </ZoneScreenContainer>
  );
}
