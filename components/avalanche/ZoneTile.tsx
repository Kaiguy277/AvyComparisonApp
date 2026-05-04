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

interface Props {
  zone: AvalancheZone;
}

const ELEVATIONS: { key: keyof ElevationDanger; label: string }[] = [
  { key: "alpine", label: "ALP" },
  { key: "treeline", label: "TL" },
  { key: "belowTreeline", label: "BTL" },
];

function startCase(s: string): string {
  if (!s) return s;
  return s.charAt(0) + s.slice(1).toLowerCase();
}

// Color the freshness word by status. Green for current is intentionally
// muted (the calm state); aspen + red carry the alert weight.
function freshnessColor(status: keyof typeof freshness): string {
  if (status === "expired") return "#FCA5A5";
  if (status === "expiring") return palette.aspen[400];
  if (status === "recent") return palette.frost[400];
  if (status === "unknown") return palette.ink[400];
  return "#52BA4A"; // current
}

// One zone in the home grid. Tap → /zone/[zoneId]. Carries every
// at-a-glance signal the prior stacked card had: per-elevation
// rating with number+word, freshness word, problem names listed
// (not just counted), issued/expires dates.
export function ZoneTile({ zone }: Props) {
  const router = useRouter();
  const today = zone.forecast?.[0];
  const fresh = freshness[zone.freshness.status];

  const onPress = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push({ pathname: "/zone/[zoneId]", params: { zoneId: zone.id } });
  };

  const headlineRating = today
    ? ([today.danger.alpine, today.danger.treeline, today.danger.belowTreeline].reduce(
        (b, c) =>
          (
            ["NO_RATING", "LOW", "MODERATE", "CONSIDERABLE", "HIGH", "EXTREME"] as DangerRating[]
          ).indexOf(c) >
          (
            ["NO_RATING", "LOW", "MODERATE", "CONSIDERABLE", "HIGH", "EXTREME"] as DangerRating[]
          ).indexOf(b)
            ? c
            : b,
      ) as DangerRating)
    : ("NO_RATING" as DangerRating);
  const headlineColor = dangerColors[headlineRating].fill;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        backgroundColor: palette.ink[800],
        borderWidth: 1,
        borderColor: palette.ink[600],
        borderRadius: 14,
        overflow: "hidden",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {/* Top danger stripe — at-a-glance scan when stacked in a 2-col
          grid. Headline color is the worst rating across elevations. */}
      <View
        style={{
          height: 6,
          backgroundColor: headlineColor,
        }}
      />

      <View style={{ padding: 12 }}>

      {/* Name + freshness word */}
      <Text
        variant="display"
        className="text-ink-50"
        style={{ fontSize: 15, lineHeight: 18 }}
        numberOfLines={2}
      >
        {zone.name}
      </Text>
      <Text
        variant="mono"
        weight="bold"
        style={{
          fontSize: 10,
          letterSpacing: 1.2,
          color: freshnessColor(zone.freshness.status),
          marginTop: 4,
        }}
      >
        {fresh.label.toUpperCase()}
      </Text>

      {/* Mountain glyph + per-elevation rows side by side. The glyph
          is the visual workhorse; the rows give numerals + words for
          unambiguous read at small sizes. */}
      {today ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginTop: 14,
          }}
        >
          <MountainDanger danger={today.danger} size={66} />
          <View style={{ flex: 1, gap: 4 }}>
            {ELEVATIONS.map(({ key, label }) => {
              const r = today.danger[key] as DangerRating;
              const c = dangerColors[r];
              return (
                <View
                  key={key}
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    gap: 4,
                  }}
                >
                  <Text
                    variant="mono"
                    weight="medium"
                    style={{
                      fontSize: 9,
                      letterSpacing: 1,
                      color: palette.ink[400],
                      width: 22,
                    }}
                  >
                    {label}
                  </Text>
                  <Text
                    variant="mono"
                    weight="bold"
                    style={{
                      fontSize: 12,
                      color: c.fill,
                      letterSpacing: -0.2,
                      width: 12,
                    }}
                  >
                    {c.level || "—"}
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 11,
                      color: c.fill,
                    }}
                    numberOfLines={1}
                  >
                    {r === "NO_RATING" ? "—" : startCase(c.label)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <View
          style={{
            marginTop: 14,
            paddingVertical: 16,
            alignItems: "center",
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

      {/* Problem names listed — not just a count. Caps, dot-separated
          inline, wrap as needed. */}
      {zone.problems && zone.problems.length > 0 ? (
        <View style={{ marginTop: 12 }}>
          <Text
            variant="mono"
            weight="bold"
            style={{
              fontSize: 9,
              letterSpacing: 1.2,
              color: palette.ink[400],
              marginBottom: 4,
            }}
          >
            PROBLEMS
          </Text>
          {zone.problems.map((p, i) => (
            <Text
              key={i}
              style={{
                fontSize: 11,
                lineHeight: 15,
                color: palette.ink[200],
              }}
              numberOfLines={1}
            >
              {p.name}
            </Text>
          ))}
        </View>
      ) : null}

      {/* Issued + expires meta — preserve from prior card. Kept compact. */}
      {zone.freshness.issueDate || zone.freshness.expiresDate ? (
        <View style={{ marginTop: 12, gap: 2 }}>
          {zone.freshness.issueDate ? (
            <Text
              variant="mono"
              style={{
                fontSize: 9,
                letterSpacing: 0.6,
                color: palette.ink[400],
              }}
              numberOfLines={1}
            >
              ISSUED{" "}
              <Text style={{ fontSize: 9, color: palette.ink[200] }}>
                {zone.freshness.issueDate}
              </Text>
            </Text>
          ) : null}
          {zone.freshness.expiresDate ? (
            <Text
              variant="mono"
              style={{
                fontSize: 9,
                letterSpacing: 0.6,
                color: palette.ink[400],
              }}
              numberOfLines={1}
            >
              EXPIRES{" "}
              <Text
                style={{
                  fontSize: 9,
                  color:
                    zone.freshness.status === "expired"
                      ? "#FCA5A5"
                      : zone.freshness.status === "expiring"
                        ? palette.aspen[400]
                        : palette.ink[200],
                }}
              >
                {zone.freshness.expiresDate}
              </Text>
            </Text>
          ) : null}
        </View>
      ) : null}
      </View>
    </Pressable>
  );
}
