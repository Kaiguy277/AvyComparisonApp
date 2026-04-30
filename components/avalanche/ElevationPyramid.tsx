import { View, Text } from "react-native";
import type { DangerRating } from "@/lib/api/avalanche";
import { dangerColors } from "./dangerColors";

interface ElevationPyramidProps {
  danger: {
    alpine: DangerRating;
    treeline: DangerRating;
    belowTreeline: DangerRating;
  };
  size?: "small" | "normal";
}

export function ElevationPyramid({ danger, size = "normal" }: ElevationPyramidProps) {
  const isSmall = size === "small";
  const alpineWidth = isSmall ? 24 : 32;
  const treelineWidth = isSmall ? 36 : 48;
  const belowWidth = isSmall ? 48 : 64;
  const height = isSmall ? 12 : 16;
  const fontSize = isSmall ? 7 : 9;

  const Stripe = ({
    width,
    rating,
    label,
    radius,
  }: {
    width: number;
    rating: DangerRating;
    label: string;
    radius?: { top?: boolean; bottom?: boolean };
  }) => {
    const c = dangerColors[rating] ?? dangerColors.NO_RATING;
    return (
      <View
        style={{
          width,
          height,
          backgroundColor: c.hex,
          borderTopLeftRadius: radius?.top ? 4 : 0,
          borderTopRightRadius: radius?.top ? 4 : 0,
          borderBottomLeftRadius: radius?.bottom ? 4 : 0,
          borderBottomRightRadius: radius?.bottom ? 4 : 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize,
            fontWeight: "700",
            color: rating === "MODERATE" || rating === "NO_RATING" ? "#000" : "#fff",
          }}
        >
          {label}
        </Text>
      </View>
    );
  };

  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <Stripe width={alpineWidth} rating={danger.alpine} label="A" radius={{ top: true }} />
      <Stripe width={treelineWidth} rating={danger.treeline} label="TL" />
      <Stripe
        width={belowWidth}
        rating={danger.belowTreeline}
        label="BTL"
        radius={{ bottom: true }}
      />
    </View>
  );
}
