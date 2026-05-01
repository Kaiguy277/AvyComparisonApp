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
          className="text-ink-300"
          style={{ fontSize: 12, letterSpacing: 2 }}
        >
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          marginTop: 6,
          gap: 10,
        }}
      >
        <Text
          variant="mono"
          weight="bold"
          style={{ color: c.fill, fontSize: 52, letterSpacing: -1, lineHeight: 54 }}
        >
          {c.level || "—"}
        </Text>
        <Text
          variant="display"
          style={{
            color: c.fill,
            fontSize: 28,
            letterSpacing: 0,
            lineHeight: 32,
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
