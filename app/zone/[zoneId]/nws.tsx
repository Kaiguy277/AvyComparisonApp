import { useMemo } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { useZoneBundle } from "@/hooks/useZoneBundle";
import { AVAILABLE_ZONES } from "@/lib/zones";
import {
  ZoneScreenHeader,
  ZoneScreenContainer,
} from "@/components/avalanche/ZoneScreenChrome";
import type { NwsForecast, NwsForecastPeriod } from "@/lib/api/avalanche";

// NWS forecast screen — National Weather Service forecast for the
// gridpoint nearest this zone. Some areas (especially mountain WFOs in
// winter) get a curated forecast; many just emit auto-generated text
// derived from the NDFD gridded model. We render both the same way and
// surface the source attribution + a link to the original page so the
// user can judge for themselves.

export default function ZoneNwsScreen() {
  const { zoneId, date } = useLocalSearchParams<{
    zoneId: string;
    date?: string;
  }>();
  const { forecast: zone, weather, loaded } = useZoneBundle(zoneId, date);
  const nws: NwsForecast | undefined = weather?.nwsForecast;
  const displayName =
    zone?.name ??
    AVAILABLE_ZONES.find((z) => z.id === zoneId)?.name ??
    "Zone";

  return (
    <ZoneScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <ZoneScreenHeader eyebrow="NWS FORECAST" title={displayName} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
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
            No NWS forecast bundled with this zone yet.
          </Text>
        ) : (
          <NwsForecastView nws={nws} />
        )}
      </ScrollView>
    </ZoneScreenContainer>
  );
}

function NwsForecastView({ nws }: { nws: NwsForecast }) {
  const periods = nws.periods ?? [];

  // High/low across the day periods so the user can read the temperature
  // arc at a glance before scrolling through period cards.
  const tempRange = useMemo(() => {
    const temps = periods
      .filter((p) => typeof p.temperature === "number")
      .map((p) => p.temperature);
    if (temps.length === 0) return null;
    return {
      hi: Math.max(...temps),
      lo: Math.min(...temps),
      unit: periods.find((p) => p.temperatureUnit)?.temperatureUnit ?? "F",
    };
  }, [periods]);

  return (
    <View style={{ gap: 16 }}>
      <SourceAttribution nws={nws} />

      {tempRange ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            gap: 18,
            paddingHorizontal: 4,
          }}
        >
          <RangeStat label="HIGH" value={`${tempRange.hi}°${tempRange.unit}`} />
          <RangeStat label="LOW" value={`${tempRange.lo}°${tempRange.unit}`} />
          <RangeStat label="PERIODS" value={`${periods.length}`} />
        </View>
      ) : null}

      {periods.length === 0 ? (
        <Text
          className="text-ink-300"
          style={{ fontSize: 14, lineHeight: 20 }}
        >
          NWS returned no period data for this gridpoint.
        </Text>
      ) : (
        <View style={{ gap: 10 }}>
          {periods.map((p, i) => (
            <PeriodCard key={i} period={p} />
          ))}
        </View>
      )}

      {nws.forecastPageUrl ? (
        <Pressable
          onPress={() => Linking.openURL(nws.forecastPageUrl)}
          style={({ pressed }) => ({
            marginTop: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 10,
            borderWidth: 0.5,
            borderColor: palette.ink[600],
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
            OPEN AT WEATHER.GOV
          </Text>
          <Ionicons name="open-outline" size={14} color={palette.ink[300]} />
        </Pressable>
      ) : null}
    </View>
  );
}

function SourceAttribution({ nws }: { nws: NwsForecast }) {
  return (
    <View
      style={{
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderLeftWidth: 3,
        borderLeftColor: palette.frost[500],
        backgroundColor: palette.ink[900],
      }}
    >
      <Text
        variant="mono"
        weight="bold"
        style={{
          fontSize: 10,
          letterSpacing: 1.4,
          color: palette.frost[500],
          marginBottom: 4,
        }}
      >
        FROM api.weather.gov
      </Text>
      <Text
        style={{
          fontSize: 12,
          lineHeight: 17,
          color: palette.ink[300],
        }}
      >
        Gridded NWS forecast for the point nearest this zone. Often
        auto-generated from the NDFD model; some mountain WFOs hand-edit
        in winter. Compare against the avalanche-center mountain
        forecast on the “Full forecast” tile.
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 8,
        }}
      >
        {nws.gridpoint ? (
          <Text
            variant="mono"
            style={{
              fontSize: 10,
              letterSpacing: 0.8,
              color: palette.ink[400],
            }}
          >
            GRIDPOINT{" "}
            <Text style={{ fontSize: 10, color: palette.ink[200] }}>
              {nws.gridpoint}
            </Text>
          </Text>
        ) : null}
        {nws.forecastZone ? (
          <Text
            variant="mono"
            style={{
              fontSize: 10,
              letterSpacing: 0.8,
              color: palette.ink[400],
            }}
          >
            ZONE{" "}
            <Text style={{ fontSize: 10, color: palette.ink[200] }}>
              {nws.forecastZone}
            </Text>
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function PeriodCard({ period: p }: { period: NwsForecastPeriod }) {
  const dayNightIcon = p.isDaytime ? "sunny-outline" : "moon-outline";
  const dayNightColor = p.isDaytime
    ? palette.aspen[400]
    : palette.frost[500];

  return (
    <View
      style={{
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: palette.ink[500] + "AA",
        backgroundColor: palette.ink[800],
      }}
    >
      {/* Header row — period name + day/night icon, then chip row with
          temp + wind. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <Ionicons name={dayNightIcon} size={16} color={dayNightColor} />
        <Text
          variant="display"
          className="text-ink-50"
          style={{ fontSize: 17, lineHeight: 21, flex: 1 }}
        >
          {p.name ?? "Period"}
        </Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 10,
        }}
      >
        {typeof p.temperature === "number" ? (
          <Chip>
            {p.temperature}°{p.temperatureUnit ?? "F"}
          </Chip>
        ) : null}
        {p.windSpeed ? (
          <Chip>
            {p.windSpeed}
            {p.windDirection ? ` ${p.windDirection}` : ""}
          </Chip>
        ) : null}
        {p.shortForecast ? <Chip subtle>{p.shortForecast}</Chip> : null}
      </View>

      {/* Detailed forecast — full prose from NWS. */}
      {p.detailedForecast ? (
        <Text
          className="text-ink-100"
          style={{ fontSize: 14, lineHeight: 21 }}
        >
          {p.detailedForecast}
        </Text>
      ) : null}
    </View>
  );
}

function Chip({
  children,
  subtle,
}: {
  children: React.ReactNode;
  subtle?: boolean;
}) {
  return (
    <View
      style={{
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 999,
        borderWidth: 0.5,
        borderColor: subtle ? palette.ink[500] : palette.ink[600],
        backgroundColor: subtle ? "transparent" : palette.ink[900],
      }}
    >
      <Text
        variant="mono"
        weight={subtle ? "regular" : "bold"}
        style={{
          fontSize: 10,
          letterSpacing: 0.8,
          color: subtle ? palette.ink[300] : palette.ink[100],
        }}
      >
        {children}
      </Text>
    </View>
  );
}

function RangeStat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text
        variant="mono"
        weight="medium"
        style={{
          fontSize: 9,
          letterSpacing: 1.2,
          color: palette.ink[400],
        }}
      >
        {label}
      </Text>
      <Text
        variant="display"
        className="text-ink-50"
        style={{ fontSize: 22, lineHeight: 26, marginTop: 2 }}
      >
        {value}
      </Text>
    </View>
  );
}
