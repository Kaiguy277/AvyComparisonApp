import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
import type { AvalancheZone } from "@/lib/api/avalanche";

// Full published forecast (minus avalanche problems) — reads as the
// avalanche center's complete narrative for the zone:
//   - Bottom line
//   - Announcement (if any)
//   - Snowpack & conditions discussion
//   - Weather discussion
//   - Avalanche-center mountain weather summary (NAC weather product)
//   - Synthesized AVG discussion (when present)
//
// Avalanche problems get their own dedicated screen (problems.tsx) so
// the user can read the prose narrative without navigating around the
// rose/likelihood detail.

export default function ZoneFullForecastScreen() {
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
  const zone: AvalancheZone | undefined = bundle?.forecast ?? session?.forecast;
  const weatherBundle = bundle?.weather ?? session?.weather;

  const sections = collectSections(zone, weatherBundle);

  return (
    <ZoneScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <ZoneScreenHeader
        eyebrow="FULL FORECAST"
        title={zone?.name ?? "Zone"}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 22 }}>
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
            No published forecast prose bundled with this zone yet.
          </Text>
        ) : (
          <>
            {sections.map((s, i) => (
              <ForecastSection key={i} {...s} />
            ))}
            {zone?.author ? (
              <Text
                variant="mono"
                className="text-ink-400"
                style={{
                  fontSize: 11,
                  letterSpacing: 1.4,
                  textAlign: "right",
                  marginTop: 4,
                }}
              >
                — {zone.author.toUpperCase()}
              </Text>
            ) : null}
            {zone?.forecastUrl ? (
              <Pressable
                onPress={() => Linking.openURL(zone.forecastUrl!)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  borderWidth: 0.5,
                  borderColor: palette.ink[600],
                  marginTop: 8,
                  backgroundColor: pressed ? palette.ink[800] : "transparent",
                })}
              >
                <Text
                  variant="mono"
                  weight="medium"
                  style={{
                    fontSize: 12,
                    letterSpacing: 1.4,
                    color: palette.ink[200],
                  }}
                >
                  OPEN OFFICIAL FORECAST
                </Text>
                <Ionicons
                  name="open-outline"
                  size={14}
                  color={palette.ink[300]}
                />
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </ZoneScreenContainer>
  );
}

interface Section {
  label: string;
  body: string;
  emphasis?: boolean; // bottom line gets serif italic prominence
}

function collectSections(
  zone: AvalancheZone | undefined,
  weather: import("@/lib/api/avalanche").ZoneWeatherForecast | undefined,
): Section[] {
  if (!zone) return [];
  const out: Section[] = [];
  if (zone.travelAdvice && zone.travelAdvice.trim()) {
    out.push({
      label: "BOTTOM LINE",
      body: zone.travelAdvice.trim(),
      emphasis: true,
    });
  }
  if (zone.announcement && zone.announcement.trim()) {
    out.push({ label: "ANNOUNCEMENT", body: zone.announcement.trim() });
  }
  if (zone.hazardDiscussion && zone.hazardDiscussion.trim()) {
    out.push({
      label: "SNOWPACK & CONDITIONS",
      body: zone.hazardDiscussion.trim(),
    });
  }
  if (zone.weatherDiscussion && zone.weatherDiscussion.trim()) {
    out.push({
      label: "WEATHER DISCUSSION",
      body: zone.weatherDiscussion.trim(),
    });
  }
  // NAC's published mountain weather summary — only the human-readable
  // text part (ignore numeric tables here; those would need their own
  // dedicated render).
  const nacText = extractNacText(weather?.nacWeather);
  if (nacText) {
    out.push({ label: "MOUNTAIN WEATHER", body: nacText });
  }
  const avg = extractAvgText(weather?.avgDiscussion);
  if (avg) {
    out.push({ label: "AVALANCHE.ORG DISCUSSION", body: avg });
  }
  return out;
}

function extractNacText(nac: unknown): string | null {
  if (!nac || typeof nac !== "object") return null;
  // The NacWeatherProduct shape varies by center; a `discussion` or
  // `summary` string is the consistent free-text field.
  const obj = nac as Record<string, unknown>;
  const candidate =
    typeof obj.discussion === "string"
      ? obj.discussion
      : typeof obj.summary === "string"
        ? obj.summary
        : typeof obj.text === "string"
          ? obj.text
          : null;
  return candidate && candidate.trim() ? candidate.trim() : null;
}

function extractAvgText(avg: unknown): string | null {
  if (!avg || typeof avg !== "object") return null;
  const obj = avg as Record<string, unknown>;
  const candidate =
    typeof obj.discussion === "string"
      ? obj.discussion
      : typeof obj.text === "string"
        ? obj.text
        : null;
  return candidate && candidate.trim() ? candidate.trim() : null;
}

function ForecastSection({ label, body, emphasis }: Section) {
  return (
    <View>
      <Text
        variant="mono"
        weight="medium"
        className="text-ink-400"
        style={{ fontSize: 10, letterSpacing: 1.6, marginBottom: 8 }}
      >
        {label}
      </Text>
      <Text
        variant={emphasis ? "display" : "body"}
        className="text-ink-100"
        style={{
          fontSize: emphasis ? 17 : 14,
          lineHeight: emphasis ? 25 : 22,
        }}
      >
        {body}
      </Text>
    </View>
  );
}
