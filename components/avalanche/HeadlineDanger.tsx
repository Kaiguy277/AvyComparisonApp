import { View } from "react-native";
import { Text } from "@/components/ui/Text";
import { dangerColors } from "@/constants/design";
import type { DangerRating, ElevationDanger } from "@/lib/api/avalanche";

function highestRating(d: ElevationDanger): DangerRating {
  const order: DangerRating[] = [
    "NO_RATING",
    "LOW",
    "MODERATE",
    "CONSIDERABLE",
    "HIGH",
    "EXTREME",
  ];
  const arr = [d.alpine, d.treeline, d.belowTreeline];
  return arr.reduce((best, cur) =>
    order.indexOf(cur) > order.indexOf(best) ? cur : best,
  );
}

interface Props {
  danger: ElevationDanger;
  label?: string;
  size?: "compact" | "default";
}

export function HeadlineDanger({ danger, label, size = "compact" }: Props) {
  const top = highestRating(danger);
  const c = dangerColors[top];
  const dim =
    size === "default"
      ? { numeral: 52, label: 28, labelLine: 32, labelGap: 2 }
      : { numeral: 40, label: 18, labelLine: 22, labelGap: 4 };

  return (
    <View>
      {label ? (
        <Text
          variant="mono"
          weight="medium"
          className="text-ink-300"
          style={{ fontSize: 11, letterSpacing: 1.8 }}
        >
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          marginTop: 4,
          gap: 8,
        }}
      >
        <Text
          variant="mono"
          weight="bold"
          style={{
            color: c.fill,
            fontSize: dim.numeral,
            letterSpacing: -1,
            lineHeight: dim.numeral + 2,
          }}
        >
          {c.level || "—"}
        </Text>
        <Text
          variant="display"
          style={{
            color: c.fill,
            fontSize: dim.label,
            letterSpacing: 0,
            lineHeight: dim.labelLine,
          }}
        >
          {top === "NO_RATING" ? "No rating" : titleCase(c.label)}
        </Text>
      </View>
    </View>
  );
}

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
