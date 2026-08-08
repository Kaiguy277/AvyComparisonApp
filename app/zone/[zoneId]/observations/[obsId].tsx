import { useEffect, useMemo, useState } from "react";
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
import { PhotoLightbox } from "@/components/avalanche/PhotoLightbox";
import {
  avalancheApi,
  type ObservationSummary,
} from "@/lib/api/avalanche";
import { getZoneSession, setZoneSession } from "@/lib/zoneSession";
import { stripObservationHtml } from "@/lib/observationText";
import { viewerUrlForObservation } from "@/lib/observationViewerUrl";

// Full-detail screen for a single observation. The list view loads
// the whole center bundle into zoneSession, so this screen looks up
// by ID first and only falls back to a fresh fetch if the user
// landed here via deep link or after a JS reload.

export default function ObservationDetailScreen() {
  const { zoneId, obsId } = useLocalSearchParams<{
    zoneId: string;
    obsId: string;
  }>();

  const fromSession = getZoneSession(zoneId)?.observations;
  const [obs, setObs] = useState<ObservationSummary | null>(
    fromSession?.find((o) => o.id === obsId) ?? null,
  );
  const [loaded, setLoaded] = useState(obs !== null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    // Resolve from the session cache fresh (keyed by zoneId + obsId)
    // rather than reading the captured `obs` state with only [zoneId,
    // obsId] deps — the latter was a stale-closure trap (B14). Still
    // falls through to a fetch when this obs isn't in the cached list.
    const cached = getZoneSession(zoneId)?.observations?.find(
      (o) => o.id === obsId,
    );
    if (cached) {
      setObs(cached);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    avalancheApi.getCachedObservations([zoneId], 100).then((r) => {
      if (cancelled) return;
      const list = r.success ? r.observations?.[zoneId] ?? [] : [];
      const found = list.find((o) => o.id === obsId) ?? null;
      setObs(found);
      setLoaded(true);
      setZoneSession(zoneId, {
        observations: list,
        cachedAt: new Date().toISOString(),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [zoneId, obsId]);

  const summary = useMemo(
    () => stripObservationHtml(obs?.summaryHtml),
    [obs?.summaryHtml],
  );

  return (
    <ZoneScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <ZoneScreenHeader
        eyebrow="OBSERVATION"
        title={obs?.locationName?.trim() || obs?.zoneName || "Observation"}
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}
      >
        {!loaded ? (
          <Text
            variant="mono"
            className="text-ink-400"
            style={{ fontSize: 11, letterSpacing: 1.4 }}
          >
            LOADING…
          </Text>
        ) : !obs ? (
          <Text className="text-ink-300" style={{ fontSize: 14, lineHeight: 20 }}>
            That observation isn&apos;t in the cache. It may have been
            deleted or moved by the avalanche center.
          </Text>
        ) : (
          <>
            <BadgesRow obs={obs} />
            <Title obs={obs} />
            {obs.media.length > 0 ? (
              <MediaGallery
                obs={obs}
                onOpenPhoto={(i) => setLightboxIndex(i)}
              />
            ) : null}
            {summary ? (
              <Section label="Observation">
                <Text
                  className="text-ink-100"
                  style={{ fontSize: 14, lineHeight: 22 }}
                >
                  {summary}
                </Text>
              </Section>
            ) : null}
            <InstabilitySection obs={obs} />
            <AvalanchesSection obs={obs} />
            <AdvancedSection obs={obs} />
            <ViewExternalLink obs={obs} />
          </>
        )}
      </ScrollView>

      {obs && lightboxIndex !== null ? (
        <PhotoLightbox
          media={obs.media}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </ZoneScreenContainer>
  );
}

function BadgesRow({ obs }: { obs: ObservationSummary }) {
  const observerColor = observerTypeColor(obs.observerType);
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 6,
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
  );
}

function Title({ obs }: { obs: ObservationSummary }) {
  const byline = formatByline(obs);
  return (
    <View style={{ gap: 6 }}>
      {byline ? (
        <Text
          variant="mono"
          className="text-ink-300"
          style={{ fontSize: 12, letterSpacing: 0.6 }}
        >
          {byline}
        </Text>
      ) : null}
      {obs.activity.length > 0 ? (
        <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
          {obs.activity.map((a) => (
            <View
              key={a}
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                backgroundColor: palette.ink[700],
              }}
            >
              <Text
                variant="mono"
                style={{ fontSize: 10, color: palette.ink[200] }}
              >
                {a}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {obs.route ? (
        <Text
          className="text-ink-300"
          style={{ fontSize: 13, lineHeight: 19 }}
        >
          Route: <Text className="text-ink-100">{obs.route}</Text>
        </Text>
      ) : null}
      {obs.locationPoint ? (
        <Text
          variant="mono"
          className="text-ink-400"
          style={{ fontSize: 10, letterSpacing: 0.4 }}
        >
          {obs.locationPoint.lat.toFixed(4)}, {obs.locationPoint.lng.toFixed(4)}
        </Text>
      ) : null}
    </View>
  );
}

function MediaGallery({
  obs,
  onOpenPhoto,
}: {
  obs: ObservationSummary;
  onOpenPhoto: (index: number) => void;
}) {
  return (
    <Section label={`Photos · ${obs.media.length}`}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {obs.media.map((m, i) => (
          <Pressable
            key={`${m.id ?? ""}-${i}`}
            onPress={() => onOpenPhoto(i)}
          >
            <Image
              source={{ uri: m.thumbnail }}
              contentFit="cover"
              transition={140}
              style={{
                width: 160,
                height: 120,
                borderRadius: 8,
                backgroundColor: palette.ink[700],
              }}
            />
          </Pressable>
        ))}
      </ScrollView>
    </Section>
  );
}

function InstabilitySection({ obs }: { obs: ObservationSummary }) {
  const flags: { label: string; on: boolean; description?: string | null }[] = [
    {
      label: "Cracking",
      on: obs.instability.cracking,
      description: obs.instability.crackingDescription,
    },
    {
      label: "Collapsing / whumpfing",
      on: obs.instability.collapsing,
      description: obs.instability.collapsingDescription,
    },
    {
      label: "Avalanches observed",
      on: obs.instability.avalanchesObserved,
    },
    {
      label: "Avalanches triggered",
      on: obs.instability.avalanchesTriggered,
    },
    { label: "Avalanche caught", on: obs.instability.avalanchesCaught },
  ];
  const anyFlag = flags.some((f) => f.on);
  if (!anyFlag && !obs.instabilitySummary) return null;
  return (
    <Section label="Instability">
      <View style={{ gap: 6 }}>
        {flags
          .filter((f) => f.on)
          .map((f) => (
            <View
              key={f.label}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <Ionicons
                name="alert-circle"
                size={14}
                color={palette.aspen[400]}
                style={{ marginTop: 2 }}
              />
              <View style={{ flex: 1 }}>
                <Text className="text-ink-100" style={{ fontSize: 13 }}>
                  {f.label}
                </Text>
                {f.description ? (
                  <Text
                    className="text-ink-300"
                    style={{ fontSize: 12, lineHeight: 17, marginTop: 2 }}
                  >
                    {f.description}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        {obs.instabilitySummary ? (
          <Text
            className="text-ink-200"
            style={{ fontSize: 13, lineHeight: 19, marginTop: 4 }}
          >
            {stripObservationHtml(obs.instabilitySummary)}
          </Text>
        ) : null}
      </View>
    </Section>
  );
}

function AvalanchesSection({ obs }: { obs: ObservationSummary }) {
  if (obs.avalanches.length === 0 && !obs.avalanchesSummary) return null;
  return (
    <Section label={`Avalanches · ${obs.avalanches.length}`}>
      {obs.avalanches.map((a, i) => (
        <View
          key={i}
          style={{
            paddingTop: i === 0 ? 0 : 12,
            borderTopWidth: i === 0 ? 0 : 0.5,
            borderColor: palette.ink[700],
            marginTop: i === 0 ? 0 : 4,
          }}
        >
          <AvalancheRecord rec={a} />
        </View>
      ))}
      {obs.avalanchesSummary ? (
        <Text
          className="text-ink-200"
          style={{ fontSize: 13, lineHeight: 19, marginTop: 8 }}
        >
          {stripObservationHtml(obs.avalanchesSummary)}
        </Text>
      ) : null}
    </Section>
  );
}

function AvalancheRecord({ rec }: { rec: Record<string, unknown> }) {
  // NAC keeps shipping new fields, so we render whatever's present
  // rather than hard-coding a curated subset. Skip empty values + the
  // attached-media field (we already render media at the top).
  const rows: [string, string][] = [];
  for (const [k, v] of Object.entries(rec)) {
    if (v === null || v === undefined) continue;
    if (k === "media" || k === "id") continue;
    if (typeof v === "object") {
      const inner = Object.entries(v as Record<string, unknown>)
        .filter(([, vv]) => vv !== null && vv !== undefined && vv !== "")
        .map(([kk, vv]) => `${humanize(kk)}: ${String(vv)}`)
        .join(" · ");
      if (inner) rows.push([humanize(k), inner]);
      continue;
    }
    if (typeof v === "string" && v.trim() === "") continue;
    rows.push([humanize(k), String(v)]);
  }
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: 4 }}>
      {rows.map(([k, v]) => (
        <View key={k} style={{ flexDirection: "row", gap: 8 }}>
          <Text
            variant="mono"
            style={{
              fontSize: 10,
              letterSpacing: 0.6,
              color: palette.ink[400],
              width: 110,
              textTransform: "uppercase",
            }}
          >
            {k}
          </Text>
          <Text
            className="text-ink-100"
            style={{ fontSize: 13, lineHeight: 18, flex: 1 }}
          >
            {v}
          </Text>
        </View>
      ))}
    </View>
  );
}

function AdvancedSection({ obs }: { obs: ObservationSummary }) {
  const af = obs.advancedFields;
  if (!af) return null;
  const blocks: { label: string; body: string }[] = [];

  const ws = af["weather_summary"];
  if (typeof ws === "string" && ws.trim()) {
    blocks.push({ label: "Weather", body: stripObservationHtml(ws) });
  }
  const wx = af["weather"];
  if (wx && typeof wx === "object") {
    const text = Object.entries(wx as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${humanize(k)}: ${String(v)}`)
      .join(" · ");
    if (text) blocks.push({ label: "Weather data", body: text });
  }
  const sps = af["snowpack_summary"];
  if (typeof sps === "string" && sps.trim()) {
    blocks.push({ label: "Snowpack", body: stripObservationHtml(sps) });
  }
  const sp = af["snowpack"];
  if (sp && typeof sp === "object") {
    const text = Object.entries(sp as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${humanize(k)}: ${String(v)}`)
      .join(" · ");
    if (text) blocks.push({ label: "Snowpack data", body: text });
  }
  const ot = af["observed_terrain"];
  if (typeof ot === "string" && ot.trim()) {
    blocks.push({ label: "Observed terrain", body: ot });
  }

  if (blocks.length === 0) return null;
  return (
    <Section label="Conditions">
      <View style={{ gap: 12 }}>
        {blocks.map((b) => (
          <View key={b.label}>
            <Text
              variant="mono"
              weight="medium"
              style={{
                fontSize: 10,
                letterSpacing: 1.2,
                color: palette.ink[400],
                marginBottom: 4,
              }}
            >
              {b.label.toUpperCase()}
            </Text>
            <Text
              className="text-ink-100"
              style={{ fontSize: 13, lineHeight: 19 }}
            >
              {b.body}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

function ViewExternalLink({ obs }: { obs: ObservationSummary }) {
  const url = viewerUrlForObservation(obs.centerId, obs.id);
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      style={({ pressed }) => ({
        marginTop: 4,
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 0.5,
        borderColor: palette.ink[600],
        backgroundColor: pressed ? palette.ink[700] : "transparent",
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
        VIEW ON {(obs.centerId ?? "AVALANCHE.ORG").toUpperCase()}
      </Text>
      <Ionicons name="open-outline" size={14} color={palette.ink[300]} />
    </Pressable>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text
        variant="mono"
        weight="medium"
        style={{
          fontSize: 10,
          letterSpacing: 1.4,
          color: palette.ink[400],
          marginBottom: 8,
        }}
      >
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
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

function humanize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
