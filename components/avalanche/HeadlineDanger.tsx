import { View } from "react-native";
import { Text } from "@/components/ui/Text";
import { dangerColors } from "@/constants/design";
import type { DangerRating, ElevationDanger } from "@/lib/api/avalanche";

// The "headline" rating: highest of the three elevation bands.
// Big, mono, color-flooded — what the user sees first when scanning.
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
  label?: string; // e.g. "TODAY" or "TOMORROW"
}

export function HeadlineDanger({ danger, label }: Props) {
  const top = highestRating(danger);
  const c = dangerColors[top];
  return (
    <View>
      {label ? (
        <Text
          variant="mono"
          weight="medium"
          className="text-ink-400"
          style={{ fontSize: 10, letterSpacing: 1.6 }}
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
          style={{ color: c.fill, fontSize: 36, letterSpacing: -0.5, lineHeight: 38 }}
        >
          {c.level || "—"}
        </Text>
        <Text
          variant="display"
          style={{
            color: c.fill,
            fontSize: 22,
            letterSpacing: 0.2,
            lineHeight: 24,
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
