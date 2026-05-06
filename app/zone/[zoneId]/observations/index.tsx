import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import {
  ZoneScreenContainer,
  ZoneScreenHeader,
} from "@/components/avalanche/ZoneScreenChrome";
import { PhotoLightbox } from "@/components/avalanche/PhotoLightbox";
import {
  avalancheApi,
  type ObservationMedia,
  type ObservationSummary,
} from "@/lib/api/avalanche";
import { AVAILABLE_ZONES, ZONE_TO_CENTER_NAME } from "@/lib/zones";
import { getZoneSession, setZoneSession } from "@/lib/zoneSession";
import { stripObservationHtml } from "@/lib/observationText";

// Per-zone field observations from the NAC public API. Backend returns
// the WHOLE center's obs with `inZone` flagged so neighbor obs land
// here too (snowpack/weather don't respect zone lines). The user can
// filter to "this zone only" via the chip up top.

type Filter = "all" | "zone";

export default function ZoneObservationsScreen() {
  const { zoneId } = useLocalSearchParams<{ zoneId: string }>();
  const router = useRouter();

  const session = getZoneSession(zoneId);
  const [obs, setObs] = useState<ObservationSummary[] | null>(
    session?.observations ?? null,
  );
  const [loaded, setLoaded] = useState(obs !== null);
  const [filter, setFilter] = useState<Filter>("all");
  const [lightbox, setLightbox] = useState<{
    media: ObservationMedia[];
    index: number;
  } | null>(null);

  useEffect(() => {
    if (obs !== null) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    avalancheApi.getCachedObservations([zoneId], 60).then((r) => {
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
  }, [zoneId]);

  const displayName =
    AVAILABLE_ZONES.find((z) => z.id === zoneId)?.name ?? "Zone";
  const centerName = ZONE_TO_CENTER_NAME[zoneId] ?? "Center";

  const inZoneCount = useMemo(
    () => (obs ?? []).filter((o) => o.inZone).length,
    [obs],
  );
  const filtered = useMemo(() => {
    if (!obs) return [];
    return filter === "zone" ? obs.filter((o) => o.inZone) : obs;
  }, [obs, filter]);

  return (
    <ZoneScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <ZoneScreenHeader
        eyebrow="OBSERVATIONS"
        title={displayName}
        count={obs?.length}
      />

      <View
        style={{
          flexDirection: "row",
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 4,
        }}
      >
        <FilterChip
          label={`ALL ${centerName.toUpperCase()}`}
          count={obs?.length}
          active={filter === "all"}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setFilter("all");
          }}
        />
        <FilterChip
          label="THIS ZONE"
          count={inZoneCount}
          active={filter === "zone"}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setFilter("zone");
          }}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
      >
        {!loaded ? (
          <Text
            variant="mono"
            className="text-ink-400"
            style={{ fontSize: 11, letterSpacing: 1.4 }}
          >
            LOADING…
          </Text>
        ) : !obs || filtered.length === 0 ? (
          <EmptyState
            hasAny={!!obs && obs.length > 0}
            centerName={centerName}
            onSwitchToAll={() => setFilter("all")}
          />
        ) : (
          filtered.map((o) => (
            <ObservationCard
              key={o.id}
              obs={o}
              onOpen={() =>
                router.push({
                  pathname: "/zone/[zoneId]/observations/[obsId]" as never,
                  params: { zoneId, obsId: o.id },
                })
              }
              onOpenPhoto={(index) => setLightbox({ media: o.media, index })}
            />
          ))
        )}
      </ScrollView>

      {lightbox ? (
        <PhotoLightbox
          media={lightbox.media}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </ZoneScreenContainer>
  );
}

function FilterChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number | undefined;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 0.5,
        borderColor: active ? "#4FB3C9" : palette.ink[600],
        backgroundColor: active
          ? "#4FB3C922"
          : pressed
            ? palette.ink[700]
            : palette.ink[800],
      })}
    >
      <Text
        variant="mono"
        weight="bold"
        style={{
          fontSize: 10,
          letterSpacing: 1.2,
          color: active ? "#4FB3C9" : palette.ink[300],
        }}
      >
        {label}
        {typeof count === "number" ? ` · ${count}` : ""}
      </Text>
    </Pressable>
  );
}

function EmptyState({
  hasAny,
  centerName,
  onSwitchToAll,
}: {
  hasAny: boolean;
  centerName: string;
  onSwitchToAll: () => void;
}) {
  if (!hasAny) {
    return (
      <View>
        <Text
          variant="display"
          className="text-ink-100"
          style={{ fontSize: 18, marginBottom: 8 }}
        >
          No observations cached for this center
        </Text>
        <Text className="text-ink-300" style={{ fontSize: 14, lineHeight: 20 }}>
          The cron pulls observations for every center since mid-March. If
          this center is empty, the NAC API hasn&apos;t returned anything in
          that window yet.
        </Text>
      </View>
    );
  }
  return (
    <View>
      <Text
        variant="display"
        className="text-ink-100"
        style={{ fontSize: 18, marginBottom: 8 }}
      >
        No in-zone observations
      </Text>
      <Text className="text-ink-300" style={{ fontSize: 14, lineHeight: 20 }}>
        Nothing has been reported inside this zone since mid-March, but{" "}
        {centerName} has neighbor obs you can browse.
      </Text>
      <Pressable
        onPress={onSwitchToAll}
        style={({ pressed }) => ({
          marginTop: 16,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 10,
          borderWidth: 0.5,
          borderColor: "#4FB3C9",
          backgroundColor: pressed ? "#4FB3C944" : "#4FB3C91A",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        })}
      >
        <Text
          variant="mono"
          weight="bold"
          style={{ fontSize: 12, letterSpacing: 1.4, color: "#4FB3C9" }}
        >
          SHOW ALL CENTER OBS
        </Text>
        <Ionicons name="chevron-forward" size={14} color="#4FB3C9" />
      </Pressable>
    </View>
  );
}

function ObservationCard({
  obs,
  onOpen,
  onOpenPhoto,
}: {
  obs: ObservationSummary;
  onOpen: () => void;
  onOpenPhoto: (index: number) => void;
}) {
  const summary = stripObservationHtml(obs.summaryHtml).slice(0, 280);
  const observerColor = observerTypeColor(obs.observerType);
  const byline = formatByline(obs);

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => ({
        backgroundColor: pressed ? palette.ink[700] : palette.ink[800],
        borderWidth: obs.inZone ? 1 : 0.5,
        borderColor: obs.inZone ? "#4FB3C9" : palette.ink[700],
        borderRadius: 12,
        overflow: "hidden",
      })}
    >
      <View style={{ padding: 14, gap: 8 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {obs.inZone ? (
            <Badge label="IN ZONE" color="#4FB3C9" filled />
          ) : obs.zoneName ? (
            <Badge label={obs.zoneName.toUpperCase()} color={palette.ink[300]} />
          ) : null}
          <Badge
            label={(obs.observerType ?? "OBSERVER").toUpperCase()}
            color={observerColor}
            filled
          />
          {obs.hasAvalanches ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 4,
                backgroundColor: "#DC26261F",
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
          <Text variant="mono" style={{ fontSize: 11, color: palette.ink[400] }}>
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

        {obs.media.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingTop: 4 }}
          >
            {obs.media.slice(0, 6).map((m, i) => (
              <Pressable
                key={`${m.id ?? ""}-${i}`}
                onPress={() => onOpenPhoto(i)}
                hitSlop={4}
              >
                <Image
                  source={{ uri: m.thumbnail }}
                  contentFit="cover"
                  transition={120}
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 6,
                    backgroundColor: palette.ink[700],
                  }}
                />
              </Pressable>
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
            style={{
              fontSize: 10,
              color: palette.ink[400],
              letterSpacing: 1.2,
            }}
          >
            TAP TO READ FULL OBS
          </Text>
          <Ionicons name="chevron-forward" size={14} color={palette.ink[400]} />
        </View>
      </View>
    </Pressable>
  );
}

function Badge({
  label,
  color,
  filled,
}: {
  label: string;
  color: string;
  filled?: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        backgroundColor: filled ? color + "26" : "transparent",
        borderWidth: 0.5,
        borderColor: color,
      }}
    >
      <Text
        variant="mono"
        weight="bold"
        style={{ fontSize: 9, letterSpacing: 1.2, color }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function observerTypeColor(t: string | null): string {
  switch (t) {
    case "forecaster":
      return "#4FB3C9";
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
