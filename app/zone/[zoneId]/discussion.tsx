import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import {
  getZoneSnapshotForDate,
  loadSnapshot,
  type FavoritesSnapshot,
} from "@/lib/offlineCache";
import { ZoneScreenHeader, ZoneScreenContainer } from "./_chrome";

export default function ZoneDiscussionScreen() {
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

  const sections: { label: string; body: string }[] = [];
  if (zone?.hazardDiscussion && zone.hazardDiscussion.trim()) {
    sections.push({
      label: "SNOWPACK & CONDITIONS",
      body: zone.hazardDiscussion.trim(),
    });
  }
  if (zone?.weatherDiscussion && zone.weatherDiscussion.trim()) {
    sections.push({
      label: "WEATHER DISCUSSION",
      body: zone.weatherDiscussion.trim(),
    });
  }

  return (
    <ZoneScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <ZoneScreenHeader
        eyebrow="FORECASTER NOTES"
        title={zone?.name ?? "Zone"}
      />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {!loaded ? (
          <Text
            variant="mono"
            className="text-ink-400"
            style={{ fontSize: 11, letterSpacing: 1.4 }}
          >
            LOADING…
          </Text>
        ) : sections.length === 0 ? (
          <Text
            className="text-ink-300"
            style={{ fontSize: 14, lineHeight: 20 }}
          >
            No additional forecaster discussion is bundled with today's forecast for this zone.
          </Text>
        ) : (
          <View style={{ gap: 24 }}>
            {sections.map((s, i) => (
              <View key={i}>
                <Text
                  variant="mono"
                  weight="medium"
                  className="text-ink-400"
                  style={{
                    fontSize: 10,
                    letterSpacing: 1.6,
                    marginBottom: 8,
                  }}
                >
                  {s.label}
                </Text>
                <Text
                  className="text-ink-100"
                  style={{ fontSize: 15, lineHeight: 23 }}
                >
                  {s.body}
                </Text>
              </View>
            ))}
            {zone?.author ? (
              <Text
                variant="mono"
                className="text-ink-400"
                style={{
                  fontSize: 10,
                  letterSpacing: 1.4,
                  marginTop: 8,
                  textAlign: "right",
                }}
              >
                — {zone.author.toUpperCase()}
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </ZoneScreenContainer>
  );
}
