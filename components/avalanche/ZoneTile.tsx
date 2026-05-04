import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/Text";
import { MountainDanger } from "./MountainDanger";
import { dangerColors, freshness, palette } from "@/constants/design";
import type {
  AvalancheZone,
  DangerRating,
  ElevationDanger,
} from "@/lib/api/avalanche";

const RATING_ORDER: DangerRating[] = [
  "NO_RATING",
  "LOW",
  "MODERATE",
  "CONSIDERABLE",
  "HIGH",
  "EXTREME",
];

function highest(d: ElevationDanger): DangerRating {
  return [d.alpine, d.treeline, d.belowTreeline].reduce((b, c) =>
    RATING_ORDER.indexOf(c) > RATING_ORDER.indexOf(b) ? c : b,
  );
}

interface Props {
  zone: AvalancheZone;
}

// One zone in the 2-column grid. Tap navigates to the zone detail
// screen. Visual workhorse is the mountain glyph; the numeral and the
// freshness dot give the disambiguating reads (color similarity at small
// sizes; how stale the forecast is).
export function ZoneTile({ zone }: Props) {
  const router = useRouter();
  const today = zone.forecast?.[0];
  const headlineRating = today ? highest(today.danger) : "NO_RATING";
  const c = dangerColors[headlineRating];
  const fresh = freshness[zone.freshness.status];

  const onPress = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push({ pathname: "/zone/[zoneId]", params: { zoneId: zone.id } });
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        backgroundColor: palette.ink[900],
        borderWidth: 0.5,
        borderColor: palette.ink[700],
        borderRadius: 14,
        padding: 14,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {/* Header row: zone name + freshness dot */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 6,
          marginBottom: 12,
          minHeight: 36,
        }}
      >
        <Text
          variant="display"
          className="text-ink-50"
          style={{
            flex: 1,
            fontSize: 15,
            lineHeight: 18,
          }}
          numberOfLines={2}
        >
          {zone.name}
        </Text>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: fresh.fill,
            marginTop: 6,
          }}
        />
      </View>

      {/* Mountain glyph centered — the at-a-glance visual */}
      <View style={{ alignItems: "center", marginVertical: 4 }}>
        {today ? (
          <MountainDanger danger={today.danger} size={88} />
        ) : (
          <View
            style={{
              width: 88,
              height: 70,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              variant="mono"
              className="text-ink-400"
              style={{ fontSize: 11, letterSpacing: 1 }}
            >
              NO RATING
            </Text>
          </View>
        )}
      </View>

      {/* Numeral + word — disambiguates the colors when they're close */}
      {today ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "center",
            gap: 6,
            marginTop: 10,
          }}
        >
          <Text
            variant="mono"
            weight="bold"
            style={{
              fontSize: 22,
              lineHeight: 24,
              color: c.fill,
              letterSpacing: -0.5,
            }}
          >
            {c.level || "—"}
          </Text>
          <Text
            variant="display"
            style={{
              fontSize: 14,
              lineHeight: 18,
              color: c.fill,
            }}
          >
            {headlineRating === "NO_RATING"
              ? "—"
              : c.label.charAt(0) + c.label.slice(1).toLowerCase()}
          </Text>
        </View>
      ) : null}

      {/* Optional bottom meta row: problem count when populated */}
      {zone.problems && zone.problems.length > 0 ? (
        <Text
          variant="mono"
          className="text-ink-400"
          style={{
            fontSize: 9,
            letterSpacing: 1.2,
            textAlign: "center",
            marginTop: 10,
          }}
        >
          {zone.problems.length} PROBLEM{zone.problems.length === 1 ? "" : "S"}
        </Text>
      ) : null}
    </Pressable>
  );
}
