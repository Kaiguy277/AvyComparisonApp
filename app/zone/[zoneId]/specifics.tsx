import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/Text";
import { AvalancheProblemCard } from "@/components/avalanche/AvalancheProblemCard";
import { WeatherForecastCard } from "@/components/avalanche/WeatherForecastCard";
import { WeatherStationCard } from "@/components/avalanche/WeatherStationCard";
import { palette } from "@/constants/design";
import {
  getZoneSnapshotForDate,
  loadSnapshot,
  type FavoritesSnapshot,
} from "@/lib/offlineCache";
import type { AvalancheZone } from "@/lib/api/avalanche";

export default function ZoneSpecificsScreen() {
  const insets = useSafeAreaInsets();
  const { zoneId } = useLocalSearchParams<{ zoneId: string }>();
  const router = useRouter();

  const [snap, setSnap] = useState<FavoritesSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    loadSnapshot().then((s) => {
      setSnap(s);
      setLoaded(true);
    });
  }, []);

  const bundle = snap ? getZoneSnapshotForDate(snap, zoneId) : undefined;
  const zone: AvalancheZone | undefined = bundle?.forecast;
  const weather = bundle?.weather;
  const stations = bundle?.stations;

  return (
    <View style={{ flex: 1, backgroundColor: palette.ink[950] }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderBottomWidth: 0.5,
          borderColor: palette.ink[700],
        }}
      >
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.back();
          }}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={palette.ink[100]} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            variant="mono"
            weight="medium"
            className="text-ink-400"
            style={{ fontSize: 10, letterSpacing: 1.4 }}
          >
            SPECIFICS
          </Text>
          <Text
            variant="display"
            className="text-ink-50"
            style={{ fontSize: 18, lineHeight: 22, marginTop: 2 }}
            numberOfLines={1}
          >
            {zone?.name ?? "Zone"}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: insets.bottom + 32,
          gap: 18,
        }}
      >
        {!loaded ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <ActivityIndicator size="small" color={palette.ink[300]} />
            <Text
              variant="mono"
              className="text-ink-300"
              style={{ fontSize: 11, letterSpacing: 1.2 }}
            >
              LOADING…
            </Text>
          </View>
        ) : !zone ? (
          <Text className="text-ink-300" style={{ fontSize: 14, lineHeight: 20 }}>
            Forecast not cached yet. Open this zone from the home grid while online to fetch and cache it.
          </Text>
        ) : (
          <>
            {/* PER-PROBLEM CARDS — rose, likelihood, size, aspect/elevation */}
            {zone.problems && zone.problems.length > 0 ? (
              <Section
                label={`PROBLEMS · ${zone.problems.length}`}
                accentColor={palette.aspen[500]}
              >
                <View style={{ gap: 10 }}>
                  {zone.problems.map((p, i) => (
                    <AvalancheProblemCard key={i} problem={p} />
                  ))}
                </View>
              </Section>
            ) : null}

            {/* FORECASTER DISCUSSION — snowpack + weather narrative */}
            {hasForecasterDiscussion(zone) ? (
              <Section
                label="FORECASTER DISCUSSION"
                accentColor={palette.frost[500]}
              >
                <ForecasterDiscussion zone={zone} />
              </Section>
            ) : null}

            {/* WEATHER OUTLOOK — NWS + NAC + AVG bundle */}
            {weather?.nacWeather ||
            weather?.nwsForecast ||
            weather?.avgDiscussion ? (
              <Section label="WEATHER OUTLOOK" accentColor={palette.frost[400]}>
                <WeatherForecastCard
                  nacWeather={weather?.nacWeather}
                  nwsForecast={weather?.nwsForecast}
                  avgDiscussion={weather?.avgDiscussion}
                  isLoading={false}
                />
              </Section>
            ) : null}

            {/* STATIONS — wind/temp/precip charts per station */}
            {stations && stations.length > 0 ? (
              <Section
                label={`STATIONS · ${stations.length}`}
                accentColor="#52BA4A"
              >
                <WeatherStationCard
                  observations={stations}
                  note={
                    zoneId === "douglas-island"
                      ? "These stations sit outside the forecast zone. Expect high spatial variability."
                      : undefined
                  }
                />
              </Section>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Section({
  label,
  accentColor,
  children,
}: {
  label: string;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <View
          style={{
            width: 3,
            height: 12,
            backgroundColor: accentColor,
            borderRadius: 1.5,
          }}
        />
        <Text
          variant="mono"
          weight="medium"
          style={{
            fontSize: 11,
            letterSpacing: 1.6,
            color: palette.ink[200],
          }}
        >
          {label}
        </Text>
      </View>
      {children}
    </View>
  );
}

function hasForecasterDiscussion(zone: AvalancheZone): boolean {
  if (zone.hazardDiscussion && zone.hazardDiscussion.trim().length > 0) return true;
  if (zone.weatherDiscussion && zone.weatherDiscussion.trim().length > 0) return true;
  return false;
}

function ForecasterDiscussion({ zone }: { zone: AvalancheZone }) {
  const sections: { label: string; body: string }[] = [];
  if (zone.hazardDiscussion && zone.hazardDiscussion.trim()) {
    sections.push({
      label: "SNOWPACK & CONDITIONS",
      body: zone.hazardDiscussion.trim(),
    });
  }
  if (zone.weatherDiscussion && zone.weatherDiscussion.trim()) {
    sections.push({
      label: "WEATHER DISCUSSION",
      body: zone.weatherDiscussion.trim(),
    });
  }
  return (
    <View style={{ gap: 16 }}>
      {sections.map((s, i) => (
        <View key={i}>
          <Text
            variant="mono"
            weight="medium"
            className="text-ink-400"
            style={{
              fontSize: 9,
              letterSpacing: 1.4,
              marginBottom: 6,
            }}
          >
            {s.label}
          </Text>
          <Text
            className="text-ink-100"
            style={{ fontSize: 14, lineHeight: 22 }}
          >
            {s.body}
          </Text>
        </View>
      ))}
    </View>
  );
}
