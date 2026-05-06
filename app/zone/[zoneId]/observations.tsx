import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import {
  ZoneScreenContainer,
  ZoneScreenHeader,
} from "@/components/avalanche/ZoneScreenChrome";
import { avalancheApi, type ObservationSummary } from "@/lib/api/avalanche";
import { AVAILABLE_ZONES } from "@/lib/zones";
import { getZoneSession, setZoneSession } from "@/lib/zoneSession";

// Per-zone field observations pulled from the NAC public API. The
// upstream list endpoint can't filter by zone, so the cron writes one
// row per obs (with NAC's detail-only zone_id) and we join here.

export default function ZoneObservationsScreen() {
  const { zoneId } = useLocalSearchParams<{ zoneId: string }>();

  const session = getZoneSession(zoneId);
  const [obs, setObs] = useState<ObservationSummary[] | null>(
    session?.observations ?? null,
  );
  const [loaded, setLoaded] = useState(obs !== null);

  useEffect(() => {
    if (obs !== null) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    avalancheApi.getCachedObservations([zoneId], 50).then((r) => {
      if (cancelled) return;
      const list = r.success ? r.observations?.[zoneId] ?? [] : [];
      setObs(list);
      setLoaded(true);
      setZoneSession(zoneId, {
        observations: list,
        cachedAt: new Date().toISOString(),
      });
    });
    return () => {
      cancelled = true;
    };
    // Intentionally only re-run when the zoneId changes.
  }, [zoneId]);

  const displayName =
    AVAILABLE_ZONES.find((z) => z.id === zoneId)?.name ?? "Zone";

  return (
    <ZoneScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <ZoneScreenHeader
        eyebrow="OBSERVATIONS"
        title={displayName}
        count={obs?.length}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
        {!loaded ? (
          <Text
            variant="mono"
            className="text-ink-400"
            style={{ fontSize: 11, letterSpacing: 1.4 }}
          >
            LOADING…
          </Text>
        ) : !obs || obs.length === 0 ? (
          <View>
            <Text
              variant="display"
              className="text-ink-100"
              style={{ fontSize: 18, marginBottom: 8 }}
            >
              No observations cached for this zone
            </Text>
            <Text
              className="text-ink-300"
              style={{ fontSize: 14, lineHeight: 20 }}
            >
              The cron pulls observations for every zone since mid-March. If
              this zone is empty, the NAC API hasn&apos;t returned anything in
              that window — open the official observations page below to be
              sure.
            </Text>
            <Pressable
              onPress={() =>
                Linking.openURL("https://avalanche.org/observations/")
              }
              style={({ pressed }) => ({
                marginTop: 16,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 10,
                borderWidth: 0.5,
                borderColor: palette.ink[600],
                backgroundColor: pressed ? palette.ink[800] : "transparent",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              })}
            >
              <Text
                variant="mono"
                weight="medium"
                style={{ fontSize: 12, letterSpacing: 1.4, color: palette.ink[200] }}
              >
                AVALANCHE.ORG / OBSERVATIONS
              </Text>
              <Ionicons name="open-outline" size={14} color={palette.ink[300]} />
            </Pressable>
          </View>
        ) : (
          obs.map((o) => <ObservationCard key={o.id} obs={o} />)
        )}
      </ScrollView>
    </ZoneScreenContainer>
  );
}

function ObservationCard({ obs }: { obs: ObservationSummary }) {
  const summary = stripHtml(obs.summaryHtml).slice(0, 280);
  const onOpen = () => Linking.openURL(obs.viewerUrl);
  const observerColor = observerTypeColor(obs.observerType);
  const byline = formatByline(obs);
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => ({
        backgroundColor: pressed ? palette.ink[700] : palette.ink[800],
        borderWidth: 0.5,
        borderColor: palette.ink[700],
        borderRadius: 12,
        overflow: "hidden",
      })}
    >
      <View style={{ padding: 14, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 4,
              backgroundColor: observerColor + "26",
              borderWidth: 0.5,
              borderColor: observerColor,
            }}
          >
            <Text
              variant="mono"
              weight="bold"
              style={{ fontSize: 9, letterSpacing: 1.2, color: observerColor }}
            >
              {(obs.observerType ?? "OBSERVER").toUpperCase()}
            </Text>
          </View>
          {obs.hasAvalanches ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 4,
                backgroundColor: "#DC2626" + "1F",
                borderWidth: 0.5,
                borderColor: "#DC2626",
              }}
            >
              <Ionicons name="warning" size={10} color="#DC2626" />
              <Text
                variant="mono"
                weight="bold"
                style={{ fontSize: 9, letterSpacing: 1.2, color: "#DC2626" }}
              >
                AVALANCHE
              </Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <Text
            variant="mono"
            style={{ fontSize: 11, color: palette.ink[400] }}
          >
            {obs.startDate ?? ""}
          </Text>
        </View>

        <Text
          variant="display"
          className="text-ink-50"
          style={{ fontSize: 16, lineHeight: 22 }}
          numberOfLines={2}
        >
          {obs.locationName?.trim() || obs.zoneName || "Observation"}
        </Text>

        {byline ? (
          <Text
            variant="mono"
            className="text-ink-400"
            style={{ fontSize: 11, letterSpacing: 0.6 }}
            numberOfLines={1}
          >
            {byline}
          </Text>
        ) : null}

        {summary ? (
          <Text
            className="text-ink-200"
            style={{ fontSize: 13, lineHeight: 19 }}
            numberOfLines={4}
          >
            {summary}
          </Text>
        ) : null}

        {obs.thumbnails.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingTop: 4 }}
          >
            {obs.thumbnails.map((src, i) => (
              <Image
                key={i}
                source={{ uri: src }}
                contentFit="cover"
                transition={120}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 6,
                  backgroundColor: palette.ink[700],
                }}
              />
            ))}
          </ScrollView>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 4,
          }}
        >
          <Text
            variant="mono"
            style={{ fontSize: 10, color: palette.ink[400], letterSpacing: 1.2 }}
          >
            VIEW ON AVALANCHE.ORG
          </Text>
          <Ionicons name="open-outline" size={12} color={palette.ink[400]} />
        </View>
      </View>
    </Pressable>
  );
}

function observerTypeColor(t: string | null): string {
  switch (t) {
    case "forecaster":
      return "#4FB3C9"; // teal — matches the Observations tile accent
    case "professional":
      return palette.aspen[400];
    case "public":
      return palette.ink[300];
    default:
      return palette.ink[300];
  }
}

function formatByline(obs: ObservationSummary): string {
  const parts: string[] = [];
  if (obs.observerName) parts.push(obs.observerName);
  if (obs.organization && obs.organization !== obs.observerName) {
    parts.push(obs.organization);
  }
  return parts.join(" · ");
}

// observation_summary on the wire is HTML. Strip tags + collapse
// whitespace so the preview reads cleanly inside a card. Full HTML
// rendering lives behind the "view on avalanche.org" tap.
function stripHtml(input: string | null): string {
  if (!input) return "";
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
