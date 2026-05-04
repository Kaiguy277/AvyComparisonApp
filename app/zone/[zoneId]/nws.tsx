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
import { getZoneSession } from "@/lib/zoneSession";
import {
  ZoneScreenHeader,
  ZoneScreenContainer,
} from "@/components/avalanche/ZoneScreenChrome";

// NWS forecast — National Weather Service zone forecast that's bundled
// alongside the avalanche center's products. Separated from the avalanche
// center's own mountain weather + AVG discussion (those live in the
// "Full forecast" tile).
export default function ZoneNwsScreen() {
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
  const session = getZoneSession(zoneId);
  const zone = bundle?.forecast ?? session?.forecast;
  const nws =
    bundle?.weather?.nwsForecast ?? session?.weather?.nwsForecast;

  return (
    <ZoneScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <ZoneScreenHeader eyebrow="NWS FORECAST" title={zone?.name ?? "Zone"} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }}>
        {!loaded ? (
          <Text
            variant="mono"
            className="text-ink-400"
            style={{ fontSize: 11, letterSpacing: 1.4 }}
          >
            LOADING…
          </Text>
        ) : !nws ? (
          <Text
            className="text-ink-300"
            style={{ fontSize: 14, lineHeight: 20 }}
          >
            No NWS zone forecast bundled with this zone in the offline snapshot.
          </Text>
        ) : (
          <NwsForecastView nws={nws} />
        )}
      </ScrollView>
    </ZoneScreenContainer>
  );
}

// Renders the NwsForecast object — periods (Today / Tonight / Tomorrow)
// each with a short detailed forecast paragraph. Defensive against shape
// drift since NWS payloads vary across endpoints.
function NwsForecastView({ nws }: { nws: unknown }) {
  // Try the shape we usually get: { periods: [{ name, detailedForecast,
  // temperature, ... }] }. Fall back to displaying the raw text if shape
  // is unfamiliar.
  const periods = (nws as { periods?: NwsPeriod[] }).periods ?? [];
  if (periods.length === 0) {
    return (
      <Text className="text-ink-300" style={{ fontSize: 13, lineHeight: 19 }}>
        {typeof nws === "string" ? nws : JSON.stringify(nws, null, 2)}
      </Text>
    );
  }
  return (
    <View style={{ gap: 18 }}>
      {periods.map((p, i) => (
        <View
          key={i}
          style={{
            paddingBottom: 16,
            borderBottomWidth: i === periods.length - 1 ? 0 : 0.5,
            borderColor: palette.ink[700],
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: 10,
              marginBottom: 6,
            }}
          >
            <Text
              variant="display"
              className="text-ink-50"
              style={{ fontSize: 16, lineHeight: 20 }}
            >
              {p.name ?? `Period ${i + 1}`}
            </Text>
            {typeof p.temperature === "number" ? (
              <Text
                variant="mono"
                weight="bold"
                className="text-ink-200"
                style={{ fontSize: 13 }}
              >
                {p.temperature}°{p.temperatureUnit ?? "F"}
              </Text>
            ) : null}
            {p.windSpeed ? (
              <Text
                variant="mono"
                className="text-ink-300"
                style={{ fontSize: 11 }}
              >
                {p.windSpeed} {p.windDirection ?? ""}
              </Text>
            ) : null}
          </View>
          <Text
            className="text-ink-100"
            style={{ fontSize: 14, lineHeight: 21 }}
          >
            {p.detailedForecast ?? p.shortForecast ?? "—"}
          </Text>
        </View>
      ))}
    </View>
  );
}

interface NwsPeriod {
  name?: string;
  temperature?: number;
  temperatureUnit?: string;
  windSpeed?: string;
  windDirection?: string;
  shortForecast?: string;
  detailedForecast?: string;
}
