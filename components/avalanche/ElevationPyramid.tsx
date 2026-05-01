import { View } from "react-native";
import { Text } from "@/components/ui/Text";
import { dangerColors } from "@/constants/design";
import type { DangerRating } from "@/lib/api/avalanche";

interface ElevationPyramidProps {
  danger: {
    alpine: DangerRating;
    treeline: DangerRating;
    belowTreeline: DangerRating;
  };
  size?: "small" | "normal";
}

export function ElevationPyramid({
  danger,
  size = "normal",
}: ElevationPyramidProps) {
  const isSmall = size === "small";
  const dimensions = {
    alpine: isSmall ? 28 : 38,
    treeline: isSmall ? 44 : 58,
    below: isSmall ? 60 : 78,
    height: isSmall ? 12 : 16,
    fontSize: isSmall ? 7 : 9,
  };

  const Slab = ({
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
    const c = dangerColors[rating];
    return (
      <View
        style={{
          width,
          height: dimensions.height,
          backgroundColor: c.fill,
          borderTopLeftRadius: radius?.top ? 3 : 0,
          borderTopRightRadius: radius?.top ? 3 : 0,
          borderBottomLeftRadius: radius?.bottom ? 3 : 0,
          borderBottomRightRadius: radius?.bottom ? 3 : 0,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: rating === "EXTREME" ? 0.5 : 0,
          borderColor: "#ED1C24",
        }}
      >
        <Text
          variant="mono"
          weight="bold"
          style={{
            fontSize: dimensions.fontSize,
            color: c.ink,
            letterSpacing: 0.6,
          }}
        >
          {label}
        </Text>
      </View>
    );
  };

  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <Slab
        width={dimensions.alpine}
        rating={danger.alpine}
        label="A"
        radius={{ top: true }}
      />
      <Slab
        width={dimensions.treeline}
        rating={danger.treeline}
        label="TL"
      />
      <Slab
        width={dimensions.below}
        rating={danger.belowTreeline}
        label="B"
        radius={{ bottom: true }}
      />
    </View>
  );
}
