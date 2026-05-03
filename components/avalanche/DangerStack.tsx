import { View } from "react-native";
import { Text } from "@/components/ui/Text";
import { dangerColors } from "@/constants/design";
import type { DangerRating } from "@/lib/api/avalanche";

interface DangerStackProps {
  danger: {
    alpine: DangerRating;
    treeline: DangerRating;
    belowTreeline: DangerRating;
  };
  size?: "compact" | "default" | "large";
  showLabels?: boolean;
}

const ELEVATION_LABELS = [
  { key: "alpine" as const, code: "ALP", name: "Alpine" },
  { key: "treeline" as const, code: "TL", name: "Near Treeline" },
  { key: "belowTreeline" as const, code: "BTL", name: "Below Treeline" },
];

export function DangerStack({
  danger,
  size = "default",
  showLabels = true,
}: DangerStackProps) {
  const dim =
    size === "compact"
      ? { rowH: 28, gap: 3, fontSize: 11, codeW: 40, fontLevel: 11, ratingW: 110 }
      : size === "large"
        ? { rowH: 52, gap: 4, fontSize: 14, codeW: 56, fontLevel: 18, ratingW: 130 }
        : { rowH: 40, gap: 3, fontSize: 13, codeW: 48, fontLevel: 14, ratingW: 110 };

  return (
    <View>
      {ELEVATION_LABELS.map((band) => {
        const rating = danger[band.key];
        const c = dangerColors[rating];
        return (
          <View
            key={band.key}
            style={{
              flexDirection: "row",
              alignItems: "stretch",
              marginBottom: dim.gap,
            }}
          >
            {showLabels ? (
              <View
                style={{
                  width: dim.codeW,
                  justifyContent: "center",
                  alignItems: "flex-end",
                  paddingRight: 8,
                }}
              >
                <Text
                  variant="mono"
                  weight="medium"
                  className="text-ink-300"
                  style={{ fontSize: dim.fontSize, letterSpacing: 1.2 }}
                >
                  {band.code}
                </Text>
              </View>
            ) : null}

            <View
              style={{
                flex: 1,
                height: dim.rowH,
                backgroundColor: c.fill,
                borderRadius: 3,
                paddingLeft: 10,
                paddingRight: 10,
                flexDirection: "row",
                alignItems: "center",
                borderWidth: rating === "EXTREME" ? 1 : 0,
                borderColor: rating === "EXTREME" ? "#ED1C24" : "transparent",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  variant="mono"
                  weight="bold"
                  style={{
                    color: c.ink,
                    fontSize: dim.fontLevel,
                    letterSpacing: 1.4,
                  }}
                >
                  {c.label}
                </Text>
              </View>
              {rating !== "NO_RATING" ? (
                <View style={{ width: dim.ratingW * 0.18, alignItems: "flex-end" }}>
                  <Text
                    variant="mono"
                    weight="bold"
                    style={{ color: c.ink, fontSize: dim.fontLevel, opacity: 0.7 }}
                  >
                    {c.level}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
