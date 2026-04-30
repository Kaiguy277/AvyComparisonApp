import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { AvalancheProblem } from "@/lib/api/avalanche";
import { Badge } from "@/components/ui/Badge";

function formatSize(value: number): string {
  return `D${value}`;
}

interface Props {
  problem: AvalancheProblem;
}

export function AvalancheProblemCard({ problem }: Props) {
  const hasAspects = problem.aspects && problem.aspects.length > 0;
  return (
    <View className="p-3 rounded-lg border border-border bg-muted/40">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="text-sm font-medium text-foreground flex-1">
          {problem.name}
        </Text>
        {problem.likelihood ? (
          <Badge variant="outline">{problem.likelihood}</Badge>
        ) : null}
      </View>

      {problem.size ? (
        <Text className="text-xs text-muted-foreground mt-2">
          <Text className="font-medium text-foreground">Size: </Text>
          {problem.size.min === problem.size.max
            ? formatSize(problem.size.min)
            : `${formatSize(problem.size.min)} to ${formatSize(problem.size.max)}`}
        </Text>
      ) : null}

      {hasAspects ? (
        <View className="mt-2">
          <View className="flex-row items-center gap-1">
            <Ionicons name="compass-outline" size={12} color="#6b7280" />
            <Text className="text-xs font-medium text-muted-foreground">
              Elevation & Aspect
            </Text>
          </View>
          <View className="pl-4 mt-1">
            {problem.aspects.map((a, i) => (
              <Text key={i} className="text-xs text-muted-foreground">
                <Text className="font-medium text-foreground/80">{a.elevation}: </Text>
                {a.aspects.length === 8 ? "All aspects" : a.aspects.join(", ")}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {problem.discussion ? (
        <Text className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
          {problem.discussion}
        </Text>
      ) : null}
    </View>
  );
}
