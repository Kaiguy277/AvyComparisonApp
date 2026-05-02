import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { palette } from "@/constants/design";
import type { AvalancheProblem } from "@/lib/api/avalanche";

function formatSize(value: number): string {
  return `D${value}`;
}

interface Props {
  problem: AvalancheProblem;
}

export function AvalancheProblemCard({ problem }: Props) {
  const hasAspects = problem.aspects && problem.aspects.length > 0;
  return (
    <View
      className="rounded-xl"
      style={{
        backgroundColor: palette.ink[900],
        padding: 14,
        borderWidth: 0.5,
        borderColor: palette.ink[700],
      }}
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text
          variant="display"
          className="text-ink-50 flex-1"
          style={{ fontSize: 17, lineHeight: 22 }}
        >
          {problem.name}
        </Text>
        {problem.likelihood ? (
          <Badge variant="aspen">{problem.likelihood}</Badge>
        ) : null}
      </View>

      {problem.size ? (
        <View className="flex-row items-baseline gap-2 mt-2">
          <Text
            variant="mono"
            className="text-ink-400"
            style={{ fontSize: 9, letterSpacing: 1.4 }}
          >
            SIZE
          </Text>
          <Text
            variant="mono"
            weight="medium"
            className="text-ink-100"
            style={{ fontSize: 12 }}
          >
            {problem.size.min === problem.size.max
              ? formatSize(problem.size.min)
              : `${formatSize(problem.size.min)} → ${formatSize(problem.size.max)}`}
          </Text>
        </View>
      ) : null}

      {hasAspects ? (
        <View className="mt-3">
          <View className="flex-row items-center gap-1.5 mb-2">
            <Ionicons
              name="compass-outline"
              size={11}
              color={palette.ink[400]}
            />
            <Text
              variant="mono"
              className="text-ink-400"
              style={{ fontSize: 9, letterSpacing: 1.4 }}
            >
              ASPECT · ELEVATION
            </Text>
          </View>
          <View className="gap-1">
            {problem.aspects.map((a, i) => (
              <View key={i} className="flex-row items-baseline gap-2">
                <Text
                  variant="mono"
                  weight="medium"
                  className="text-ink-200"
                  style={{ fontSize: 11, width: 70 }}
                >
                  {a.elevation.toUpperCase()}
                </Text>
                <Text
                  className="text-ink-300 flex-1"
                  style={{ fontSize: 12, lineHeight: 17 }}
                >
                  {a.aspects.length === 8 ? "All aspects" : a.aspects.join(" · ")}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {problem.problemDescription ? (
        <View
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 0.5,
            borderColor: palette.ink[700],
          }}
        >
          <Text
            variant="mono"
            weight="medium"
            className="text-ink-400"
            style={{ fontSize: 9, letterSpacing: 1.4, marginBottom: 6 }}
          >
            ABOUT THIS PROBLEM
          </Text>
          <Text
            variant="display-italic"
            className="text-ink-300"
            style={{ fontSize: 13, lineHeight: 19 }}
          >
            {problem.problemDescription}
          </Text>
        </View>
      ) : null}

      {problem.discussion ? (
        <View
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 0.5,
            borderColor: palette.ink[700],
          }}
        >
          <Text
            variant="mono"
            weight="medium"
            className="text-aspen-400"
            style={{ fontSize: 9, letterSpacing: 1.4, marginBottom: 6 }}
          >
            FORECASTER NOTES · THIS ZONE
          </Text>
          <Text
            className="text-ink-100"
            style={{ fontSize: 13, lineHeight: 20 }}
          >
            {problem.discussion}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
